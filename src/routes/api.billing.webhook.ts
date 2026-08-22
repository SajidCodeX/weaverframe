import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

const handleBillingWebhook = createServerFn({ method: 'POST' })
  .handler(async (ctx) => {
    const request = (ctx as any).request as Request;
    const { db } = await import('@/lib/db');
    const { invalidateCache } = await import('@/lib/dashboard');

    try {
      const rawBody = await request.text();
      const event = JSON.parse(rawBody);

      if (event.type === 'checkout.session.completed') {
        const sessionObj = event.data?.object;
        const builderId = sessionObj?.client_reference_id;
        const amountTotal = sessionObj?.amount_total;

        if (builderId) {
          // Determine tier based on amount
          const plan = amountTotal >= 70000 ? 'enterprise' : 'professional';
          await db.builder.update({
            where: { id: builderId },
            data: {
              plan,
              isActive: true,
            }
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

      return { isResponse: true, status: 200, json: { received: true } };
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
