import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, Component, ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Calendar, Layers, Shield, Sparkles, Users, Zap, CheckCircle2, Building2 } from "lucide-react";

const Spline = React.lazy(() => import('@splinetool/react-spline'));

class ErrorBoundary extends Component<{children: ReactNode, fallback: ReactNode}, {hasError: boolean}> {
  constructor(props: {children: ReactNode, fallback: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Spline Model Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | Premium AI for Custom Home Builders" },
      { name: "description", content: "The ultimate AI Concierge and CRM for premium home builders." }
    ]
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-emerald-500/30 font-sans relative overflow-x-hidden custom-scrollbar">
      
      {/* ── AMBIENT GLOW (Lightweight CSS, no JS tracking) ── */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] pointer-events-none z-0" />

      {/* ── NAVIGATION ── */}
      <nav className="absolute top-0 left-0 right-0 z-50 py-6">
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer">
            <Layers className="size-6 text-white" />
            <span className="font-display text-xl font-bold tracking-widest uppercase text-white">WeaverFrame</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Platform</a>
            <a href="#ai" className="text-sm font-medium text-white/70 hover:text-white transition-colors">AI Concierge</a>
            <a href="#pricing" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-bold text-white hover:text-emerald-400 transition-colors uppercase tracking-widest hidden sm:block">
              Sign In
            </Link>
            <a href="mailto:contact@weaverframe.com" className="px-6 py-2.5 rounded-full text-sm font-bold bg-white text-black hover:bg-white/90 transition-all">
              Book a Demo
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <div className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden z-10">
        <div className="max-w-[1400px] mx-auto px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Text */}
          <div className="space-y-8 relative z-20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
            >
              <Sparkles className="size-4 text-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold tracking-wide text-white/90">Purpose-Built for Custom Builders</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-7xl font-display font-black tracking-tighter leading-[1.05]"
            >
              Build Homes.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500">
                We'll Build The Pipeline.
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }}
              className="text-xl md:text-2xl text-white/50 max-w-xl font-light leading-relaxed"
            >
              The definitive CRM and AI Concierge for elite home builders. Let our 70B AI handle objections and book site visits 24/7.
            </motion.p>
            
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} className="pt-4 flex items-center gap-6">
              <a href="mailto:contact@weaverframe.com" className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                Deploy Agency OS <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </motion.div>
          </div>

          {/* Right 3D Model (Spline Mini Room/House) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, delay: 0.4 }}
            className="relative h-[600px] w-full"
          >
            {/* The WebGL Canvas */}
            <div className="absolute inset-0">
              <ErrorBoundary fallback={
                <div className="w-full h-full rounded-3xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center p-8 text-center gap-4">
                  <Building2 className="size-16 text-emerald-500/50" />
                  <div className="text-white/50 text-sm">3D Architecture Model Unavailable (Private URL).<br/>Please provide a valid .splinecode export.</div>
                </div>
              }>
                <Suspense fallback={
                  <div className="w-full h-full rounded-3xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center gap-4">
                    <div className="size-12 rounded-full border-t-2 border-emerald-500 animate-spin" />
                    <div className="text-white/40 font-mono text-sm tracking-widest uppercase">Loading 3D Architecture Model...</div>
                  </div>
                }>
                  {/* Real 3D Architecture/Room Model */}
                  <Spline scene="https://prod.spline.design/Q7L7WjFzGgBvFhR0/scene.splinecode" />
                </Suspense>
              </ErrorBoundary>
            </div>
            {/* Floating glass label to ensure context */}
            <div className="absolute bottom-10 right-10 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center gap-3 shadow-2xl">
              <Building2 className="size-5 text-emerald-400" />
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">Project Type</div>
                <div className="text-sm font-semibold">Custom Luxury Estate</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── SOCIAL PROOF & STATS ── */}
      <div className="relative z-20 border-y border-white/5 bg-[#020202]/50 py-16 mt-20">
        <div className="max-w-[1400px] mx-auto px-8">
          <p className="text-center text-sm text-white/30 uppercase tracking-[0.3em] font-mono mb-10 font-semibold">
            Trusted by Elite Custom Home Builders
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
            <div className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight hover:text-emerald-400 transition-colors cursor-default"><Layers className="size-8"/> Apex Homes</div>
            <div className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight hover:text-blue-400 transition-colors cursor-default"><Bot className="size-8"/> Elevate Build</div>
            <div className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight hover:text-purple-400 transition-colors cursor-default"><Zap className="size-8"/> Nova Estates</div>
            <div className="flex items-center gap-3 font-display text-2xl font-bold tracking-tight hover:text-teal-400 transition-colors cursor-default"><Shield className="size-8"/> Prime Struct</div>
          </div>
        </div>
      </div>

      <div className="relative z-20 py-24">
        <div className="max-w-[1200px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">30s</div>
            <div className="text-emerald-400 font-mono text-sm tracking-widest uppercase">Avg Response Time</div>
            <p className="text-white/40 text-sm mt-4 font-light">Never lose a lead to slow replies. WeaverFrame engages instantly.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">92%</div>
            <div className="text-blue-400 font-mono text-sm tracking-widest uppercase">Lead Retention</div>
            <p className="text-white/40 text-sm mt-4 font-light">Autonomously follow up and keep prospects warm for months.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">24/7</div>
            <div className="text-purple-400 font-mono text-sm tracking-widest uppercase">Concierge Active</div>
            <p className="text-white/40 text-sm mt-4 font-light">Book site visits while you sleep, completely hands-free.</p>
          </motion.div>
        </div>
      </div>

      {/* ── FEATURES SECTION (Standard Flow, High Performance) ── */}
      <div id="features" className="py-32 relative z-20">
        <div className="max-w-[1400px] mx-auto px-8 space-y-32">
          
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h2 className="text-4xl md:text-6xl font-display font-bold">Engineered for <span className="text-emerald-400">Excellence.</span></h2>
            <p className="text-xl text-white/50 font-light">Not just a CRM. A complete operating system for custom home builders with AI embedded at the core.</p>
          </div>

          {/* Feature 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            className="flex flex-col lg:flex-row items-center gap-16"
          >
            <div className="flex-1 space-y-6">
              <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bot className="size-8 text-emerald-400" />
              </div>
              <h3 className="text-4xl font-display font-bold">Unmatched AI Logic.</h3>
              <p className="text-xl text-white/50 leading-relaxed font-light">
                Powered by Llama 3.3 70B, our concierge handles brutal objections, complex pricing queries, and automatically books site visits on your calendar.
              </p>
              <ul className="space-y-3 pt-4">
                <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-emerald-500" /> Zero Hallucinations</li>
                <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-emerald-500" /> Strict Timezone Enforcement</li>
              </ul>
            </div>
            <div className="flex-1 w-full h-[400px] rounded-3xl bg-[#0a0a0c] border border-white/10 flex items-center justify-center p-8 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
               <div className="w-full max-w-md space-y-4 relative z-10">
                 <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-5 text-white/80">Can I view the site tomorrow at 2 PM?</div>
                 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm p-5 text-emerald-50 ml-12 shadow-[0_10px_40px_rgba(16,185,129,0.1)]">I've booked your site visit for 2:00 PM tomorrow. Looking forward to showing you the property!</div>
               </div>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            className="flex flex-col lg:flex-row-reverse items-center gap-16"
          >
            <div className="flex-1 space-y-6">
              <div className="size-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="size-8 text-blue-400" />
              </div>
              <h3 className="text-4xl font-display font-bold">Built for Agencies.</h3>
              <p className="text-xl text-white/50 leading-relaxed font-light">
                Manage dozens of custom home builders from one single super-admin dashboard. Total isolation, strict privacy, and global analytics.
              </p>
              <ul className="space-y-3 pt-4">
                <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-blue-500" /> Multi-tenant Architecture</li>
                <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-blue-500" /> Impersonation Mode</li>
              </ul>
            </div>
            <div className="flex-1 w-full h-[400px] rounded-3xl bg-[#0a0a0c] border border-white/10 p-8 flex flex-col justify-center gap-4 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
               <div className="h-20 w-full rounded-2xl bg-white/5 border border-white/10 flex items-center px-6 gap-6 relative z-10 shadow-xl">
                 <div className="size-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Shield className="size-6 text-blue-400"/></div>
                 <div><div className="text-lg font-bold">Admin Console</div><div className="text-sm text-white/50">4 Active Builders</div></div>
               </div>
               <div className="h-20 w-full rounded-2xl bg-white/5 border border-white/10 flex items-center px-6 gap-6 relative z-10 opacity-60 ml-8">
                 <div className="size-12 rounded-xl bg-white/10 flex items-center justify-center"><Layers className="size-6 text-white/50"/></div>
                 <div><div className="text-lg font-bold">Apex Homes</div><div className="text-sm text-white/50">Impersonate Workspace</div></div>
               </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── PRICING SECTION ── */}
      <div id="pricing" className="py-32 relative z-20 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold">Simple, transparent <span className="text-emerald-400">pricing.</span></h2>
            <p className="text-xl text-white/50 font-light">Invest in an AI concierge that actually converts leads.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter */}
            <div className="rounded-3xl bg-[#0a0a0a] border border-white/10 p-10 flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Agency Starter</h3>
              <p className="text-white/50 mb-8 font-light">Perfect for small agencies managing up to 3 builders.</p>
              <div className="text-5xl font-display font-black mb-8">₹24,999<span className="text-xl text-white/30 font-light">/mo</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-500" /> Up to 3 Builder Sub-accounts</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-500" /> Llama 3.3 70B AI Engine</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-500" /> 1,000 AI Messages / month</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-500" /> Basic WhatsApp Support</li>
              </ul>
              <button className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">Start Free Trial</button>
            </div>
            
            {/* Pro */}
            <div className="rounded-3xl bg-emerald-500/5 border border-emerald-500/30 p-10 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
              <div className="absolute top-6 right-6 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest rounded-full border border-emerald-500/20">Most Popular</div>
              
              <h3 className="text-2xl font-bold mb-2">Agency Pro</h3>
              <p className="text-emerald-100/50 mb-8 font-light">For growing agencies scaling their builder portfolio.</p>
              <div className="text-5xl font-display font-black mb-8 text-emerald-400">₹49,999<span className="text-xl text-emerald-400/50 font-light">/mo</span></div>
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-400" /> Up to 10 Builder Sub-accounts</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-400" /> Advanced Calendar Integration</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-400" /> Unlimited AI Messages</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-400" /> Real-time Portal Syncing</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-emerald-400" /> 24/7 Dedicated Support</li>
              </ul>
              <button className="w-full py-4 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors shadow-[0_0_30px_rgba(16,185,129,0.3)]">Deploy Agency Pro</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="py-20 relative z-30 bg-[#020202]">
        <div className="max-w-[1400px] mx-auto px-8 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-display font-bold">Ready to scale?</h2>
          <p className="text-xl text-white/50 font-light">Join the most exclusive platform for luxury home builders.</p>
          <a href="mailto:contact@weaverframe.com" className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300">
            Contact Enterprise Sales <ArrowRight className="size-5" />
          </a>
        </div>
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between max-w-[1400px] mx-auto px-8 text-sm text-white/30 font-medium">
          <div className="flex items-center gap-2"><Layers className="size-4" /> WeaverFrame © {new Date().getFullYear()}</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
