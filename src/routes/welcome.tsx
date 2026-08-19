import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef, useState, useMemo } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  BarChart3,
  MessageSquare,
  Users,
  Calendar,
  BrainCircuit,
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Building2,
  ChevronRight,
  X,
  Send,
  Sliders,
  Layers,
  ChevronDown
} from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

import { CustomCursor } from "../components/CustomCursor";
import { MagneticButton } from "../components/MagneticButton";

// ── 3D LUXURY ARCHITECTURAL SCENE ─────────────────────────────────────────────
function ArchitecturalSculpture() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.08;
      meshRef.current.rotation.y = t * 0.12;
    }
    if (outerRef.current) {
      outerRef.current.rotation.x = -t * 0.04;
      outerRef.current.rotation.y = -t * 0.06;
    }
  });

  return (
    <group position={[1.5, 0, 0]}>
      {/* Inner Sculptural Fluid Core */}
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.6}>
        <mesh ref={meshRef} scale={2.2}>
          <icosahedronGeometry args={[1.2, 2]} />
          <MeshDistortMaterial
            color="#141414"
            attach="material"
            distort={0.45}
            speed={1.2}
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
      </Float>

      {/* Outer Wireframe Crystalline Cage */}
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh ref={outerRef} scale={3.2}>
          <octahedronGeometry args={[1.5, 1]} />
          <meshBasicMaterial color="#e5d9c5" wireframe transparent opacity={0.15} />
        </mesh>
      </Float>
    </group>
  );
}

function HeroScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#080808"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 8]} intensity={3} color="#e5d9c5" />
      <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[0, 0, 4]} intensity={2} color="#c9a84c" />
      <Suspense fallback={null}>
        <ArchitecturalSculpture />
      </Suspense>
    </Canvas>
  );
}

// ── TEXT REVEAL WRAPPER ───────────────────────────────────────────────────────
const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div className={`overflow-hidden ${className}`}>
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  </div>
);

// ── MARQUEE ───────────────────────────────────────────────────────────────────
const LuxuryMarquee = () => {
  const items = [
    "24/7 AI Lead Concierge",
    "Instant <60s Lead Response",
    "High-Ticket Budget Qualification",
    "Autonomous Site Visit Bookings",
    "Custom Home Pipeline OS",
    "Zero Dropped Inquiries",
  ];

  return (
    <div className="w-full overflow-hidden bg-[#e5d9c5] text-[#080808] py-3.5 whitespace-nowrap flex items-center relative z-20 border-y border-[#dcd0bc]">
      <motion.div
        animate={{ x: [0, -1200] }}
        transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
        className="flex items-center space-x-12"
      >
        {[...items, ...items, ...items].map((item, idx) => (
          <React.Fragment key={idx}>
            <span className="text-xs font-bold tracking-[0.25em] uppercase font-mono">{item}</span>
            <span className="size-1.5 rounded-full bg-[#080808]" />
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};

// ── ROUTE DEFINITION ──────────────────────────────────────────────────────────
export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | Quiet Luxury AI Lead Conversion OS" },
      { name: "description", content: "The definitive 24/7 AI Lead Concierge and Pipeline OS engineered exclusively for elite custom home builders." },
    ],
  }),
  component: WelcomePage,
});

// ── MAIN LANDING PAGE COMPONENT ──────────────────────────────────────────────
function WelcomePage() {
  // Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", company: "", email: "", phone: "", buildVolume: "$1M - $3M" });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // ROI Calculator State
  const [avgPrice, setAvgPrice] = useState(1200000);
  const [monthlyLeads, setMonthlyLeads] = useState(25);
  const [conversionLift, setConversionLift] = useState(3); // 3%

  // Real-time ROI calculations
  const extraDealsPerYear = useMemo(() => {
    const annualLeads = monthlyLeads * 12;
    return Math.max(1, Math.round((annualLeads * (conversionLift / 100)) * 10) / 10);
  }, [monthlyLeads, conversionLift]);

  const pipelineValueAnnual = useMemo(() => {
    return extraDealsPerYear * avgPrice;
  }, [extraDealsPerYear, avgPrice]);

  const annualRoiMultiple = useMemo(() => {
    const platformCostAnnual = 36000; // $3,000/mo * 12
    const builderMargin = pipelineValueAnnual * 0.15; // 15% net builder margin
    return Math.round(builderMargin / platformCostAnnual);
  }, [pipelineValueAnnual]);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setIsDemoModalOpen(false);
      setDemoSubmitted(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[#080808] text-[#f8f8f8] font-sans selection:bg-[#e5d9c5] selection:text-black">
      <CustomCursor />

      {/* ── TOP LUXURY NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-[#080808]/85 backdrop-blur-md border-b border-white/[0.08] px-6 md:px-12 py-5 flex items-center justify-between pointer-events-auto">
        <Link to="/welcome" className="flex items-center gap-3 group">
          <div className="size-8 rounded border border-white/20 bg-white/[0.03] flex items-center justify-center font-serif text-sm font-bold text-[#e5d9c5] group-hover:border-[#e5d9c5] transition-colors">
            W
          </div>
          <div>
            <span className="font-serif text-lg tracking-[0.18em] uppercase text-white font-semibold block leading-none">
              WeaverFrame
            </span>
            <span className="text-[9px] font-mono tracking-widest text-[#e5d9c5]/60 uppercase block mt-1">
              Architecture & AI OS
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-10 text-[11px] font-bold tracking-[0.2em] uppercase text-white/70">
          <a href="#platform" className="hover:text-[#e5d9c5] transition-colors">The 6 Pillars</a>
          <a href="#calculator" className="hover:text-[#e5d9c5] transition-colors">ROI Calculator</a>
          <a href="#comparison" className="hover:text-[#e5d9c5] transition-colors">Why AI</a>
          <a href="#pricing" className="hover:text-[#e5d9c5] transition-colors">Pricing</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/80 hover:text-white px-3 py-2 transition-colors"
          >
            Client Sign In
          </Link>
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#e5d9c5] hover:bg-white text-black text-[11px] font-bold uppercase tracking-widest transition-all rounded-xs shadow-lg shadow-[#e5d9c5]/10"
          >
            Request Private Demo
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative min-h-[95vh] flex items-center pt-28 pb-16 overflow-hidden border-b border-white/[0.08]">
        {/* 3D Background Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-80 lg:opacity-100">
          <HeroScene3D />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-3xl">
            {/* Status Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e5d9c5]/20 bg-[#e5d9c5]/5 mb-8"
            >
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#e5d9c5]">
                Custom Home Builder Lead Conversion OS
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[76px] leading-[1.04] tracking-tight font-medium text-white mb-8">
              Never lose a <span className="italic text-[#e5d9c5] font-normal">$1M+ custom build</span> to slow follow-up.
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg md:text-xl font-light text-white/70 leading-relaxed mb-10 max-w-2xl">
              WeaverFrame is the autonomous 24/7 AI Concierge and Pipeline OS engineered exclusively for elite custom home builders. It qualifies budgets, verifies timelines, references your floor plans, and secures private consultations in <span className="text-white font-medium">under 60 seconds</span>.
            </p>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <MagneticButton>
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-3 shadow-xl shadow-[#e5d9c5]/15"
                >
                  Schedule Private Demo
                  <ArrowRight className="size-4" />
                </button>
              </MagneticButton>
              <a
                href="#platform"
                className="w-full sm:w-auto px-8 py-4 border border-white/20 text-white text-xs font-bold uppercase tracking-widest hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-center"
              >
                Explore Platform Architecture
              </a>
            </div>

            {/* Micro Stats Bar */}
            <div className="grid grid-cols-3 gap-6 mt-16 pt-8 border-t border-white/[0.1] max-w-lg">
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-white font-semibold">&lt; 45s</div>
                <div className="text-[10px] uppercase font-mono tracking-widest text-white/50 mt-1">Response Time</div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#e5d9c5] font-semibold">100%</div>
                <div className="text-[10px] uppercase font-mono tracking-widest text-white/50 mt-1">Lead Coverage</div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-white font-semibold">24 / 7 / 365</div>
                <div className="text-[10px] uppercase font-mono tracking-widest text-white/50 mt-1">Autonomous</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <LuxuryMarquee />

      {/* ── 6 PILLARS OF WEAVERFRAME OS ── */}
      <section id="platform" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08]">
        <div className="mb-20 max-w-3xl">
          <Reveal>
            <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
              01 / Architecture & Core Capabilities
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
              Six foundational pillars.<br />
              <span className="text-[#e5d9c5] italic font-normal">Zero dropped opportunities.</span>
            </h2>
          </Reveal>
          <p className="text-white/60 font-light text-base mt-6 leading-relaxed">
            Every element of WeaverFrame is built around the unique sales cycle of bespoke architectural construction — where a single qualified conversation is worth seven figures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              num: "01",
              icon: BarChart3,
              title: "Executive ROI Command",
              desc: "A crystal-clear dashboard that gives you 5-second visibility over your entire active pipeline value, lead velocity, and consultation conversion rates.",
              badge: "Financial Oversight"
            },
            {
              num: "02",
              icon: MessageSquare,
              title: "Multi-Channel Live Inbox",
              desc: "Unified WhatsApp, SMS, Email, and Web Portal conversations in one place. Take over chats in real-time or let AI maintain white-glove dialogue 24/7.",
              badge: "Omnichannel Concierge"
            },
            {
              num: "03",
              icon: Users,
              title: "Smart Qualification CRM",
              desc: "Instantly score incoming inquiries as Hot, Warm, or Cold. Verifies land ownership, building budget, target completion timeline, and financing status.",
              badge: "Automated Screening"
            },
            {
              num: "04",
              icon: Calendar,
              title: "Live Consultation Calendar",
              desc: "Converts qualified high-intent leads into confirmed in-person site visits and showroom consultations on your sales team's calendar without phone tag.",
              badge: "Direct Bookings"
            },
            {
              num: "05",
              icon: BrainCircuit,
              title: "Custom AI Knowledge Base",
              desc: "Train Alex on your architectural style, past luxury portfolios, finish specs, lot requirements, and price-per-sq-ft ranges for hyper-accurate responses.",
              badge: "Builder Brain"
            },
            {
              num: "06",
              icon: Workflow,
              title: "Instant CRM & Webhook Sync",
              desc: "Connect seamlessly with HubSpot, GoHighLevel, or your proprietary workflows. Push qualified buyer profiles and meeting notes automatically.",
              badge: "Ecosystem Integration"
            },
          ].map((pillar, i) => (
            <motion.div
              key={pillar.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="p-8 rounded-lg bg-[#0e0e0e] border border-white/[0.08] hover:border-[#e5d9c5]/40 transition-all duration-300 group relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="size-11 rounded border border-white/10 bg-white/[0.03] flex items-center justify-center text-[#e5d9c5] group-hover:bg-[#e5d9c5] group-hover:text-black transition-all">
                    <pillar.icon className="size-5 stroke-[1.5]" />
                  </div>
                  <span className="text-xs font-mono text-white/30 tracking-widest">{pillar.num}</span>
                </div>
                <span className="text-[10px] font-mono tracking-widest text-[#e5d9c5] uppercase block mb-2">
                  {pillar.badge}
                </span>
                <h3 className="font-serif text-2xl text-white font-medium mb-3 group-hover:text-[#e5d9c5] transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-sm font-light text-white/60 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center gap-2 text-[11px] uppercase font-mono tracking-wider text-white/40 group-hover:text-white transition-colors">
                <span>Integrated into WeaverFrame OS</span>
                <ChevronRight className="size-3 text-[#e5d9c5]" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE ROI & REVENUE CALCULATOR ── */}
      <section id="calculator" className="py-32 px-6 md:px-12 bg-[#0a0a0a] border-b border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Description */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
                02 / ROI & Financial Impact
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
                Calculate the revenue your slow follow-up is leaving behind.
              </h2>
              <p className="text-white/60 font-light text-base leading-relaxed">
                High-net-worth clients inquire on nights and weekends when inspiration strikes. When you respond in 45 seconds instead of 6 hours, your conversion rate increases exponentially.
              </p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5] shrink-0" />
                  <span>Instant engagement prevents leads from contacting rival builders</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5] shrink-0" />
                  <span>Continuous 12-month automated follow-up on long sales cycles</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5] shrink-0" />
                  <span>Pre-screened budgets protect your architect and estimators' time</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Calculator Card */}
            <div className="lg:col-span-7 bg-[#111111] border border-white/[0.12] rounded-xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-8">
                <div className="flex items-center gap-3">
                  <Sliders className="size-5 text-[#e5d9c5]" />
                  <span className="font-serif text-xl text-white font-medium">Custom Builder Revenue Modeler</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] bg-[#e5d9c5]/10 px-2.5 py-1 rounded">
                  Live Calculator
                </span>
              </div>

              {/* Sliders */}
              <div className="space-y-8 mb-10">
                {/* Slider 1: Avg Home Build Value */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-mono tracking-wider text-white/70">
                      Average Custom Home Value
                    </label>
                    <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                      ${(avgPrice).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={500000}
                    max={4000000}
                    step={50000}
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                    <span>$500,000</span>
                    <span>$2,000,000</span>
                    <span>$4,000,000+</span>
                  </div>
                </div>

                {/* Slider 2: Inbound Inquiries Per Month */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-mono tracking-wider text-white/70">
                      Monthly Inbound Inquiries (Website, Social, Ads)
                    </label>
                    <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                      {monthlyLeads} leads / mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={1}
                    value={monthlyLeads}
                    onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                    <span>5 leads</span>
                    <span>50 leads</span>
                    <span>100 leads</span>
                  </div>
                </div>

                {/* Slider 3: Conversion Lift */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-mono tracking-wider text-white/70">
                      Estimated Conversion Lift with &lt;60s AI Response
                    </label>
                    <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                      +{conversionLift}% conversion
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={conversionLift}
                    onChange={(e) => setConversionLift(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                    <span>+1%</span>
                    <span>+3% (Avg)</span>
                    <span>+6% (Aggressive)</span>
                  </div>
                </div>
              </div>

              {/* Output Result Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 rounded-lg bg-black/60 border border-[#e5d9c5]/20">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
                    Additional Contracts / Year
                  </span>
                  <div className="font-serif text-3xl sm:text-4xl text-white font-bold mt-1">
                    +{extraDealsPerYear} Homes
                  </div>
                  <p className="text-[11px] text-white/40 mt-1">Recaptured from lost inquiries</p>
                </div>
                <div className="sm:border-l sm:border-white/10 sm:pl-6">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block">
                    Annual Pipeline Value Created
                  </span>
                  <div className="font-serif text-3xl sm:text-4xl text-[#e5d9c5] font-bold mt-1">
                    ${(pipelineValueAnnual / 1000000).toFixed(1)}M+
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                    ~{annualRoiMultiple}x ROI on WeaverFrame OS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CONTRAST (TRADITIONAL VS WEAVERFRAME AI) ── */}
      <section id="comparison" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            03 / The Contrast
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
            Why traditional sales follow-up fails high-ticket luxury clients.
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            Custom home buyers demand immediacy. Here is the operational gap WeaverFrame closes.
          </p>
        </div>

        {/* Comparison Matrix Table */}
        <div className="border border-white/[0.1] rounded-xl overflow-hidden bg-[#0d0d0d] shadow-2xl">
          <div className="grid grid-cols-12 bg-white/[0.03] border-b border-white/[0.08] p-5 text-xs font-mono tracking-wider uppercase text-white/60">
            <div className="col-span-4 font-semibold text-white">Dimension</div>
            <div className="col-span-4 text-rose-400/90 font-semibold">Traditional Follow-Up</div>
            <div className="col-span-4 text-[#e5d9c5] font-semibold">WeaverFrame AI OS</div>
          </div>

          {[
            {
              dim: "Lead Speed to Contact",
              trad: "4 to 12 hours (often next business day)",
              ai: "< 45 seconds (instant 24/7 engagement)",
              isPositive: true,
            },
            {
              dim: "Night & Weekend Coverage",
              trad: "Zero response. Leads cold by Monday morning.",
              ai: "Full conversational concierge active 365 days.",
              isPositive: true,
            },
            {
              dim: "Long-Cycle Nurture",
              trad: "Sales reps abandon leads after 2-3 attempts.",
              ai: "Intelligent autonomous follow-up up to 12 months.",
              isPositive: true,
            },
            {
              dim: "Qualification Precision",
              trad: "Inconsistent qualification; time wasted on bad leads.",
              ai: "Structured scoring: Budget, Land, Timeline, Financing.",
              isPositive: true,
            },
            {
              dim: "Operational Cost",
              trad: "$80k–$120k/yr salary + commissions per rep.",
              ai: "Flat predictable SaaS subscription ($3,000/mo).",
              isPositive: true,
            },
          ].map((row, idx) => (
            <div
              key={row.dim}
              className={`grid grid-cols-12 p-5 items-center text-sm border-b border-white/[0.04] ${
                idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
              }`}
            >
              <div className="col-span-4 font-medium text-white/90">{row.dim}</div>
              <div className="col-span-4 text-white/50 text-xs sm:text-sm flex items-center gap-2">
                <XCircle className="size-4 text-rose-500/80 shrink-0 hidden sm:inline" />
                <span>{row.trad}</span>
              </div>
              <div className="col-span-4 text-[#e5d9c5] font-medium text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 hidden sm:inline" />
                <span>{row.ai}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRANSPARENT PRICING MATRIX ── */}
      <section id="pricing" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            04 / Transparent Investment
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
            Flat, predictable pricing.<br />
            <span className="text-[#e5d9c5] italic font-normal">One closed home covers years of service.</span>
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            No per-lead markups. No hidden transaction fees. Just pure conversion infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1: Starter */}
          <div className="p-8 sm:p-10 rounded-xl bg-[#0c0c0c] border border-white/[0.08] flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2">Boutique</span>
              <h3 className="font-serif text-2xl text-white mb-2">Starter</h3>
              <p className="text-xs text-white/50 mb-6">Designed for boutique custom builders handling up to 25 leads/month.</p>
              <div className="font-serif text-4xl font-bold text-white mb-8">
                $1,500 <span className="text-xs font-mono text-white/40 font-normal">/ month</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/[0.06] text-xs text-white/70">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Up to 25 active leads / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>24/7 AI Email & Web Portal Concierge</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Budget & Timeline Qualification</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Live Consultation Calendar Sync</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 py-3.5 border border-white/20 text-white hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Get Started
            </button>
          </div>

          {/* Plan 2: Professional (Featured) */}
          <div className="p-8 sm:p-10 rounded-xl bg-[#121212] border-2 border-[#e5d9c5] flex flex-col justify-between relative shadow-2xl shadow-[#e5d9c5]/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e5d9c5] text-black text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full">
              Most Popular · Recommended
            </div>

            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-[#e5d9c5] block mb-2">Full Operating System</span>
              <h3 className="font-serif text-3xl text-white mb-2">Professional</h3>
              <p className="text-xs text-white/60 mb-6">Complete autonomous conversion OS for high-volume luxury custom builders.</p>
              <div className="font-serif text-4xl font-bold text-[#e5d9c5] mb-8">
                $3,000 <span className="text-xs font-mono text-white/50 font-normal">/ month</span>
              </div>

              <div className="space-y-3.5 pt-6 border-t border-white/[0.08] text-xs text-white/80">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span className="font-medium text-white">Unlimited Inbound Leads</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Multi-Channel SMS, WhatsApp & Email</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Custom Floor Plan & Finish AI Knowledge Base</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>HubSpot & GoHighLevel Two-Way Sync</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Executive ROI Command Dashboard</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 py-4 bg-[#e5d9c5] text-black hover:bg-white transition-colors text-xs font-bold uppercase tracking-widest shadow-lg"
            >
              Start 14-Day Pilot
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="p-8 sm:p-10 rounded-xl bg-[#0c0c0c] border border-white/[0.08] flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2">Multi-Location</span>
              <h3 className="font-serif text-2xl text-white mb-2">Enterprise</h3>
              <p className="text-xs text-white/50 mb-6">For multi-market architectural firms and luxury development groups.</p>
              <div className="font-serif text-4xl font-bold text-white mb-8">
                $5,000 <span className="text-xs font-mono text-white/40 font-normal">/ month</span>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/[0.06] text-xs text-white/70">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Multiple Builder Brands & Locations</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Custom CRM & ERP Database Connectors</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Dedicated AI Model Fine-Tuning</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>White-Glove Onboarding & Account Lead</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 py-3.5 border border-white/20 text-white hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Contact Advisory Team
            </button>
          </div>
        </div>
      </section>

      {/* ── PRIVATE DEMO INVITATION CTA ── */}
      <section className="py-32 px-6 md:px-12 bg-gradient-to-b from-[#080808] to-[#121212] relative">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
            05 / Private Architecture Briefing
          </span>
          <h2 className="font-serif text-4xl sm:text-6xl text-white leading-tight font-normal">
            Elevate your builder pipeline to autonomous precision.
          </h2>
          <p className="text-base sm:text-lg font-light text-white/60 max-w-2xl mx-auto leading-relaxed">
            Schedule a 1-on-1 private walkthrough of the WeaverFrame OS. We will demonstrate live how our AI qualifies custom build inquiries with your exact pricing and portfolio.
          </p>

          <div className="pt-6">
            <MagneticButton>
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-10 py-5 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-3 mx-auto shadow-2xl shadow-[#e5d9c5]/20"
              >
                Schedule Private Demonstration
                <ArrowRight className="size-4" />
              </button>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.08] py-12 px-6 md:px-12 text-[10px] uppercase font-mono tracking-[0.2em] text-white/40 bg-[#080808]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-emerald-400" />
            <span>WeaverFrame OS · Version 2.4 Active · Built for Global Luxury Builders</span>
          </div>
          <div className="flex gap-8">
            <Link to="/login" className="hover:text-white transition-colors">Client Login</Link>
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div>
            © {new Date().getFullYear()} WeaverFrame Inc. All Rights Reserved.
          </div>
        </div>
      </footer>

      {/* ── DEMO BOOKING MODAL ── */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#111111] border border-white/[0.15] rounded-xl p-8 shadow-2xl relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsDemoModalOpen(false)}
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>

              {demoSubmitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="size-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="font-serif text-2xl text-white">Private Briefing Requested</h3>
                  <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto">
                    Thank you. Our executive concierge will reach out to you directly to confirm your demonstration session.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block mb-1">
                      White-Glove Onboarding
                    </span>
                    <h3 className="font-serif text-2xl text-white font-medium">
                      Schedule a Private OS Walkthrough
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      See how WeaverFrame automates qualification for your specific building markets.
                    </p>
                  </div>

                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={demoForm.name}
                        onChange={(e) => setDemoForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Marcus Vance"
                        className="w-full bg-[#181818] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                          Building Company *
                        </label>
                        <input
                          required
                          type="text"
                          value={demoForm.company}
                          onChange={(e) => setDemoForm((p) => ({ ...p, company: e.target.value }))}
                          placeholder="e.g. Apex Luxury Estates"
                          className="w-full bg-[#181818] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                          Typical Home Price
                        </label>
                        <select
                          value={demoForm.buildVolume}
                          onChange={(e) => setDemoForm((p) => ({ ...p, buildVolume: e.target.value }))}
                          className="w-full bg-[#181818] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        >
                          <option>$500k - $1M</option>
                          <option>$1M - $3M</option>
                          <option>$3M - $5M+</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                          Work Email *
                        </label>
                        <input
                          required
                          type="email"
                          value={demoForm.email}
                          onChange={(e) => setDemoForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="marcus@apexestates.com"
                          className="w-full bg-[#181818] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                          Direct Phone *
                        </label>
                        <input
                          required
                          type="tel"
                          value={demoForm.phone}
                          onChange={(e) => setDemoForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+1 (512) 555-0199"
                          className="w-full bg-[#181818] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-4 py-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 rounded-xs shadow-lg"
                    >
                      <Send className="size-3.5" />
                      Request Private Demonstration
                    </button>
                    <p className="text-[10px] text-white/40 text-center mt-2">
                      Strict privacy. Your company details are never shared.
                    </p>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
