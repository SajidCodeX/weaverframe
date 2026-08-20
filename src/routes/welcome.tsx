import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence, useInView } from "framer-motion";
import Lenis from "lenis";
import useEmblaCarousel from "embla-carousel-react";
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
  ChevronLeft,
  X,
  Send,
  Sliders,
  Layers,
  Flame,
  Radio,
  Eye,
  Check,
  Smartphone,
  ChevronDown,
  Compass,
  MapPin,
  Cpu,
  Box,
  Maximize2,
  Scan,
  Sun,
  Moon,
  Grid as GridIcon,
  Home,
  Bed,
  Utensils,
  Armchair,
  Car,
  LandPlot,
  Layers3,
  Crosshair,
  Quote,
  Menu,
} from "lucide-react";

import { CustomCursor } from "../components/CustomCursor";
import { MagneticButton } from "../components/MagneticButton";

// ── LAZY-LOADED COMPONENTS (INSTANT HYDRATION) ────────────────────────────────
const LazyParticleBackground = React.lazy(() => import("../components/ParticleBackground"));
const LazyRoiProjectionChart = React.lazy(() => import("../components/RoiProjectionChart"));

// ── KINETIC TEXT REVEAL ───────────────────────────────────────────────────────
const KineticText = ({ text, className = "" }: { text: string; delay?: number; className?: string }) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-block ${className}`}
    >
      {text}
    </motion.span>
  );
};

// ── SCROLL-TRIGGERED NUMBER COUNTER ───────────────────────────────────────────
function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.6,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });

  useEffect(() => {
    if (!inView) return;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      // Exponential ease-out for ultra smooth luxury deceleration
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setVal(ease * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setVal(target);
      }
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()}
      {suffix}
    </span>
  );
}

// ── LUXURY INFINITE MARQUEE ───────────────────────────────────────────────────
const LuxuryMarquee = () => {
  const items = [
    "24/7 AI Lead Concierge",
    "Instant <45s Lead Engagement",
    "High-Ticket Budget Verification",
    "Autonomous Site Visit Scheduling",
    "Custom Home Pipeline OS",
    "Bespoke Floor-Plan Knowledge Brain",
  ];

  return (
    <div className="w-full overflow-hidden bg-[#e5d9c5] text-[#080808] py-4 whitespace-nowrap flex items-center relative z-20 shadow-2xl">
      <div className="flex items-center space-x-12 font-mono animate-marquee will-change-transform">
        {[...items, ...items, ...items, ...items].map((item, idx) => (
          <React.Fragment key={idx}>
            <span className="text-xs font-extrabold tracking-[0.28em] uppercase">{item}</span>
            <span className="size-2 rounded-full bg-[#080808]" />
          </React.Fragment>
        ))}
      </div>
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
  // Client mount state for WebGL canvas SSR safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lenis Smooth Scroll Engine (120 FPS High Performance) - Deferred to prioritize instant interactivity
  useEffect(() => {
    let lenis: Lenis | null = null;
    let reqId: number | null = null;
    let idleHandle: any = null;

    const initLenis = () => {
      lenis = new Lenis({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.5,
      });

      function raf(time: number) {
        lenis?.raf(time);
        reqId = requestAnimationFrame(raf);
      }
      reqId = requestAnimationFrame(raf);
    };

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleHandle = (window as any).requestIdleCallback(initLenis, { timeout: 350 });
      } else {
        idleHandle = setTimeout(initLenis, 100);
      }
    }

    return () => {
      if (idleHandle) {
        if ("cancelIdleCallback" in window) {
          (window as any).cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle);
        }
      }
      if (reqId) cancelAnimationFrame(reqId);
      lenis?.destroy();
    };
  }, []);

  // Mouse coordinate tracker for Hero WebGL Particle Parallax
  const heroMouseRef = useRef({ x: 0, y: 0 });

  // Scroll Progress & Spring-Smoothed Parallax
  const { scrollY, scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  const rawParallax = useTransform(scrollY, [0, 700], [0, -35]);
  const heroParallaxY = useSpring(rawParallax, { stiffness: 140, damping: 25, restDelta: 0.001 });

  // Embla Carousel Hook for Case Studies
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", dragFree: true });

  // Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: "", company: "", email: "", phone: "", buildVolume: "$1M - $3M" });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Live Radar Interactive Simulator State
  const [activeScenario, setActiveScenario] = useState<"travis" | "aspen" | "palm">("travis");

  const scenarios = {
    travis: {
      title: "Lake Travis Modern Estate",
      location: "Austin, TX",
      budget: "$2,200,000",
      land: "Owned (1.8 Waterfront Acres)",
      timeline: "6 Months",
      buyer: "Dr. Harrison Wright",
      inboundChannel: "Instagram Ad Lead",
      responseTime: "32 seconds",
      qualificationScore: 96,
      status: "Site Visit Confirmed",
      transcript: [
        { role: "buyer", text: "Hi, I love your Lake Travis portfolio. We have a 1.8 acre lot on the water and want to start a 5,500 sq ft build this fall. Budget is ~$2.2M." },
        { role: "ai", text: "Good afternoon Dr. Wright. That's a stunning location. Our team specializes in lakefront engineering and modern cantilever designs in that exact price range. Let's get you in for a private architectural consultation with our principal builder." },
        { role: "buyer", text: "Thursday at 2:00 PM works perfectly." },
        { role: "ai", text: "Confirmed. I've placed Thursday, 2:00 PM on the calendar and sent the project brief to your email." }
      ]
    },
    aspen: {
      title: "Red Mountain Alpine Chalet",
      location: "Aspen, CO",
      budget: "$4,500,000",
      land: "Under Contract",
      timeline: "Immediate",
      buyer: "Elena Rostova",
      inboundChannel: "Website Direct Inquiry",
      responseTime: "41 seconds",
      qualificationScore: 98,
      status: "Consultation Booked",
      transcript: [
        { role: "buyer", text: "Inquiring about high-alpine custom builds. We require heavy timber and heated foundation specs." },
        { role: "ai", text: "Welcome Elena. We build structural glulam timber frames engineered for heavy snow loads. Our past projects in Red Mountain have similar specs. Would you like a private review of our alpine floor plans?" },
        { role: "buyer", text: "Yes, please schedule a call with the architect." },
        { role: "ai", text: "Booked for tomorrow at 11:00 AM MST. Meeting link and architectural portfolio dispatched." }
      ]
    },
    palm: {
      title: "Palm Jumeirah Signature Villa",
      location: "Dubai, UAE",
      budget: "$6,800,000",
      land: "Ready Plot",
      timeline: "Q1 Next Year",
      buyer: "Tariq Al-Mansoor",
      inboundChannel: "WhatsApp Business Direct",
      responseTime: "28 seconds",
      qualificationScore: 100,
      status: "VIP Showroom Visit Set",
      transcript: [
        { role: "buyer", text: "Salam. Looking to construct an ultra-modern 7-bedroom beachfront residence on Palm Frond G." },
        { role: "ai", text: "Welcome Mr. Al-Mansoor. We craft bespoke luxury residences with private beach frontage and imported Italian marble finishes. I can arrange an exclusive showroom tour with our lead partner." },
        { role: "buyer", text: "Saturday evening at 6:00 PM." },
        { role: "ai", text: "Reserved. Our executive team will welcome you at the Design Studio on Saturday at 6:00 PM." }
      ]
    }
  };

  const currentScenario = scenarios[activeScenario];

  // Verified Market Case Studies Data
  const caseStudies = [
    {
      id: "austin",
      location: "Austin, TX 🇺🇸",
      title: "Lake Travis Waterfront Estate",
      budget: "$2.2M per Build",
      outcome: "+$4.1M pipeline in 90 days",
      stat: "32s",
      statLabel: "Avg Lead Response",
      quote: "WeaverFrame booked 11 pre-screened site visits while our team was off-site. Our closing velocity doubled within one quarter.",
      author: "Marcus Reed — Principal, Reed Architecture Group",
      accent: "from-amber-950/30",
    },
    {
      id: "aspen",
      location: "Aspen, CO 🇺🇸",
      title: "Red Mountain Alpine Chalets",
      budget: "$4.5M per Build",
      outcome: "100% weekend inquiry capture",
      stat: "100%",
      statLabel: "Coverage Rate",
      quote: "High-net-worth buyers browse lots late on Sundays. The AI engages immediately with technical precision on timber loads and foundations.",
      author: "Sophia Hartwell — Founder, Hartwell Luxury Builds",
      accent: "from-sky-950/25",
    },
    {
      id: "dubai",
      location: "Dubai, UAE 🇦🇪",
      title: "Palm Jumeirah Signature Villas",
      budget: "$6.8M per Villa",
      outcome: "$17.6M pipeline qualified in 4 months",
      stat: "$17.6M",
      statLabel: "Pipeline Qualified",
      quote: "The multi-lingual tone and instant WhatsApp concierge matches the highest tier of ultra-luxury hospitality.",
      author: "Tariq Al-Mansoor — Managing Director, Gulf Prestige",
      accent: "from-amber-950/20",
    },
  ];

  // 4 Architectural Exploded Layers (Matching the image)
  const architecturalLayers = [
    {
      id: "roof",
      title: "ROOF",
      spec1: "Architectural Shingles",
      spec2: "Weather Protection",
      icon: Home,
      pinY: "14%",
      pinX: "72%",
    },
    {
      id: "ceiling",
      title: "CEILING",
      spec1: "Drywall Finish",
      spec2: "Insulation Layer",
      icon: Layers3,
      pinY: "33%",
      pinX: "72%",
    },
    {
      id: "living",
      title: "LIVING SPACE",
      spec1: "Bedrooms, Kitchen, Living & Dining",
      spec2: "Interior Walls · Flooring",
      icon: Armchair,
      pinY: "49%",
      pinX: "72%",
    },
    {
      id: "foundation",
      title: "FOUNDATION",
      spec1: "Concrete Slab",
      spec2: "Structural Support",
      icon: LandPlot,
      pinY: "73%",
      pinX: "72%",
    },
  ];

  // ROI Calculator State
  const [avgPrice, setAvgPrice] = useState(1400000);
  const [monthlyLeads, setMonthlyLeads] = useState(30);
  const [conversionLift, setConversionLift] = useState(3.5);

  const extraDealsPerYear = useMemo(() => {
    const annualLeads = monthlyLeads * 12;
    return Math.max(1, Math.round((annualLeads * (conversionLift / 100)) * 10) / 10);
  }, [monthlyLeads, conversionLift]);

  const pipelineValueAnnual = useMemo(() => {
    return extraDealsPerYear * avgPrice;
  }, [extraDealsPerYear, avgPrice]);

  const annualRoiMultiple = useMemo(() => {
    const platformCostAnnual = 36000;
    const builderMargin = pipelineValueAnnual * 0.15;
    return Math.round(builderMargin / platformCostAnnual);
  }, [pipelineValueAnnual]);

  // 12-Month Live Chart Projection Data
  const chartData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
      weaverframe: Math.round(((i + 1) / 12) * pipelineValueAnnual),
      baseline: Math.round(((i + 1) / 12) * (monthlyLeads * 12 * avgPrice * 0.012)),
    })),
    [pipelineValueAnnual, monthlyLeads, avgPrice]
  );

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
    setTimeout(() => {
      setIsDemoModalOpen(false);
      setDemoSubmitted(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[#060608] text-[#f8f8f8] font-sans selection:bg-[#e5d9c5] selection:text-black">
      <CustomCursor />

      {/* ── CINEMATIC READING PROGRESS BAR ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#c9a84c] via-[#fce6b8] to-[#c9a84c] z-[100] origin-left pointer-events-none shadow-[0_0_12px_rgba(201,168,76,0.6)]"
        style={{ scaleX: progressScaleX }}
      />

      {/* Ambient Lighting Orbs */}
      <div className="fixed top-0 left-1/3 w-[600px] h-[600px] bg-radial from-[#c9a84c]/[0.08] to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[700px] h-[700px] bg-radial from-[#e5d9c5]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* ── TOP FLOATING GLASSMORPHIC CAPSULE NAVBAR ── */}
      <div className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pointer-events-none">
        <header className="w-full max-w-[1260px] bg-[#060608]/80 backdrop-blur-2xl border border-white/[0.12] hover:border-[#e5d9c5]/35 rounded-full px-5 sm:px-7 py-2.5 flex items-center justify-between pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(201,168,76,0.06)] transition-all duration-300">
          {/* Brand Logo */}
          <Link to="/welcome" className="flex items-center gap-3 group shrink-0">
            <div className="size-8 rounded-full border border-white/20 bg-white/[0.06] flex items-center justify-center font-nevera text-sm font-bold text-[#e5d9c5] group-hover:border-[#e5d9c5] group-hover:scale-105 transition-all">
              W
            </div>
            <div>
              <span className="font-nevera text-base sm:text-lg tracking-[0.18em] uppercase text-white font-semibold block leading-none">
                WeaverFrame
              </span>
              <span className="text-[8px] font-mono tracking-widest text-[#e5d9c5]/70 uppercase block mt-0.5">
                AI Operating System
              </span>
            </div>
          </Link>

          {/* Centered Clean Navigation */}
          <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-[11px] font-medium tracking-[0.16em] uppercase text-white/70">
            <a href="#radar" className="hover:text-[#e5d9c5] transition-colors whitespace-nowrap">Live Radar</a>
            <a href="#pillars" className="hover:text-[#e5d9c5] transition-colors whitespace-nowrap">Platform</a>
            <a href="#calculator" className="hover:text-[#e5d9c5] transition-colors whitespace-nowrap">ROI Modeler</a>
            <a href="#cases" className="hover:text-[#e5d9c5] transition-colors whitespace-nowrap">Case Studies</a>
            <a href="#pricing" className="hover:text-[#e5d9c5] transition-colors whitespace-nowrap">Pricing</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/login"
              className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/80 hover:text-white px-3 py-1.5 transition-colors whitespace-nowrap hidden sm:inline-block"
            >
              Client Login
            </Link>
            <MagneticButton>
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#e5d9c5] hover:bg-white text-black text-[11px] font-bold uppercase tracking-wider transition-all rounded-full shadow-xl shadow-[#e5d9c5]/15 cursor-pointer whitespace-nowrap"
              >
                Request Demo
                <ArrowRight className="size-3.5" />
              </button>
            </MagneticButton>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-full border border-white/15 bg-white/5 text-white/80 hover:text-white lg:hidden"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </header>
      </div>

      {/* ── MOBILE NAVIGATION DRAWER ── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            className="fixed top-20 left-4 right-4 z-50 bg-[#0c0d12]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 lg:hidden pointer-events-auto"
          >
            <nav className="flex flex-col space-y-3 font-mono text-xs tracking-widest uppercase text-white/80">
              <a
                href="#radar"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 border-b border-white/5 hover:text-[#e5d9c5]"
              >
                Live Radar
              </a>
              <a
                href="#pillars"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 border-b border-white/5 hover:text-[#e5d9c5]"
              >
                Platform Architecture
              </a>
              <a
                href="#calculator"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 border-b border-white/5 hover:text-[#e5d9c5]"
              >
                ROI Modeler
              </a>
              <a
                href="#cases"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 border-b border-white/5 hover:text-[#e5d9c5]"
              >
                Case Studies
              </a>
              <a
                href="#pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 hover:text-[#e5d9c5]"
              >
                Pricing
              </a>
            </nav>
            <div className="pt-3 border-t border-white/10 flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-3 text-center border border-white/20 text-xs uppercase font-mono tracking-widest text-white hover:border-[#e5d9c5] rounded-full"
              >
                Client Login
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsDemoModalOpen(true);
                }}
                className="w-full py-3 text-center bg-[#e5d9c5] text-black text-xs uppercase font-mono font-bold tracking-widest hover:bg-white rounded-full shadow-lg shadow-[#e5d9c5]/15"
              >
                Request Private Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO SECTION: 3D PERSPECTIVE EXPLODED VILLA & WEBGL CONSTELLATION ── */}
      <section
        onMouseMove={(e) => {
          heroMouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
          heroMouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
        }}
        className="relative min-h-[96vh] flex items-center pt-24 pb-16 overflow-hidden border-b border-white/[0.08]"
      >
        {/* Living Three.js WebGL Particle Field (Lazy-loaded for instant interactivity) */}
        {mounted && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <Suspense fallback={null}>
              <LazyParticleBackground mouseRef={heroMouseRef} />
            </Suspense>
          </div>
        )}

        <div className="w-full max-w-[1680px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10">
          
          {/* LEFT COLUMN: Editorial Typography with Scroll Parallax */}
          <motion.div style={{ y: heroParallaxY }} className="lg:col-span-5 space-y-7 pt-2 z-20">
            
            {/* Status Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-[#e5d9c5]/30 bg-[#e5d9c5]/10 backdrop-blur-md shadow-lg shadow-[#e5d9c5]/5"
            >
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#e5d9c5] font-semibold">
                Autonomous 24/7 AI Lead Concierge
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="font-nevera text-4xl sm:text-5xl lg:text-[62px] leading-[1.18] font-normal text-white tracking-normal">
              Your{" "}
              <span className="inline-block px-1 bg-gradient-to-r from-[#e5d9c5] via-[#fce6b8] to-[#c9a84c] bg-clip-text text-transparent font-nevera">
                $2M+ custom builds
              </span>{" "}
              deserve a 24/7 digital architect.
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="text-sm sm:text-base font-light text-white/75 leading-relaxed max-w-lg"
            >
              WeaverFrame engages high-ticket luxury home buyers in <strong className="text-white font-medium">&lt; 45 seconds</strong> across WhatsApp, SMS, and Email. It screens seven-figure budgets, verifies land ownership, and schedules qualified site consultations directly to your team.
            </motion.p>

            {/* Magnetic Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3.5 sm:items-center pt-1"
            >
              <MagneticButton>
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2.5 shadow-2xl shadow-[#e5d9c5]/25 group"
                >
                  Schedule Private Demo
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </MagneticButton>
              <a
                href="#radar"
                className="w-full sm:w-auto px-7 py-4 border border-white/20 bg-white/[0.02] text-white text-xs font-bold uppercase tracking-widest hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-all text-center backdrop-blur-sm"
              >
                Test Live Radar ↓
              </a>
            </motion.div>

            {/* Animated Trust Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.1] max-w-md">
              <div className="group cursor-default">
                <div className="font-nevera text-2xl sm:text-3xl text-white font-bold group-hover:text-[#e5d9c5] transition-colors">
                  <AnimatedCounter target={45} prefix="< " suffix="s" duration={1.4} />
                </div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Lead Response</div>
              </div>
              <div className="group cursor-default">
                <div className="font-nevera text-2xl sm:text-3xl text-[#e5d9c5] font-bold group-hover:scale-105 transition-transform origin-left">
                  <AnimatedCounter target={100} suffix="%" duration={1.5} />
                </div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Coverage</div>
              </div>
              <div className="group cursor-default">
                <div className="font-nevera text-2xl sm:text-3xl text-white font-bold group-hover:text-[#e5d9c5] transition-colors">
                  <AnimatedCounter target={180} prefix="$" suffix="M+" duration={1.8} />
                </div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Pipeline Qualified</div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Massive Frameless Exploded Villa Visual */}
          <div className="lg:col-span-7 relative flex items-center justify-center">
            {/* Ambient Lighting Glow Behind Image */}
            <div className="absolute inset-0 bg-radial from-[#c9a84c]/[0.08] via-transparent to-transparent rounded-full blur-3xl pointer-events-none scale-125" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full flex items-center justify-center group"
            >
              <picture className="w-full max-w-[1150px] 2xl:max-w-[1300px] flex justify-center">
                <source srcSet="/images/exploded-villa.webp" type="image/webp" />
                <img
                  src="/images/exploded-villa.png"
                  alt="WeaverFrame Exploded Luxury Architecture"
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-[0_30px_70px_rgba(0,0,0,0.95)] transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </picture>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ── MARQUEE ── */}
      <LuxuryMarquee />

      {/* ── THE "WOW" FEATURE: LIVE AUTONOMOUS PIPELINE RADAR ── */}
      <section id="radar" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] relative">
        {/* Ambient Gold Glow */}
        <div className="absolute top-1/2 -left-48 w-96 h-96 bg-radial from-[#c9a84c]/[0.07] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="mb-16 max-w-3xl">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            01 / Live Demonstration
          </span>
          <h2 className="font-nevera text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
            <KineticText text="Watch the AI qualify a $2M+ client in real-time." />
          </h2>
          <p className="text-white/60 font-light text-base mt-4 leading-relaxed">
            Select an active luxury build market below to observe how WeaverFrame autonomous AI screens buyers, validates lot readiness, and confirms consultation appointments without human delay.
          </p>
        </div>

        {/* Market Switcher Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { id: "travis", label: "Austin, TX · Lakefront Estate", budget: "$2.2M" },
            { id: "aspen", label: "Aspen, CO · Alpine Chalet", budget: "$4.5M" },
            { id: "palm", label: "Dubai, UAE · Signature Villa", budget: "$6.8M" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveScenario(tab.id as any)}
              className={`px-5 py-3 rounded-lg text-xs font-mono tracking-wider uppercase transition-all flex items-center gap-3 border cursor-pointer ${
                activeScenario === tab.id
                  ? "bg-[#e5d9c5] text-black border-[#e5d9c5] font-bold shadow-lg shadow-[#e5d9c5]/15 scale-102"
                  : "bg-[#101116] text-white/60 border-white/[0.08] hover:border-white/30 hover:text-white"
              }`}
            >
              <Compass className="size-3.5" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${activeScenario === tab.id ? "bg-black/20 text-black font-bold" : "bg-white/10 text-[#e5d9c5]"}`}>
                {tab.budget}
              </span>
            </button>
          ))}
        </div>

        {/* Live Radar Terminal Screen */}
        <div className="rounded-2xl border border-[#e5d9c5]/30 bg-[#0c0d12]/90 backdrop-blur-2xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden">
          {/* Top Window Chrome Bar */}
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest ml-3 hidden sm:inline-block">
                WeaverFrame AI Autonomous Terminal · Live Screening Feed
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Status: Operational & Screening
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Live Intelligence Feed */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="size-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-mono text-xs uppercase tracking-widest text-white font-semibold">
                    Live Autonomous Screening
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {currentScenario.responseTime} Response
                </span>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="flex justify-between p-3 rounded bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/50">Project Type:</span>
                  <span className="text-white font-medium">{currentScenario.title}</span>
                </div>
                <div className="flex justify-between p-3 rounded bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/50">Verified Budget:</span>
                  <span className="text-[#e5d9c5] font-bold text-sm">{currentScenario.budget}</span>
                </div>
                <div className="flex justify-between p-3 rounded bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/50">Lot / Land Status:</span>
                  <span className="text-white">{currentScenario.land}</span>
                </div>
                <div className="flex justify-between p-3 rounded bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-white/50">Inbound Channel:</span>
                  <span className="text-white">{currentScenario.inboundChannel}</span>
                </div>
                <div className="flex justify-between p-3 rounded bg-emerald-500/[0.05] border border-emerald-500/20 items-center">
                  <span className="text-emerald-400">Lead Score & Status:</span>
                  <span className="text-emerald-400 font-bold">{currentScenario.qualificationScore}/100 · {currentScenario.status}</span>
                </div>
              </div>
            </div>

            {/* Right: Real-time Transcript Mockup */}
            <div className="lg:col-span-7 bg-[#08090d] rounded-lg p-6 border border-white/[0.06] space-y-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/40 pb-3 border-b border-white/[0.06]">
                <span>Conversation Log with {currentScenario.buyer}</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <Cpu className="size-3" /> AI Concierge Active
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {currentScenario.transcript.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className={`flex flex-col ${msg.role === "buyer" ? "items-start" : "items-end"}`}
                  >
                    <span className="text-[9px] font-mono uppercase text-white/40 mb-1 px-1">
                      {msg.role === "buyer" ? currentScenario.buyer : "WeaverFrame AI Concierge"}
                    </span>
                    <div
                      className={`max-w-[85%] p-3.5 rounded-lg text-xs leading-relaxed ${
                        msg.role === "buyer"
                          ? "bg-white/[0.06] text-white/90 border border-white/[0.08]"
                          : "bg-[#e5d9c5] text-black font-medium border border-[#e5d9c5]"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6 FOUNDATIONAL PILLARS (SPOTLIGHT CARDS) ── */}
      <section id="pillars" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] relative">
        {/* Ambient Gold Glow */}
        <div className="absolute top-1/3 -right-48 w-96 h-96 bg-radial from-[#e5d9c5]/[0.06] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="mb-20 max-w-3xl">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            02 / Platform Architecture
          </span>
          <h2 className="font-nevera text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
            <KineticText text="Six pillars engineered for seven-figure construction deals." />
          </h2>
          <p className="text-white/60 font-light text-base mt-6 leading-relaxed">
            Standard CRMs are built for small e-commerce checkouts. WeaverFrame is tailored specifically to custom architects and estate builders with multi-month sales cycles and high-touch requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              num: "01",
              icon: BarChart3,
              title: "Executive ROI Command",
              desc: "Provides total 5-second visibility over active pipeline values, conversion velocity, and cost-per-qualified-tour across all developments.",
              badge: "Financial Command"
            },
            {
              num: "02",
              icon: MessageSquare,
              title: "Omnichannel Live Inbox",
              desc: "Unified WhatsApp, SMS, Email, and Web Portal conduit. One-click human takeover whenever you want to step into the dialogue.",
              badge: "Multi-Channel"
            },
            {
              num: "03",
              icon: Users,
              title: "Autonomous Lead Scoring",
              desc: "Screens budget, verified land title status, construction timeline, and pre-approval financing to instantly separate tire-kickers from buyers.",
              badge: "Lead Screening"
            },
            {
              num: "04",
              icon: Calendar,
              title: "Live Site Visit Booking",
              desc: "Direct calendar synchronization that books high-intent prospects for on-site walk-throughs and showroom appointments automatically.",
              badge: "Direct Calendar"
            },
            {
              num: "05",
              icon: BrainCircuit,
              title: "Bespoke Builder Brain",
              desc: "Trained on your specific architectural styles, price-per-square-foot baseline, finishes, and elevation portfolios for precise responses.",
              badge: "AI Knowledge Base"
            },
            {
              num: "06",
              icon: Workflow,
              title: "Ecosystem CRM Sync",
              desc: "Two-way live synchronization with HubSpot, GoHighLevel, and Zapier webhooks to keep your current tech stack fully aligned.",
              badge: "Zero-Code Sync"
            },
          ].map((pillar, idx) => (
            <motion.div
              key={pillar.num}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="p-8 rounded-xl border border-white/[0.08] bg-[#0c0d12] flex flex-col justify-between h-full hover:border-[#e5d9c5]/40 transition-all duration-300 group"
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="size-12 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-[#e5d9c5] group-hover:bg-[#e5d9c5] group-hover:text-black transition-all">
                    <pillar.icon className="size-6 stroke-[1.5]" />
                  </div>
                  <span className="font-mono text-xs text-white/30 tracking-widest">{pillar.num}</span>
                </div>

                <span className="text-[10px] font-mono tracking-widest text-[#e5d9c5] uppercase block mb-2 font-semibold">
                  {pillar.badge}
                </span>
                <h3 className="font-nevera text-2xl text-white font-medium mb-3 group-hover:text-[#e5d9c5] transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-sm font-light text-white/60 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] uppercase font-mono tracking-wider text-white/40 group-hover:text-white transition-colors">
                <span>Integrated Operating System</span>
                <ChevronRight className="size-3 text-[#e5d9c5]" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE ROI & REVENUE CALCULATOR ── */}
      <section id="calculator" className="py-32 px-6 md:px-12 bg-[#08080a] border-b border-white/[0.08] relative">
        {/* Ambient Gold Glow */}
        <div className="absolute top-1/2 -right-48 w-96 h-96 bg-radial from-[#c9a84c]/[0.06] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Description */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
                03 / ROI Modeling
              </span>
              <h2 className="font-nevera text-3xl sm:text-5xl text-white leading-tight font-normal">
                <KineticText text="How much revenue are you losing to slow responses?" />
              </h2>
              <p className="text-white/60 font-light text-base leading-relaxed">
                A custom home buyer inquiring at 9:00 PM on a Sunday will not wait until Tuesday for a callback. Engaging them in 45 seconds recaptures contracts that would otherwise go to competitors.
              </p>
              
              <div className="space-y-3.5 pt-4">
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Eliminate lost opportunities on weekends and holidays</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Nurture long-cycle leads automatically for up to 12 months</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/80">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Protect architect and sales time with pre-screened budgets</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Calculator */}
            <div className="lg:col-span-7">
              <div className="p-8 sm:p-10 rounded-2xl border border-[#e5d9c5]/30 bg-[#0c0d12]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-8">
                  <div className="flex items-center gap-3">
                    <Sliders className="size-5 text-[#e5d9c5]" />
                    <span className="font-nevera text-xl text-white font-medium">Custom Builder Revenue Modeler</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] bg-[#e5d9c5]/10 px-2.5 py-1 rounded">
                    Interactive Math
                  </span>
                </div>

                <div className="space-y-8 mb-10">
                  {/* Slider 1: Avg Custom Home Value */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs uppercase font-mono tracking-wider text-white/70">
                        Average Custom Home Contract Price
                      </label>
                      <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                        ${avgPrice.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={600000}
                      max={4500000}
                      step={50000}
                      value={avgPrice}
                      onChange={(e) => setAvgPrice(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5] transition-all hover:bg-white/20"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                      <span>$600,000</span>
                      <span>$2,000,000</span>
                      <span>$4,500,000+</span>
                    </div>
                  </div>

                  {/* Slider 2: Monthly Inquiries */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs uppercase font-mono tracking-wider text-white/70">
                        Monthly Inbound Inquiries (Website, Social, Ads, Referrals)
                      </label>
                      <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                        {monthlyLeads} inquiries / mo
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={1}
                      value={monthlyLeads}
                      onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5] transition-all hover:bg-white/20"
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
                        Projected Conversion Rate Increase with &lt;45s AI Engagement
                      </label>
                      <span className="font-mono text-lg font-bold text-[#e5d9c5]">
                        +{conversionLift}% conversion lift
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={0.5}
                      value={conversionLift}
                      onChange={(e) => setConversionLift(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5] transition-all hover:bg-white/20"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                      <span>+1.0%</span>
                      <span>+3.5% (Typical)</span>
                      <span>+6.0% (Aggressive)</span>
                    </div>
                  </div>
                </div>

                {/* 12-Month Live Projected Growth Area Chart */}
                <div className="mb-8 p-4 rounded-xl bg-black/60 border border-white/[0.06]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                      12-Month Pipeline Projection (Baseline vs. WeaverFrame AI)
                    </span>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                      <span className="flex items-center gap-1.5 text-white/40">
                        <span className="size-2 rounded-full bg-white/20" /> Baseline
                      </span>
                      <span className="flex items-center gap-1.5 text-[#e5d9c5]">
                        <span className="size-2 rounded-full bg-[#c9a84c]" /> With WeaverFrame
                      </span>
                    </div>
                  </div>

                  <div className="h-[180px] w-full">
                    <Suspense fallback={<div className="h-[180px] w-full bg-white/[0.02] rounded-lg animate-pulse flex items-center justify-center text-white/30 text-xs font-mono">Loading Growth Projections...</div>}>
                      <LazyRoiProjectionChart chartData={chartData} />
                    </Suspense>
                  </div>
                </div>

                {/* Outputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 rounded-lg bg-black/70 border border-[#e5d9c5]/20">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
                      Extra Homes Contracted / Year
                    </span>
                    <div className="font-nevera text-3xl sm:text-4xl text-white font-bold mt-1">
                      +{extraDealsPerYear} Homes
                    </div>
                    <p className="text-[11px] text-white/40 mt-1">Recaptured from dropped inquiries</p>
                  </div>
                  <div className="sm:border-l sm:border-white/10 sm:pl-6">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block">
                      Annual Pipeline Value Protected
                    </span>
                    <div className="font-nevera text-3xl sm:text-4xl text-[#e5d9c5] font-bold mt-1">
                      ${(pipelineValueAnnual / 1000000).toFixed(1)}M+
                    </div>
                    <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                      ~{annualRoiMultiple}x Return on Investment
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CONTRAST (TRADITIONAL VS WEAVERFRAME) ── */}
      <section id="comparison" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] relative">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-radial from-[#c9a84c]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            04 / Market Contrast
          </span>
          <h2 className="font-nevera text-3xl sm:text-5xl text-white leading-tight font-normal">
            <KineticText text="Why traditional sales follow-up fails luxury clientele." />
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            Compare standard sales operations against WeaverFrame Autonomous AI OS.
          </p>
        </div>

        <div className="border border-white/[0.12] rounded-xl overflow-hidden bg-[#0a0b0e] shadow-2xl relative z-10">
          <div className="grid grid-cols-12 bg-white/[0.04] border-b border-white/[0.08] p-5 text-xs font-mono tracking-wider uppercase text-white/60">
            <div className="col-span-4 font-semibold text-white">Dimension</div>
            <div className="col-span-4 text-rose-400/90 font-semibold">Traditional Follow-Up</div>
            <div className="col-span-4 text-[#e5d9c5] font-semibold flex items-center gap-2">
              <span>WeaverFrame AI OS</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
                ★ 10x Advantage
              </span>
            </div>
          </div>

          {[
            {
              dim: "Speed to Contact",
              trad: "4 to 12 hours (often next business day)",
              ai: "< 45 seconds (24/7/365 instant response)",
            },
            {
              dim: "Night & Weekend Coverage",
              trad: "Zero response. Leads go cold by Monday morning.",
              ai: "Full conversational concierge active every hour.",
            },
            {
              dim: "Long-Cycle Nurture",
              trad: "Sales reps abandon follow-up after 2-3 calls.",
              ai: "Intelligent autonomous follow-up for up to 12 months.",
            },
            {
              dim: "Qualification Rigor",
              trad: "Subjective screening; estimators' time wasted on low budgets.",
              ai: "Systematic qualification: Budget, Land, Timeline, Financing.",
            },
            {
              dim: "Operational Expense",
              trad: "$80,000–$120,000/yr salary + bonuses per rep.",
              ai: "Flat predictable subscription ($3,000/mo).",
            },
          ].map((row, idx) => (
            <div
              key={row.dim}
              className={`grid grid-cols-12 p-5 items-center text-sm border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${
                idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
              }`}
            >
              <div className="col-span-4 font-medium text-white/90">{row.dim}</div>
              <div className="col-span-4 text-white/50 text-xs sm:text-sm flex items-center gap-2">
                <XCircle className="size-4 text-rose-500/80 shrink-0 hidden sm:inline" />
                <span>{row.trad}</span>
              </div>
              <div className="col-span-4 text-[#e5d9c5] font-medium text-xs sm:text-sm flex items-center gap-2 bg-[#e5d9c5]/[0.03] py-2 px-3 rounded-lg border border-[#e5d9c5]/10">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 hidden sm:inline" />
                <span>{row.ai}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CASE STUDIES & LIVE MARKET OUTCOMES (EMBLA CAROUSEL) ── */}
      <section id="cases" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] overflow-hidden relative">
        {/* Ambient Glow */}
        <div className="absolute top-1/2 -left-48 w-96 h-96 bg-radial from-[#c9a84c]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="max-w-3xl">
            <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
              05 / Live Market Outcomes
            </span>
            <h2 className="font-nevera text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
              <KineticText text="Real custom builders. Seven-figure outcomes." />
            </h2>
            <p className="text-white/60 font-light text-base mt-4">
              Explore how bespoke architecture firms and luxury builders protect and accelerate their high-ticket contract pipelines.
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Previous case study"
              className="size-12 rounded-full border border-white/20 bg-white/[0.03] flex items-center justify-center text-white/70 hover:border-[#e5d9c5] hover:text-[#e5d9c5] hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Next case study"
              className="size-12 rounded-full border border-white/20 bg-white/[0.03] flex items-center justify-center text-white/70 hover:border-[#e5d9c5] hover:text-[#e5d9c5] hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        {/* Embla Viewport */}
        <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
          <div className="flex gap-6">
            {caseStudies.map((cs) => (
              <motion.div
                key={cs.id}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ duration: 0.3 }}
                className={`flex-none w-[90vw] sm:w-[500px] lg:w-[460px] p-8 sm:p-10 rounded-2xl border border-white/[0.12] bg-gradient-to-br ${cs.accent} via-[#0c0d12]/95 to-[#08090c] backdrop-blur-2xl flex flex-col justify-between min-h-[380px] shadow-2xl hover:border-[#e5d9c5]/50 transition-all group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] bg-[#e5d9c5]/10 px-3.5 py-1.5 rounded-full border border-[#e5d9c5]/25 font-semibold">
                      {cs.location}
                    </span>
                    <span className="text-[11px] font-mono text-white/40">{cs.budget}</span>
                  </div>

                  <h3 className="font-nevera text-2xl sm:text-3xl text-white mb-4 group-hover:text-[#e5d9c5] transition-colors">
                    {cs.title}
                  </h3>

                  <div className="relative mb-6">
                    <Quote className="size-6 text-[#e5d9c5]/20 absolute -top-3 -left-2 rotate-180 pointer-events-none" />
                    <p className="text-sm font-light text-white/70 italic leading-relaxed pl-4">
                      "{cs.quote}"
                    </p>
                  </div>

                  <p className="text-[11px] font-mono text-white/40 pl-4 border-l border-[#e5d9c5]/30">
                    {cs.author}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-end justify-between">
                  <div>
                    <div className="font-nevera text-3xl sm:text-4xl text-[#e5d9c5] font-bold">
                      {cs.stat}
                    </div>
                    <div className="text-[9px] uppercase font-mono tracking-widest text-white/45 mt-1">
                      {cs.statLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20">
                      {cs.outcome}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRANSPARENT PRICING MATRIX ── */}
      <section id="pricing" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] relative">
        {/* Ambient Gold Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#c9a84c]/[0.06] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            06 / Predictable Investment
          </span>
          <h2 className="font-nevera text-3xl sm:text-5xl text-white leading-tight font-normal">
            <KineticText text="One extra home build covers years of platform access." />
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            No per-lead markups. No hidden commissions. Just pure operational power.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch relative z-10">
          {/* Plan 1: Starter */}
          <div className="p-8 sm:p-10 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/80 backdrop-blur-xl flex flex-col justify-between hover:border-white/30 transition-all hover:bg-[#0e0f15]">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2 font-semibold">Boutique</span>
              <h3 className="font-nevera text-2xl text-white mb-2">Starter</h3>
              <p className="text-xs text-white/50 mb-6">Designed for boutique custom home builders handling up to 25 leads/month.</p>
              <div className="font-nevera text-4xl font-bold text-white mb-8">
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
                  <span>Budget & Land Qualification</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 text-[#e5d9c5]" />
                  <span>Live Consultation Calendar Sync</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full mt-8 py-3.5 border border-white/20 text-white hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* Plan 2: Professional (Dominant Featured Hero Card) */}
          <div className="p-8 sm:p-10 rounded-2xl border-2 border-[#e5d9c5] flex flex-col justify-between relative shadow-[0_25px_60px_rgba(201,168,76,0.18)] bg-[#121319] backdrop-blur-2xl group lg:-translate-y-4 lg:scale-[1.03] transition-all">
            {/* Ambient Gold Halo */}
            <div className="absolute -inset-1 bg-gradient-to-b from-[#e5d9c5]/30 via-[#c9a84c]/15 to-transparent rounded-3xl blur-xl opacity-90 pointer-events-none" />

            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e5d9c5] text-black text-[10px] font-mono uppercase font-bold tracking-widest px-4 py-1 rounded-full shadow-lg z-20 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Most Popular · Recommended
            </div>

            <div className="relative z-10">
              <span className="text-xs font-mono tracking-widest uppercase text-[#e5d9c5] block mb-2 font-semibold">Complete OS</span>
              <h3 className="font-nevera text-3xl text-white mb-2">Professional</h3>
              <p className="text-xs text-white/60 mb-6">Complete autonomous conversion OS for high-volume luxury custom builders.</p>
              <div className="font-nevera text-4xl font-bold text-[#e5d9c5] mb-8">
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
              className="w-full mt-8 py-4 bg-[#e5d9c5] text-black hover:bg-white transition-all text-xs font-bold uppercase tracking-widest shadow-xl shadow-[#e5d9c5]/25 cursor-pointer relative z-10"
            >
              Start 14-Day Pilot
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="p-8 sm:p-10 rounded-2xl border border-white/[0.08] bg-[#0c0d12]/80 backdrop-blur-xl flex flex-col justify-between hover:border-white/30 transition-all hover:bg-[#0e0f15]">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2 font-semibold">Multi-Location</span>
              <h3 className="font-nevera text-2xl text-white mb-2">Enterprise</h3>
              <p className="text-xs text-white/50 mb-6">For multi-market architectural firms and luxury development groups.</p>
              <div className="font-nevera text-4xl font-bold text-white mb-8">
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
              className="w-full mt-8 py-3.5 border border-white/20 text-white hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
            >
              Contact Advisory Team
            </button>
          </div>
        </div>
      </section>

      {/* ── PRIVATE DEMO BRIEFING CTA ── */}
      <section className="py-32 px-6 md:px-12 bg-gradient-to-b from-[#060608] to-[#121319] relative">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
            07 / Private Briefing
          </span>
          <h2 className="font-nevera text-4xl sm:text-6xl text-white leading-tight font-normal">
            <KineticText text="Elevate your custom home pipeline to autonomous precision." />
          </h2>
          <p className="text-base sm:text-lg font-light text-white/60 max-w-2xl mx-auto leading-relaxed">
            Schedule a 1-on-1 private walkthrough of the WeaverFrame OS. We will configure the AI live with your exact portfolio, floor plans, and pricing parameters.
          </p>

          <div className="pt-6">
            <MagneticButton>
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-10 py-5 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-3 mx-auto shadow-2xl shadow-[#e5d9c5]/25 group cursor-pointer"
              >
                Schedule Private Demonstration
                <ArrowRight className="size-4 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ── EXPANSIVE LUXURY ARCHITECTURE OS FOOTER ── */}
      <footer className="border-t border-white/[0.08] pt-20 pb-12 px-6 md:px-12 bg-[#060608] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-white/[0.08]">
            {/* Col 1: Brand & Tagline */}
            <div className="lg:col-span-2 space-y-5">
              <Link to="/welcome" className="flex items-center gap-3 group">
                <div className="size-8 rounded-full border border-white/20 bg-white/[0.06] flex items-center justify-center font-nevera text-sm font-bold text-[#e5d9c5] group-hover:border-[#e5d9c5] transition-all">
                  W
                </div>
                <div>
                  <span className="font-nevera text-lg tracking-[0.18em] uppercase text-white font-semibold block leading-none">
                    WeaverFrame
                  </span>
                  <span className="text-[8px] font-mono tracking-widest text-[#e5d9c5]/70 uppercase block mt-0.5">
                    Architecture & AI Operating System
                  </span>
                </div>
              </Link>
              <p className="text-xs text-white/50 leading-relaxed max-w-sm">
                The quiet luxury AI lead concierge and pipeline engine engineered exclusively for elite custom home builders, estates, and architecture studios.
              </p>
              <div className="flex items-center gap-3 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 w-fit">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>All Systems Operational · 99.99% Uptime</span>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#e5d9c5] font-semibold">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                <li><a href="#radar" className="hover:text-white transition-colors">Live Radar Simulator</a></li>
                <li><a href="#pillars" className="hover:text-white transition-colors">The 6 Core Pillars</a></li>
                <li><a href="#calculator" className="hover:text-white transition-colors">ROI Modeler</a></li>
                <li><a href="#cases" className="hover:text-white transition-colors">Verified Case Studies</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Predictable Pricing</a></li>
              </ul>
            </div>

            {/* Col 3: Integrations */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#e5d9c5] font-semibold">
                Integrations
              </h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                <li><span className="text-white/80">WhatsApp Business API</span></li>
                <li><span className="text-white/80">Twilio SMS (BYOK)</span></li>
                <li><span className="text-white/80">HubSpot & GoHighLevel</span></li>
                <li><span className="text-white/80">Google & Outlook Calendar</span></li>
                <li><span className="text-white/80">Custom ERP Webhooks</span></li>
              </ul>
            </div>

            {/* Col 4: Trust & Security */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#e5d9c5] font-semibold">
                Security & Data
              </h4>
              <ul className="space-y-2.5 text-xs text-white/60">
                <li><span className="text-white/80">AES-256 GCM Data Encryption</span></li>
                <li><span className="text-white/80">Strict Multi-Tenant Isolation</span></li>
                <li><span className="text-white/80">SOC-2 & GDPR Compliance</span></li>
                <li><span className="text-white/80">Private AI Model Training</span></li>
                <li><Link to="/login" className="text-[#e5d9c5] hover:underline">Client Portal Access →</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-white/40 tracking-wider">
            <div>
              © {new Date().getFullYear()} WeaverFrame Inc. All rights reserved. Quiet Luxury Architecture & AI OS.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Security Architecture</a>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-[#e5d9c5] hover:text-white transition-colors cursor-pointer"
              >
                Back to Top ↑
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── PRIVATE DEMO MODAL ── */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-[#0e0f14] border border-white/[0.15] rounded-2xl p-8 shadow-2xl relative"
            >
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
                  <h3 className="font-nevera text-2xl text-white">Demonstration Requested</h3>
                  <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto">
                    Thank you. An executive advisor will reach out within 2 hours to confirm your private architecture demonstration.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block mb-1">
                      White-Glove Onboarding
                    </span>
                    <h3 className="font-nevera text-2xl text-white font-medium">
                      Schedule a Private OS Walkthrough
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      See how WeaverFrame qualifies custom home buyers with your exact portfolio.
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
                        className="w-full bg-[#16171e] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
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
                          className="w-full bg-[#16171e] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-mono tracking-wider text-white/60 block mb-1.5">
                          Typical Home Price
                        </label>
                        <select
                          value={demoForm.buildVolume}
                          onChange={(e) => setDemoForm((p) => ({ ...p, buildVolume: e.target.value }))}
                          className="w-full bg-[#16171e] border border-white/[0.1] rounded-md px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
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
                          className="w-full bg-[#16171e] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
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
                          className="w-full bg-[#16171e] border border-white/[0.1] rounded-md px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#e5d9c5] font-sans"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-4 py-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 rounded-xs shadow-xl shadow-[#e5d9c5]/20"
                    >
                      <Send className="size-3.5" />
                      Request Private Demonstration
                    </button>
                    <p className="text-[10px] text-white/40 text-center mt-2">
                      Strict confidentiality. Your data is never shared.
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
