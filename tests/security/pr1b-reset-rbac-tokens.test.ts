import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { runInServerContext, createMockRequest } from '../test-utils';
import { signToken } from '../../src/lib/server-utils.server';
import { getDb } from '../../src/lib/db.server';

describe('PR-1b Security Tests: Reset Link RBAC & Hashed Tokens (Finding 1.1)', async () => {
  // Real DB records for testing auth validation:
  // rohan@builder.com has builderRole: 'sales' (non-owner/non-admin)
  const db = await getDb();
  const salesUser = await db.user.findUnique({ where: { id: '5e850708-4d63-46f0-be66-3b6b066b2432' } });
  const ownerUser = await db.user.findUnique({ where: { id: '1de96151-566c-4e26-bec0-44d50b6c17ae' } });

  const salesUserSession = {
    userId: '5e850708-4d63-46f0-be66-3b6b066b2432',
    builderId: '259fb0c0-7bc0-46c1-b9ae-df63cc539575',
    role: 'builder' as const,
    builderRole: 'sales',
    permissions: [],
    displayName: 'Rohan Sales',
    email: 'rohan@builder.com',
    tokenVersion: salesUser?.tokenVersion ?? 1,
  };

  // demo@builder.com has builderRole: 'owner'
  const ownerUserSession = {
    userId: '1de96151-566c-4e26-bec0-44d50b6c17ae',
    builderId: '259fb0c0-7bc0-46c1-b9ae-df63cc539575',
    role: 'builder' as const,
    builderRole: 'owner',
    permissions: [],
    displayName: 'Demo Owner',
    email: 'demo@builder.com',
    tokenVersion: ownerUser?.tokenVersion ?? 1,
  };

  describe('1. RBAC Allow-List on generatePasswordResetLink', () => {
    test('non-owner/non-admin (sales staff) is rejected with FORBIDDEN', async () => {
      const { generatePasswordResetLink } = await import('../../src/lib/dashboard');
      const salesJwt = signToken(salesUserSession);
      const req = createMockRequest({ cookies: { jwt_builder: salesJwt } });

      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return generatePasswordResetLink({ data: '1de96151-566c-4e26-bec0-44d50b6c17ae' });
          });
        },
        (err: any) => {
          return (
            err &&
            (err.message?.includes('FORBIDDEN') ||
              err.message?.includes('Forbidden') ||
              err.message?.includes('owner'))
          );
        },
        'Expected non-owner/non-admin role to be denied from issuing password resets'
      );
    });

    test('unauthenticated caller is rejected with UNAUTHORIZED', async () => {
      const { generatePasswordResetLink } = await import('../../src/lib/dashboard');
      const req = createMockRequest(); // no cookies

      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return generatePasswordResetLink({ data: '1de96151-566c-4e26-bec0-44d50b6c17ae' });
          });
        },
        (err: any) => {
          return err && (err.message === 'UNAUTHORIZED' || err.message?.includes('UNAUTHORIZED'));
        }
      );
    });

    test('owner can successfully generate reset link without token leak in response', async () => {
      const { generatePasswordResetLink } = await import('../../src/lib/dashboard');
      const ownerJwt = signToken(ownerUserSession);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      const response = await runInServerContext(req, async () => {
        // Reset sales team member
        return generatePasswordResetLink({ data: '5e850708-4d63-46f0-be66-3b6b066b2432' });
      });

      assert.strictEqual(response.success, true);
      assert.strictEqual((response as any).token, undefined, 'Must not leak token');
      assert.strictEqual((response as any).inviteLink, undefined, 'Must not leak inviteLink');
      assert.strictEqual((response as any).resetLink, undefined, 'Must not leak resetLink');
      assert.strictEqual((response as any).rawToken, undefined, 'Must not leak rawToken');
    });
  });

  describe('2. Response Credential Leak Prevention', () => {
    test('sanitizeResetResponse returns safe structure', async () => {
      const { sanitizeResetResponse } = await import('../../src/lib/security-helpers.server');
      const safeResponse = sanitizeResetResponse();
      assert.strictEqual(safeResponse.success, true);
      assert.strictEqual((safeResponse as any).token, undefined);
      assert.strictEqual((safeResponse as any).inviteLink, undefined);
      assert.strictEqual((safeResponse as any).resetLink, undefined);
    });
  });

  describe('3. Cryptographic Token Hashing (SHA-256)', () => {
    test('hashToken produces deterministic SHA-256 hex digest of 64 chars', async () => {
      const { hashToken } = await import('../../src/lib/security-helpers.server');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const computedHash = hashToken(rawToken);
      assert.strictEqual(computedHash.length, 64);
      assert.strictEqual(computedHash, expectedHash);
    });

    test('hashToken rejects empty or invalid token inputs', async () => {
      const { hashToken } = await import('../../src/lib/security-helpers.server');
      assert.throws(() => hashToken(''));
      assert.throws(() => hashToken(null as any));
    });
  });

  describe('4. Token Verification & Single-Use Consumption', () => {
    test('handleVerifyResetToken and handleResetPassword function with hashed tokens', async () => {
      const { handleVerifyResetToken, handleResetPassword } = await import(
        '../../src/lib/server-utils.server'
      );
      const { hashToken } = await import('../../src/lib/security-helpers.server');
      const { getDb } = await import('../../src/lib/db.server');

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

      const db = await getDb();
      // Set resetTokenHash on test user
      await db.user.update({
        where: { id: '5e850708-4d63-46f0-be66-3b6b066b2432' },
        data: {
          resetToken: null,
          resetTokenHash: tokenHash,
          resetTokenExpires: expires,
        },
      });

      // 1. Verify valid token
      const verifyRes = await handleVerifyResetToken(rawToken);
      assert.strictEqual(verifyRes.valid, true);
      assert.strictEqual(verifyRes.email, 'rohan@builder.com');

      // 2. Tampered token fails
      const tamperedRes = await handleVerifyResetToken(rawToken + 'x');
      assert.strictEqual(tamperedRes.valid, false);

      // 3. Consume token
      const resetRes = await handleResetPassword({
        token: rawToken,
        password: 'NewStrongPassword2026!',
      });
      assert.strictEqual(resetRes.success, true);

      // 4. Single-use: consumed token cannot be reused
      const secondVerify = await handleVerifyResetToken(rawToken);
      assert.strictEqual(secondVerify.valid, false, 'Token must be invalidated after consumption');
    });
  });
});
