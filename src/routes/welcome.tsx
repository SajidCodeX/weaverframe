import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
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
  Grid as GridIcon
} from "lucide-react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, Grid, Center } from "@react-three/drei";
import * as THREE from "three";

import { CustomCursor } from "../components/CustomCursor";
import { MagneticButton } from "../components/MagneticButton";

// ── 3D BESPOKE ARCHITECTURAL MODERN VILLA MODEL WITH LIDAR SCAN ────────────────

function ModernArchitecturalVilla({ visualMode }: { visualMode: "night" | "lidar" | "wireframe" }) {
  const villaGroup = useRef<THREE.Group>(null!);
  const scannerRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const { x, y } = state.pointer;

    // Smooth subtle mouse rotation
    if (villaGroup.current) {
      villaGroup.current.rotation.y = THREE.MathUtils.lerp(
        villaGroup.current.rotation.y,
        -0.45 + x * 0.45 + Math.sin(t * 0.25) * 0.08,
        0.05
      );
      villaGroup.current.rotation.x = THREE.MathUtils.lerp(
        villaGroup.current.rotation.x,
        0.28 - y * 0.25,
        0.05
      );
    }

    // LiDAR Scanner beam oscillation
    if (scannerRef.current) {
      scannerRef.current.position.y = Math.sin(t * 1.5) * 1.8 + 0.8;
    }
  });

  const isWireframe = visualMode === "wireframe";
  const isLidar = visualMode === "lidar";

  return (
    <group ref={villaGroup} position={[0, -0.6, 0]}>
      {/* Foundation Concrete Slabs */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[6.2, 0.2, 4.4]} />
        <meshStandardMaterial
          color={isWireframe ? "#1a1a1a" : "#111215"}
          roughness={0.8}
          metalness={0.2}
          wireframe={isWireframe}
        />
      </mesh>

      {/* Ground Floor Cantilever Pavilion (Living & Dining) */}
      <mesh position={[-0.8, 0.7, 0.2]}>
        <boxGeometry args={[3.8, 1.35, 3.2]} />
        <meshPhysicalMaterial
          color={isLidar ? "#0a192f" : "#0d0f14"}
          transparent
          opacity={isWireframe ? 0.2 : 0.85}
          roughness={0.1}
          metalness={0.8}
          wireframe={isWireframe}
        />
      </mesh>

      {/* Upper Floor Architectural Master Cantilever (Offset) */}
      <mesh position={[0.8, 1.9, -0.2]}>
        <boxGeometry args={[4.2, 1.25, 2.8]} />
        <meshPhysicalMaterial
          color={isLidar ? "#112240" : "#161820"}
          transparent
          opacity={isWireframe ? 0.3 : 0.9}
          roughness={0.2}
          metalness={0.7}
          wireframe={isWireframe}
        />
      </mesh>

      {/* Structural Steel Columns */}
      <mesh position={[2.6, 0.7, 1.0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color="#c9a84c" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[2.6, 0.7, -1.2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color="#c9a84c" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-2.4, 0.7, -1.2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color="#c9a84c" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Warm Golden Architectural Interior Illumination */}
      <pointLight position={[-0.8, 0.7, 0.2]} intensity={isLidar ? 1 : 4} color="#f5d799" distance={4.5} />
      <pointLight position={[0.8, 1.9, -0.2]} intensity={isLidar ? 1 : 5} color="#e5d9c5" distance={4.5} />
      <pointLight position={[0, -0.1, 2.2]} intensity={2} color="#00ffcc" distance={2.5} />

      {/* LiDAR Laser Scanning Plane */}
      {isLidar && (
        <mesh ref={scannerRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7, 5]} />
          <meshBasicMaterial color="#00ffcc" transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 3D Floating HUD Hotspots Pinpointed on Architecture */}
      <Html position={[-1.6, 1.6, 1.8]} center distanceFactor={10}>
        <div className="pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/85 border border-[#c9a84c]/50 backdrop-blur-md text-[9px] font-mono tracking-wider text-[#e5d9c5] shadow-xl whitespace-nowrap animate-pulse">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>&lt;45s AI Lead Response</span>
        </div>
      </Html>

      <Html position={[1.8, 2.7, 0.5]} center distanceFactor={10}>
        <div className="pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/85 border border-white/20 backdrop-blur-md text-[9px] font-mono tracking-wider text-white shadow-xl whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-[#c9a84c]" />
          <span>$2M - $5M+ Budget Verified</span>
        </div>
      </Html>

      <Html position={[0.5, 0.1, 2.3]} center distanceFactor={10}>
        <div className="pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/85 border border-emerald-500/30 backdrop-blur-md text-[9px] font-mono tracking-wider text-emerald-400 shadow-xl whitespace-nowrap">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>Confirmed Site Consultation</span>
        </div>
      </Html>

      {/* Ground Architectural Grid */}
      <Grid
        position={[0, -0.22, 0]}
        args={[14, 14]}
        cellSize={0.6}
        cellThickness={0.8}
        cellColor="#e5d9c5"
        sectionSize={2.4}
        sectionThickness={1.2}
        sectionColor="#c9a84c"
        fadeDistance={9}
        fadeStrength={1.5}
      />
    </group>
  );
}

function HeroArchitecturalScene3D({ visualMode }: { visualMode: "night" | "lidar" | "wireframe" }) {
  return (
    <Canvas
      camera={{ position: [5, 4, 6.5], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={visualMode === "lidar" ? 0.3 : 0.8} />
      <directionalLight position={[10, 15, 8]} intensity={visualMode === "lidar" ? 1.5 : 3.5} color="#e5d9c5" />
      <directionalLight position={[-10, 10, -5]} intensity={1.2} color="#ffffff" />
      <Suspense fallback={null}>
        <Center>
          <ModernArchitecturalVilla visualMode={visualMode} />
        </Center>
      </Suspense>
    </Canvas>
  );
}

// ── 3D SPOTLIGHT TILT CARD COMPONENT ──────────────────────────────────────────
function TiltCard({
  children,
  className = "",
  spotlightColor = "rgba(229, 217, 197, 0.12)"
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), { damping: 20, stiffness: 200 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { damping: 20, stiffness: 200 });

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);

    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setCursorPos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative rounded-xl border border-white/[0.09] bg-[#0c0d11]/80 backdrop-blur-xl transition-colors duration-300 group overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10"
        style={{
          background: `radial-gradient(400px circle at ${cursorPos.x}px ${cursorPos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative z-20" style={{ transform: "translateZ(25px)" }}>
        {children}
      </div>
    </motion.div>
  );
}

// ── KINETIC TEXT REVEAL ───────────────────────────────────────────────────────
const KineticText = ({ text, delay = 0, className = "" }: { text: string; delay?: number; className?: string }) => {
  const words = text.split(" ");
  return (
    <span className={`inline-block overflow-hidden ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.28em]">
          <motion.span
            initial={{ y: "110%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              delay: delay + i * 0.04,
            }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

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
      <motion.div
        animate={{ x: [0, -1200] }}
        transition={{ repeat: Infinity, duration: 24, ease: "linear" }}
        className="flex items-center space-x-12 font-mono"
      >
        {[...items, ...items, ...items].map((item, idx) => (
          <React.Fragment key={idx}>
            <span className="text-xs font-extrabold tracking-[0.28em] uppercase">{item}</span>
            <span className="size-2 rounded-full bg-[#080808]" />
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

// ── MAIN LUXURY LANDING PAGE ──────────────────────────────────────────────────
function WelcomePage() {
  // Lenis Smooth Scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const reqId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(reqId);
      lenis.destroy();
    };
  }, []);

  // 3D Hero Visual Mode State
  const [heroMode, setHeroMode] = useState<"night" | "lidar" | "wireframe">("night");

  // Demo Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
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

      {/* Ambient Lighting Orbs */}
      <div className="fixed top-0 left-1/3 w-[600px] h-[600px] bg-radial from-[#c9a84c]/[0.08] to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-[700px] h-[700px] bg-radial from-[#e5d9c5]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* ── TOP LUXURY NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-[#060608]/85 backdrop-blur-xl border-b border-white/[0.07] px-6 md:px-12 py-5 flex items-center justify-between pointer-events-auto">
        <Link to="/welcome" className="flex items-center gap-3 group">
          <div className="size-8 rounded border border-white/20 bg-white/[0.04] flex items-center justify-center font-serif text-sm font-bold text-[#e5d9c5] group-hover:border-[#e5d9c5] group-hover:scale-105 transition-all">
            W
          </div>
          <div>
            <span className="font-serif text-lg tracking-[0.2em] uppercase text-white font-semibold block leading-none">
              WeaverFrame
            </span>
            <span className="text-[9px] font-mono tracking-widest text-[#e5d9c5]/70 uppercase block mt-1">
              Architecture & AI OS
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-10 text-[11px] font-bold tracking-[0.22em] uppercase text-white/70">
          <a href="#radar" className="hover:text-[#e5d9c5] transition-colors">Live Radar</a>
          <a href="#pillars" className="hover:text-[#e5d9c5] transition-colors">The 6 Pillars</a>
          <a href="#calculator" className="hover:text-[#e5d9c5] transition-colors">ROI Modeler</a>
          <a href="#comparison" className="hover:text-[#e5d9c5] transition-colors">Why AI</a>
          <a href="#pricing" className="hover:text-[#e5d9c5] transition-colors">Investment</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/80 hover:text-white px-3 py-2 transition-colors"
          >
            Client Access
          </Link>
          <MagneticButton>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#e5d9c5] hover:bg-white text-black text-[11px] font-bold uppercase tracking-widest transition-all rounded-xs shadow-xl shadow-[#e5d9c5]/15"
            >
              Request Private Demo
              <ArrowRight className="size-3.5" />
            </button>
          </MagneticButton>
        </div>
      </header>

      {/* ── HIGH-CONCEPT ARCHITECTURAL HERO SECTION ── */}
      <section className="relative min-h-[92vh] flex items-center pt-24 pb-12 overflow-hidden border-b border-white/[0.08]">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          
          {/* Left Column: High-Status Editorial Headline */}
          <div className="lg:col-span-6 space-y-6 pt-4">
            
            {/* Live Ticker Pulse */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#e5d9c5]/25 bg-[#e5d9c5]/8 backdrop-blur-md shadow-lg shadow-[#e5d9c5]/5"
            >
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#e5d9c5] font-semibold">
                Autonomous 24/7 AI Lead Concierge
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-[72px] leading-[1.04] tracking-tight font-normal text-white">
              Your <span className="italic text-[#e5d9c5]">$2M+ custom builds</span> deserve a 24/7 digital architect.
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="text-base sm:text-lg font-light text-white/75 leading-relaxed max-w-xl"
            >
              WeaverFrame engages high-ticket luxury home buyers in <strong className="text-white font-medium">&lt; 45 seconds</strong> across WhatsApp, SMS, and Email. It screens seven-figure budgets, verifies land ownership, and schedules qualified site consultations directly to your team.
            </motion.p>

            {/* Magnetic CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 sm:items-center pt-2"
            >
              <MagneticButton>
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-3 shadow-2xl shadow-[#e5d9c5]/20 group"
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

            {/* Live Trust Metrics Ticker */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.1] max-w-md">
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-white font-bold">&lt; 45s</div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Lead Response</div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-[#e5d9c5] font-bold">100%</div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Coverage</div>
              </div>
              <div>
                <div className="font-serif text-2xl sm:text-3xl text-white font-bold">$180M+</div>
                <div className="text-[9px] uppercase font-mono tracking-widest text-white/50 mt-1">Pipeline Qualified</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Modern Villa Viewport with Mode Switcher */}
          <div className="lg:col-span-6 relative h-[480px] sm:h-[580px] w-full rounded-2xl border border-white/[0.12] bg-[#090a0f]/90 backdrop-blur-2xl shadow-2xl overflow-hidden group">
            
            {/* 3D Canvas */}
            <div className="absolute inset-0 z-0">
              <HeroArchitecturalScene3D visualMode={heroMode} />
            </div>

            {/* Top Viewport Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/75 border border-white/10 backdrop-blur-md text-[10px] font-mono text-white/70">
                <Scan className="size-3.5 text-[#e5d9c5]" />
                <span>3D Architectural Viewport · Interactive</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                AI Concierge Active
              </span>
            </div>

            {/* Bottom 3D Mode Switcher Toolbar */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between bg-black/80 border border-white/15 p-2 rounded-xl backdrop-blur-xl">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest hidden sm:inline pl-2">
                Viewport Mode:
              </span>
              <div className="flex gap-1.5 w-full sm:w-auto justify-end">
                {[
                  { id: "night", label: "Night Architecture", icon: Moon },
                  { id: "lidar", label: "LiDAR AI Scan", icon: Scan },
                  { id: "wireframe", label: "Blueprint Grid", icon: GridIcon },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setHeroMode(mode.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all flex items-center gap-1.5 border ${
                      heroMode === mode.id
                        ? "bg-[#e5d9c5] text-black border-[#e5d9c5] font-bold"
                        : "bg-white/[0.04] text-white/60 border-white/[0.08] hover:text-white"
                    }`}
                  >
                    <mode.icon className="size-3" />
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── MARQUEE ── */}
      <LuxuryMarquee />

      {/* ── THE "WOW" FEATURE: LIVE AUTONOMOUS PIPELINE RADAR ── */}
      <section id="radar" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08] relative">
        <div className="mb-16 max-w-3xl">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            01 / Live Demonstration
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
            Watch the AI qualify a $2M+ client in real-time.
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
              className={`px-5 py-3 rounded-lg text-xs font-mono tracking-wider uppercase transition-all flex items-center gap-3 border ${
                activeScenario === tab.id
                  ? "bg-[#e5d9c5] text-black border-[#e5d9c5] font-bold shadow-lg shadow-[#e5d9c5]/15 scale-102"
                  : "bg-[#101116] text-white/60 border-white/[0.08] hover:border-white/30 hover:text-white"
              }`}
            >
              <Compass className="size-3.5" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${activeScenario === tab.id ? "bg-black/20 text-black" : "bg-white/10 text-[#e5d9c5]"}`}>
                {tab.budget}
              </span>
            </button>
          ))}
        </div>

        {/* Live Radar Terminal Screen */}
        <TiltCard className="p-6 sm:p-10 border-[#e5d9c5]/25 shadow-2xl">
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
        </TiltCard>
      </section>

      {/* ── 6 FOUNDATIONAL PILLARS (SPOTLIGHT TILT CARDS) ── */}
      <section id="pillars" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08]">
        <div className="mb-20 max-w-3xl">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            02 / Platform Architecture
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white leading-tight font-normal">
            Six pillars engineered for seven-figure construction deals.
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
            <TiltCard key={pillar.num} className="p-8 flex flex-col justify-between h-full">
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
                <h3 className="font-serif text-2xl text-white font-medium mb-3 group-hover:text-[#e5d9c5] transition-colors">
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
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE ROI & REVENUE CALCULATOR ── */}
      <section id="calculator" className="py-32 px-6 md:px-12 bg-[#08080a] border-b border-white/[0.08] relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Description */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
                03 / ROI Modeling
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
                How much revenue are you losing to slow responses?
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
              <TiltCard className="p-8 sm:p-10 border-[#e5d9c5]/30">
                <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-8">
                  <div className="flex items-center gap-3">
                    <Sliders className="size-5 text-[#e5d9c5]" />
                    <span className="font-serif text-xl text-white font-medium">Custom Builder Revenue Modeler</span>
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
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5]"
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
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#e5d9c5]"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/30 mt-1">
                      <span>+1.0%</span>
                      <span>+3.5% (Typical)</span>
                      <span>+6.0% (Aggressive)</span>
                    </div>
                  </div>
                </div>

                {/* Outputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 rounded-lg bg-black/70 border border-[#e5d9c5]/20">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block">
                      Extra Homes Contracted / Year
                    </span>
                    <div className="font-serif text-3xl sm:text-4xl text-white font-bold mt-1">
                      +{extraDealsPerYear} Homes
                    </div>
                    <p className="text-[11px] text-white/40 mt-1">Recaptured from dropped inquiries</p>
                  </div>
                  <div className="sm:border-l sm:border-white/10 sm:pl-6">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#e5d9c5] block">
                      Annual Pipeline Value Protected
                    </span>
                    <div className="font-serif text-3xl sm:text-4xl text-[#e5d9c5] font-bold mt-1">
                      ${(pipelineValueAnnual / 1000000).toFixed(1)}M+
                    </div>
                    <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                      ~{annualRoiMultiple}x Return on Investment
                    </p>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CONTRAST (TRADITIONAL VS WEAVERFRAME) ── */}
      <section id="comparison" className="py-32 px-6 md:px-12 max-w-7xl mx-auto border-b border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block mb-4">
            04 / Market Contrast
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
            Why traditional sales follow-up fails luxury clientele.
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            Compare standard sales operations against WeaverFrame Autonomous AI OS.
          </p>
        </div>

        <div className="border border-white/[0.12] rounded-xl overflow-hidden bg-[#0a0b0e] shadow-2xl">
          <div className="grid grid-cols-12 bg-white/[0.04] border-b border-white/[0.08] p-5 text-xs font-mono tracking-wider uppercase text-white/60">
            <div className="col-span-4 font-semibold text-white">Dimension</div>
            <div className="col-span-4 text-rose-400/90 font-semibold">Traditional Follow-Up</div>
            <div className="col-span-4 text-[#e5d9c5] font-semibold">WeaverFrame AI OS</div>
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
              className={`grid grid-cols-12 p-5 items-center text-sm border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
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
            05 / Predictable Investment
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl text-white leading-tight font-normal">
            One extra home build covers years of platform access.
          </h2>
          <p className="text-white/60 font-light text-base mt-4">
            No per-lead markups. No hidden commissions. Just pure operational power.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1: Starter */}
          <TiltCard className="p-8 sm:p-10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2 font-semibold">Boutique</span>
              <h3 className="font-serif text-2xl text-white mb-2">Starter</h3>
              <p className="text-xs text-white/50 mb-6">Designed for boutique custom home builders handling up to 25 leads/month.</p>
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
              className="w-full mt-8 py-3.5 border border-white/20 text-white hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Get Started
            </button>
          </TiltCard>

          {/* Plan 2: Professional (Featured Spotlight) */}
          <TiltCard className="p-8 sm:p-10 border-2 border-[#e5d9c5] flex flex-col justify-between relative shadow-2xl shadow-[#e5d9c5]/15 bg-[#121319]/90">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#e5d9c5] text-black text-[10px] font-mono uppercase font-bold tracking-widest px-3.5 py-1 rounded-full shadow-lg">
              Most Popular · Recommended
            </div>

            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-[#e5d9c5] block mb-2 font-semibold">Complete OS</span>
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
              className="w-full mt-8 py-4 bg-[#e5d9c5] text-black hover:bg-white transition-all text-xs font-bold uppercase tracking-widest shadow-xl shadow-[#e5d9c5]/20"
            >
              Start 14-Day Pilot
            </button>
          </TiltCard>

          {/* Plan 3: Enterprise */}
          <TiltCard className="p-8 sm:p-10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-white/40 block mb-2 font-semibold">Multi-Location</span>
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
          </TiltCard>
        </div>
      </section>

      {/* ── PRIVATE DEMO BRIEFING CTA ── */}
      <section className="py-32 px-6 md:px-12 bg-gradient-to-b from-[#060608] to-[#121319] relative">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-[11px] uppercase font-mono tracking-[0.3em] font-bold text-[#e5d9c5] block">
            06 / Private Briefing
          </span>
          <h2 className="font-serif text-4xl sm:text-6xl text-white leading-tight font-normal">
            Elevate your custom home pipeline to autonomous precision.
          </h2>
          <p className="text-base sm:text-lg font-light text-white/60 max-w-2xl mx-auto leading-relaxed">
            Schedule a 1-on-1 private walkthrough of the WeaverFrame OS. We will configure the AI live with your exact portfolio, floor plans, and pricing parameters.
          </p>

          <div className="pt-6">
            <MagneticButton>
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-10 py-5 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-3 mx-auto shadow-2xl shadow-[#e5d9c5]/25 group"
              >
                Schedule Private Demonstration
                <ArrowRight className="size-4 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.08] py-12 px-6 md:px-12 text-[10px] uppercase font-mono tracking-[0.2em] text-white/40 bg-[#060608]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-emerald-400" />
            <span>WeaverFrame OS · Version 2.5 Live · Engineered for Elite Custom Builders</span>
          </div>
          <div className="flex gap-8">
            <Link to="/login" className="hover:text-white transition-colors">Client Login</Link>
            <a href="#pillars" className="hover:text-white transition-colors">Platform</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div>
            © {new Date().getFullYear()} WeaverFrame Inc. All Rights Reserved.
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
                  <h3 className="font-serif text-2xl text-white">Demonstration Requested</h3>
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
                    <h3 className="font-serif text-2xl text-white font-medium">
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
