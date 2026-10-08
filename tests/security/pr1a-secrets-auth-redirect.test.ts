import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';
import { runInServerContext, createMockRequest } from '../test-utils';

describe('PR-1a Security Tests: Secret Hooks, LLM Auth Gate, Open Redirect Mitigation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Webhook HMAC Secret Hardening (Finding 3.1)', () => {
    test('generatePlatformToken throws fatal error when WEBHOOK_HMAC_ROOT is missing', async () => {
      delete process.env.WEBHOOK_HMAC_ROOT;
      delete process.env.SESSION_SECRET;
      delete process.env.ENCRYPTION_KEY;

      const { generatePlatformToken } = await import('../../src/lib/webhook-tokens.server');
      assert.throws(
        () => generatePlatformToken('builder_123', 'wordpress'),
        (err: any) => {
          return err instanceof Error && err.message.includes('WEBHOOK_HMAC_ROOT');
        },
        'Expected generatePlatformToken to throw when secret is missing'
      );
    });

    test('generatePlatformToken throws when WEBHOOK_HMAC_ROOT is too short (< 32 chars)', async () => {
      process.env.WEBHOOK_HMAC_ROOT = 'short_secret_under_32_chars';
      delete process.env.SESSION_SECRET;
      delete process.env.ENCRYPTION_KEY;

      const { generatePlatformToken } = await import('../../src/lib/webhook-tokens.server');
      assert.throws(
        () => generatePlatformToken('builder_123', 'wordpress'),
        (err: any) => {
          return err instanceof Error && err.message.includes('32 characters');
        }
      );
    });

    test('generatePlatformToken and verifyPlatformToken work securely with valid secret', async () => {
      process.env.WEBHOOK_HMAC_ROOT = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const { generatePlatformToken, verifyPlatformToken } = await import('../../src/lib/webhook-tokens.server');
      const token = generatePlatformToken('builder_test_1', 'wordpress');
      assert.ok(token.startsWith('wf_'), 'Token must start with wf_');

      const verified = verifyPlatformToken(token, [{ id: 'builder_test_1', isActive: true }]);
      assert.ok(verified, 'Verification must succeed for valid active builder');
      assert.strictEqual(verified?.builderId, 'builder_test_1');
      assert.strictEqual(verified?.platform, 'wordpress');

      // Tampered token must fail
      const tampered = token.slice(0, -4) + 'abcd';
      const tamperedResult = verifyPlatformToken(tampered, [{ id: 'builder_test_1', isActive: true }]);
      assert.strictEqual(tamperedResult, null, 'Tampered token must be rejected');
    });
  });

  describe('2. Google OAuth State Secret Hardening (Finding 3.1)', () => {
    test('signOAuthState throws fatal error when GOOGLE_OAUTH_STATE_SECRET is missing', async () => {
      delete process.env.GOOGLE_OAUTH_STATE_SECRET;
      delete process.env.SESSION_SECRET;
      delete process.env.ENCRYPTION_KEY;

      const { signOAuthState } = await import('../../src/lib/google-oauth.server');
      assert.throws(
        () => signOAuthState({ builderId: 'b_123', ts: Date.now(), nonce: 'abc' }),
        (err: any) => {
          return err instanceof Error && err.message.includes('GOOGLE_OAUTH_STATE_SECRET');
        }
      );
    });

    test('signOAuthState and verifyOAuthState work securely with valid secret', async () => {
      process.env.GOOGLE_OAUTH_STATE_SECRET = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

      const { signOAuthState, verifyOAuthState } = await import('../../src/lib/google-oauth.server');
      const state = signOAuthState({ builderId: 'b_test', ts: Date.now(), nonce: 'xyz123' });
      assert.ok(state.includes('.'), 'State must be signed with HMAC delimiter');

      const payload = verifyOAuthState(state);
      assert.ok(payload, 'Valid state must verify');
      assert.strictEqual(payload?.builderId, 'b_test');

      // Tampered state must fail
      const tamperedState = state + 'tamper';
      assert.strictEqual(verifyOAuthState(tamperedState), null, 'Tampered state must fail');
    });
  });

  describe('3. Public LLM Completion RPC Auth Gate (Finding 8.1)', () => {
    test('generateGroqCompletion rejects unauthenticated requests', async () => {
      const { generateGroqCompletion } = await import('../../src/lib/dashboard');
      const unauthRequest = createMockRequest();

      await assert.rejects(
        async () => {
          await runInServerContext(unauthRequest, async () => {
            return generateGroqCompletion({
              data: {
                messages: [{ role: 'user', content: 'What is the price?' }],
              },
            });
          });
        },
        (err: any) => {
          return err && (err.message === 'UNAUTHORIZED' || err.message?.includes('UNAUTHORIZED'));
        },
        'generateGroqCompletion must enforce authentication and reject anonymous calls'
      );
    });
  });

  describe('4. Stripe Checkout & Portal Open Redirect Mitigation (Finding 4.3)', () => {
    test('createStripeCheckoutSession rejects unauthenticated requests', async () => {
      const { createStripeCheckoutSession } = await import('../../src/lib/dashboard');
      const unauthRequest = createMockRequest();

      await assert.rejects(
        async () => {
          await runInServerContext(unauthRequest, async () => {
            return createStripeCheckoutSession({
              data: { planId: 'starter', returnUrl: 'https://evil.com' },
            });
          });
        },
        (err: any) => {
          return err && (err.message === 'UNAUTHORIZED' || err.message?.includes('UNAUTHORIZED'));
        }
      );
    });

    test('getSafeRedirectUrl prevents open redirect vectors', async () => {
      const { getSafeRedirectUrl } = await import('../../src/lib/security-helpers.server');
      process.env.APP_BASE_URL = 'https://weaverframe.in';

      const dangerousUrls = [
        'https://evil.com',
        'http://phishing.site/login',
        '//evil.com/settings',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://weaverframe.in.attacker.com',
        'https://evil.com/settings?billing=success',
        '/\\evil.com',
      ];

      for (const dangerous of dangerousUrls) {
        const resolved = getSafeRedirectUrl(dangerous, '/settings?billing=success');
        assert.ok(
          resolved.startsWith('https://weaverframe.in/settings'),
          `Resolved URL "${resolved}" must stay within trusted origin for input "${dangerous}"`
        );
        assert.ok(!resolved.includes('evil.com'), `Must not contain evil.com`);
        assert.ok(!resolved.includes('phishing.site'), `Must not contain phishing.site`);
      }

      // Safe relative paths within domain must be preserved
      const safeRelative = getSafeRedirectUrl('/settings?tab=billing', '/settings');
      assert.strictEqual(safeRelative, 'https://weaverframe.in/settings?tab=billing');

      // Trusted absolute URL with matching origin must be allowed
      const safeAbsolute = getSafeRedirectUrl('https://weaverframe.in/settings?billing=success', '/settings');
      assert.strictEqual(safeAbsolute, 'https://weaverframe.in/settings?billing=success');
    });
  });
});
