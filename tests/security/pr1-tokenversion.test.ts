import test from 'node:test';
import assert from 'node:assert/strict';
import { runInServerContext, createMockRequest } from '../test-utils';
import { signToken, requireAuth, handleResetPassword } from '../../src/lib/server-utils.server';
import { getDb } from '../../src/lib/db.server';

test('Security Finding 1.3: Instant Session Revocation & TokenVersion Enforcement', async (t) => {
  const db = await getDb();

  // Find or pick a test user
  const user = await db.user.findFirst({
    where: { role: 'builder', isActive: true, deletedAt: null },
  });

  assert.ok(user, 'Should find an active user for testing tokenVersion');

  const currentVersion = user.tokenVersion ?? 1;

  await t.test('JWT with matching tokenVersion succeeds in requireAuth', async () => {
    const validJwt = signToken({
      userId: user.id,
      builderId: user.builderId,
      role: user.role,
      builderRole: user.builderRole,
      tokenVersion: currentVersion,
    });

    await runInServerContext(createMockRequest({ cookies: { jwt_builder: validJwt } }), async () => {
      const session = await requireAuth('builder');
      assert.equal(session.userId, user.id);
    });
  });

  await t.test('JWT with outdated tokenVersion is rejected with UNAUTHORIZED', async () => {
    const outdatedJwt = signToken({
      userId: user.id,
      builderId: user.builderId,
      role: user.role,
      builderRole: user.builderRole,
      tokenVersion: currentVersion - 1, // outdated version
    });

    await runInServerContext(createMockRequest({ cookies: { jwt_builder: outdatedJwt } }), async () => {
      await assert.rejects(
        async () => {
          await requireAuth('builder');
        },
        /UNAUTHORIZED/,
        'Outdated tokenVersion must be rejected with UNAUTHORIZED'
      );
    });
  });
});
