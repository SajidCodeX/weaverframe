import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { loginFn } from '@/lib/auth'
import { toast } from 'sonner'
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Building2,
  Compass,
  KeyRound,
  Radio
} from 'lucide-react'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'WeaverFrame | Client Portal & Executive Login' },
      { name: 'description', content: 'Secure access to the WeaverFrame AI Lead Concierge and Architecture Operating System.' },
    ],
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const router = useRouter()
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
      const result = await loginFn({ data: { email, password, rememberMe } })

      if (result?.success) {
        // Lock tab identity in sessionStorage so root beforeLoad knows which cookie to read.
        const tabId =
          sessionStorage.getItem('tab_id') ??
          Math.random().toString(36).substring(2) + Date.now().toString(36)
        sessionStorage.setItem('tab_id', tabId)
        sessionStorage.setItem('active_role', result.role)
        localStorage.setItem(`role_${tabId}`, result.role)

        // Fast-path: cache session from login response
        if (result.session) {
          ;(window as any).__pendingLoginSession = result.session
        }

        // Client-side navigate
        if (result.forcePasswordReset) {
          window.location.href = '/reset-password'
        } else if (result.role === 'admin') {
          await router.navigate({ to: '/admin' })
        } else {
          await router.navigate({ to: '/' })
        }
      } else {
        setError('Login failed. Please verify your credentials.')
        setLoading(false)
      }
    } catch (err: any) {
      const msg =
        err?.data?.message ??
        err?.message ??
        'Invalid email or password.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white flex flex-col lg:flex-row selection:bg-[#e5d9c5] selection:text-black font-sans relative overflow-hidden">
      {/* Ambient Lighting Orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-radial from-[#c9a84c]/[0.06] to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[700px] h-[700px] bg-radial from-[#e5d9c5]/[0.04] to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* ── LEFT PANE: LUXURY LOGIN FORM ── */}
      <div className="w-full lg:w-[50%] xl:w-[46%] min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 z-10 border-r border-white/[0.07] bg-[#060608]/90 backdrop-blur-xl">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-white/50 hover:text-[#e5d9c5] uppercase transition-colors group"
          >
            <ArrowLeft className="size-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Public Site</span>
          </Link>

          <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Vault Security Active</span>
          </div>
        </div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="my-auto max-w-md w-full mx-auto py-10"
        >
          {/* Brand Mark */}
          <div className="flex items-center gap-3.5 mb-8">
            <div className="size-11 rounded-xl border border-white/20 bg-black/60 flex items-center justify-center p-1.5 shadow-lg shadow-[#e5d9c5]/10">
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
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-nevera text-3xl sm:text-4xl text-white font-normal leading-tight">
              Executive Sign In
            </h1>
            <p className="text-xs sm:text-sm text-white/60 mt-2 font-light leading-relaxed">
              Enter your verified credentials to access your custom build pipeline, autonomous AI radar, and deal intelligence.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-3 font-mono"
            >
              <div className="size-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
            className="space-y-5"
          >
            {/* Email Field */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60 mb-2">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Mail className="size-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="builder@luxuryestates.com"
                  className="w-full bg-[#0e0f15] border border-white/[0.12] hover:border-white/25 focus:border-[#e5d9c5] rounded-xl pl-10 pr-4 py-3.5 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-[#e5d9c5]/50 transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-white/60">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Contact your administrator or executive sponsor to reset your password.')}
                  className="text-[10px] font-mono tracking-wider text-[#e5d9c5]/80 hover:text-white transition-colors cursor-pointer"
                >
                  Forgot Key?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
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
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-white/20 bg-[#0e0f15] text-[#e5d9c5] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#e5d9c5]"
                />
                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                  Remember this secure workstation
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="sign-in-btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#e5d9c5] hover:bg-white text-black text-xs font-bold uppercase tracking-widest transition-all rounded-xl shadow-xl shadow-[#e5d9c5]/15 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2 font-mono text-xs">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Enter Command Center</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Demonstration Notice */}
          <div className="mt-8 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-start gap-3 text-xs text-white/60">
            <Sparkles className="size-4 text-[#e5d9c5] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Need platform access?</span>
              <p className="text-[11px] text-white/50 mt-0.5">
                WeaverFrame licenses are issued exclusively to qualified custom builders.{' '}
                <Link to="/welcome" className="text-[#e5d9c5] hover:underline font-medium">
                  Request a Private Demo →
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Security Assurance Footer */}
        <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-white/40 tracking-wider">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>AES-256 GCM Encrypted</span>
          </div>
          <span>SOC-2 Type II Certified</span>
        </div>
      </div>

      {/* ── RIGHT PANE: BRAND & ARCHITECTURAL SHOWCASE ── */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[54%] min-h-screen bg-gradient-to-br from-[#0a0b10] via-[#060608] to-[#040405] p-12 xl:p-16 flex-col justify-between relative overflow-hidden border-l border-white/[0.05]">
        {/* Ambient Halo behind Villa Image */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-radial from-[#c9a84c]/[0.12] via-[#e5d9c5]/[0.03] to-transparent rounded-full blur-3xl pointer-events-none scale-125" />

        {/* Top Feature Pill */}
        <div className="flex items-center justify-between relative z-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md">
            <Radio className="size-3 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] font-semibold">
              Live AI Autonomous Screening Hub
            </span>
          </div>

          <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
            Austin · Aspen · Dubai
          </div>
        </div>

        {/* Center Showcase: Exploded Villa with Floating Metric Cards */}
        <div className="relative my-auto flex items-center justify-center py-6">
          {/* Villa Graphic */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-[620px] 2xl:max-w-[700px]"
          >
            <picture className="w-full">
              <source srcSet="/images/exploded-villa.webp" type="image/webp" />
              <img
                src="/images/exploded-villa.png"
                alt="WeaverFrame Exploded Luxury Architecture"
                className="w-full h-auto object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,0.95)] select-none pointer-events-none"
              />
            </picture>
          </motion.div>

          {/* Floating Metric Pill 1: Response Time */}
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute top-8 left-4 xl:left-8 z-20 p-4 rounded-2xl border border-white/[0.12] bg-[#0c0d12]/85 backdrop-blur-xl shadow-2xl space-y-1 max-w-[200px]"
          >
            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              <CheckCircle2 className="size-3.5" />
              <span>&lt; 45s Qualified</span>
            </div>
            <p className="text-xs text-white/80 font-medium">
              High-net-worth buyers engaged 24/7/365.
            </p>
          </motion.div>

          {/* Floating Metric Pill 2: Annual Pipeline */}
          <motion.div
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="absolute bottom-8 right-4 xl:right-8 z-20 p-4 rounded-2xl border border-[#e5d9c5]/30 bg-[#0c0d12]/85 backdrop-blur-xl shadow-2xl space-y-1 text-right max-w-[220px]"
          >
            <span className="font-nevera text-2xl text-[#e5d9c5] font-bold block">
              $180M+
            </span>
            <p className="text-[11px] text-white/70 font-mono uppercase tracking-wider">
              Protected Construction Pipeline
            </p>
          </motion.div>
        </div>

        {/* Bottom Testimonial Banner */}
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-xs font-light text-white/80 italic leading-relaxed">
              "WeaverFrame converts high-ticket inquiries into qualified showroom consultations with surgical precision."
            </p>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block mt-1">
              Marcus Reed — Principal, Reed Architecture Group
            </span>
          </div>
          <div className="size-10 rounded-full border border-[#e5d9c5]/30 bg-[#e5d9c5]/10 flex items-center justify-center shrink-0 text-[#e5d9c5]">
            <Building2 className="size-5" />
          </div>
        </div>
      </div>
    </div>
  )
}
