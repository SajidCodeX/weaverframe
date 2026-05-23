import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from './db'

export type AuthSession = {
  userId: string
  builderId: string | null
  role: string
  builderRole?: string
  permissions?: string[]
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing from environment variables.')
  return secret
}

export const signToken = (payload: AuthSession): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' })
}

export const verifyToken = (token: string): AuthSession | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthSession
  } catch {
    return null
  }
}

// ─── Use native getCookie / setCookie from TanStack Start ────────────────────

export const getSessionFromCookie = async (): Promise<AuthSession | null> => {
  const { getCookie } = await import('@tanstack/react-start/server')
  const token = getCookie('jwt')
  if (!token) return null
  return verifyToken(token)
}

export const requireAuth = async (): Promise<AuthSession> => {
  const session = await getSessionFromCookie()
  if (!session) throw new Error('UNAUTHORIZED')
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
  setCookie('jwt', token, {
    httpOnly: true,
    sameSite: 'lax',   // lax allows cookies after redirect
    maxAge: 86400,     // 24 hours
    path: '/',
  })
}

export const clearAuthCookie = async (): Promise<void> => {
  const { deleteCookie } = await import('@tanstack/react-start/server')
  deleteCookie('jwt', { path: '/' })
}

// ─── Tenant-isolated DB ──────────────────────────────────────────────────────

export const getTenantDb = async () => {
  const session = await requireAuth()
  if (!session.builderId) throw new Error('Not a builder account')

  const rawDb = await getDb()

  return rawDb.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (['User', 'Builder'].includes(model as string)) return query(args)

          args = args || {}

          if (['create', 'createMany'].includes(operation)) {
            if (args.data) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({ ...d, builderId: session.builderId }))
              } else {
                args.data.builderId = session.builderId
              }
            }
          } else if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...args.where, builderId: session.builderId }
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

  const user = await db.user.findUnique({ where: { email: data.email } })
  if (!user || !user.isActive) throw new Error('Invalid email or password')

  const isValid = await bcrypt.compare(data.password, user.passwordHash)
  if (!isValid) throw new Error('Invalid email or password')

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const payload: AuthSession = {
    userId: user.id,
    builderId: user.builderId,
    role: user.role,
    builderRole: user.builderRole,
    permissions: user.permissions,
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
    role: updated.role,
    builderRole: updated.builderRole,
    permissions: updated.permissions,
  }

  await setAuthCookie(payload)
  return { success: true }
}
