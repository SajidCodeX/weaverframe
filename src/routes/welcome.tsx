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

      {/* ── SOCIAL PROOF ── */}
      <div className="border-y border-white/5 py-14 relative z-10">
        <p className="text-center text-xs text-white/25 uppercase tracking-[0.35em] font-bold mb-8">Trusted by Elite Builders</p>
        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-35 hover:opacity-80 grayscale hover:grayscale-0 transition-all duration-700 max-w-4xl mx-auto px-8">
          {[{ Icon: Layers, name: "Apex Homes", color: "text-emerald-400" }, { Icon: Bot, name: "Elevate Build", color: "text-blue-400" }, { Icon: Zap, name: "Nova Estates", color: "text-purple-400" }, { Icon: Shield, name: "Prime Struct", color: "text-teal-400" }].map(({ Icon, name, color }) => (
            <div key={name} className={`flex items-center gap-2 text-xl font-black cursor-default hover:${color} transition-colors`}>
              <Icon className="size-6" /> {name}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="py-24 relative z-10">
        <div className="max-w-[1100px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          {[
            { num: "30s", label: "Avg Response Time", color: "text-emerald-400", desc: "Never lose a lead to slow replies." },
            { num: "92%", label: "Lead Retention Rate", color: "text-blue-400", desc: "Keep prospects warm for months, automatically." },
            { num: "24/7", label: "Concierge Active", color: "text-purple-400", desc: "Book site visits while you sleep." },
          ].map(({ num, label, color, desc }) => (
            <motion.div key={num} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-3">
              <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20">{num}</div>
              <div className={`text-xs font-bold uppercase tracking-widest font-mono ${color}`}>{label}</div>
              <p className="text-sm text-white/35 font-light">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" className="py-28 relative z-10">
        <div className="max-w-[1300px] mx-auto px-8 space-y-28">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Engineered for <span className="text-emerald-400">Excellence.</span></h2>
            <p className="text-lg text-white/40 font-light">Not a generic CRM. A complete AI operating system built around the custom home builder workflow.</p>
          </div>

          {/* Feature Row 1 */}
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="flex flex-col lg:flex-row items-center gap-16"
          >
            <div className="flex-1 space-y-5">
              <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bot className="size-7 text-emerald-400" />
              </div>
              <h3 className="text-3xl md:text-4xl font-black">Unmatched AI Logic.</h3>
              <p className="text-lg text-white/45 leading-relaxed font-light">Powered by Llama 3.3 70B, our AI Concierge handles brutal objections, pricing queries, and books site visits directly on your calendar — zero human intervention.</p>
              <ul className="space-y-2 pt-2">
                {["Zero Hallucinations", "Strict Timezone Enforcement", "Voice-Matching Brand Tone"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-white/70 text-sm"><CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> {item}</li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full h-[380px] rounded-3xl bg-[#080808] border border-white/8 p-8 flex flex-col justify-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
              <div className="w-full max-w-sm mx-auto space-y-4 relative z-10">
                <div className="bg-white/6 border border-white/8 rounded-2xl rounded-tl-sm px-5 py-4 text-sm text-white/70">Can I view the site tomorrow at 2 PM?</div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-5 py-4 text-sm text-emerald-50 ml-10 shadow-lg">
                  <span className="text-emerald-400 font-bold block mb-1">WeaverFrame AI</span>
                  I've booked your site visit for 2:00 PM tomorrow at Apex Homes — see you there!
                </div>
              </div>
              <div className="absolute bottom-5 left-5 right-5 h-8 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-xl blur-sm" />
            </div>
          </motion.div>

          {/* Feature Row 2 */}
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="flex flex-col lg:flex-row-reverse items-center gap-16"
          >
            <div className="flex-1 space-y-5">
              <div className="size-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="size-7 text-blue-400" />
              </div>
              <h3 className="text-3xl md:text-4xl font-black">Built for Agencies.</h3>
              <p className="text-lg text-white/45 leading-relaxed font-light">Manage dozens of custom home builders from one super-admin dashboard. Total isolation, strict privacy, and global revenue analytics.</p>
              <ul className="space-y-2 pt-2">
                {["Multi-tenant Architecture", "Impersonation Mode", "Cross-builder Analytics"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-white/70 text-sm"><CheckCircle2 className="size-4 text-blue-400 shrink-0" /> {item}</li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full h-[380px] rounded-3xl bg-[#080808] border border-white/8 p-8 flex flex-col justify-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-bl from-blue-500/5 via-transparent to-transparent" />
              {[
                { Icon: Shield, name: "Admin Console", sub: "4 Active Builders", active: true },
                { Icon: Layers, name: "Apex Homes", sub: "Impersonate Workspace", active: false },
                { Icon: Building2, name: "Nova Estates", sub: "Impersonate Workspace", active: false },
              ].map(({ Icon, name, sub, active }, i) => (
                <div key={name} className={`w-full rounded-2xl border flex items-center px-5 py-3.5 gap-4 relative z-10 transition-all ${active ? "bg-white/6 border-white/10" : "bg-white/[0.02] border-white/5 opacity-50"}`} style={{ marginLeft: active ? 0 : `${i * 16}px` }}>
                  <div className={`size-10 rounded-xl flex items-center justify-center ${active ? "bg-blue-500/20" : "bg-white/5"}`}><Icon className={`size-5 ${active ? "text-blue-400" : "text-white/30"}`} /></div>
                  <div><div className="text-sm font-bold">{name}</div><div className="text-xs text-white/40">{sub}</div></div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div id="pricing" className="py-28 relative z-10 border-y border-white/5 bg-white/[0.012]">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-3">Simple, transparent <span className="text-emerald-400">pricing.</span></h2>
            <p className="text-lg text-white/40 font-light">An AI concierge that pays for itself on the first converted lead.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="rounded-3xl bg-[#080808] border border-white/8 p-9 flex flex-col">
              <h3 className="text-xl font-black mb-1">Agency Starter</h3>
              <p className="text-white/40 text-sm mb-7 font-light">Up to 3 builder accounts</p>
              <div className="text-5xl font-black mb-7">₹24,999<span className="text-lg text-white/25 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8 flex-1">
                {["3 Builder Sub-accounts", "Llama 3.3 70B AI", "1,000 AI Messages / mo", "WhatsApp Integration"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/70"><CheckCircle2 className="size-4 text-emerald-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href="mailto:contact@weaverframe.com" className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-colors text-center block">Start Free Trial</a>
            </div>
            {/* Pro */}
            <div className="rounded-3xl bg-emerald-500/5 border border-emerald-500/25 p-9 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-300" />
              <div className="absolute top-5 right-5 px-3 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">Most Popular</div>
              <h3 className="text-xl font-black mb-1">Agency Pro</h3>
              <p className="text-emerald-100/40 text-sm mb-7 font-light">Scale your builder portfolio</p>
              <div className="text-5xl font-black text-emerald-400 mb-7">₹49,999<span className="text-lg text-emerald-400/40 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Up to 10 Builder Accounts", "Unlimited AI Messages", "Advanced Calendar Sync", "Portal Syncing", "24/7 Dedicated Support"].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/80"><CheckCircle2 className="size-4 text-emerald-400 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href="mailto:contact@weaverframe.com" className="w-full py-3.5 rounded-xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 transition-colors text-center block shadow-[0_4px_30px_rgba(16,185,129,0.35)]">Deploy Agency Pro</a>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER CTA ── */}
      <footer className="py-24 relative z-10 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-black">Ready to scale your agency?</h2>
          <p className="text-lg text-white/40 font-light max-w-md mx-auto">Join the most exclusive platform for custom home builders. Start today.</p>
          <a href="mailto:contact@weaverframe.com" className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-black rounded-full hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.15)]">
            Contact Enterprise Sales <ArrowRight className="size-5" />
          </a>
        </motion.div>
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between max-w-[1400px] mx-auto px-8 text-sm text-white/25">
          <div className="flex items-center gap-2 font-bold"><Layers className="size-4 text-emerald-400" /> WeaverFrame © {new Date().getFullYear()}</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white/60 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
