import { createFileRoute, Link } from "@tanstack/react-router";
import React, { Suspense, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Box, Circle, Pyramid } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

// ── 3D MINIMALIST ARCHITECTURE ────────────────────────────────────────────────
function MinimalArchitecture() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
      // Slight vertical floating
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  // Matte Sand/Alabaster Material
  const material = new THREE.MeshStandardMaterial({
    color: "#e5d9c5",
    roughness: 0.9,
    metalness: 0.1,
  });

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      {/* Base Plinth */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[4, 0.4, 4]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Structural Column */}
      <mesh castShadow receiveShadow position={[-0.8, 1.5, 0.8]}>
        <boxGeometry args={[0.6, 3, 0.6]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Horizontal Slab */}
      <mesh castShadow receiveShadow position={[0.5, 3.2, 0]}>
        <boxGeometry args={[4.5, 0.4, 3]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Accent Wall */}
      <mesh castShadow receiveShadow position={[1.5, 1.6, -1]}>
        <boxGeometry args={[0.2, 2.8, 2]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

function Scene3D() {
  return (
    <Canvas shadows camera={{ position: [6, 4, 8], fov: 35 }}>
      <SoftShadows size={25} samples={10} focus={0.5} />
      <color attach="background" args={["#0a0a0a"]} />
      
      <ambientLight intensity={0.4} />
      {/* Key Light */}
      <spotLight 
        position={[10, 15, 10]} 
        angle={0.25} 
        penumbra={1} 
        intensity={2.5} 
        castShadow 
        shadow-bias={-0.0001} 
      />
      {/* Fill Light */}
      <spotLight 
        position={[-10, 5, -10]} 
        angle={0.5} 
        penumbra={1} 
        intensity={0.8} 
        color="#ffffff"
      />

      <MinimalArchitecture />
      
      {/* Invisible Floor for Shadows */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <shadowMaterial transparent opacity={0.3} />
      </mesh>

      <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2.1} autoRotate={false} />
    </Canvas>
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
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, 300]);

  return (
    <div className="bg-[#0a0a0a] text-[#f8f8f8] font-sans selection:bg-[#e5d9c5] selection:text-black">
      
      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 mix-blend-difference border-b border-white/[0.08] px-8 py-6 flex items-center justify-between">
        <div className="font-serif text-xl tracking-widest uppercase">WeaverFrame</div>
        <div className="hidden md:flex gap-12 text-[11px] font-bold tracking-[0.2em] uppercase">
          <a href="#ethos" className="hover:text-[#e5d9c5] transition-colors">Ethos</a>
          <a href="#platform" className="hover:text-[#e5d9c5] transition-colors">Platform</a>
          <a href="#inquiry" className="hover:text-[#e5d9c5] transition-colors">Inquiry</a>
        </div>
        <Link to="/login" className="text-[11px] font-bold tracking-[0.2em] uppercase border-b border-transparent hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-all pb-1">Client Access</Link>
      </header>

      {/* ── HERO ── */}
      <section className="relative h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-80 mix-blend-screen">
          <Suspense fallback={<div className="w-full h-full bg-[#0a0a0a]" />}>
            <Scene3D />
          </Suspense>
        </div>
        
        <div className="relative z-10 w-full px-8 md:px-16 pointer-events-none mt-20">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }} className="max-w-4xl">
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[140px] leading-[0.9] tracking-tight mb-8">
              Build <br /> <i className="text-[#e5d9c5]">Differently.</i>
            </h1>
            <p className="max-w-md text-lg md:text-xl font-light leading-relaxed text-white/60">
              The first autonomous operating system designed exclusively for elite custom home builders.
            </p>
          </motion.div>
        </div>
        
        <div className="absolute bottom-12 left-8 md:left-16 flex items-center gap-6 z-10 mix-blend-difference">
          <div className="w-px h-12 bg-white/30" />
          <span className="text-[10px] uppercase tracking-[0.4em] font-bold">Scroll to Discover</span>
        </div>
      </section>

      {/* ── ETHOS (MANIFESTO) ── */}
      <section id="ethos" className="relative py-40 px-8 md:px-16 border-t border-white/[0.08] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5]">01 / The Ethos</h2>
          </div>
          <div className="md:col-span-8">
            <motion.h3 
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }}
              className="font-serif text-3xl md:text-5xl leading-tight text-white/90"
            >
              Exclusivity requires focus. We handle the noise so you can focus on the craftsmanship. WeaverFrame acts as your silent, 24/7 digital partner—intercepting leads, answering architectural queries, and curating your client pipeline with zero human intervention.
            </motion.h3>
          </div>
        </div>
      </section>

      {/* ── PLATFORM METRICS ── */}
      <section className="border-t border-white/[0.08] py-20 px-8 md:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          {[
            { num: "< 30s", label: "Response Latency", desc: "Immediate, intelligent lead engagement round the clock." },
            { num: "70B", label: "Parameter AI", desc: "Powered by the most advanced LLMs trained on real estate dynamics." },
            { num: "0", label: "Human Effort", desc: "From first touch to booked site visit, entirely autonomous." }
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false }} transition={{ duration: 1, delay: i * 0.2 }}
              className={`pt-8 md:pt-0 ${i !== 0 ? 'md:pl-16' : ''}`}
            >
              <div className="font-serif text-7xl md:text-8xl mb-6 text-[#e5d9c5]">{stat.num}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-3">{stat.label}</div>
              <p className="text-sm font-light text-white/40 leading-relaxed max-w-xs">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES (ASYMMETRIC) ── */}
      <section id="platform" className="border-t border-white/[0.08] py-40 px-8 md:px-16 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-32">
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5] mb-8">02 / The Platform</h2>
            <div className="font-serif text-5xl md:text-7xl leading-tight">Quiet intelligence.<br />Absolute control.</div>
          </div>

          <div className="space-y-40">
            {/* Feature 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }} className="order-2 md:order-1">
                <div className="w-full aspect-square md:aspect-[4/5] bg-[#111111] border border-white/[0.08] relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#e5d9c5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="text-center space-y-6 z-10 mix-blend-difference opacity-80">
                    <Circle className="size-16 mx-auto stroke-[0.5]" />
                    <div className="font-serif text-2xl italic">Omnichannel Capture</div>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }} className="order-1 md:order-2 space-y-6 md:pl-16">
                <div className="text-3xl font-serif">Seamless Integration</div>
                <p className="text-lg font-light text-white/50 leading-relaxed">Whether a client reaches out via WhatsApp, SMS, or your bespoke web portal, WeaverFrame unifies the conversation. The AI adopts your brand's unique tone, ensuring a deeply personal touch.</p>
              </motion.div>
            </div>

            {/* Feature 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }} className="space-y-6 md:pr-16">
                <div className="text-3xl font-serif">The AI Concierge</div>
                <p className="text-lg font-light text-white/50 leading-relaxed">It doesn't just answer questions; it drives intent. By flawlessly handling objections and dynamically referencing your floor plans and pricing, the concierge converts casual inquiries into scheduled site visits.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }}>
                <div className="w-full aspect-square md:aspect-[4/5] bg-[#111111] border border-white/[0.08] relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-bl from-transparent to-[#e5d9c5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="text-center space-y-6 z-10 mix-blend-difference opacity-80">
                    <Pyramid className="size-16 mx-auto stroke-[0.5]" />
                    <div className="font-serif text-2xl italic">Autonomous Conversion</div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Feature 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }} className="order-2 md:order-1">
                <div className="w-full aspect-square md:aspect-[4/5] bg-[#111111] border border-white/[0.08] relative overflow-hidden flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-[#e5d9c5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="text-center space-y-6 z-10 mix-blend-difference opacity-80">
                    <Box className="size-16 mx-auto stroke-[0.5]" />
                    <div className="font-serif text-2xl italic">Super Admin Control</div>
                  </div>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 1 }} className="order-1 md:order-2 space-y-6 md:pl-16">
                <div className="text-3xl font-serif">Agency Command</div>
                <p className="text-lg font-light text-white/50 leading-relaxed">Manage your entire portfolio of builders from a single, austere dashboard. With strict multi-tenant isolation, cross-builder analytics, and impersonation capabilities, you possess total operational oversight.</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INQUIRY (REPLACES PRICING) ── */}
      <section id="inquiry" className="border-t border-white/[0.08] py-40 px-8 md:px-16">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <h2 className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#e5d9c5]">03 / Partnership</h2>
          <div className="font-serif text-5xl md:text-7xl leading-tight">Elevate your agency.</div>
          <p className="text-xl font-light text-white/50 max-w-2xl mx-auto leading-relaxed">
            We limit our platform to select, elite builder agencies to ensure unmatched performance and dedicated service. 
            Inquire below to reserve your allocation.
          </p>
          <div className="pt-10">
            <a href="mailto:partners@weaverframe.com" className="inline-flex items-center gap-6 px-10 py-5 border border-white/20 hover:border-[#e5d9c5] hover:text-[#e5d9c5] transition-all duration-500 uppercase tracking-widest text-[11px] font-bold group">
              Request an Invitation
              <ArrowRight className="size-4 group-hover:translate-x-2 transition-transform duration-500" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.08] py-12 px-8 md:px-16 text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>© {new Date().getFullYear()} WeaverFrame Architecture</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
