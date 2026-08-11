import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Layers, Shield, Sparkles, Users, Zap, CheckCircle2, Building2 } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// ── 3D BUILDING SCENE ────────────────────────────────────────────────────────

function BuildingWireframe() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  const emerald = new THREE.Color("#10b981");
  const blue = new THREE.Color("#3b82f6");
  const white = new THREE.Color("#ffffff");

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {/* Main Body */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[2.4, 1.6, 1.6]} />
        <meshStandardMaterial color={emerald} wireframe transparent opacity={0.6} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 2.0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 1.0, 4]} />
        <meshStandardMaterial color={white} wireframe transparent opacity={0.4} />
      </mesh>

      {/* Left Wing */}
      <mesh position={[-1.7, 0.3, 0]}>
        <boxGeometry args={[1.0, 0.6, 1.4]} />
        <meshStandardMaterial color={blue} wireframe transparent opacity={0.5} />
      </mesh>
      {/* Right Wing */}
      <mesh position={[1.7, 0.3, 0]}>
        <boxGeometry args={[1.0, 0.6, 1.4]} />
        <meshStandardMaterial color={blue} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Ground Deck */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[4.2, 0.1, 2.4]} />
        <meshStandardMaterial color={emerald} wireframe transparent opacity={0.3} />
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.2, 0.81]}>
        <boxGeometry args={[0.45, 0.75, 0.02]} />
        <meshStandardMaterial color={white} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Window Left */}
      <mesh position={[-0.7, 0.9, 0.81]}>
        <boxGeometry args={[0.45, 0.45, 0.02]} />
        <meshStandardMaterial color={emerald} wireframe transparent opacity={0.7} />
      </mesh>
      {/* Window Right */}
      <mesh position={[0.7, 0.9, 0.81]}>
        <boxGeometry args={[0.45, 0.45, 0.02]} />
        <meshStandardMaterial color={emerald} wireframe transparent opacity={0.7} />
      </mesh>

      {/* Floating node spheres at corners */}
      {[[-1.2, 0.0, 0.8], [1.2, 0.0, 0.8], [-1.2, 0.0, -0.8], [1.2, 0.0, -0.8],
        [-1.2, 1.6, 0.8], [1.2, 1.6, 0.8], [-1.2, 1.6, -0.8], [1.2, 1.6, -0.8]
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={emerald} emissive={emerald} emissiveIntensity={2} />
        </mesh>
      ))}
    </group>
  );
}

function Scene3D() {
  return (
    <Canvas style={{ background: "transparent" }} gl={{ antialias: true, alpha: true }}>
      <PerspectiveCamera makeDefault position={[4, 2, 5]} fov={45} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#10b981" />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#3b82f6" />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#10b981" />
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <BuildingWireframe />
      </Float>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 3} />
    </Canvas>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | Premium AI for Custom Home Builders" },
      { name: "description", content: "The definitive CRM and AI Concierge for elite custom home builders." }
    ]
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <div className="h-screen bg-[#020202] text-white font-sans relative overflow-x-hidden overflow-y-auto">

      {/* Ambient top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-emerald-500/8 blur-[130px] rounded-full pointer-events-none z-0" />
      {/* Subtle grid */}
      <div className="fixed inset-0 bg-[radial-gradient(rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_60%_60%_at_center,black,transparent)] pointer-events-none z-0" />

      {/* ── NAV ── */}
      <nav className="absolute top-0 left-0 right-0 z-50 py-6">
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="size-6 text-emerald-400" />
            <span className="text-xl font-black tracking-widest uppercase">WeaverFrame</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Platform</a>
            <a href="#ai" className="hover:text-white transition-colors">AI Concierge</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="text-sm font-bold text-white/70 hover:text-white transition-colors hidden sm:block">Sign In</Link>
            <a href="mailto:contact@weaverframe.com" className="px-5 py-2.5 rounded-full text-sm font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.4)]">Book a Demo</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[95vh] flex items-center pt-24 overflow-hidden z-10">
        <div className="max-w-[1400px] mx-auto px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* Left Copy */}
          <div className="space-y-8 z-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            >
              <Sparkles className="size-3.5" />
              <span className="text-xs font-bold tracking-[0.15em] uppercase">Purpose-Built for Custom Builders</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.0]"
            >
              Build Homes.<br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                We Build the Pipeline.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.25 }}
              className="text-lg md:text-xl text-white/45 max-w-xl leading-relaxed font-light"
            >
              The definitive multi-tenant CRM and 70B AI Concierge for elite custom home builders. Automate lead nurturing and site visits — 24/7, hands-free.
            </motion.p>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="flex items-center gap-5 pt-2">
              <a href="mailto:contact@weaverframe.com" className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-full text-base hover:scale-105 transition-all shadow-[0_4px_40px_rgba(255,255,255,0.15)]">
                Deploy Agency OS <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors underline underline-offset-4">
                Sign in →
              </Link>
            </motion.div>
          </div>

          {/* Right: Real 3D Building (self-contained, no external URL) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.3 }}
            className="relative h-[560px] w-full"
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                <div className="size-10 rounded-full border-t-2 border-emerald-500 animate-spin" />
              </div>
            }>
              <Scene3D />
            </Suspense>

            {/* Context label */}
            <div className="absolute bottom-8 right-4 px-4 py-2.5 rounded-2xl bg-black/60 border border-white/10 flex items-center gap-3 shadow-2xl backdrop-blur-md">
              <Building2 className="size-5 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Project Type</div>
                <div className="text-sm font-semibold">Custom Luxury Estate</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>


      {/* ── HOW IT WORKS ── */}
      <div className="relative z-10 border-y border-white/5 py-24 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(16,185,129,0.04),transparent)] pointer-events-none" />

        <div className="max-w-[1200px] mx-auto px-8 relative z-10">
          <div className="text-center mb-20">
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.5 }}
              className="text-[10px] font-black uppercase tracking-[0.45em] text-emerald-400 mb-3"
            >
              How It Works
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.5 }} transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black tracking-tighter"
            >
              From inquiry to signed deal.<br />
              <span className="text-white/30">Zero effort from you.</span>
            </motion.h2>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.66%+16px)] right-[calc(16.66%+16px)] h-px bg-gradient-to-r from-emerald-500/30 via-blue-500/30 to-purple-500/30" />

            {[
              {
                num: "01",
                color: "emerald",
                icon: Zap,
                title: "Lead Arrives",
                body: "A prospect inquires about your project via WhatsApp, SMS, or your portal. WeaverFrame captures it instantly, 24/7.",
                badge: "Any Channel",
              },
              {
                num: "02",
                color: "blue",
                icon: Bot,
                title: "AI Takes Over",
                body: "Our 70B AI Concierge responds within 30 seconds. It handles objections, shares pricing, and books a site visit on your calendar.",
                badge: "< 30s Response",
              },
              {
                num: "03",
                color: "purple",
                icon: Building2,
                title: "You Close the Deal",
                body: "Show up to a pre-qualified, site-visit-ready prospect. No cold follow-ups, no chasing. Just walk in and convert.",
                badge: "Higher Close Rate",
              },
            ].map(({ num, color, icon: Icon, title, body, badge }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="relative group"
              >
                {/* Card */}
                <div className={`rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/8 p-8 h-full flex flex-col gap-5 hover:border-${color}-500/25 transition-all duration-500`}>
                  {/* Step number + icon row */}
                  <div className="flex items-center justify-between">
                    <span className={`text-5xl font-black text-${color}-500/20 leading-none`}>{num}</span>
                    <div className={`size-12 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`size-6 text-${color}-400`} />
                    </div>
                  </div>

                  {/* Badge */}
                  <div className={`self-start px-3 py-1 rounded-full bg-${color}-500/10 border border-${color}-500/20 text-[10px] font-black uppercase tracking-widest text-${color}-400`}>
                    {badge}
                  </div>

                  <div>
                    <h3 className="text-xl font-black mb-2">{title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed font-light">{body}</p>
                  </div>
                </div>

                {/* Arrow between cards (desktop) */}
                {i < 2 && (
                  <div className="hidden md:flex absolute top-10 -right-3 z-10 size-6 rounded-full bg-[#020202] border border-white/10 items-center justify-center">
                    <ArrowRight className="size-3 text-white/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>


      {/* ── STATS (Glassmorphism Cards) ── */}
      <div className="py-28 relative z-10">
        {/* Radial background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(16,185,129,0.06),transparent)] pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { num: "30s", label: "Avg. AI Response Time", color: "emerald", icon: Zap, desc: "From inquiry to personalized reply in under 30 seconds, 24/7." },
              { num: "92%", label: "Lead Retention Rate", color: "blue", icon: Users, desc: "Autonomous follow-ups keep your pipeline warm for months." },
              { num: "24/7", label: "Concierge Always On", color: "purple", icon: Bot, desc: "Site visits booked automatically while you focus on building." },
            ].map(({ num, label, color, icon: Icon, desc }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.25 }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className={`relative rounded-3xl p-8 border overflow-hidden cursor-default group
                  bg-gradient-to-b from-white/[0.04] to-transparent
                  border-white/8 hover:border-${color}-500/30 transition-all duration-500`}
              >
                {/* Corner glow */}
                <div className={`absolute -top-10 -right-10 w-36 h-36 rounded-full bg-${color}-500/10 blur-2xl group-hover:bg-${color}-500/20 transition-all duration-500`} />
                <div className={`size-12 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center mb-6`}>
                  <Icon className={`size-6 text-${color}-400`} />
                </div>
                <div className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-${color}-400 mb-2 leading-none`}>{num}</div>
                <div className={`text-xs font-black uppercase tracking-[0.2em] text-${color}-400 mb-4`}>{label}</div>
                <p className="text-sm text-white/35 leading-relaxed font-light">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" className="relative z-10">

        {/* Section Header */}
        <div className="max-w-[1300px] mx-auto px-8 text-center pb-20">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.25 }} className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-4">Platform Capabilities</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} className="text-5xl md:text-6xl font-black tracking-tighter">
            The AI Operating System<br />for Home Builders.
          </motion.h2>
        </div>

        {/* FEATURE 1 — Full bleed section */}
        <div className="relative overflow-hidden py-20 border-y border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/40 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/8 rounded-full blur-[100px]" />
          <div className="max-w-[1300px] mx-auto px-8 flex flex-col lg:flex-row items-center gap-16 relative z-10">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.7 }} className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase">
                <Bot className="size-3.5" /> AI Concierge
              </div>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                Never Miss a Lead.<br /><span className="text-emerald-400">Ever Again.</span>
              </h3>
              <p className="text-lg text-white/45 leading-relaxed font-light max-w-lg">
                Llama 3.3 70B answers objections, handles pricing questions, and books site visits autonomously — 24 hours a day, 7 days a week.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {["Zero Hallucinations", "Strict Timezone Enforcement", "Voice-Matched Brand Tone", "Multi-language Support"].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/60">
                    <div className="size-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-3 text-emerald-400" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AI Chat Mockup */}
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.7 }} className="flex-1 w-full">
              <div className="relative rounded-3xl bg-[#060606] border border-white/8 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                {/* Mockup Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Bot className="size-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">WeaverFrame AI</div>
                      <div className="flex items-center gap-1"><div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-white/40">Online · Apex Homes</span></div>
                    </div>
                  </div>
                  <div className="flex gap-1.5"><div className="size-2.5 rounded-full bg-white/10" /><div className="size-2.5 rounded-full bg-white/10" /><div className="size-2.5 rounded-full bg-emerald-500/50" /></div>
                </div>
                {/* Messages */}
                <div className="p-6 space-y-4 min-h-[280px]">
                  <div className="flex items-end gap-3">
                    <div className="size-7 rounded-full bg-white/5 border border-white/10 shrink-0" />
                    <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white/70 max-w-[80%]">
                      Hi, I'm interested in your 4BHK villa project. What's the starting price?
                    </div>
                  </div>
                  <div className="flex items-end gap-3 flex-row-reverse">
                    <div className="size-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Bot className="size-3.5 text-emerald-400" />
                    </div>
                    <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl rounded-br-sm px-4 py-3 text-sm text-emerald-50/90 max-w-[80%] shadow-lg">
                      <span className="text-emerald-400 font-bold text-xs block mb-1">WeaverFrame AI · just now</span>
                      Our 4BHK luxury villas start from ₹2.4 Cr. I'd love to arrange a private site visit for you. Are you available this Saturday at 11 AM?
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="size-7 rounded-full bg-white/5 border border-white/10 shrink-0" />
                    <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-white/70 max-w-[80%]">Yes, Saturday works for me!</div>
                  </div>
                  <div className="flex items-end gap-3 flex-row-reverse">
                    <div className="size-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Bot className="size-3.5 text-emerald-400" />
                    </div>
                    <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl rounded-br-sm px-4 py-3 text-sm text-emerald-50/90 max-w-[80%]">
                      <span className="text-emerald-400 font-bold text-xs block mb-1">WeaverFrame AI · just now</span>
                      ✅ Booked! Your site visit is confirmed for Saturday, 11:00 AM. You'll receive a confirmation SMS shortly.
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-white/5 flex gap-3">
                  <div className="flex-1 rounded-xl bg-white/4 border border-white/8 px-4 py-2.5 text-sm text-white/25">Type a message...</div>
                </div>
                {/* Bottom glow */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-500/5 to-transparent" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* FEATURE 2 */}
        <div className="relative overflow-hidden py-20 border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-l from-blue-950/40 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/8 rounded-full blur-[100px]" />
          <div className="max-w-[1300px] mx-auto px-8 flex flex-col lg:flex-row-reverse items-center gap-16 relative z-10">
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.7 }} className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase">
                <Shield className="size-3.5" /> Agency Control
              </div>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
                One Dashboard.<br /><span className="text-blue-400">Unlimited Builders.</span>
              </h3>
              <p className="text-lg text-white/45 leading-relaxed font-light max-w-lg">
                A true multi-tenant platform. Manage each builder as a fully isolated workspace from a single command center. Total privacy, zero data mixing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {["Multi-tenant Architecture", "1-Click Impersonation", "Cross-builder Analytics", "Isolated Data Stores"].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/60">
                    <div className="size-5 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="size-3 text-blue-400" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Agency Dashboard Mockup */}
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.7 }} className="flex-1 w-full">
              <div className="relative rounded-3xl bg-[#060606] border border-white/8 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] p-6 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-black uppercase tracking-widest text-white/30">Agency Admin</div>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold"><div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />All Systems Live</div>
                </div>
                {[
                  { name: "Apex Homes", leads: 142, revenue: "₹2.1Cr", status: "Active", color: "emerald" },
                  { name: "Nova Estates", leads: 89, revenue: "₹1.4Cr", status: "Active", color: "blue" },
                  { name: "Prime Struct", leads: 63, revenue: "₹0.9Cr", status: "Active", color: "purple" },
                  { name: "Elevate Build", leads: 31, revenue: "₹0.5Cr", status: "Setup", color: "yellow" },
                ].map(({ name, leads, revenue, status, color }, i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.25 }}
                    transition={{ delay: i * 0.1 }}
                    className={`rounded-2xl bg-white/[0.03] border border-white/6 px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.06] hover:border-${color}-500/20 transition-all duration-300 cursor-default group`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-9 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center`}>
                        <Building2 className={`size-4 text-${color}-400`} />
                      </div>
                      <div>
                        <div className="text-sm font-bold">{name}</div>
                        <div className="text-xs text-white/35">{leads} leads · {revenue} pipeline</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>{status}</span>
                      <div className="text-[10px] text-white/20 group-hover:text-blue-400 transition-colors font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100">Impersonate →</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" className="py-32 relative z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(16,185,129,0.05),transparent)] pointer-events-none" />
        <div className="max-w-[1100px] mx-auto px-8 relative z-10">
          <div className="text-center mb-20">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.25 }} className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-3">Pricing</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} className="text-5xl font-black tracking-tighter mb-3">
              Transparent. Scalable. <span className="text-emerald-400">Profitable.</span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.25 }} className="text-lg text-white/40 font-light">An AI concierge that pays for itself on the very first converted lead.</motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/8 p-9 flex flex-col hover:border-white/15 transition-all duration-500 cursor-default"
            >
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-5">Agency Starter</div>
              <div className="text-5xl font-black mb-1">₹24,999</div>
              <div className="text-sm text-white/30 font-light mb-8">per month + GST</div>
              <div className="text-xs text-white/40 uppercase tracking-widest font-bold mb-4 border-b border-white/5 pb-4">What's included</div>
              <ul className="space-y-3 mb-10 flex-1">
                {[
                  "Up to 3 Builder Sub-accounts",
                  "Llama 3.3 70B AI Engine",
                  "1,000 AI Messages / month",
                  "WhatsApp + SMS Integration",
                  "Basic Analytics Dashboard",
                ].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/55">
                    <CheckCircle2 className="size-4 text-white/20 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <a href="mailto:contact@weaverframe.com" className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 hover:border-white/20 transition-all text-center block">
                Start Free Trial →
              </a>
            </motion.div>

            {/* Pro */}
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="rounded-3xl bg-gradient-to-b from-emerald-500/8 to-transparent border border-emerald-500/25 p-9 flex flex-col relative overflow-hidden hover:border-emerald-500/40 hover:shadow-[0_0_60px_rgba(16,185,129,0.12)] transition-all duration-500 cursor-default"
            >
              {/* Top gradient line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
              {/* Glow */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl" />

              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Agency Pro</div>
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Most Popular</span>
              </div>
              <div className="text-5xl font-black text-emerald-300 mb-1 relative z-10">₹49,999</div>
              <div className="text-sm text-emerald-400/40 font-light mb-8 relative z-10">per month + GST</div>
              <div className="text-xs text-emerald-400/40 uppercase tracking-widest font-bold mb-4 border-b border-emerald-500/10 pb-4 relative z-10">Everything in Starter, plus</div>
              <ul className="space-y-3 mb-10 flex-1 relative z-10">
                {[
                  "Up to 10 Builder Sub-accounts",
                  "Unlimited AI Messages",
                  "Advanced Google Calendar Sync",
                  "Real-time Portal Syncing",
                  "Cross-builder Revenue Analytics",
                  "24/7 Dedicated Support",
                ].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <a href="mailto:contact@weaverframe.com" className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 transition-all text-center block shadow-[0_4px_30px_rgba(16,185,129,0.4)] relative z-10">
                Deploy Agency Pro →
              </a>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── FOOTER CTA ── */}
      <div className="relative overflow-hidden border-t border-white/5 z-10">
        {/* Mesh gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(16,185,129,0.1),transparent)]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/8 rounded-full blur-[80px]" />
        <div className="max-w-[900px] mx-auto px-8 py-32 text-center relative z-10 space-y-8">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.25 }} className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Get Started</motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} className="text-5xl md:text-6xl font-black tracking-tighter leading-tight">
            Ready to build a 7-figure<br />agency pipeline?
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.25 }} className="text-xl text-white/40 font-light">Join the most exclusive AI platform for custom home builders. First 10 agencies get 2 months free.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.25 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a href="mailto:contact@weaverframe.com" className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-black rounded-full hover:scale-105 hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] transition-all duration-300">
              Contact Enterprise Sales <ArrowRight className="size-5" />
            </a>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-5 rounded-full border border-white/10 text-white/70 font-bold hover:border-white/25 hover:text-white transition-all">
              Sign in to Dashboard
            </Link>
          </motion.div>
        </div>
        {/* Footer bar */}
        <div className="border-t border-white/5 py-8 flex flex-col md:flex-row items-center justify-between max-w-[1400px] mx-auto px-8 text-sm text-white/20 relative z-10">
          <div className="flex items-center gap-2 font-black"><Layers className="size-4 text-emerald-400" /> WeaverFrame © {new Date().getFullYear()}</div>
          <div className="flex gap-8 mt-4 md:mt-0 font-medium">
            <a href="#" className="hover:text-white/50 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/50 transition-colors">Terms</a>
            <a href="mailto:contact@weaverframe.com" className="hover:text-white/50 transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}

