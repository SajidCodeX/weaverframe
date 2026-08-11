import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Box, Circle, Pyramid, Layers, Shield, Zap } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

import { CustomCursor } from "../components/CustomCursor";
import { MagneticButton } from "../components/MagneticButton";

// ── 3D FLUID AURA (OPTIMIZED FOR PERFORMANCE) ──────────────────────────────────
function FluidAura() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.05;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
      {/* Drastically reduced geometry segments from 128 to 32 for performance */}
      <mesh ref={meshRef} position={[2, 0, -2]} scale={2}>
        <sphereGeometry args={[2, 32, 32]} />
        <MeshDistortMaterial 
          color="#0a0a0a" 
          attach="material" 
          distort={0.4} 
          speed={1} 
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
}

function Scene3D() {
  return (
    // Reduced pixel ratio and disabled anti-aliasing if performance is critical, but let's just keep dpr default and optimize geometry
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={["#0a0a0a"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#e5d9c5" />
      <directionalLight position={[-10, -10, -5]} intensity={1} color="#ffffff" />
      <Suspense fallback={null}>
        <FluidAura />
      </Suspense>
    </Canvas>
  );
}

// ── TEXT REVEAL COMPONENT (OPTIMIZED) ─────────────────────────────────────────
const RevealText = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <div className="overflow-hidden">
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }} // Only animate once to prevent scroll lag
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  </div>
);

// ── MARQUEE COMPONENT ─────────────────────────────────────────────────────────
const Marquee = () => {
  return (
    <div className="w-full overflow-hidden bg-[#e5d9c5] text-[#0a0a0a] py-4 whitespace-nowrap flex items-center relative z-20">
      <motion.div 
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        className="flex items-center space-x-12"
        style={{ willChange: "transform" }} // Hardware acceleration hint
      >
        {[...Array(8)].map((_, i) => (
          <React.Fragment key={i}>
            <span className="text-sm font-bold tracking-[0.3em] uppercase">Autonomous Intelligence</span>
            <span className="size-2 rounded-full bg-[#0a0a0a]" />
            <span className="text-sm font-bold tracking-[0.3em] uppercase">Elite Custom Builders</span>
            <span className="size-2 rounded-full bg-[#0a0a0a]" />
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | The Foundation of Luxury" },
      { name: "description", content: "The definitive AI platform for elite custom home builders." }
    ]
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    // Removed `cursor-none` globally to let standard cursor work as fallback, CustomCursor can render on top. 
    // Added hardware acceleration classes to the container if needed.
    <div className="h-screen overflow-x-hidden overflow-y-auto relative bg-[#0a0a0a] text-[#f8f8f8] font-sans selection:bg-[#e5d9c5] selection:text-black scroll-smooth">
      
      <CustomCursor />

      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/[0.08] px-8 py-6 flex items-center justify-between pointer-events-auto">
        <div className="font-serif text-xl tracking-widest uppercase">WeaverFrame</div>
        <div className="hidden md:flex gap-12 text-[11px] font-bold tracking-[0.2em] uppercase">
          <MagneticButton><a href="#services" className="hover:text-[#e5d9c5] transition-colors">Services</a></MagneticButton>
          <MagneticButton><a href="#platform" className="hover:text-[#e5d9c5] transition-colors">Platform</a></MagneticButton>
          <MagneticButton><a href="#case-studies" className="hover:text-[#e5d9c5] transition-colors">Case Studies</a></MagneticButton>
          <MagneticButton><a href="#inquiry" className="hover:text-[#e5d9c5] transition-colors">Inquiry</a></MagneticButton>
        </div>
        <div>
          <MagneticButton>
            <Link to="/login" className="text-[11px] font-bold tracking-[0.2em] uppercase border-b border-transparent hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-all pb-1">Client Access</Link>
          </MagneticButton>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
          <Scene3D />
        </div>
        
        <div className="relative z-10 w-full px-8 md:px-16 pointer-events-none mt-20">
          <div className="max-w-4xl">
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[140px] leading-[0.9] tracking-tight mb-8">
              <RevealText delay={0.1}>Build</RevealText>
              <RevealText delay={0.3}><i className="text-[#e5d9c5]">Differently.</i></RevealText>
            </h1>
            <div className="max-w-md text-lg md:text-xl font-light leading-relaxed text-white/60">
              <RevealText delay={0.6}>
                The first autonomous operating system and digital agency designed exclusively for elite custom home builders.
              </RevealText>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-12 pointer-events-auto flex gap-6">
               <a href="#inquiry" className="px-8 py-4 bg-[#e5d9c5] text-black text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-colors">
                 Start a Project
               </a>
               <a href="#services" className="px-8 py-4 border border-white/20 text-white text-[11px] font-bold uppercase tracking-widest hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-colors">
                 Our Services
               </a>
            </motion.div>
          </div>
        </div>
      </section>

      <Marquee />

      {/* ── AGENCY EXPERTISE / SERVICES ── */}
      <section id="services" className="py-32 px-8 md:px-16 bg-[#0a0a0a] relative z-10 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-6">01 / Our Expertise</h2>
            <h3 className="font-serif text-4xl md:text-6xl leading-tight max-w-3xl">
              We provide end-to-end digital infrastructure for modern luxury builders.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Layers, title: "Autonomous Lead Capture", desc: "Omnichannel conversational AI that engages ultra-high-net-worth clients 24/7, qualifying them before they ever reach your desk." },
              { icon: Shield, title: "Brand Architecture", desc: "We design and deploy museum-grade digital storefronts that reflect the physical quality of the estates you build." },
              { icon: Zap, title: "Pipeline Intelligence", desc: "A centralized, multi-tenant dashboard giving you total operational oversight across all active developments and client communications." }
            ].map((service, idx) => (
              <motion.div 
                key={service.title}
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, margin: "-50px" }} 
                transition={{ duration: 0.6, delay: idx * 0.15 }}
                className="p-10 border border-white/[0.08] hover:border-[#e5d9c5]/30 transition-colors bg-[#0f0f0f]"
              >
                <service.icon className="size-10 text-[#e5d9c5] mb-8 stroke-1" />
                <h4 className="font-serif text-2xl mb-4">{service.title}</h4>
                <p className="text-sm font-light text-white/50 leading-relaxed">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CASE STUDIES / PORTFOLIO (THE "AGENCY" FEEL) ── */}
      <section id="case-studies" className="py-32 px-8 md:px-16 bg-[#0a0a0a] relative z-10 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto">
           <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
             <div>
               <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-6">02 / Selected Works</h2>
               <h3 className="font-serif text-4xl md:text-6xl leading-tight">
                 Empowering visionary builders.
               </h3>
             </div>
             <a href="#inquiry" className="border-b border-[#e5d9c5] text-[#e5d9c5] text-[11px] uppercase tracking-widest font-bold pb-1 hover:text-white hover:border-white transition-colors">
               View All Case Studies
             </a>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
             {[
               { name: "The Aspen Residence", builder: "Lumina Custom Homes", metric: "40% Increase in Qualified Leads" },
               { name: "Glass House Dubai", builder: "Apex Architectural", metric: "Zero Touch Conversions" },
               { name: "Silicon Valley Estate", builder: "Vanguard Builders", metric: "$2.4M Pipeline Generated" },
               { name: "Manhattan Penthouse", builder: "Elevation Properties", metric: "Automated Client Onboarding" },
             ].map((project, idx) => (
               <motion.div 
                 key={project.name}
                 initial={{ opacity: 0, scale: 0.98 }} 
                 whileInView={{ opacity: 1, scale: 1 }} 
                 viewport={{ once: true, margin: "-50px" }} 
                 transition={{ duration: 0.8, delay: (idx % 2) * 0.2 }}
                 className={`group cursor-pointer ${idx % 2 !== 0 ? 'md:mt-24' : ''}`}
               >
                 <div className="w-full aspect-[4/3] bg-[#141414] mb-6 relative overflow-hidden flex items-center justify-center border border-white/[0.05]">
                    {/* Placeholder for actual architectural imagery */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#e5d9c5]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="font-serif text-2xl text-white/10 italic">Project Imagery</div>
                 </div>
                 <div className="flex justify-between items-start">
                   <div>
                     <h4 className="font-serif text-2xl mb-2 group-hover:text-[#e5d9c5] transition-colors">{project.name}</h4>
                     <p className="text-[11px] uppercase tracking-widest text-white/40">{project.builder}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-bold text-[#e5d9c5]">{project.metric}</p>
                   </div>
                 </div>
               </motion.div>
             ))}
           </div>
        </div>
      </section>

      {/* ── PLATFORM TECHNOLOGY (STICKY SCROLL) ── */}
      <section id="platform" className="py-40 px-8 md:px-16 bg-[#0a0a0a] relative z-10 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-20">
          
          <div className="md:w-1/3 md:sticky md:top-40 h-fit">
            <div className="mb-12">
              <RevealText>
                <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-8">
                  03 / The Platform
                </h2>
              </RevealText>
              <RevealText delay={0.1}>
                <div className="font-serif text-4xl md:text-6xl leading-tight">
                  Quiet intelligence.<br />Absolute control.
                </div>
              </RevealText>
            </div>
            <p className="text-white/50 font-light leading-relaxed mb-8">
              Underneath the bespoke agency design lies a powerful SaaS infrastructure. WeaverFrame is built to scale your operations without scaling your headcount.
            </p>
          </div>

          <div className="md:w-2/3 space-y-12">
            {[
              { icon: Circle, title: "Omnichannel Capture", desc: "Unify WhatsApp, SMS, and web portal conversations. The AI adopts your brand's unique tone." },
              { icon: Pyramid, title: "Autonomous Conversion", desc: "Flawlessly handle objections and dynamically reference floor plans to convert casual inquiries into site visits." },
              { icon: Box, title: "Agency Command", desc: "Manage your portfolio of builders from a single dashboard. Strict multi-tenant isolation and analytics." }
            ].map((feat, i) => (
              <motion.div 
                key={feat.title}
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ duration: 0.6 }} 
                className="w-full bg-[#0f0f0f] border border-white/[0.05] p-10 md:p-16 hover:border-white/10 transition-colors"
              >
                <feat.icon className="size-10 text-[#e5d9c5] mb-8 stroke-1" />
                <h3 className="font-serif text-3xl mb-4">{feat.title}</h3>
                <p className="text-lg font-light text-white/50 leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INQUIRY (MAGNETIC CTA) ── */}
      <section id="inquiry" className="py-40 px-8 md:px-16 bg-[#0a0a0a] relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <RevealText>
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5]">
              04 / Partnership
            </h2>
          </RevealText>
          <RevealText delay={0.1}>
            <div className="font-serif text-5xl md:text-7xl leading-tight">
              Elevate your agency.
            </div>
          </RevealText>
          <motion.p 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 }} 
            className="text-xl font-light text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            We limit our platform to select, elite builder agencies to ensure unmatched performance and dedicated service. 
            Inquire below to reserve your allocation.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.5 }} className="pt-10">
            <MagneticButton href="mailto:partners@weaverframe.com">
              <span className="inline-flex items-center gap-6 px-12 py-6 border border-white/20 hover:border-[#e5d9c5] hover:text-[#e5d9c5] hover:bg-[#e5d9c5]/5 transition-colors duration-500 uppercase tracking-widest text-[11px] font-bold group cursor-pointer">
                Request an Invitation
                <ArrowRight className="size-4 group-hover:translate-x-2 transition-transform duration-500" />
              </span>
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.08] py-12 px-8 md:px-16 text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 bg-[#0a0a0a] relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>© {new Date().getFullYear()} WeaverFrame Architecture</div>
          <div className="flex gap-8 pointer-events-auto">
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-pointer">Legal</a></MagneticButton>
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-pointer">Privacy</a></MagneticButton>
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-pointer">Contact</a></MagneticButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
