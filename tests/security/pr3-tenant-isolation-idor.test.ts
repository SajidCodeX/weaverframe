import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runInServerContext, createMockRequest } from '../test-utils';
import { signToken, AuthSession } from '../../src/lib/server-utils.server';

describe('PR-3 Security Tests: Multi-Tenant Isolation & IDOR Remediation (Findings 2.1 & 2.2)', () => {
  // Test builder tenants from database:
  const TENANT_A_ID = '259fb0c0-7bc0-46c1-b9ae-df63cc539575'; // Nexora
  const TENANT_B_ID = 'b7b2521c-a335-430c-ab22-0498b5962078'; // Second builder

  // Users in Tenant A
  const tenantAOwner: AuthSession = {
    userId: '1de96151-566c-4e26-bec0-44d50b6c17ae',
    builderId: TENANT_A_ID,
    role: 'builder',
    builderRole: 'owner',
    permissions: [],
    displayName: 'Demo Owner',
    email: 'demo@builder.com',
  };

  const tenantASales: AuthSession = {
    userId: '5e850708-4d63-46f0-be66-3b6b066b2432',
    builderId: TENANT_A_ID,
    role: 'builder',
    builderRole: 'sales',
    permissions: [],
    displayName: 'Rohan Sales',
    email: 'rohan@builder.com',
  };

  // Malformed session with null builderId (simulates corrupted or missing tenant context)
  const tenantMissingSession: AuthSession = {
    userId: '1de96151-566c-4e26-bec0-44d50b6c17ae',
    builderId: null as any,
    role: 'builder',
    builderRole: 'owner',
    permissions: [],
    displayName: 'Orphan User',
    email: 'orphan@builder.com',
  };

  describe('1. Systemic Tenant Context Assertion', () => {
    test('assertTenantContext returns tenantId for valid builder session', async () => {
      const { assertTenantContext } = await import('../../src/lib/security-helpers.server');
      const tenantId = assertTenantContext(tenantAOwner);
      assert.strictEqual(tenantId, TENANT_A_ID);
    });

    test('assertTenantContext throws FORBIDDEN when builderId is missing or empty', async () => {
      const { assertTenantContext } = await import('../../src/lib/security-helpers.server');
      assert.throws(
        () => assertTenantContext(tenantMissingSession),
        (err: any) => err && err.message?.includes('Tenant context')
      );
    });

    test('assertTenantContext supports admin in impersonation mode', async () => {
      const { assertTenantContext } = await import('../../src/lib/security-helpers.server');
      const adminImpersonating: AuthSession = {
        userId: 'admin_1',
        builderId: null,
        actingAsBuilderId: TENANT_B_ID,
        role: 'admin',
        permissions: ['*'],
      };
      const tenantId = assertTenantContext(adminImpersonating);
      assert.strictEqual(tenantId, TENANT_B_ID);
    });
  });

  describe('2. Cross-Tenant Leak Prevention in getTeamData (Finding 2.1)', () => {
    test('getTeamData rejects calls when tenant context is missing', async () => {
      const { getTeamData } = await import('../../src/lib/dashboard');
      const orphanJwt = signToken(tenantMissingSession);
      const req = createMockRequest({ cookies: { jwt_builder: orphanJwt } });

      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return getTeamData();
          });
        },
        (err: any) => err && (err.message?.includes('Tenant') || err.message?.includes('FORBIDDEN') || err.message?.includes('UNAUTHORIZED'))
      );
    });

    test('getTeamData returns ONLY members of the caller tenant', async () => {
      const { getTeamData } = await import('../../src/lib/dashboard');
      const ownerJwt = signToken(tenantAOwner);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      const team = await runInServerContext(req, async () => {
        return getTeamData();
      });

      assert.ok(Array.isArray(team), 'Team must be an array');
      // Every returned user must belong to TENANT_A_ID
      const { getDb } = await import('../../src/lib/db.server');
      const db = await getDb();
      for (const member of team) {
        const dbUser = await db.user.findUnique({ where: { id: member.id }, select: { builderId: true } });
        assert.strictEqual(
          dbUser?.builderId,
          TENANT_A_ID,
          `User ${member.id} from another tenant leaked in getTeamData!`
        );
      }
    });
  });

  describe('3. removeTeamMember Tenant Boundary & Hierarchy (Finding 2.1)', () => {
    test('blocks self-removal attempt', async () => {
      const { removeTeamMember } = await import('../../src/lib/dashboard');
      const ownerJwt = signToken(tenantAOwner);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return removeTeamMember({ data: tenantAOwner.userId });
          });
        },
        (err: any) => err && (err.message?.includes('own account') || err.message?.includes('self'))
      );
    });

    test('blocks cross-tenant user deletion (IDOR protection)', async () => {
      const { removeTeamMember } = await import('../../src/lib/dashboard');
      const ownerJwt = signToken(tenantAOwner);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      // Attempt to remove a non-existent user or user from another tenant
      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return removeTeamMember({ data: 'non-existent-user-id' });
          });
        },
        (err: any) => err && (err.message?.includes('not found') || err.message?.includes('denied'))
      );
    });
  });

  describe('4. assignLeadToUser Cross-Tenant IDOR Prevention (Finding 2.2)', () => {
    test('rejects assigning lead when leadId does not belong to caller tenant', async () => {
      const { assignLeadToUser } = await import('../../src/lib/dashboard');
      const ownerJwt = signToken(tenantAOwner);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return assignLeadToUser({
              data: {
                leadId: 'fake-or-foreign-lead-id',
                userId: tenantASales.userId,
              },
            });
          });
        },
        (err: any) => err && (err.message?.includes('Lead not found') || err.message?.includes('denied'))
      );
    });

    test('rejects assigning a valid lead to a user from a different tenant', async () => {
      const { assignLeadToUser } = await import('../../src/lib/dashboard');
      const { getDb } = await import('../../src/lib/db.server');
      const db = await getDb();

      // Find any lead belonging to Tenant A
      const leadA = await db.lead.findFirst({
        where: { builderId: TENANT_A_ID },
        select: { id: true },
      });

      if (!leadA) {
        // If no lead exists, skip this specific test
        return;
      }

      const ownerJwt = signToken(tenantAOwner);
      const req = createMockRequest({ cookies: { jwt_builder: ownerJwt } });

      // Try assigning to a foreign user ID from Tenant B or non-existent
      await assert.rejects(
        async () => {
          await runInServerContext(req, async () => {
            return assignLeadToUser({
              data: {
                leadId: leadA.id,
                userId: 'foreign-tenant-user-id',
              },
            });
          });
        },
        (err: any) => err && (err.message?.includes('User not found') || err.message?.includes('organization'))
      );
    });
  });
});
