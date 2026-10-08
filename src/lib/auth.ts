import { createServerFn } from '@tanstack/react-start'

export type AuthSession = {
  userId: string
  builderId: string | null
  actingAsBuilderId?: string | null
  role: string
  builderRole?: string
  permissions?: string[]
  displayName?: string
  companyName?: string
}

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { clearAuthCookie } = await import('./server-utils.server')
    await clearAuthCookie()
    return { success: true }
  })

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; password: string; rememberMe?: boolean }) => data)
  .handler(async ({ data }) => {
    const { handleLogin } = await import('./server-utils.server')
    return handleLogin(data)
  })

// ── Instant Session Revocation ───────────────────────────────────────────────
// In-memory 30s session caching is dropped to guarantee immediate tokenVersion
// and account status enforcement on every request.
export function invalidateSessionCache(_userId?: string) {
  // Retained for API compatibility; DB verification is instantaneous
}

export const getSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null; clientPath?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const { requireAuth, getSessionFromCookie } = await import('./server-utils.server')

      // Resolve active role: explicit role > path-derived role
      let activeRole = data?.activeRole ?? undefined
      if (!activeRole && data?.clientPath) {
        activeRole = data.clientPath.startsWith('/admin') ? 'admin' : 'builder'
      }
      
      // 1. Verify the JWT cookie exists
      const jwtSession = await getSessionFromCookie(activeRole)
      if (!jwtSession || !jwtSession.userId) {
        return null
      }

      // 2. Perform direct DB validation (verifies tokenVersion, isActive, deletedAt)
      const session = await requireAuth(activeRole)
      return session
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] getSessionFn error:`, err.message || err);
      return null;
    }
  })

export const verifyInviteToken = createServerFn({ method: 'GET' })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }) => {
    const { handleVerifyInvite } = await import('./server-utils.server')
    return handleVerifyInvite(token)
  })

export const setInvitePassword = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { handleSetInvitePassword } = await import('./server-utils.server')
    return handleSetInvitePassword(data)
  })

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { handleRequestPasswordReset } = await import('./server-utils.server')
    return handleRequestPasswordReset(data.email)
  })

export const verifyPasswordResetToken = createServerFn({ method: 'GET' })
  .inputValidator((token: string) => token)
  .handler(async ({ data: token }) => {
    const { handleVerifyResetToken } = await import('./server-utils.server')
    return handleVerifyResetToken(token)
  })

export const resetPasswordWithToken = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { handleResetPassword } = await import('./server-utils.server')
    return handleResetPassword(data)
  })

