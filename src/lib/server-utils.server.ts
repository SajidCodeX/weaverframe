import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db'

// ─── Login Rate Limiter (In-Memory) ──────────────────────────────────────────
// Tracks failed login attempts per key (email + IP).
// After 10 failures, the key is locked for 15 minutes.
// NOTE: This resets on server restart. For production at scale, replace with
// a persistent store (e.g. Upstash Redis). For single-instance deployments
// this provides solid brute-force protection.

const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

interface LoginAttemptRecord {
  count: number
  firstAttemptAt: number
  lockedUntil?: number
}

// Key format: "email:ip" — dual-keyed to prevent both email enumeration & IP attacks
const loginAttemptStore = new Map<string, LoginAttemptRecord>()

// Periodic cleanup every 30 minutes — prevents unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of loginAttemptStore.entries()) {
    // Remove entries that are past their lockout window or have expired
    const expiry = record.lockedUntil ?? (record.firstAttemptAt + LOGIN_LOCKOUT_MS)
    if (now > expiry) {
      loginAttemptStore.delete(key)
    }
  }
}, 30 * 60 * 1000)

function getRateLimitKey(email: string, ip: string): string {
  return `${email.toLowerCase().trim()}:${ip}`
}

function checkLoginRateLimit(email: string, ip: string): void {
  const key = getRateLimitKey(email, ip)
  const now = Date.now()
  const record = loginAttemptStore.get(key)

  if (!record) return // No previous failures — allow

  // If locked, check if lockout window has expired
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      const remainingMs = record.lockedUntil - now
      const remainingMins = Math.ceil(remainingMs / 60000)
      throw new Error(
        `Too many failed login attempts. Your account access has been temporarily locked. ` +
        `Please try again in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.`
      )
    } else {
      // Lockout expired — reset and allow
      loginAttemptStore.delete(key)
      return
    }
  }

  // Not locked yet — check if window has expired naturally
  if (now - record.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttemptStore.delete(key)
    return // Window expired — treat as fresh start
  }
}

function recordFailedLogin(email: string, ip: string): void {
  const key = getRateLimitKey(email, ip)
  const now = Date.now()
  const record = loginAttemptStore.get(key)

  if (!record) {
    loginAttemptStore.set(key, { count: 1, firstAttemptAt: now })
    return
  }

  // Reset if window has naturally expired
  if (now - record.firstAttemptAt > LOGIN_LOCKOUT_MS) {
    loginAttemptStore.set(key, { count: 1, firstAttemptAt: now })
    return
  }

  record.count++

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS
    loginAttemptStore.set(key, record)
    throw new Error(
      `Too many failed login attempts (${LOGIN_MAX_ATTEMPTS} attempts). ` +
      `Your account access has been locked for 15 minutes for security. ` +
      `If this wasn't you, please contact support.`
    )
  }

  const remaining = LOGIN_MAX_ATTEMPTS - record.count
  loginAttemptStore.set(key, record)

  // Surface warning when getting close to lockout
  if (remaining <= 3) {
    throw new Error(
      `Invalid email or password. Warning: ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before your access is temporarily locked.`
    )
  }
}

function clearLoginAttempts(email: string, ip: string): void {
  loginAttemptStore.delete(getRateLimitKey(email, ip))
}

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
  email?: string           // The logged-in user's own email — used as Reply-To for outbound lead emails
  companyEmail?: string    // The builder company's general email (e.g. contact@nexora.com) — shown as company sender
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing from environment variables.')
  return secret
}

export const signToken = (payload: AuthSession, rememberMe: boolean = false): string => {
  // If rememberMe is checked, token lasts 7 days; otherwise 1 day.
  const expiresIn = rememberMe ? '7d' : '1d'
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
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
    // If still not resolved, use the request URL path to determine role.
    // active_role cookie is intentionally NOT used here — it is shared across
    // all browser tabs, so using it would cause cross-tab role contamination
    // on hard refresh (Tab 1: admin, Tab 2: builder — one overwrites the other).
    // URL path is a reliable, per-request signal:
    //   /admin/* → admin role
    //   everything else → builder role
    try {
      const clientPath = getRequestHeader('x-client-path') ?? undefined
      if (clientPath) {
        resolvedRole = clientPath.startsWith('/admin') ? 'admin' : 'builder'
      }
    } catch {
      // x-client-path not available (hard refresh — browser navigation, not fetch)
    }
  }

  if (!resolvedRole) {
    // Last resort for hard refresh: read the request URL from the server context
    try {
      const { getRequestUrl } = await import('@tanstack/react-start/server')
      const url = getRequestUrl()
      if (url) {
        resolvedRole = new URL(url).pathname.startsWith('/admin') ? 'admin' : 'builder'
      }
    } catch {
      // Not in a request context
    }
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

  // Instant Session Invalidation: Validate user exists in DB & is active
  if (session.userId) {
    const db = await getDb()
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { 
        id: true, 
        displayName: true,
        isActive: true, 
        deletedAt: true,
        builderRole: true,
        builder: {
          select: { companyName: true, isActive: true, deletedAt: true }
        }
      }
    })
    
    if (!user || user.isActive === false || user.deletedAt) {
      throw new Error('UNAUTHORIZED')
    }
    
    if (user.builder && (user.builder.isActive === false || user.builder.deletedAt)) {
      throw new Error('UNAUTHORIZED')
    }
    
    if (user.displayName) {
      session.displayName = user.displayName;
    }
    if (user.builder?.companyName) {
      session.companyName = user.builder.companyName;
    }

    if (session.role === 'builder') {
      session.builderRole = (user.builderRole || 'sales') as any
    }
  }

  return session
}

export const requireAdmin = async (): Promise<AuthSession> => {
  const session = await requireAuth()
  if (session.role !== 'admin') throw new Error('FORBIDDEN')
  return session
}

export const requireOwner = async (activeRole?: string): Promise<AuthSession> => {
  const session = await requireAuth(activeRole)
  if (session.role === 'builder' && session.builderRole !== 'owner') {
    throw new Error('FORBIDDEN')
  }
  return session
}

export const requireAdminOrOwner = async (activeRole?: string): Promise<AuthSession> => {
  const session = await requireAuth(activeRole)
  if (session.role === 'builder' && session.builderRole !== 'owner' && session.builderRole !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return session
}

export const requireManagerOrAbove = async (activeRole?: string): Promise<AuthSession> => {
  const session = await requireAuth(activeRole)
  if (session.role === 'builder' && session.builderRole === 'sales') {
    throw new Error('FORBIDDEN')
  }
  return session
}

export const setAuthCookie = async (payload: AuthSession, rememberMe: boolean = false): Promise<void> => {
  const { setCookie } = await import('@tanstack/react-start/server')
  const token = signToken(payload, rememberMe)
  const cookieName = COOKIE_NAME_MAP[payload.role] ?? 'jwt'

  // secure:true only in production (HTTPS). In local dev (http://localhost),
  // most browsers (Firefox, Safari) will NOT send Secure cookies over HTTP,
  // even on localhost — causing all auth to silently fail.
  // In production this must be true to prevent MITM interception.
  const isProduction = process.env.NODE_ENV === 'production'

  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  }

  // If rememberMe is checked, set persistent cookie for 7 days (604,800s).
  // If NOT checked, omit maxAge to create a Session Cookie (cleared when browser session ends).
  if (rememberMe) {
    cookieOptions.maxAge = 604800
  }

  setCookie(cookieName, token, cookieOptions)

  // NOTE: We intentionally do NOT set an active_role cookie.
  // Using a shared active_role cookie caused cross-tab role contamination:
  // admin (Tab 1) + builder (Tab 2) login would overwrite each other's cookie,
  // and the wrong role would load on hard refresh.
  // Role is now determined server-side from the request URL path instead.
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

export const handleLogin = async (data: { email: string; password: string; rememberMe?: boolean; ip?: string }) => {
  const db = await getDb()
  const ip = data.ip ?? 'unknown'

  // ── Rate Limit Check ─────────────────────────────────────────────────────────
  // Throws if email:ip is currently locked out. Must run BEFORE any DB lookup
  // to prevent timing-based user enumeration via DB query timing differences.
  checkLoginRateLimit(data.email, ip)

  const user = await db.user.findUnique({ 
    where: { email: data.email },
    include: { builder: true }
  })

  // Treat missing user same as wrong password (no user enumeration)
  if (!user || user.deletedAt) {
    recordFailedLogin(data.email, ip)
    throw new Error('Invalid email or password')
  }

  if (!user.isActive) throw new Error('Your account has been blocked by the admin.')
  if (user.builder && (!user.builder.isActive || user.builder.deletedAt)) {
    throw new Error('Your company account has been suspended or deleted. Please contact support.')
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash)
  if (!isValid) {
    // Record failed attempt — throws with warning/lockout error if threshold hit
    recordFailedLogin(data.email, ip)
    throw new Error('Invalid email or password')
  }

  if (user.role !== 'admin' && (await isMaintenanceModeEnabled())) {
    throw new Error('Platform is currently in maintenance mode. Please try again later.')
  }

  // ── Success: clear any accumulated failed attempts ────────────────────────
  clearLoginAttempts(data.email, ip)

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
    email: user.email,           // logged-in user's own email → Reply-To header
    companyEmail: user.builder?.email,  // builder's company email → company sender identity
  }

  await setAuthCookie(payload, data.rememberMe ?? false)
  return {
    success: true,
    forcePasswordReset: user.forcePasswordReset,
    role: user.role,
    // Return full session so client can skip the getSessionFn round-trip
    session: payload,
  }
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
    email: updated.email,            // team member's own email → Reply-To header
    companyEmail: user.builder?.email, // builder company email → company sender identity
  }

  await setAuthCookie(payload)
  return { success: true }
}
