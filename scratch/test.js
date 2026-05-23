const { getTenantDb } = require('./src/lib/server-utils.server.ts');
// actually we can't easily call createTeamInvite outside of TanStack Start context because requireAuth requires headers.
// But we can check if it's the builderId or email unique constraint.
