import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

const handleBillingWebhook = createServerFn({ method: 'POST' })
  .handler(async (ctx) => {
    const request = (ctx as any).request as Request;
    const { getDb } = await import('@/lib/db.server');
    const db = await getDb();
    const { invalidateCache } = await import('@/lib/cache');
    const crypto = await import('crypto');

    try {
      const rawBody = await request.text();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const signature = request.headers.get('stripe-signature');

      // Verify Stripe signature if secret is configured in production
      if (webhookSecret && signature) {
        const parts = signature.split(',');
        const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
        const v1Sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];

        if (timestamp && v1Sig) {
          const payload = `${timestamp}.${rawBody}`;
          const expectedSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

          if (expectedSig !== v1Sig) {
            console.warn('[Stripe Webhook] Invalid signature verification attempt.');
            return { isResponse: true, status: 400, json: { error: 'Invalid Stripe signature' } };
          }
        }
      }

      const event = JSON.parse(rawBody);

      if (event.type === 'checkout.session.completed') {
        const sessionObj = event.data?.object;
        const builderId = sessionObj?.client_reference_id;
        const amountTotal = sessionObj?.amount_total;
        const customerEmail = sessionObj?.customer_email || sessionObj?.customer_details?.email;

        if (builderId) {
          // 34900 cents = $349 growth tier, 14900 cents = $149 starter tier
          const plan = amountTotal >= 30000 ? 'growth' : 'starter';
          await db.builder.update({
            where: { id: builderId },
            data: {
              plan,
              isActive: true,
              paymentMethod: 'Credit Card (Stripe)',
            }
          });
          invalidateCache('dashboard_');
        } else if (customerEmail) {
          const plan = amountTotal >= 30000 ? 'growth' : 'starter';
          await db.builder.updateMany({
            where: { email: customerEmail },
            data: {
              plan,
              isActive: true,
              paymentMethod: 'Credit Card (Stripe)',
            }
          });
          invalidateCache('dashboard_');
        }
      }

      if (event.type === 'invoice.payment_succeeded') {
        const invoiceObj = event.data?.object;
        const customerEmail = invoiceObj?.customer_email;
        if (customerEmail) {
          await db.builder.updateMany({
            where: { email: customerEmail },
            data: { isActive: true }
          });
          invalidateCache('dashboard_');
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subObj = event.data?.object;
        const customerId = subObj?.customer;
        // Downgrade to trial if subscription canceled
        if (customerId) {
          await db.builder.updateMany({
            where: { id: customerId },
            data: { plan: 'trial' }
          });
          invalidateCache('dashboard_');
        }
      }

      return { isResponse: true, status: 200, json: { received: true, event: event.type } };
    } catch (err: any) {
      console.error('Stripe webhook error:', err);
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
        description: 'Stripe Webhook listener for subscription checkout and payment renewals.'
      }
    };
  },
});
