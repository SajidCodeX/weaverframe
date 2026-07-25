import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { verifyInviteToken, setInvitePassword } from '@/lib/auth'

export const Route = createFileRoute('/invite/$token')({
  loader: async ({ params }) => {
    try {
      const data = await verifyInviteToken({ data: params.token })
      return { token: params.token, user: data }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: InviteRoute,
})

function InviteRoute() {
  const { token, user } = Route.useLoaderData()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await setInvitePassword({ data: { token, password } })
      if (res.success) {
        window.location.href = '/'
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-inter">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-[#222] shadow-[0_0_15px_rgba(255,255,255,0.05)] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">WeaverFrame</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
          Welcome to the platform
        </h2>
        <p className="mt-2 text-center text-sm text-[#888]">
          You've been invited to join <span className="text-white font-medium">{user.companyName}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0a0a] py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:rounded-xl sm:px-10 border border-[#222]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-[#ccc]">
                Account Email
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="block w-full appearance-none rounded-lg border border-[#333] bg-[#050505] px-3 py-2 text-muted-foreground opacity-70 cursor-not-allowed sm:text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="bg-[#ff453a]/10 border border-[#ff453a]/30 rounded-lg p-3 text-sm text-[#ff453a] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#ccc]">
                Set Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-[#333] bg-[#050505] px-3 py-2 placeholder-[#666] text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white sm:text-sm transition-all"
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#ccc]">
                Confirm Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-[#333] bg-[#050505] px-3 py-2 placeholder-[#666] text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg border border-transparent bg-white py-2 px-4 text-sm font-medium text-black shadow-sm hover:bg-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Setting up...' : 'Set Password & Enter Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
