import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { loginFn } from '@/lib/auth'
import { toast } from 'sonner'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

function LoginRoute() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    const savedEmail = localStorage.getItem('builders_edge_remembered_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async () => {
    if (loading) return
    setError('')
    setLoading(true)


    if (rememberMe) {
      localStorage.setItem('builders_edge_remembered_email', email)
    } else {
      localStorage.removeItem('builders_edge_remembered_email')
    }

    try {
      const result = await loginFn({ data: { email, password } })

      if (result?.success) {
        // Lock tab identity in sessionStorage so the root beforeLoad knows which cookie to read.
        // Also write to localStorage (FIX-3) so it survives tab/browser close.
        // Without localStorage fallback, returning users have no role hint → multi-cookie
        // ambiguity → server returns null → redirect to login even with a valid cookie.
        const tabId =
          sessionStorage.getItem('tab_id') ??
          Math.random().toString(36).substring(2) + Date.now().toString(36)
        sessionStorage.setItem('tab_id', tabId)
        sessionStorage.setItem('active_role', result.role)
        localStorage.setItem(`role_${tabId}`, result.role)     // tab-specific cross-session persistence

        // Hard navigate so the full SSR cycle restarts cleanly with the new cookie
        if (result.forcePasswordReset) {
          window.location.href = '/reset-password'
        } else if (result.role === 'admin') {
          window.location.href = '/admin'
        } else {
          window.location.href = '/'
        }
        // Don't setLoading(false) — page is navigating away
      } else {
        setError('Login failed. Please try again.')
        setLoading(false)
      }
    } catch (err: any) {
      // TanStack Start server fn errors surface as err.data.message or err.message
      const msg =
        err?.data?.message ??
        err?.message ??
        'Invalid email or password.'
      setError(msg)
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
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-[#888]">
          Manage your custom home leads and appointments
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0a0a] py-8 px-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:rounded-xl sm:px-10 border border-[#222]">
          <form
            className="space-y-6"
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            autoComplete="on"
          >
            {error && (

              <div className="bg-[#ff453a]/10 border border-[#ff453a]/30 rounded-lg p-3 text-sm text-[#ff453a] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#ccc]">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-[#333] bg-[#050505] px-3 py-2 placeholder-[#666] text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white sm:text-sm transition-all"
                  placeholder="admin@buildersedge.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#ccc]">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-[#333] bg-[#050505] px-3 py-2 placeholder-[#666] text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white sm:text-sm transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#888] hover:text-white focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#333] bg-[#050505] text-white focus:ring-white focus:ring-offset-[#0a0a0a]"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-[#888]">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => toast.info('Contact your administrator to reset your password.')}
                  className="font-medium text-[#ccc] hover:text-white transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </div>

            <div>
              <button
                id="sign-in-btn"
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg border border-transparent bg-white py-2 px-4 text-sm font-medium text-black shadow-sm hover:bg-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
