import { createServerFn } from '@tanstack/react-start'

export type AuthSession = {
  userId: string
  builderId: string | null
  role: string
  builderRole?: string
  permissions?: string[]
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
    return handleLogin(data)
  })

export const getSessionFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      const { requireAuth } = await import('./server-utils.server')
      const session = await requireAuth()
      return session
    } catch {
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
