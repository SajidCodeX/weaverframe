import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { runInServerContext, createMockRequest } from '../test-utils';
import { signToken } from '../../src/lib/server-utils.server';

describe('PR-2 Security Tests: Rate Limiting & Anti-Abuse (Findings 1.2 & 10.2)', () => {
  beforeEach(async () => {
    // Reset rate limiter state between tests
    const { resetRateLimiterState } = await import('../../src/lib/rate-limiter.server');
    resetRateLimiterState();
  });

  describe('1. Client IP Extraction & Anti-Spoofing (Finding 1.2)', () => {
    test('extracts cf-connecting-ip from Cloudflare', async () => {
      const { getClientIp } = await import('../../src/lib/rate-limiter.server');
      const req = new Request('https://weaverframe.in/api/test', {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 203.0.113.195',
        },
      });
      const ip = getClientIp(req);
      assert.strictEqual(ip, '203.0.113.195');
    });

    test('extracts x-vercel-forwarded-for from Vercel deployment', async () => {
      const { getClientIp } = await import('../../src/lib/rate-limiter.server');
      const req = new Request('https://weaverframe.in/api/test', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.42',
        },
      });
      const ip = getClientIp(req);
      assert.strictEqual(ip, '198.51.100.42');
    });

    test('honors TRUSTED_IP_HEADER when configured in environment', async () => {
      const originalHeader = process.env.TRUSTED_IP_HEADER;
      process.env.TRUSTED_IP_HEADER = 'x-real-ip';
      try {
        const { getClientIp } = await import('../../src/lib/rate-limiter.server');
        const req = new Request('https://weaverframe.in/api/test', {
          headers: {
            'x-real-ip': '192.0.2.1',
            'x-forwarded-for': 'attacker.spoofed.ip',
          },
        });
        const ip = getClientIp(req);
        assert.strictEqual(ip, '192.0.2.1');
      } finally {
        if (originalHeader) process.env.TRUSTED_IP_HEADER = originalHeader;
        else delete process.env.TRUSTED_IP_HEADER;
      }
    });

    test('validates IP syntax and rejects malformed / injected headers', async () => {
      const { getClientIp } = await import('../../src/lib/rate-limiter.server');
      const maliciousHeaders = [
        '../malicious',
        '<script>alert(1)</script>',
        'not-an-ip',
        '999.999.999.999',
        '127.0.0.1; DROP TABLE users',
      ];

      for (const bad of maliciousHeaders) {
        const req = new Request('https://weaverframe.in/api/test', {
          headers: { 'x-real-ip': bad },
        });
        const ip = getClientIp(req);
        assert.notStrictEqual(ip, bad, 'Must not return malformed IP string');
        assert.ok(ip.startsWith('anon:') || ip === 'unknown', 'Must fallback safely without crashing');
      }
    });

    test('does not bundle unknown callers into a shared 127.0.0.1 bucket', async () => {
      const { getClientIp } = await import('../../src/lib/rate-limiter.server');
      const req1 = new Request('https://weaverframe.in/api/test', {
        headers: { 'user-agent': 'Browser 1' },
      });
      const req2 = new Request('https://weaverframe.in/api/test', {
        headers: { 'user-agent': 'Browser 2' },
      });
      const ip1 = getClientIp(req1);
      const ip2 = getClientIp(req2);
      assert.notStrictEqual(ip1, '127.0.0.1', 'Must not fall back to localhost');
      assert.notStrictEqual(ip2, '127.0.0.1', 'Must not fall back to localhost');
      assert.notStrictEqual(ip1, ip2, 'Different unknown clients should get isolated buckets');
    });
  });

  describe('2. Login Rate Limiting & Lockout (Finding 1.2)', () => {
    test('successful checks do not consume attempts (failures only count)', async () => {
      const { checkLoginRateLimit, recordFailedLogin } = await import('../../src/lib/rate-limiter.server');
      const email = 'user1@example.com';
      const ip = '198.51.100.10';

      // 10 checks in a row must pass without locking
      for (let i = 0; i < 10; i++) {
        await assert.doesNotReject(async () => {
          await checkLoginRateLimit(email, ip);
        });
      }

      // Record 1 failure
      await recordFailedLogin(email, ip);

      // Still should not be locked out (threshold is 5)
      await assert.doesNotReject(async () => {
        await checkLoginRateLimit(email, ip);
      });
    });

    test('locks out after 5 failed attempts for specific (email, IP) pair', async () => {
      const { checkLoginRateLimit, recordFailedLogin } = await import('../../src/lib/rate-limiter.server');
      const email = 'target@example.com';
      const ip = '198.51.100.20';

      // 4 failures should warn or record
      for (let i = 1; i <= 4; i++) {
        try {
          await recordFailedLogin(email, ip);
        } catch {
          // Warning error on attempt 4 is acceptable
        }
      }

      // 5th failure must trigger lockout
      await assert.rejects(
        async () => {
          await recordFailedLogin(email, ip);
        },
        (err: any) => err && err.message?.includes('locked')
      );

      // Subsequent checkLoginRateLimit must fail fast and closed
      await assert.rejects(
        async () => {
          await checkLoginRateLimit(email, ip);
        },
        (err: any) => err && err.message?.includes('locked')
      );
    });

    test('clears failed attempts upon successful login', async () => {
      const { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } = await import('../../src/lib/rate-limiter.server');
      const email = 'recovering@example.com';
      const ip = '198.51.100.30';

      // Record 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await recordFailedLogin(email, ip);
        } catch {}
      }

      // Successful login clears attempts
      await clearLoginAttempts(email, ip);

      // Should now be able to record 4 new failures without hitting lockout
      for (let i = 0; i < 4; i++) {
        try {
          await recordFailedLogin(email, ip);
        } catch {}
      }

      // Must not be locked
      await assert.doesNotReject(async () => {
        await checkLoginRateLimit(email, ip);
      });
    });

    test('global per-email threshold triggers even if attacker rotates IPs', async () => {
      const { checkLoginRateLimit, recordFailedLogin } = await import('../../src/lib/rate-limiter.server');
      const email = 'ceo@builder.com';

      // Attacker tries 1 attempt each across 10 distinct IPs (distributed brute force)
      for (let i = 1; i <= 9; i++) {
        try {
          await recordFailedLogin(email, `198.51.100.${i}`);
        } catch {}
      }

      // The 10th distributed attempt must trigger global email protection
      await assert.rejects(
        async () => {
          await recordFailedLogin(email, '198.51.100.10');
        },
        (err: any) => err && (err.message?.includes('locked') || err.message?.includes('Too many failed'))
      );

      // Even a new IP cannot attempt login on that locked account
      await assert.rejects(
        async () => {
          await checkLoginRateLimit(email, '198.51.100.99');
        },
        (err: any) => err && err.message?.includes('locked')
      );
    });
  });

  describe('3. Password Reset Rate Limiting (Finding 10.2)', () => {
    test('enforces per-email cap (maximum 3 requests per hour)', async () => {
      const { checkPasswordResetRateLimit } = await import('../../src/lib/rate-limiter.server');
      const email = 'victim@example.com';
      const ip = '198.51.100.50';

      // Requests 1, 2, 3 should succeed
      await checkPasswordResetRateLimit(email, ip);
      await checkPasswordResetRateLimit(email, ip);
      await checkPasswordResetRateLimit(email, ip);

      // Request 4 must be blocked
      await assert.rejects(
        async () => {
          await checkPasswordResetRateLimit(email, ip);
        },
        (err: any) => err && (err.message?.includes('Too many') || err.message?.includes('reset'))
      );
    });

    test('enforces per-IP cap to prevent mass password reset bombing across multiple emails', async () => {
      const { checkPasswordResetRateLimit } = await import('../../src/lib/rate-limiter.server');
      const ip = '198.51.100.60';

      // Try resetting 10 different accounts from the same IP (max 10 / hour per IP)
      for (let i = 1; i <= 10; i++) {
        await checkPasswordResetRateLimit(`user_${i}@example.com`, ip);
      }

      // 11th reset from same IP must be rejected
      await assert.rejects(
        async () => {
          await checkPasswordResetRateLimit('another_user@example.com', ip);
        },
        (err: any) => err && (err.message?.includes('Too many') || err.message?.includes('rate'))
      );
    });
  });

  describe('4. Public Form Abuse Prevention (Finding 10.2)', () => {
    test('rate limits demo request submissions per IP', async () => {
      const { checkPublicFormRateLimit } = await import('../../src/lib/rate-limiter.server');
      const ip = '198.51.100.70';

      // 5 submissions allowed in 10-minute window
      for (let i = 0; i < 5; i++) {
        await assert.doesNotReject(async () => {
          await checkPublicFormRateLimit('demo', ip);
        });
      }

      // 6th submission must be rejected
      await assert.rejects(
        async () => {
          await checkPublicFormRateLimit('demo', ip);
        },
        (err: any) => err && err.message?.includes('Too many')
      );
    });

    test('rate limits inbound lead webhook per token + IP', async () => {
      const { checkPublicFormRateLimit } = await import('../../src/lib/rate-limiter.server');
      const token = 'wf_wp_testtoken123';
      const ip = '198.51.100.80';
      const key = `${token}:${ip}`;

      // Inbound webhook limit is 60 per minute
      for (let i = 0; i < 60; i++) {
        await checkPublicFormRateLimit('inbound', key);
      }

      // 61st request in the window must be rejected
      await assert.rejects(
        async () => {
          await checkPublicFormRateLimit('inbound', key);
        },
        (err: any) => err && err.message?.includes('Too many')
      );
    });
  });
});
