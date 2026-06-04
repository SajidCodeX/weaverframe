import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db'
// ─── HMAC Invite Link Signing ────────────────────────────────────────
// Every public review invite link is signed with HMAC-SHA256 using the
// JWT_SECRET so the /api/rate endpoint can cryptographically verify the
// invite ID has not been forged or tampered with.
export async function signReviewInviteId(inviteId: string): Promise<string> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing.')
  const { createHmac } = await import('crypto')
  return createHmac('sha256', secret).update(inviteId).digest('hex')
}

export async function verifyReviewInviteSignature(inviteId: string, sig: string): Promise<boolean> {
  try {
    const expected = await signReviewInviteId(inviteId)
    // Constant-time comparison to prevent timing attacks
    if (expected.length !== sig.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
    }
    return diff === 0
  } catch {
    return false
  }
}

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

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing from environment variables.')
  return secret
}

export const signToken = (payload: AuthSession): string => {
  // FIX-2: 7-day sessions (industry standard for SaaS dashboards).
  // Previously 24h — users visiting after 1+ day were forced back to login.
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export const verifyToken = (token: string): AuthSession | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthSession
  } catch {
    return null
  }
}

// ─── Use native getCookie / setCookie from TanStack Start ────────────────────

const COOKIE_NAME_MAP: Record<string, string> = {
  admin: 'jwt_admin',
  builder: 'jwt_builder',
  user: 'jwt_user',
}

export const getSessionFromCookie = async (
  activeRole?: string
): Promise<AuthSession | null> => {
  const { getCookie, deleteCookie, getRequestHeader } = await import('@tanstack/react-start/server')

  // Try to resolve role from header if not explicitly passed
  let resolvedRole = activeRole
  if (!resolvedRole) {
    try {
      resolvedRole = getRequestHeader('x-active-role') ?? undefined
    } catch {
      // Outside active request context or header not set
    }
  }
  
  if (!resolvedRole) {
    // If still not resolved, check the active_role cookie (available during SSR)
    resolvedRole = getCookie('active_role')
  }

  // Role-specific cookie read: if activeRole/resolvedRole is resolved, strictly read that cookie
  if (resolvedRole && COOKIE_NAME_MAP[resolvedRole]) {
    const cookieName = COOKIE_NAME_MAP[resolvedRole]
    const token = getCookie(cookieName)
    if (!token) return null
    try {
      return verifyToken(token) as AuthSession
    } catch {
      deleteCookie(cookieName, { path: '/' })
      return null
    }
  }

  // x-active-role not present — Contextless check. 
  // Do NOT guess based on priority if multiple cookies are present, to avoid crossing streams.
  // We only fallback if exactly ONE cookie is present.
  const adminCookie = getCookie('jwt_admin')
  const builderCookie = getCookie('jwt_builder')
  const userCookie = getCookie('jwt_user')
  const fallbackCookie = getCookie('jwt')

  const presentCookies = [
    { name: 'jwt_admin', val: adminCookie },
    { name: 'jwt_builder', val: builderCookie },
    { name: 'jwt_user', val: userCookie },
    { name: 'jwt', val: fallbackCookie }
  ].filter(c => c.val)

  if (presentCookies.length === 1) {
    try {
      return verifyToken(presentCookies[0].val as string) as AuthSession
    } catch {
      deleteCookie(presentCookies[0].name, { path: '/' })
      return null
    }
  }

  // If multiple cookies are present and NO explicit role was requested, we CANNOT safely guess.
  return null
}

const isMaintenanceModeEnabled = async (): Promise<boolean> => {
  const db = await getDb()
  const settings = await db.platformSettings.findUnique({
    where: { id: 'global' },
    select: { maintenanceMode: true },
  })
  return Boolean(settings?.maintenanceMode)
}

export const requireAuth = async (activeRole?: string): Promise<AuthSession> => {
  const session = await getSessionFromCookie(activeRole)
  if (!session) throw new Error('UNAUTHORIZED')
  if (session.role !== 'admin' && (await isMaintenanceModeEnabled())) {
    throw new Error('MAINTENANCE_MODE')
  }
  return session
}

export const requireAdmin = async (): Promise<AuthSession> => {
  const session = await requireAuth()
  if (session.role !== 'admin') throw new Error('FORBIDDEN')
  return session
}

export const setAuthCookie = async (payload: AuthSession): Promise<void> => {
  const { setCookie } = await import('@tanstack/react-start/server')
  const token = signToken(payload)
  const cookieName = COOKIE_NAME_MAP[payload.role] ?? 'jwt'

  // secure:true only in production (HTTPS). In local dev (http://localhost),
  // most browsers (Firefox, Safari) will NOT send Secure cookies over HTTP,
  // even on localhost — causing all auth to silently fail.
  // In production this must be true to prevent MITM interception.
  const isProduction = process.env.NODE_ENV === 'production'

  setCookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 604800,   // FIX-2: 7 days (matches JWT expiresIn: '7d')
    path: '/',
  })

  // Set a non-httpOnly cookie for active_role so the server knows the primary context during SSR
  setCookie('active_role', payload.role, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 604800,
    path: '/',
  })
}

export const clearAuthCookie = async (): Promise<void> => {
  const { deleteCookie } = await import('@tanstack/react-start/server')

  // Unconditionally nuke ALL role cookies on every logout.
  // For deletion, only path needs to match — do NOT pass secure/httpOnly
  // because those flags can conflict with how the cookie was originally set,
  // causing the delete to silently fail and leaving stale sessions alive.
  const allCookieNames = ['jwt_admin', 'jwt_builder', 'jwt_user', 'jwt']
  for (const name of allCookieNames) {
    deleteCookie(name, { path: '/' })
  }
}


// ─── Tenant-isolated DB ──────────────────────────────────────────────────────

export const getTenantDb = async (preResolvedSession?: AuthSession) => {
  // Accept a pre-resolved session to avoid a second requireAuth() round-trip
  // when the caller has already authenticated (e.g. getDashboardData).
  // When called without a session it authenticates normally — all existing callers are unaffected.
  const session = preResolvedSession ?? await requireAuth()
  const tenantId = session.role === 'admin' 
    ? session.actingAsBuilderId 
    : session.builderId
  
  if (!tenantId) throw new Error('Admin must be in impersonation mode to access tenant data')

  const rawDb = await getDb()

  // Integrity check: verify builder still exists and is active
  // This is a single indexed PK lookup — negligible cost on Neon
  const builder = await rawDb.builder.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true, deletedAt: true }
  })
  
  if (!builder || !builder.isActive || builder.deletedAt) {
    throw new Error('TENANT_UNAVAILABLE')
  }

  return rawDb.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          // FIX-7 SAFETY NOTE: User and Builder models are excluded from the automatic
          // builderId tenant-scoping middleware. Any server function that queries these
          // models via getTenantDb() MUST manually add its own `where: { builderId: tenantId }`
          // filter to prevent cross-tenant data leakage. Do NOT add new unscoped queries
          // on User or Builder without an explicit WHERE clause.
          if (['User', 'Builder', 'SystemSync', 'PlatformSettings'].includes(model as string)) return query(args)

          args = args || {}

          if (['create', 'createMany'].includes(operation)) {
            if (args.data) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, builderId: tenantId }))
              } else {
                args.data.builderId = tenantId
              }
            }
          } else if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...args.where, builderId: tenantId }
          }

          return query(args)
        }
      }
    }
  })
}


// ─── Login / Invite Handlers ─────────────────────────────────────────────────

export const handleLogin = async (data: { email: string; password: string }) => {
  const db = await getDb()

  const user = await db.user.findUnique({ 
    where: { email: data.email },
    include: { builder: true }
  })
  if (!user || user.deletedAt) throw new Error('Invalid email or password')
  if (!user.isActive) throw new Error('Your account has been blocked by the admin.')
  if (user.builder && (!user.builder.isActive || user.builder.deletedAt)) {
    throw new Error('Your company account has been suspended or deleted. Please contact support.')
  }
  const isValid = await bcrypt.compare(data.password, user.passwordHash)
  if (!isValid) throw new Error('Invalid email or password')
  if (user.role !== 'admin' && (await isMaintenanceModeEnabled())) {
    throw new Error('Platform is currently in maintenance mode. Please try again later.')
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const payload: AuthSession = {
    userId: user.id,
    builderId: user.builderId,
    actingAsBuilderId: null,
    role: user.role,
    builderRole: user.builderRole,
    permissions: user.permissions,
    displayName: user.displayName,
    companyName: user.builder?.companyName,
  }

  await setAuthCookie(payload)
  return { success: true, forcePasswordReset: user.forcePasswordReset, role: user.role }
}

export const handleVerifyInvite = async (token: string) => {
  const db = await getDb()
  const user = await db.user.findFirst({
    where: { resetToken: token, resetTokenExpires: { gt: new Date() }, forcePasswordReset: true },
    include: { builder: true },
  })
  if (!user) throw new Error('Invalid or expired invite token')
  return { email: user.email, companyName: user.builder?.companyName }
}

export const handleSetInvitePassword = async (data: { token: string; password: string }) => {
  const db = await getDb()
  const user = await db.user.findFirst({
    where: { resetToken: data.token, resetTokenExpires: { gt: new Date() }, forcePasswordReset: true },
    include: { builder: true }
  })
  if (!user) throw new Error('Invalid or expired invite token')

  const passwordHash = await bcrypt.hash(data.password, 10)
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      forcePasswordReset: false,
      resetToken: null,
      resetTokenExpires: null,
      lastLoginAt: new Date(),
    },
  })

  const payload: AuthSession = {
    userId: updated.id,
    builderId: updated.builderId,
    actingAsBuilderId: null,
    role: updated.role,
    builderRole: updated.builderRole,
    permissions: updated.permissions,
    displayName: updated.displayName,
    companyName: user.builder?.companyName,
  }

  await setAuthCookie(payload)
  return { success: true }
}
