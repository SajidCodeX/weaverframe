import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from './db.server'

// ─── Login & Request Rate Limiter (Distributed Upstash + Resilient Local) ───
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  checkPasswordResetRateLimit,
} from './rate-limiter.server';

export {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  checkPasswordResetRateLimit,
};


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
  tokenVersion?: number
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing from environment variables.')
  return secret
}

export const signToken = (payload: AuthSession, rememberMe: boolean = false): string => {
  // If rememberMe is checked, token lasts 7 days; otherwise 1 day.
  const expiresIn = rememberMe ? '7d' : '1d'
  const sessionPayload = {
    ...payload,
    tokenVersion: payload.tokenVersion ?? 1,
  }
  return jwt.sign(sessionPayload, getJwtSecret(), { expiresIn })
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
  const { getCookie, deleteCookie, getRequestHeader } = await import('@tanstack/react-start-server')

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
      const { getRequestUrl } = await import('@tanstack/react-start-server')
      const url = getRequestUrl()
      if (url) {
        resolvedRole = new URL(url).pathname.startsWith('/admin') ? 'admin' : 'builder'
      }
    } catch {
      // Not in a request context
    }
  }

  try {
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

    // If multiple cookies are present, gracefully check builder then admin rather than locking the user out
    if (builderCookie) {
      try {
        const s = verifyToken(builderCookie) as AuthSession
        if (s) return s
      } catch {
        deleteCookie('jwt_builder', { path: '/' })
      }
    }

    if (adminCookie) {
      try {
        const s = verifyToken(adminCookie) as AuthSession
        if (s) return s
      } catch {
        deleteCookie('jwt_admin', { path: '/' })
      }
    }

    if (fallbackCookie) {
      try {
        const s = verifyToken(fallbackCookie) as AuthSession
        if (s) return s
      } catch {
        deleteCookie('jwt', { path: '/' })
      }
    }
  } catch {
    // Outside active request context or no cookies available
    return null
  }

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
        tokenVersion: true,
        builder: {
          select: { companyName: true, isActive: true, deletedAt: true }
        }
      }
    })
    
    if (!user || user.isActive === false || user.deletedAt) {
      throw new Error('UNAUTHORIZED')
    }

    // Session Invalidation: If tokenVersion exists and does not match DB, invalidate session
    if (session.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (session.tokenVersion !== user.tokenVersion) {
        throw new Error('UNAUTHORIZED')
      }
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

export const requireAdmin = async (activeRole?: string): Promise<AuthSession> => {
  const session = await requireAuth(activeRole || 'admin')
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
  try {
    const { setCookie, deleteCookie } = await import('@tanstack/react-start-server')
    const token = signToken(payload, rememberMe)
    const cookieName = COOKIE_NAME_MAP[payload.role] ?? 'jwt'

    // Proactively clear conflicting role cookies to prevent multi-cookie deadlocks
    const allCookieNames = ['jwt_admin', 'jwt_builder', 'jwt_user', 'jwt']
    for (const name of allCookieNames) {
      if (name !== cookieName) {
        deleteCookie(name, { path: '/' })
      }
    }

    const isProduction = process.env.NODE_ENV === 'production'

    const cookieOptions: any = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    }

    if (rememberMe) {
      cookieOptions.maxAge = 604800
    }

    setCookie(cookieName, token, cookieOptions)
  } catch {
    // Outside active request context
  }
}

export const clearAuthCookie = async (): Promise<void> => {
  try {
    const { deleteCookie } = await import('@tanstack/react-start-server')
    const allCookieNames = ['jwt_admin', 'jwt_builder', 'jwt_user', 'jwt']
    for (const name of allCookieNames) {
      deleteCookie(name, { path: '/' })
    }
  } catch {
    // Outside active request context
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
          // SAFETY NOTE: Platform-level models (User, Builder, SystemSync, PlatformSettings, DemoRequest)
          // are isolated from tenant-scoping middleware.
          if (['User', 'Builder', 'SystemSync', 'PlatformSettings', 'DemoRequest'].includes(model as string)) return query(args)

          args = args || {}

          if (['create', 'createMany'].includes(operation)) {
            if (args.data) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, builderId: tenantId }))
              } else {
                args.data.builderId = tenantId
              }
            }
          } else if (operation === 'findUnique') {
            // Prisma findUnique only accepts unique keys. We use findFirst to enforce builderId and NOT filters.
            return (rawDb as any)[model].findFirst({
              where: {
                ...args.where,
                builderId: tenantId,
                ...(model === 'Lead' ? {
                  NOT: [
                    { source: { contains: 'Demo Request' } },
                    { source: { contains: 'Website Landing Page' } }
                  ]
                } : {})
              },
              ...(args.select ? { select: args.select } : {}),
              ...(args.include ? { include: args.include } : {}),
            })
          } else if (['findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            // Defense-in-depth: Never allow tenant builders to read or touch Demo Requests
            if (model === 'Lead') {
              args.where = {
                ...args.where,
                builderId: tenantId,
                NOT: [
                  { source: { contains: 'Demo Request' } },
                  { source: { contains: 'Website Landing Page' } }
                ]
              }
            } else {
              args.where = { ...args.where, builderId: tenantId }
            }
          }

          return query(args)
        }
      }
    }
  })
}


export async function resolveRequestClientIp(clientIp?: string): Promise<string> {
  if (clientIp && clientIp !== 'unknown') return clientIp;
  try {
    const { getRequestHeader } = await import('@tanstack/react-start-server');
    const { getClientIp } = await import('./rate-limiter.server');
    return getClientIp({
      'cf-connecting-ip': getRequestHeader('cf-connecting-ip'),
      'x-vercel-forwarded-for': getRequestHeader('x-vercel-forwarded-for'),
      'x-real-ip': getRequestHeader('x-real-ip'),
      'x-forwarded-for': getRequestHeader('x-forwarded-for'),
      'user-agent': getRequestHeader('user-agent'),
      'accept-language': getRequestHeader('accept-language'),
    });
  } catch {
    const { getClientIp } = await import('./rate-limiter.server');
    return getClientIp();
  }
}

// ─── Login / Invite Handlers ─────────────────────────────────────────────────

export const handleLogin = async (data: { email: string; password: string; rememberMe?: boolean; ip?: string }) => {
  const db = await getDb()
  const ip = await resolveRequestClientIp(data.ip)

  // ── Rate Limit Check ─────────────────────────────────────────────────────────
  // Throws if email:ip is currently locked out. Must run BEFORE any DB lookup
  // to prevent timing-based user enumeration via DB query timing differences.
  await checkLoginRateLimit(data.email, ip)

  const user = await db.user.findUnique({ 
    where: { email: data.email },
    include: { builder: true }
  })

  // Treat missing user same as wrong password (no user enumeration)
  if (!user || user.deletedAt) {
    await recordFailedLogin(data.email, ip)
    throw new Error('Invalid email or password')
  }

  if (!user.isActive) throw new Error('Your account has been blocked by the admin.')
  if (user.builder && (!user.builder.isActive || user.builder.deletedAt)) {
    throw new Error('Your company account has been suspended or deleted. Please contact support.')
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash)
  if (!isValid) {
    // Record failed attempt — throws with warning/lockout error if threshold hit
    await recordFailedLogin(data.email, ip)
    throw new Error('Invalid email or password')
  }

  if (user.role !== 'admin' && (await isMaintenanceModeEnabled())) {
    throw new Error('Platform is currently in maintenance mode. Please try again later.')
  }

  // ── Success: clear any accumulated failed attempts ────────────────────────
  await clearLoginAttempts(data.email, ip)

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
    tokenVersion: user.tokenVersion ?? 1,
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
  if (!token || typeof token !== 'string') throw new Error('Invalid or expired invite token')
  const { hashToken } = await import('./security-helpers.server')
  const tokenHash = hashToken(token)
  const db = await getDb()
  const user = await db.user.findFirst({
    where: {
      OR: [{ resetTokenHash: tokenHash }, { resetToken: token }],
      resetTokenExpires: { gt: new Date() },
      forcePasswordReset: true,
    },
    include: { builder: true },
  })
  if (!user) throw new Error('Invalid or expired invite token')
  return { email: user.email, companyName: user.builder?.companyName }
}

export const handleSetInvitePassword = async (data: { token: string; password: string }) => {
  if (!data.token) throw new Error('Invalid or expired invite token')
  const { hashToken } = await import('./security-helpers.server')
  const tokenHash = hashToken(data.token)
  const db = await getDb()
  const user = await db.user.findFirst({
    where: {
      OR: [{ resetTokenHash: tokenHash }, { resetToken: data.token }],
      resetTokenExpires: { gt: new Date() },
      forcePasswordReset: true,
    },
    include: { builder: true },
  })
  if (!user) throw new Error('Invalid or expired invite token')

  const passwordHash = await bcrypt.hash(data.password, 10)
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
      forcePasswordReset: false,
      resetToken: null,
      resetTokenHash: null,
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
    tokenVersion: updated.tokenVersion ?? 1,
  }

  await setAuthCookie(payload)
  return { success: true }
}

export const handleRequestPasswordReset = async (email: string, clientIp?: string) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid corporate email address.' };
  }

  // Anti-Abuse & Email Bombing Protection (Finding 10.2)
  const ip = await resolveRequestClientIp(clientIp);

  await checkPasswordResetRateLimit(normalizedEmail, ip);

  const db = await getDb();
  const user = await db.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      isActive: true,
      deletedAt: null,
    },
    include: { builder: true },
  });

  // Anti-enumeration: always return success
  if (!user) {
    return {
      success: true,
      message: 'If an active account exists for this corporate address, password reset instructions have been dispatched.',
    };
  }

  const { hashToken } = await import('./security-helpers.server');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken: null,
      resetTokenHash: tokenHash,
      resetTokenExpires: expires,
    },
  });

  const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
  const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

  // Non-blocking asynchronous email delivery
  setImmediate(async () => {
    try {
      const { sendOutboundEmail, buildPasswordResetEmailHtml } = await import('./email.server');
      const html = buildPasswordResetEmailHtml({
        resetUrl,
        recipientEmail: user.email,
        displayName: user.displayName,
      });

      await sendOutboundEmail({
        to: user.email,
        subject: 'WeaverFrame Security: Password Reset Authorization',
        html,
      });
    } catch (emailErr) {
      console.error('[AUTH] Failed to dispatch password reset email:', emailErr);
    }
  });

  return {
    success: true,
    message: 'If an active account exists for this corporate address, password reset instructions have been dispatched.',
  };
};

export const handleVerifyResetToken = async (token: string) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, message: 'Invalid reset link' };
  }

  const { hashToken } = await import('./security-helpers.server');
  const tokenHash = hashToken(token);
  const db = await getDb();
  const user = await db.user.findFirst({
    where: {
      OR: [{ resetTokenHash: tokenHash }, { resetToken: token }],
      resetTokenExpires: { gt: new Date() },
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
    },
  });

  if (!user) {
    return { valid: false, message: 'This password reset link is invalid or has expired.' };
  }

  return {
    valid: true,
    email: user.email,
    displayName: user.displayName,
  };
};

export const handleResetPassword = async (data: { token: string; password: string }) => {
  if (!data.token) {
    throw new Error('Reset token is required.');
  }

  if (!data.password || data.password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const { hashToken } = await import('./security-helpers.server');
  const tokenHash = hashToken(data.token);
  const db = await getDb();
  const user = await db.user.findFirst({
    where: {
      OR: [{ resetTokenHash: tokenHash }, { resetToken: data.token }],
      resetTokenExpires: { gt: new Date() },
      isActive: true,
      deletedAt: null,
    },
    include: { builder: true },
  });

  if (!user) {
    throw new Error('This password reset link is invalid or has expired.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
      forcePasswordReset: false,
      resetToken: null,
      resetTokenHash: null,
      resetTokenExpires: null,
      lastLoginAt: new Date(),
    },
  });

  const payload: AuthSession = {
    userId: updated.id,
    builderId: updated.builderId,
    actingAsBuilderId: null,
    role: updated.role,
    builderRole: updated.builderRole,
    permissions: updated.permissions,
    displayName: updated.displayName,
    companyName: user.builder?.companyName,
    email: updated.email,
    companyEmail: user.builder?.email,
    tokenVersion: updated.tokenVersion ?? 1,
  };

  await setAuthCookie(payload);
  return { success: true };
};

export async function processMessageAttachments(content: string, leadId: string): Promise<string> {
  const { processAndUploadContentAttachments } = await import('./storage.server');
  return processAndUploadContentAttachments(content, leadId);
}

export async function handleSubmitDemoRequest(data: {
  name: string;
  company: string;
  email: string;
  phone: string;
  buildVolume: string;
}) {
  const { checkPublicFormRateLimit } = await import('./rate-limiter.server');
  const clientIp = await resolveRequestClientIp();
  await checkPublicFormRateLimit('demo', clientIp);

  if (!data.name || data.name.trim().length < 2) {
    throw new Error('Please enter your full name.');
  }
  if (!data.company || data.company.trim().length < 2) {
    throw new Error('Please enter your building company name.');
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new Error('Please enter a valid work email address.');
  }
  if (!data.phone || data.phone.trim().length < 5) {
    throw new Error('Please enter a valid phone number.');
  }

  const { getDb } = await import('./db.server');
  const db = await getDb();
  const { sendOutboundEmail, buildAdminDemoNotificationHtml, buildUserDemoConfirmationHtml } = await import('./email.server');
  const crypto = await import('crypto');

  try {
    const platformSettings = await db.platformSettings.findFirst({ select: { supportEmail: true } }).catch(() => null);
    const portalToken = crypto.randomBytes(16).toString('hex');

    const demoRequest = await db.demoRequest.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        company: data.company.trim(),
        buildVolume: data.buildVolume || 'Custom Build Inquiry',
        status: 'new',
        portalToken,
        metadata: JSON.stringify({
          requestType: 'Private Architecture Demonstration Walkthrough',
          submittedAt: new Date().toISOString(),
          buildVolume: data.buildVolume,
        }),
      }
    });

    const demoId = demoRequest.id;

    let adminEmail = (typeof process !== 'undefined' ? (process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER) : '') || '';
    if (!adminEmail && platformSettings?.supportEmail) {
      adminEmail = platformSettings.supportEmail;
    }
    if (!adminEmail) {
      adminEmail = 'admin@weaverframe.com';
    }

    const baseUrl = (typeof process !== 'undefined' ? process.env.APP_BASE_URL : '') || 'https://weaverframe.in';
    const dashboardUrl = `${baseUrl}/admin/demo-requests`;

    if (adminEmail) {
      sendOutboundEmail({
        to: adminEmail,
        subject: `🚀 [Demo Request] ${data.name.trim()} from ${data.company.trim()} (${data.buildVolume})`,
        html: buildAdminDemoNotificationHtml({
          name: data.name.trim(),
          company: data.company.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          buildVolume: data.buildVolume,
          dashboardUrl,
        }),
        from: 'WeaverFrame Concierge <onboarding@resend.dev>',
      }).catch((err) => {
        console.error('[DEMO REQUEST ADMIN EMAIL ERROR]:', err);
      });
    }

    sendOutboundEmail({
      to: data.email.trim(),
      subject: `WeaverFrame — Private OS Demonstration Request Received`,
      html: buildUserDemoConfirmationHtml({
        recipientName: data.name.trim(),
        company: data.company.trim(),
        buildVolume: data.buildVolume,
      }),
      from: 'WeaverFrame Executive Advisory <onboarding@resend.dev>',
    }).catch((err) => {
      console.error('[DEMO REQUEST USER CONFIRMATION ERROR]:', err);
    });

    const { invalidateCache } = await import('./cache');
    invalidateCache('dashboard_');

    return {
      success: true,
      message: 'Your demonstration request has been received. Our executive advisor will reach out shortly.',
      demoId,
      leadId: demoId,
    };
  } catch (error: any) {
    console.error('[DEMO REQUEST ERROR]:', error);
    throw new Error(error?.message || 'Failed to submit demonstration request. Please try again.');
  }
}

