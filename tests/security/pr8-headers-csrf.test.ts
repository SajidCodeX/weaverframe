import test from 'node:test';
import assert from 'node:assert/strict';
import server from '../../src/server';

test('Security PR-8: Security Headers & CSRF Origin Protection', async (t) => {
  await t.test('Mutating POST request from evil.com is blocked with 403 Forbidden', async () => {
    const req = new Request('http://localhost:8080/api/dashboard/settings', {
      method: 'POST',
      headers: {
        'Origin': 'https://evil.attacker.com',
        'Host': 'localhost:8080',
      },
    });

    const res = await server.fetch(req, {}, {});
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'CSRF Origin Verification Failed');
  });

  await t.test('Webhook routes are exempt from CSRF Origin check', async () => {
    const webhookReq = new Request('http://localhost:8080/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Origin': 'https://hooks.stripe.com',
        'Host': 'localhost:8080',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: 'evt_test', type: 'test' }),
    });

    const res = await server.fetch(webhookReq, {}, {});
    // Should NOT be 403 CSRF blocked (it may be 400 due to invalid signature, but not 403 CSRF)
    assert.notEqual(res.status, 403);
  });

  await t.test('Security response headers (nosniff, DENY, CSP) are attached to responses', async () => {
    const req = new Request('http://localhost:8080/api/auth-sink');
    const res = await server.fetch(req, {}, {});

    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.ok(res.headers.get('permissions-policy'));
    assert.ok(res.headers.get('content-security-policy-report-only'));
  });
});
