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
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { handleLogin } = await import('./server-utils.server')

    // Extract client IP from request headers for rate limiting.
    // TanStack Start exposes getRequestHeader() in server fn context.
    let ip = 'unknown'
    try {
      const { getRequestHeader } = await import('@tanstack/react-start/server')
      ip =
        getRequestHeader('cf-connecting-ip') ??        // Cloudflare
        getRequestHeader('x-forwarded-for')?.split(',')[0].trim() ?? // Reverse proxy
        getRequestHeader('x-real-ip') ??               // Nginx
        'unknown'
    } catch {
      // Outside request context — use fallback
    }

    return handleLogin({ ...data, ip })
  })

// ── In-memory Session Cache ──────────────────────────────────────────────────
// Cache DB validation results for 30 seconds to prevent redundant DB queries
// on every navigation. JWT verification still happens on every request.
const sessionCache = new Map<string, { session: AuthSession; expiry: number }>()

export const getSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    try {
      const { requireAuth, getSessionFromCookie } = await import('./server-utils.server')
      
      // 1. Verify the JWT unconditionally (no DB queries)
      const jwtSession = await getSessionFromCookie(data?.activeRole ?? undefined)
      if (!jwtSession || !jwtSession.userId) {
        return null
      }
      
      // 2. Check cache for recent successful DB validation
      const now = Date.now()
      const cached = sessionCache.get(jwtSession.userId)
      if (cached && cached.expiry > now) {
        return cached.session
      }

      // 3. Not cached or expired -> Perform full DB validation
      const session = await requireAuth(data?.activeRole ?? undefined)
      
      // 4. Cache the result for 30 seconds
      sessionCache.set(session.userId, { session, expiry: now + 30000 })
      
      return session
    } catch (err: any) {
      const fs = await import('fs')
      fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] getSessionFn failed: ${err.message || err}\n${err.stack}\n`)
      return null
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
