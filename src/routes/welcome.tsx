import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Box, Circle, Pyramid } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float, Environment } from "@react-three/drei";
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
      
      {/* Dynamic Lighting for the Liquid Aura */}
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
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, 300]);

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

      {/* ── ETHOS (MANIFESTO) ── */}
      <section id="ethos" className="relative py-40 px-8 md:px-16 border-t border-white/[0.08] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-4">
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5]">01 / The Ethos</h2>
          </div>
          <div className="md:col-span-8 overflow-hidden">
            <motion.h3 
              initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="font-serif text-3xl md:text-5xl leading-tight text-white/90"
            >
              Exclusivity requires focus. We handle the noise so you can focus on the craftsmanship. WeaverFrame acts as your silent, 24/7 digital partner—intercepting leads, answering architectural queries, and curating your client pipeline with zero human intervention.
            </motion.h3>
          </div>
        </div>
      </section>

      {/* ── PLATFORM METRICS ── */}
      <section className="border-t border-white/[0.08] py-20 px-8 md:px-16 relative z-10 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          {[
            { num: "< 30s", label: "Response Latency", desc: "Immediate, intelligent lead engagement round the clock." },
            { num: "70B", label: "Parameter AI", desc: "Powered by the most advanced LLMs trained on real estate dynamics." },
            { num: "0", label: "Human Effort", desc: "From first touch to booked site visit, entirely autonomous." }
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

      {/* ── FEATURES (ASYMMETRIC) ── */}
      <section id="platform" className="border-t border-white/[0.08] py-40 px-8 md:px-16 bg-[#0a0a0a] relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-32 overflow-hidden">
            <motion.h2 initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-8">
              02 / The Platform
            </motion.h2>
            <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="font-serif text-5xl md:text-7xl leading-tight">
              Quiet intelligence.<br />Absolute control.
            </motion.div>
          </div>

          <div className="space-y-40">
            {/* Feature 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1.5, ease: "easeOut" }} className="order-2 md:order-1">
                <div className="w-full aspect-square md:aspect-[4/5] bg-[#111111] border border-white/[0.08] relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#e5d9c5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="text-center space-y-6 z-10 mix-blend-difference opacity-80">
                    <Circle className="size-16 mx-auto stroke-[0.5]" />
                    <div className="font-serif text-2xl italic">Omnichannel Capture</div>
                  </div>
                </div>
              </motion.div>
              <div className="order-1 md:order-2 space-y-6 md:pl-16">
                <div className="overflow-hidden">
                  <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="text-3xl font-serif">Seamless Integration</motion.div>
                </div>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.2 }} className="text-lg font-light text-white/50 leading-relaxed">
                  Whether a client reaches out via WhatsApp, SMS, or your bespoke web portal, WeaverFrame unifies the conversation. The AI adopts your brand's unique tone, ensuring a deeply personal touch.
                </motion.p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="space-y-6 md:pr-16">
                <div className="overflow-hidden">
                  <motion.div initial={{ y: "100%" }} whileInView={{ y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="text-3xl font-serif">The AI Concierge</motion.div>
                </div>
                <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1, delay: 0.2 }} className="text-lg font-light text-white/50 leading-relaxed">
                  It doesn't just answer questions; it drives intent. By flawlessly handling objections and dynamically referencing your floor plans and pricing, the concierge converts casual inquiries into scheduled site visits.
                </motion.p>
              </div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1.5, ease: "easeOut" }}>
                <div className="w-full aspect-square md:aspect-[4/5] bg-[#111111] border border-white/[0.08] relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-bl from-transparent to-[#e5d9c5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="text-center space-y-6 z-10 mix-blend-difference opacity-80">
                    <Pyramid className="size-16 mx-auto stroke-[0.5]" />
                    <div className="font-serif text-2xl italic">Autonomous Conversion</div>
                  </div>
                </div>
              </motion.div>
            </div>
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
