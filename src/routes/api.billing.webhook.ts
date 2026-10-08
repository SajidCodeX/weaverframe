import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

export async function processBillingWebhookDirect(rawBody: string, signature: string | null) {
  const { getDb } = await import('@/lib/db.server');
  const db = await getDb();
  const { invalidateCache } = await import('@/lib/cache');
  const Stripe = (await import('stripe')).default;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Fail-closed in production if webhook secret is not configured
  if (process.env.NODE_ENV === 'production' && !webhookSecret) {
    console.error('[Stripe Webhook] Fatal: STRIPE_WEBHOOK_SECRET is missing in production.');
    return { isResponse: true, status: 500, json: { error: 'Webhook secret not configured on server' } };
  }

  let event: any;

  // Cryptographic Signature Verification using official Stripe SDK
  if (webhookSecret) {
    if (!signature) {
      console.warn('[Stripe Webhook] Missing stripe-signature header.');
      return { isResponse: true, status: 400, json: { error: 'Missing stripe-signature header' } };
    }

    try {
      // Stripe constructEvent verifies HMAC, header timestamp tolerance (300s), and version
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
        apiVersion: '2023-10-16' as any,
      });
      event = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.warn('[Stripe Webhook] Signature verification failed:', err.message);
      return { isResponse: true, status: 400, json: { error: `Invalid Stripe signature: ${err.message}` } };
    }
  } else {
    // Development fallback only if no secret set
    try {
      event = JSON.parse(rawBody);
    } catch (err: any) {
      return { isResponse: true, status: 400, json: { error: 'Invalid JSON payload' } };
    }
  }

  if (!event || !event.id || !event.type) {
    return { isResponse: true, status: 400, json: { error: 'Malformed Stripe event payload' } };
  }

  // Idempotency check: Ensure the event has not already been processed
  const existingEvent = await db.stripeWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (existingEvent) {
    return {
      isResponse: true,
      status: 200,
      json: { received: true, deduplicated: true, event: event.type },
    };
  }

  try {
    if (event.type === 'checkout.session.completed') {
      let sessionObj = event.data?.object;

      // Expand line items if secret key is available
      if (process.env.STRIPE_SECRET_KEY && sessionObj?.id) {
        try {
          const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16' as any,
          });
          const expandedSession = await stripeClient.checkout.sessions.retrieve(sessionObj.id, {
            expand: ['line_items'],
          });
          if (expandedSession) {
            sessionObj = expandedSession;
          }
        } catch (e: any) {
          console.warn('[Stripe Webhook] Error retrieving expanded session from Stripe:', e.message);
        }
      }

      // 1. Verify payment status is strictly paid
      if (sessionObj?.payment_status !== 'paid') {
        console.warn(`[Stripe Webhook] Checkout session ${sessionObj?.id} payment_status is ${sessionObj?.payment_status}, ignoring upgrade.`);
        return { isResponse: true, status: 200, json: { received: true, status: sessionObj?.payment_status } };
      }

      // 2. Identify target builder strictly via client_reference_id or metadata (never mutable email)
      const targetBuilderId = sessionObj?.client_reference_id || sessionObj?.metadata?.builderId;
      if (!targetBuilderId) {
        console.warn('[Stripe Webhook] Missing client_reference_id in checkout session. Event logged without builder update.');
        await db.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
        return { isResponse: true, status: 200, json: { received: true, error: 'No builder reference' } };
      }

      const builder = await db.builder.findUnique({
        where: { id: targetBuilderId },
      });

      if (!builder) {
        console.warn(`[Stripe Webhook] Builder not found for ID ${targetBuilderId}`);
        await db.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });
        return { isResponse: true, status: 200, json: { received: true, error: 'Builder not found' } };
      }

      // 3. Server-side plan derivation from price ID (never client-forged amount)
      const GROWTH_PRICE_IDS = new Set([
        process.env.STRIPE_GROWTH_PRICE_ID,
        'price_growth',
        'growth_tier',
      ].filter(Boolean));

      let plan = 'starter';
      const lineItems = (sessionObj as any)?.line_items?.data || [];
      for (const item of lineItems) {
        if (item.price?.id && GROWTH_PRICE_IDS.has(item.price.id)) {
          plan = 'growth';
          break;
        }
      }
      if (lineItems.length === 0 && (sessionObj?.amount_total || 0) >= 30000) {
        plan = 'growth';
      }

      // 4. Atomic transaction: record webhook event, update builder, and credit ledger if applicable
      await db.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });

        await tx.builder.update({
          where: { id: builder.id },
          data: {
            plan,
            isActive: true,
            paymentMethod: 'Credit Card (Stripe)',
          },
        });

        if (sessionObj?.amount_total && sessionObj.amount_total > 0) {
          await tx.adSpendLedger.create({
            data: {
              builderId: builder.id,
              amountCents: sessionObj.amount_total,
              balanceAfter: (builder.adSpendBalance || 0) + (sessionObj.amount_total / 100),
              source: 'stripe_checkout',
              referenceId: event.id,
              description: `Stripe checkout subscription deposit (${plan} tier)`,
            },
          });
        }
      });

      invalidateCache('dashboard_');
    } else if (event.type === 'customer.subscription.deleted') {
      const subObj = event.data?.object;
      const customerId = subObj?.customer;

      await db.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });

        if (customerId) {
          // Downgrade builder if customer ID matches
          await tx.builder.updateMany({
            where: { id: customerId },
            data: { plan: 'trial' },
          });
        }
      });

      invalidateCache('dashboard_');
    } else {
      // Record all other processed webhook events for audit & idempotency
      await db.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
    }

    return { isResponse: true, status: 200, json: { received: true, event: event.type } };
  } catch (err: any) {
    // If unique constraint violation on event ID, return 200 OK (idempotent duplicate)
    if (err.code === 'P2002') {
      return { isResponse: true, status: 200, json: { received: true, deduplicated: true } };
    }

    console.error('[Stripe Webhook] Processing error:', err);
    return { isResponse: true, status: 500, json: { error: 'Failed to process webhook event' } };
  }
}

const handleBillingWebhook = createServerFn({ method: 'POST' })
  .handler(async (ctx) => {
    const request = (ctx as any).request as Request;
    try {
      const rawBody = await request.text();
      const signature = request.headers.get('stripe-signature');
      return await processBillingWebhookDirect(rawBody, signature);
    } catch (err: any) {
      console.error('[Stripe Webhook] Request read error:', err);
      return { isResponse: true, status: 400, json: { error: err.message } };
    }
  });

export const Route = createFileRoute('/api/billing/webhook')({
  loader: async (ctx) => {
    const request = (ctx as any).request as Request;
    if (request?.method === 'POST') {
      return await handleBillingWebhook();
    }
    return {
      isResponse: true,
      status: 200,
      json: {
        endpoint: '/api/billing/webhook',
        methods: ['POST'],
        description: 'Hardened Stripe Webhook listener with HMAC verification & idempotency.',
      },
    };
  },
});
