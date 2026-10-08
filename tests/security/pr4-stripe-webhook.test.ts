import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { processBillingWebhookDirect } from '../../src/routes/api.billing.webhook';
import { getDb } from '../../src/lib/db.server';

function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('Security Finding 4.1: Stripe Webhook Complete Hardening & Idempotency', async (t) => {
  const testSecret = 'whsec_test_secret_for_hardening_verification_1234567890';
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = testSecret;

  t.after(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  const db = await getDb();
  const builder = await db.builder.findFirst({ where: { isActive: true } });
  assert.ok(builder, 'Active builder required for Stripe webhook test');

  await t.test('1. Missing signature header is rejected with 400 Bad Request', async () => {
    const res = await processBillingWebhookDirect('{}', null);
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing stripe-signature/);
  });

  await t.test('2. Tampered / invalid signature is rejected with 400 Bad Request', async () => {
    const payload = JSON.stringify({ id: 'evt_tampered', type: 'test' });
    const invalidSignature = 't=12345,v1=bad_signature_digest';
    const res = await processBillingWebhookDirect(payload, invalidSignature);
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid Stripe signature/);
  });

  await t.test('3. Valid signature is accepted, verified, and executes idempotently', async () => {
    const eventId = `evt_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${Date.now()}`,
          client_reference_id: builder.id,
          payment_status: 'paid',
          amount_total: 34900,
          mode: 'subscription',
        },
      },
    });

    const signature = generateStripeSignature(payload, testSecret);

    // First call -> Processes successfully and creates StripeWebhookEvent
    const res1 = await processBillingWebhookDirect(payload, signature);
    assert.equal(res1.status, 200);
    assert.equal(res1.json.received, true);

    // Verify StripeWebhookEvent exists in DB
    const eventInDb = await db.stripeWebhookEvent.findUnique({
      where: { id: eventId },
    });
    assert.ok(eventInDb, 'Event must be recorded in StripeWebhookEvent table');

    // Second call with same event ID -> Idempotency kicks in, returns 200 with deduplicated: true
    const res2 = await processBillingWebhookDirect(payload, signature);
    assert.equal(res2.status, 200);
    assert.equal(res2.json.deduplicated, true);

    // Clean up test event record
    await db.stripeWebhookEvent.delete({ where: { id: eventId } }).catch(() => {});
  });
});
