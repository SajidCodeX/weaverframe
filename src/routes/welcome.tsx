import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { ArrowRight, Bot, Calendar, Layers, Shield, Sparkles, Star, Users, Zap, MessageSquare, LineChart, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | The Ultimate AI CRM for Builders" },
      { name: "description", content: "Premium AI Concierge and dashboard for custom home builders." }
    ]
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Framer Motion 3D Mouse Tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for rotation
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), { damping: 30, stiffness: 100 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), { damping: 30, stiffness: 100 });
  
  // Parallax for floating elements
  const floatX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-30, 30]), { damping: 25, stiffness: 80 });
  const floatY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-30, 30]), { damping: 25, stiffness: 80 });
  const floatXReverse = useSpring(useTransform(mouseX, [-0.5, 0.5], [30, -30]), { damping: 25, stiffness: 80 });
  const floatYReverse = useSpring(useTransform(mouseY, [-0.5, 0.5], [30, -30]), { damping: 25, stiffness: 80 });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.body.getBoundingClientRect();
      // Normalize mouse coordinates between -0.5 and 0.5
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="h-screen bg-[#020202] text-white overflow-x-hidden overflow-y-auto selection:bg-emerald-500/30 font-sans relative perspective-[2000px]">
      
      {/* ── TOP-NOTCH AMBIENT BACKGROUND ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
        {/* Deep background glow */}
        <div className="absolute top-[20%] w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] rounded-full bg-emerald-900/20 blur-[180px] mix-blend-screen opacity-50" />
        
        {/* Dynamic mouse-following spotlight */}
        <motion.div 
          className="absolute w-[600px] h-[600px] rounded-full bg-emerald-500/15 blur-[120px] mix-blend-screen"
          style={{ 
            x: useSpring(useTransform(mouseX, [-0.5, 0.5], [-400, 400]), { damping: 40 }),
            y: useSpring(useTransform(mouseY, [-0.5, 0.5], [-400, 400]), { damping: 40 }),
          }}
        />

        {/* 3D Perspective Grid */}
        <div 
          className="absolute bottom-[-20%] left-[-50%] right-[-50%] h-[60vh] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:linear-gradient(to_bottom,transparent,black)]"
          style={{ transform: "perspective(1000px) rotateX(70deg) translateZ(0)", transformOrigin: "bottom" }}
        />
      </div>

      {/* ── ULTRA-PREMIUM NAVIGATION ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? "bg-[#020202]/70 backdrop-blur-2xl border-b border-white/5 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" : "bg-transparent py-6"}`}>
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#222] to-[#050505] border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.1)] flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
              <Layers className="size-5 text-white group-hover:text-emerald-400 transition-colors" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-widest uppercase text-white">WeaverFrame</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 px-6 py-2 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-md">
            <a href="#features" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Platform</a>
            <a href="#ai" className="text-sm font-medium text-white/70 hover:text-white transition-colors">AI Concierge</a>
            <a href="#pricing" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/login"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <a 
              href="mailto:contact@weaverframe.com"
              className="group relative px-6 py-2.5 rounded-full text-sm font-bold overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative z-10 flex items-center gap-2 text-black">
                Book a Demo <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
          </div>
        </div>
      </nav>

      {/* ── 3D HERO SECTION ── */}
      <main className="relative z-10 pt-40 pb-32 flex flex-col items-center justify-center min-h-screen">
        <div className="max-w-[1400px] mx-auto px-8 w-full flex flex-col xl:flex-row items-center gap-20">
          
          {/* Left: Typography & CTA */}
          <div className="flex-1 space-y-8 z-20 text-center xl:text-left">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-xl"
            >
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-white/80">Llama 3.3 70B Engine Active</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="text-6xl md:text-8xl font-display font-extrabold tracking-tighter leading-[1.05]"
            >
              The Next Era of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/30">
                Home Building.
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto xl:mx-0 leading-relaxed font-light"
            >
              WeaverFrame is the hyper-premium CRM that autonomously nurtures leads, books site visits, and closes deals—all driven by advanced AI.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-6 pt-4 justify-center xl:justify-start"
            >
              <a 
                href="mailto:contact@weaverframe.com"
                className="group relative px-10 py-5 bg-white text-black font-bold rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] transition-all hover:scale-105 duration-300"
              >
                <span className="flex items-center gap-3 text-lg">
                  Deploy for your Agency <ChevronRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
              <div className="flex items-center gap-3 text-white/40">
                <Shield className="size-5 text-emerald-500/70" />
                <span className="text-sm font-medium">Bank-grade Security</span>
              </div>
            </motion.div>
          </div>

          {/* Right: The 3D Glass Masterpiece */}
          <div className="flex-1 w-full max-w-[700px] aspect-square relative perspective-[2000px]">
            <motion.div 
              className="w-full h-full relative"
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            >
              
              {/* Back Glow */}
              <div 
                className="absolute inset-10 rounded-full bg-emerald-500/30 blur-[100px]"
                style={{ transform: "translateZ(-100px)" }}
              />

              {/* Main Dashboard Panel */}
              <div 
                className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/20 shadow-[0_20px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-3xl overflow-hidden flex flex-col"
                style={{ transform: "translateZ(0px)" }}
              >
                {/* Mac OS Style Header */}
                <div className="h-12 border-b border-white/10 flex items-center px-6 gap-2 bg-black/20">
                  <div className="flex gap-2">
                    <div className="size-3.5 rounded-full bg-white/20" />
                    <div className="size-3.5 rounded-full bg-white/20" />
                    <div className="size-3.5 rounded-full bg-white/20" />
                  </div>
                  <div className="mx-auto px-4 py-1.5 rounded-md bg-black/40 border border-white/5 flex items-center gap-2">
                    <Bot className="size-3.5 text-emerald-400" />
                    <span className="text-xs font-mono text-white/70">AI Agent Active</span>
                  </div>
                  <div className="w-10" />
                </div>

                {/* Dashboard Content */}
                <div className="flex-1 p-6 flex gap-6">
                  {/* Sidebar */}
                  <div className="w-48 rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col gap-4">
                    <div className="h-10 rounded-xl bg-white/10 border border-white/10 flex items-center px-3 gap-3">
                      <Users className="size-4 text-white/70" />
                      <div className="h-2 w-16 bg-white/30 rounded-full" />
                    </div>
                    <div className="h-10 rounded-xl bg-white/5 flex items-center px-3 gap-3">
                      <MessageSquare className="size-4 text-white/40" />
                      <div className="h-2 w-12 bg-white/20 rounded-full" />
                    </div>
                    <div className="h-10 rounded-xl bg-white/5 flex items-center px-3 gap-3">
                      <Calendar className="size-4 text-white/40" />
                      <div className="h-2 w-20 bg-white/20 rounded-full" />
                    </div>
                  </div>

                  {/* Main Chat/Graph Area */}
                  <div className="flex-1 flex flex-col gap-6">
                    {/* Graph Card */}
                    <div className="h-32 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-5 flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[40px] rounded-full" />
                      <div className="flex items-center gap-3">
                        <LineChart className="size-5 text-emerald-400" />
                        <span className="text-sm font-bold text-white">Conversion Rate</span>
                      </div>
                      <div className="text-3xl font-display font-bold text-white">42.8% <span className="text-sm text-emerald-400">+12%</span></div>
                    </div>

                    {/* Chat UI */}
                    <div className="flex-1 rounded-2xl bg-black/20 border border-white/5 p-5 flex flex-col gap-4">
                      <div className="flex gap-3 w-4/5">
                        <div className="size-8 rounded-full bg-blue-500/20 shrink-0" />
                        <div className="h-12 rounded-2xl rounded-tl-sm bg-white/10 w-full" />
                      </div>
                      <div className="flex gap-3 w-4/5 self-end flex-row-reverse">
                        <div className="size-8 rounded-full bg-emerald-500/20 shrink-0 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          <Bot className="size-4 text-emerald-400" />
                        </div>
                        <div className="h-16 rounded-2xl rounded-tr-sm bg-emerald-500/10 border border-emerald-500/20 w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Element: Booking Confirmed (Pops out in Z space) */}
              <motion.div 
                className="absolute -right-16 top-32 p-5 rounded-2xl bg-[#0a0a0c]/90 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-xl flex items-center gap-4"
                style={{ transform: "translateZ(100px)", x: floatX, y: floatY }}
              >
                <div className="size-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <Calendar className="size-6 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-mono text-emerald-400 mb-1">AUTO-BOOKED</div>
                  <div className="text-base font-bold text-white">Site Visit Confirmed</div>
                </div>
              </motion.div>

              {/* Floating Element: Lead Score (Pops out further) */}
              <motion.div 
                className="absolute -left-12 bottom-40 p-5 rounded-2xl bg-[#0a0a0c]/90 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-xl flex flex-col gap-3 w-56"
                style={{ transform: "translateZ(140px)", x: floatXReverse, y: floatYReverse }}
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                    <Star className="size-5 text-yellow-400" />
                  </div>
                  <div className="text-sm font-bold text-white">Hot Lead</div>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-red-500 w-[92%] shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                </div>
              </motion.div>

            </motion.div>
          </div>
          
        </div>
      </main>

      {/* ── HIGH-END FEATURES GRID ── */}
      <section id="features" className="py-32 relative z-10 bg-[#050505]">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        <div className="max-w-[1400px] mx-auto px-8 relative z-10">
          <div className="text-center mb-24 space-y-6">
            <h2 className="text-5xl md:text-6xl font-display font-bold">Uncompromising <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Power.</span></h2>
            <p className="text-white/50 max-w-2xl mx-auto text-xl font-light">The only platform engineered specifically for agencies managing elite custom home builders.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-emerald-500/50 transition-all duration-700">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative h-full p-8 rounded-[23px] bg-[#0a0a0a] border border-white/5 overflow-hidden">
                <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all duration-500">
                  <Bot className="size-7 text-white group-hover:text-emerald-400 transition-colors" />
                </div>
                <h3 className="text-2xl font-bold mb-4">70B Parameter AI</h3>
                <p className="text-white/50 leading-relaxed text-lg font-light">Fine-tuned Llama 3.3 70B logic converses naturally, handles objections, and perfectly manages your scheduling without hallucinations.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-blue-500/50 transition-all duration-700">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative h-full p-8 rounded-[23px] bg-[#0a0a0a] border border-white/5 overflow-hidden">
                <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all duration-500">
                  <Users className="size-7 text-white group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Multi-Tenant Architecture</h3>
                <p className="text-white/50 leading-relaxed text-lg font-light">Built for scale. Agencies can seamlessly manage dozens of builder accounts from a single, unified super-admin dashboard.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-purple-500/50 transition-all duration-700">
              <div className="absolute inset-0 bg-purple-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative h-full p-8 rounded-[23px] bg-[#0a0a0a] border border-white/5 overflow-hidden">
                <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 transition-all duration-500">
                  <Zap className="size-7 text-white group-hover:text-purple-400 transition-colors" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Real-Time Sync</h3>
                <p className="text-white/50 leading-relaxed text-lg font-light">Experience instantaneous WhatsApp-style online indicators and live chat mirroring between the dashboard and client portals.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <footer className="py-32 relative z-10 border-t border-white/5 bg-[#020202] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-[800px] mx-auto px-8 text-center space-y-10 relative z-10">
          <h2 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight">Step into the <br/><span className="text-emerald-400">Future.</span></h2>
          <p className="text-xl text-white/50 font-light max-w-xl mx-auto">Equip your agency with the world's most advanced AI platform for custom home builders.</p>
          <a 
            href="mailto:contact@weaverframe.com"
            className="inline-flex items-center gap-3 px-12 py-6 bg-white text-black font-bold rounded-full text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300"
          >
            Contact Enterprise Sales <ArrowRight className="size-5" />
          </a>
        </div>
        
        <div className="mt-32 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between max-w-[1400px] mx-auto px-8 text-sm text-white/30 font-medium">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Layers className="size-4" /> WeaverFrame © {new Date().getFullYear()}
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* CSS Utilities */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .perspective-\\[2000px\\] {
          perspective: 2000px;
        }
      `}} />
    </div>
  );
}
