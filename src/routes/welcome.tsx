import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef } from "react";
import { motion, useScroll, useTransform, cubicBezier } from "framer-motion";
import { ArrowRight, Box, Circle, Pyramid } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

import { CustomCursor } from "../components/CustomCursor";
import { MagneticButton } from "../components/MagneticButton";

// ── 3D FLUID AURA (WEBGL SHADER REPLACEMENT) ──────────────────────────────────
function FluidAura() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={[2, 0, -2]} scale={1.8}>
        <sphereGeometry args={[2, 128, 128]} />
        <MeshDistortMaterial 
          color="#0a0a0a" 
          attach="material" 
          distort={0.6} 
          speed={1.5} 
          roughness={0.2}
          metalness={0.9}
          envMapIntensity={2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
}

function Scene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
      <color attach="background" args={["#0a0a0a"]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#e5d9c5" />
      <directionalLight position={[-10, -10, -5]} intensity={1} color="#ffffff" />
      <spotLight position={[0, 10, 0]} intensity={2} color="#e5d9c5" />

      <Suspense fallback={null}>
        <Environment preset="city" />
        <FluidAura />
      </Suspense>
    </Canvas>
  );
}

// ── TEXT REVEAL COMPONENT ─────────────────────────────────────────────────────
const RevealText = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <div className="overflow-hidden">
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  </div>
);

// ── MARQUEE COMPONENT ─────────────────────────────────────────────────────────
const Marquee = () => {
  return (
    <div className="w-full overflow-hidden bg-[#e5d9c5] text-[#0a0a0a] py-4 whitespace-nowrap flex items-center relative z-20 mix-blend-difference border-y border-white/10">
      <motion.div 
        animate={{ x: [0, -1000] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="flex items-center space-x-12"
      >
        {[...Array(6)].map((_, i) => (
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
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <div className="h-screen overflow-x-hidden overflow-y-auto relative bg-[#0a0a0a] text-[#f8f8f8] font-sans selection:bg-[#e5d9c5] selection:text-black cursor-none">
      
      <CustomCursor />

      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 mix-blend-difference border-b border-white/[0.08] px-8 py-6 flex items-center justify-between pointer-events-none">
        <div className="font-serif text-xl tracking-widest uppercase pointer-events-auto">WeaverFrame</div>
        <div className="hidden md:flex gap-12 text-[11px] font-bold tracking-[0.2em] uppercase pointer-events-auto">
          <MagneticButton><a href="#ethos" className="hover:text-[#e5d9c5] transition-colors">Ethos</a></MagneticButton>
          <MagneticButton><a href="#platform" className="hover:text-[#e5d9c5] transition-colors">Platform</a></MagneticButton>
          <MagneticButton><a href="#inquiry" className="hover:text-[#e5d9c5] transition-colors">Inquiry</a></MagneticButton>
        </div>
        <div className="pointer-events-auto">
          <MagneticButton>
            <Link to="/login" className="text-[11px] font-bold tracking-[0.2em] uppercase border-b border-transparent hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-all pb-1">Client Access</Link>
          </MagneticButton>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none mix-blend-screen opacity-90">
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
                The first autonomous operating system designed exclusively for elite custom home builders.
              </RevealText>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-12 left-8 md:left-16 flex items-center gap-6 z-10 mix-blend-difference">
          <motion.div 
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 1, duration: 1 }}
            className="w-px h-12 bg-white/50 origin-top" 
          />
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="text-[10px] uppercase tracking-[0.4em] font-bold">
            Scroll to Discover
          </motion.span>
        </div>
      </section>

      <Marquee />

      {/* ── ETHOS (MANIFESTO) ── */}
      <section id="ethos" className="relative py-40 px-8 md:px-16 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-4">
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] sticky top-40">01 / The Ethos</h2>
          </div>
          <div className="md:col-span-8">
            <div className="overflow-hidden mb-12">
              <motion.h3 
                initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="font-serif text-3xl md:text-5xl leading-tight text-white/90"
              >
                Exclusivity requires focus. We handle the noise so you can focus on the craftsmanship. WeaverFrame acts as your silent, 24/7 digital partner.
              </motion.h3>
            </div>
            
            {/* Rich Parallax Image Placeholder */}
            <motion.div 
              style={{ y: yParallax }}
              className="w-full h-[500px] bg-[#111] mt-20 relative overflow-hidden flex items-center justify-center group"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,217,197,0.1),transparent)] opacity-50 group-hover:scale-110 transition-transform duration-1000" />
              <div className="font-serif text-3xl italic text-white/20">The pursuit of perfection</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM METRICS ── */}
      <section className="border-t border-white/[0.08] py-20 px-8 md:px-16 relative z-10 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          {[
            { num: "< 30s", label: "Response Latency", desc: "Immediate, intelligent lead engagement round the clock. Never miss a high-net-worth inquiry again." },
            { num: "70B", label: "Parameter AI", desc: "Powered by the most advanced LLMs trained specifically on luxury real estate dynamics and architectural nuance." },
            { num: "100%", label: "Autonomous", desc: "From first touch to booked site visit on your calendar, entirely without human intervention." }
          ].map((stat, i) => (
            <div key={stat.label} className={`pt-8 md:pt-0 ${i !== 0 ? 'md:pl-16' : ''}`}>
              <div className="overflow-hidden mb-6">
                <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false }} transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-7xl md:text-8xl text-[#e5d9c5]">
                  {stat.num}
                </motion.div>
              </div>
              <div className="overflow-hidden mb-3">
                <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false }} transition={{ duration: 1, delay: i * 0.1 + 0.1, ease: [0.16, 1, 0.3, 1] }} className="text-[11px] uppercase tracking-[0.2em] font-bold">
                  {stat.label}
                </motion.div>
              </div>
              <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false }} transition={{ duration: 1, delay: i * 0.1 + 0.2 }} className="text-sm font-light text-white/40 leading-relaxed max-w-xs">
                {stat.desc}
              </motion.p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES (STICKY SCROLL) ── */}
      <section id="platform" className="border-t border-white/[0.08] py-40 px-8 md:px-16 bg-[#0a0a0a] relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-20">
          
          {/* Sticky Left Column */}
          <div className="md:w-1/3 md:sticky md:top-40 h-fit">
            <div className="mb-32 overflow-hidden">
              <motion.h2 initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-8">
                02 / The Platform
              </motion.h2>
              <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-5xl md:text-7xl leading-tight">
                Quiet intelligence.<br />Absolute control.
              </motion.div>
            </div>
          </div>

          {/* Scrolling Right Column */}
          <div className="md:w-2/3 space-y-40">
            {/* Feature 1 */}
            <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 1 }} className="group">
              <div className="w-full aspect-video bg-[#0f0f0f] border border-white/[0.05] relative overflow-hidden flex flex-col justify-end p-12 hover:border-white/10 transition-colors duration-700">
                <div className="absolute inset-0 bg-gradient-to-t from-[#e5d9c5]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Circle className="size-12 text-[#e5d9c5] mb-auto stroke-1" />
                <div className="relative z-10">
                  <h3 className="font-serif text-4xl mb-4">Omnichannel Capture</h3>
                  <p className="text-lg font-light text-white/50 leading-relaxed max-w-xl">
                    Whether a client reaches out via WhatsApp, SMS, or your bespoke web portal, WeaverFrame unifies the conversation. The AI adopts your brand's unique tone, ensuring a deeply personal touch.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 1 }} className="group">
              <div className="w-full aspect-video bg-[#0f0f0f] border border-white/[0.05] relative overflow-hidden flex flex-col justify-end p-12 hover:border-white/10 transition-colors duration-700">
                <div className="absolute inset-0 bg-gradient-to-t from-[#e5d9c5]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Pyramid className="size-12 text-[#e5d9c5] mb-auto stroke-1" />
                <div className="relative z-10">
                  <h3 className="font-serif text-4xl mb-4">Autonomous Conversion</h3>
                  <p className="text-lg font-light text-white/50 leading-relaxed max-w-xl">
                    It doesn't just answer questions; it drives intent. By flawlessly handling objections and dynamically referencing your floor plans and pricing, the concierge converts casual inquiries into scheduled site visits.
                  </p>
                </div>
              </div>
            </motion.div>
            
            {/* Feature 3 */}
            <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 1 }} className="group">
              <div className="w-full aspect-video bg-[#0f0f0f] border border-white/[0.05] relative overflow-hidden flex flex-col justify-end p-12 hover:border-white/10 transition-colors duration-700">
                <div className="absolute inset-0 bg-gradient-to-t from-[#e5d9c5]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <Box className="size-12 text-[#e5d9c5] mb-auto stroke-1" />
                <div className="relative z-10">
                  <h3 className="font-serif text-4xl mb-4">Agency Command</h3>
                  <p className="text-lg font-light text-white/50 leading-relaxed max-w-xl">
                    Manage your entire portfolio of builders from a single, austere dashboard. With strict multi-tenant isolation, cross-builder analytics, and impersonation capabilities, you possess total operational oversight.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── INQUIRY (MAGNETIC CTA) ── */}
      <section id="inquiry" className="border-t border-white/[0.08] py-40 px-8 md:px-16 bg-[#0a0a0a] relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="overflow-hidden">
            <motion.h2 initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5]">
              03 / Partnership
            </motion.h2>
          </div>
          <div className="overflow-hidden">
            <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-5xl md:text-7xl leading-tight">
              Elevate your agency.
            </motion.div>
          </div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.3 }} className="text-xl font-light text-white/50 max-w-2xl mx-auto leading-relaxed">
            We limit our platform to select, elite builder agencies to ensure unmatched performance and dedicated service. 
            Inquire below to reserve your allocation.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.5 }} className="pt-10">
            <MagneticButton href="mailto:partners@weaverframe.com">
              <span className="inline-flex items-center gap-6 px-12 py-6 border border-white/20 hover:border-[#e5d9c5] hover:text-[#e5d9c5] hover:bg-[#e5d9c5]/5 transition-colors duration-500 uppercase tracking-widest text-[11px] font-bold group cursor-none">
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
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-none">Legal</a></MagneticButton>
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-none">Privacy</a></MagneticButton>
            <MagneticButton><a href="#" className="hover:text-white transition-colors cursor-none">Contact</a></MagneticButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
