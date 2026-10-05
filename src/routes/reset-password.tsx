import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { requestPasswordReset, verifyPasswordResetToken, resetPasswordWithToken } from '@/lib/auth'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  loaderDeps: ({ search: { token } }) => ({ token }),
  loader: async ({ deps: { token } }) => {
    if (!token) {
      return { token: null, isValid: false, email: null, displayName: null }
    }
    try {
      const res = await verifyPasswordResetToken({ data: token })
      return {
        token,
        isValid: res.valid,
        email: res.email || null,
        displayName: res.displayName || null,
      }
    } catch {
      return { token, isValid: false, email: null, displayName: null }
    }
  },
  head: () => ({
    meta: [
      { title: 'WeaverFrame | Reset Password' },
      { name: 'description', content: 'Reset your WeaverFrame account password.' },
    ],
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, isValid, email: prefillEmail, displayName } = Route.useLoaderData()
  const navigate = useNavigate()

  // State when requesting a reset link
  const [requestEmail, setRequestEmail] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')

  // State when setting new password with token
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetError, setResetError] = useState('')

  // Handle request password reset link
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRequestError('')
    if (!requestEmail.trim() || !requestEmail.includes('@')) {
      setRequestError('Please enter a valid email address.')
      return
    }

    setIsRequesting(true)
    try {
      const res = await requestPasswordReset({ data: { email: requestEmail.trim() } })
      setRequestSuccess(true)
      setRequestMessage(res.message || 'If an account exists with that email, we have sent a reset link.')
    } catch (err: any) {
      setRequestError(err?.message || 'Failed to send reset link. Please try again.')
    } finally {
      setIsRequesting(false)
    }
  }

  // Handle setting new password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')

    if (password.length < 8) {
      setResetError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    if (!token) {
      setResetError('Reset token is missing.')
      return
    }

    setIsResetting(true)
    try {
      const res = await resetPasswordWithToken({ data: { token, password } })
      if (res.success) {
        setResetSuccess(true)
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
    } catch (err: any) {
      setResetError(err?.message || 'Failed to update password. Link may have expired.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white flex flex-col justify-center items-center p-6 sm:p-12 font-sans relative overflow-hidden selection:bg-[#e5d9c5] selection:text-black">
      {/* Ambient Lighting Orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-radial from-[#c9a84c]/[0.06] to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[700px] h-[700px] bg-radial from-[#e5d9c5]/[0.04] to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* Centered Form Container */}
      <div className="max-w-md w-full mx-auto z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Brand Mark (Exact match with login.tsx) */}
        <Link to="/login" className="flex items-center gap-3.5 mb-8 group inline-flex">
          <div className="size-11 rounded-xl border border-white/20 bg-black/60 flex items-center justify-center p-1.5 shadow-lg shadow-[#e5d9c5]/10 group-hover:border-[#e5d9c5]/40 transition-colors">
            <img src="/weaverframe-mark-transparent.png" alt="WeaverFrame" className="size-full object-contain" />
          </div>
          <div>
            <span className="font-nevera text-xl tracking-[0.2em] uppercase text-white font-semibold block leading-none">
              WeaverFrame
            </span>
            <span className="text-[9px] font-mono tracking-widest text-[#e5d9c5]/70 uppercase block mt-1">
              AI Sales Concierge
            </span>
          </div>
        </Link>

        {/* ─────────────────────────────────────────────────────────────────
            CASE 1: TOKEN PRESENT AND EXPIRED / INVALID
        ────────────────────────────────────────────────────────────────── */}
        {token && !isValid && (
          <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/90 backdrop-blur-xl shadow-2xl space-y-6 text-center">
            <div className="size-12 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="size-6" />
            </div>

            <div>
              <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                Link Expired
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-2 font-light leading-relaxed">
                This password reset link is invalid or has expired. Reset links are valid for 60 minutes.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <Link
                to="/reset-password"
                search={{}}
                className="w-full bg-[#e5d9c5] text-black hover:bg-[#d8cbb5] font-semibold rounded-xl py-3.5 text-xs transition-all tracking-wider uppercase font-mono shadow-lg shadow-[#e5d9c5]/10 cursor-pointer flex items-center justify-center"
              >
                Request New Link
              </Link>
              <Link
                to="/login"
                className="w-full py-2.5 inline-flex items-center justify-center gap-2 text-xs font-mono tracking-widest text-white/50 hover:text-[#e5d9c5] uppercase transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            CASE 2: TOKEN PRESENT AND VALID -> SET NEW PASSWORD
        ────────────────────────────────────────────────────────────────── */}
        {token && isValid && (
          <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/90 backdrop-blur-xl shadow-2xl">
            {resetSuccess ? (
              <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-200">
                <div className="size-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="size-8" />
                </div>
                <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                  Password Updated
                </h1>
                <p className="text-xs sm:text-sm text-white/60 font-light leading-relaxed">
                  Your new password is set. Redirecting to your dashboard...
                </p>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono text-[#e5d9c5]">
                    <div className="size-2 rounded-full bg-[#e5d9c5] animate-ping" />
                    Entering WeaverFrame...
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-6">
                <div>
                  <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                    Reset Password
                  </h1>
                  <p className="text-xs sm:text-sm text-white/60 mt-2 font-light leading-relaxed">
                    Set a new password for <span className="text-white font-mono">{prefillEmail}</span>
                  </p>
                </div>

                {resetError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-3 font-mono">
                    <div className="size-2 rounded-full bg-rose-500 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Lock className="size-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0e0f15] border border-white/[0.12] hover:border-white/25 focus:border-[#e5d9c5] rounded-xl pl-10 pr-11 py-3.5 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#e5d9c5]/50 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-white/40 mt-1.5 block font-mono">
                    Must be at least 8 characters
                  </span>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Lock className="size-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0e0f15] border border-white/[0.12] hover:border-white/25 focus:border-[#e5d9c5] rounded-xl pl-10 pr-11 py-3.5 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#e5d9c5]/50 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={isResetting || !password || !confirmPassword}
                    className="w-full bg-[#e5d9c5] text-black hover:bg-[#d8cbb5] font-semibold rounded-xl py-3.5 text-xs transition-all tracking-wider uppercase font-mono shadow-lg shadow-[#e5d9c5]/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isResetting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            CASE 3: NO TOKEN -> REQUEST RESET LINK FORM
        ────────────────────────────────────────────────────────────────── */}
        {!token && (
          <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/90 backdrop-blur-xl shadow-2xl">
            {requestSuccess ? (
              <div className="text-center space-y-5 py-2 animate-in zoom-in-95 duration-200">
                <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mx-auto flex items-center justify-center">
                  <Mail className="size-6" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                    Check Your Inbox
                  </h1>
                  <p className="text-xs sm:text-sm text-white/60 mt-2 font-light leading-relaxed">
                    {requestMessage}
                  </p>
                </div>

                <div className="pt-3">
                  <Link
                    to="/login"
                    className="w-full bg-[#e5d9c5] text-black hover:bg-[#d8cbb5] font-semibold rounded-xl py-3.5 text-xs transition-all tracking-wider uppercase font-mono shadow-lg shadow-[#e5d9c5]/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="size-3.5" /> Return to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-6">
                <div>
                  <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                    Reset Password
                  </h1>
                  <p className="text-xs sm:text-sm text-white/60 mt-2 font-light leading-relaxed">
                    Enter your email address to receive a secure password reset link.
                  </p>
                </div>

                {requestError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-3 font-mono">
                    <div className="size-2 rounded-full bg-rose-500 shrink-0" />
                    <span>{requestError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Mail className="size-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="builder@luxuryestates.com"
                      className="w-full bg-[#0e0f15] border border-white/[0.12] hover:border-white/25 focus:border-[#e5d9c5] rounded-xl pl-10 pr-4 py-3.5 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#e5d9c5]/50 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <button
                    type="submit"
                    disabled={isRequesting || !requestEmail.trim()}
                    className="w-full bg-[#e5d9c5] text-black hover:bg-[#d8cbb5] font-semibold rounded-xl py-3.5 text-xs transition-all tracking-wider uppercase font-mono shadow-lg shadow-[#e5d9c5]/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRequesting ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <div className="text-center">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-white/50 hover:text-[#e5d9c5] uppercase transition-colors"
                    >
                      <ArrowLeft className="size-3.5" /> Back to Sign In
                    </Link>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
