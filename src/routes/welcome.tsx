import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { ArrowRight, Bot, Calendar, Layers, Shield, Sparkles, Users, Zap, CheckCircle2 } from "lucide-react";

const Spline = React.lazy(() => import('@splinetool/react-spline'));

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Global Scroll Progress (tracked on the scrollable container)
  const { scrollYProgress } = useScroll({ container: containerRef });
  const smoothScroll = useSpring(scrollYProgress, { damping: 20, stiffness: 100, mass: 0.5 });

  // Mouse Tracking for ambient glows
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.body.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // HERO ANIMATIONS (Fades out and shrinks as we scroll down)
  const heroScale = useTransform(smoothScroll, [0, 0.2], [1, 0.8]);
  const heroRotateX = useTransform(smoothScroll, [0, 0.2], [0, 15]);
  const heroOpacity = useTransform(smoothScroll, [0, 0.15], [1, 0]);
  const heroY = useTransform(smoothScroll, [0, 0.2], [0, -100]);

  // FEATURES SCROLL (3D Stacking Cards)
  // The features section spans from 0.2 to 0.8 of the total scroll
  // Card 1
  const card1Scale = useTransform(smoothScroll, [0.3, 0.45], [1, 0.9]);
  const card1Y = useTransform(smoothScroll, [0.3, 0.45], [0, -40]);
  const card1Opacity = useTransform(smoothScroll, [0.4, 0.5], [1, 0.4]);
  const card1Z = useTransform(smoothScroll, [0.3, 0.45], [0, -50]);
  
  // Card 2
  const card2Y = useTransform(smoothScroll, [0.25, 0.4], [800, 0]); // Slides in
  const card2Scale = useTransform(smoothScroll, [0.5, 0.65], [1, 0.9]);
  const card2YOffset = useTransform(smoothScroll, [0.5, 0.65], [0, -40]);
  const card2Opacity = useTransform(smoothScroll, [0.6, 0.7], [1, 0.4]);
  const card2Z = useTransform(smoothScroll, [0.5, 0.65], [0, -50]);
  
  // Card 3
  const card3Y = useTransform(smoothScroll, [0.45, 0.6], [800, 0]); // Slides in

  // FOOTER ANIMATION
  const footerY = useTransform(smoothScroll, [0.8, 1], [300, 0]);
  const footerOpacity = useTransform(smoothScroll, [0.8, 0.95], [0, 1]);

  return (
    <div ref={containerRef} className="h-screen bg-[#020202] text-white overflow-x-hidden overflow-y-auto selection:bg-emerald-500/30 font-sans relative">
      
      {/* ── AMBIENT MOUSE GLOW (Optimized) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        <motion.div 
          className="absolute w-[600px] h-[600px] rounded-full mix-blend-screen"
          style={{ 
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0) 70%)',
            x: useSpring(useTransform(mouseX, [-0.5, 0.5], [-300, 300]), { damping: 40 }),
            y: useSpring(useTransform(mouseY, [-0.5, 0.5], [-300, 300]), { damping: 40 }),
          }}
        />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      {/* ── NAVIGATION ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-6 mix-blend-difference">
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
            <Link 
              to="/login"
              className="text-sm font-bold text-white hover:text-emerald-400 transition-colors uppercase tracking-widest hidden sm:block"
            >
              Sign In
            </Link>
            <a 
              href="mailto:contact@weaverframe.com"
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-white text-black hover:bg-white/90 transition-all"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION (STICKY) ── */}
      <div className="h-[150vh] relative z-10">
        <motion.div 
          className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{ scale: heroScale, rotateX: heroRotateX, opacity: heroOpacity, y: heroY, perspective: 1500, transformStyle: "preserve-3d" }}
        >
          <div className="max-w-[1200px] mx-auto px-8 text-center space-y-8 flex flex-col items-center relative z-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
            >
              <Sparkles className="size-4 text-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold tracking-wide text-white/90">Introducing The AI Operating System</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="text-6xl md:text-[7rem] font-display font-black tracking-tighter leading-[0.95]"
            >
              Scale Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">
                Agency.
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
              className="text-xl md:text-2xl text-white/50 max-w-2xl font-light leading-relaxed"
            >
              The definitive multi-tenant dashboard for managing elite custom home builders. Automate SMS nurturing and site visits with 70B AI.
            </motion.p>
          </div>

          {/* Real WebGL 3D Hero Model */}
          <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-60">
            <Suspense fallback={
              <div className="w-[800px] h-[800px] rounded-full border border-emerald-500/10 animate-pulse flex items-center justify-center">
                <div className="text-emerald-500/50 text-sm font-mono tracking-widest uppercase">Loading 3D Engine...</div>
              </div>
            }>
              <Spline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
            </Suspense>
          </div>
        </motion.div>
      </div>

      {/* ── SOCIAL PROOF BAR ── */}
      <div className="relative z-20 border-y border-white/5 bg-[#020202]/50 backdrop-blur-xl py-16">
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

      {/* ── QUICK STATS ── */}
      <div className="relative z-20 bg-[#020202] py-24">
        <div className="max-w-[1200px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">30s</div>
            <div className="text-emerald-400 font-mono text-sm tracking-widest uppercase">Avg Response Time</div>
            <p className="text-white/40 text-sm mt-4 font-light">Never lose a lead to slow replies. WeaverFrame engages instantly.</p>
          </div>
          <div className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">92%</div>
            <div className="text-blue-400 font-mono text-sm tracking-widest uppercase">Lead Retention</div>
            <p className="text-white/40 text-sm mt-4 font-light">Autonomously follow up and keep prospects warm for months.</p>
          </div>
          <div className="text-center space-y-2">
            <div className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">24/7</div>
            <div className="text-purple-400 font-mono text-sm tracking-widest uppercase">Concierge Active</div>
            <p className="text-white/40 text-sm mt-4 font-light">Book site visits while you sleep, completely hands-free.</p>
          </div>
        </div>
      </div>

      {/* ── 3D STACKING FEATURES SCROLL ── */}
      {/* Container is 300vh tall to allow scrolling through the 3 cards */}
      <div className="h-[300vh] relative z-20">
        <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden perspective-[2000px]">
          
          <div className="absolute top-20 text-center w-full z-0">
            <h2 className="text-4xl md:text-6xl font-display font-bold text-white/10 tracking-tight uppercase">Engineered Platform</h2>
          </div>

          <div className="relative w-full max-w-[1000px] h-[500px] flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
            
            {/* CARD 1 */}
            <motion.div 
              className="absolute w-full h-full rounded-3xl bg-[#0a0a0c] border border-white/10 shadow-2xl p-12 flex flex-col justify-center origin-bottom will-change-transform"
              style={{ scale: card1Scale, y: card1Y, z: card1Z, opacity: card1Opacity }}
            >
              <div className="flex gap-12 items-center h-full">
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
                <div className="flex-1 h-full rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden flex items-center justify-center">
                   <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
                   <div className="space-y-4 w-3/4 z-10">
                     <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4 text-sm text-white/80">Can I view the site tomorrow at 2 PM?</div>
                     <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm p-4 text-sm text-emerald-50 ml-8">I've booked your site visit for 2:00 PM tomorrow. Looking forward to showing you the property!</div>
                   </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 2 */}
            <motion.div 
              className="absolute w-full h-full rounded-3xl bg-[#0a0a0c] border border-white/10 shadow-2xl p-12 flex flex-col justify-center origin-bottom will-change-transform"
              style={{ scale: card2Scale, y: useTransform(() => card2Y.get() + card2YOffset.get()), z: card2Z, opacity: card2Opacity }}
            >
              <div className="flex gap-12 items-center h-full">
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
                <div className="flex-1 h-full rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden flex flex-col gap-3 p-6 justify-center">
                   <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                   <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10 flex items-center px-4 gap-4 z-10">
                     <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center"><Shield className="size-5 text-blue-400"/></div>
                     <div><div className="text-sm font-bold">Admin Console</div><div className="text-xs text-white/50">4 Active Builders</div></div>
                   </div>
                   <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10 flex items-center px-4 gap-4 z-10 opacity-70">
                     <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center"><Layers className="size-5 text-white/50"/></div>
                     <div><div className="text-sm font-bold">Apex Homes</div><div className="text-xs text-white/50">Impersonate</div></div>
                   </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 3 */}
            <motion.div 
              className="absolute w-full h-full rounded-3xl bg-[#0a0a0c] border border-white/10 shadow-2xl p-12 flex flex-col justify-center origin-bottom will-change-transform"
              style={{ y: card3Y }}
            >
              <div className="flex gap-12 items-center h-full">
                <div className="flex-1 space-y-6">
                  <div className="size-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Zap className="size-8 text-purple-400" />
                  </div>
                  <h3 className="text-4xl font-display font-bold">Real-Time Sync.</h3>
                  <p className="text-xl text-white/50 leading-relaxed font-light">
                    Watch leads interact with their client portals live. Our real-time polling infrastructure shows exactly who is online and engaged.
                  </p>
                  <ul className="space-y-3 pt-4">
                    <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-purple-500" /> Live Presence Tracking</li>
                    <li className="flex items-center gap-3 text-white/80"><CheckCircle2 className="size-5 text-purple-500" /> Optimistic UI Updates</li>
                  </ul>
                </div>
                <div className="flex-1 h-full rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden flex items-center justify-center">
                   <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                   <div className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 z-10 flex items-center gap-4">
                     <div className="size-12 rounded-full bg-white/10 flex items-center justify-center font-bold">JD</div>
                     <div>
                       <div className="font-bold flex items-center gap-2">John Doe <span className="flex size-2 rounded-full bg-green-500 animate-pulse" /></div>
                       <div className="text-xs text-green-400 font-medium tracking-widest uppercase mt-1">Online (Portal)</div>
                     </div>
                   </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* ── CTA / FOOTER ── */}
      <div className="h-screen relative z-30 flex items-center justify-center overflow-hidden bg-[#020202]">
        <motion.div 
          className="text-center space-y-12 max-w-[800px] mx-auto px-8"
          style={{ y: footerY, opacity: footerOpacity }}
        >
          <h2 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-tight">
            Ready to upgrade your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Builder Stack?</span>
          </h2>
          <p className="text-2xl text-white/40 font-light">
            Join the most exclusive platform for luxury home builders.
          </p>
          <a 
            href="mailto:contact@weaverframe.com"
            className="group inline-flex items-center gap-4 px-12 py-6 bg-white text-black font-bold rounded-full text-xl shadow-xl hover:scale-105 transition-all duration-300"
          >
            Contact Sales <ArrowRight className="size-6 group-hover:translate-x-2 transition-transform" />
          </a>
        </motion.div>
        
        {/* Footer bottom links */}
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center text-xs text-white/30 font-medium">
          <div>© {new Date().getFullYear()} WeaverFrame</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
