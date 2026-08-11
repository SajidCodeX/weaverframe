import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, Calendar, Layers, Shield, Sparkles, Star, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "WeaverFrame | Premium AI for Custom Home Builders" },
      { name: "description", content: "The ultimate AI Concierge and CRM for premium home builders." }
    ]
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20; // -10 to 10
      const y = (e.clientY / window.innerHeight - 0.5) * 20; // -10 to 10
      setMousePosition({ x, y });
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden selection:bg-emerald-500/30 font-sans relative">
      
      {/* ── AMBIENT 3D BACKGROUND GLOWS ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div 
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-screen animate-pulse" 
          style={{ transform: `translate3d(${mousePosition.x * 2}px, ${mousePosition.y * 2}px, 0)` }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/10 blur-[150px] mix-blend-screen"
          style={{ transform: `translate3d(${mousePosition.x * -2}px, ${mousePosition.y * -2}px, 0)` }}
        />
        {/* Subtle grid overlay for tech feel */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      {/* ── NAVIGATION ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? "bg-[#030303]/80 backdrop-blur-xl border-b border-white/5 py-4" : "bg-transparent py-6"}`}>
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] flex items-center justify-center">
              <Layers className="size-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-[0.1em] uppercase text-white">WeaverFrame</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-white/60 hover:text-white transition-colors hidden md:block">Features</a>
            <Link 
              to="/login"
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Client Login
            </Link>
            <a 
              href="mailto:contact@weaverframe.com"
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-white/90 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION (3D PARALLAX) ── */}
      <main className="relative z-10 pt-40 pb-32 overflow-hidden flex items-center justify-center min-h-[90vh]">
        <div className="max-w-[1400px] mx-auto px-8 w-full flex flex-col lg:flex-row items-center gap-16" style={{ perspective: "1500px" }}>
          
          {/* Left Content */}
          <div className="flex-1 space-y-8 z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
              <Sparkles className="size-3.5 animate-pulse" />
              Llama 3.3 70B Powered
            </div>
            
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/40">
              The AI Concierge <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">For Premium Builders.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/60 max-w-xl leading-relaxed font-light">
              Stop losing leads after hours. WeaverFrame's intelligent SMS agent engages clients, schedules site visits, and manages your pipeline while you sleep.
            </p>
            
            <div className="flex items-center gap-4 pt-4">
              <a 
                href="mailto:contact@weaverframe.com"
                className="group relative px-8 py-4 bg-emerald-500 text-black font-bold rounded-xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] transition-all"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="flex items-center gap-2 relative z-10">
                  Request Agency Access <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
              <div className="flex items-center gap-3 text-sm text-white/50 font-medium ml-4">
                <Shield className="size-4 text-emerald-500" /> Enterprise Grade
              </div>
            </div>
          </div>

          {/* Right 3D Dashboard Mockup */}
          <div 
            className="flex-1 relative w-full h-[500px] hidden lg:block"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div 
              className="absolute inset-0 transition-transform duration-200 ease-out"
              style={{
                transform: `rotateY(${-mousePosition.x}deg) rotateX(${mousePosition.y}deg)`,
              }}
            >
              {/* Main App Window */}
              <div className="absolute inset-0 rounded-2xl bg-[#0a0a0c]/90 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-2xl overflow-hidden flex flex-col">
                <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-500/80" />
                    <div className="size-3 rounded-full bg-yellow-500/80" />
                    <div className="size-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-white/40 font-mono">
                    <Bot className="size-3" /> AI Active
                  </div>
                </div>
                <div className="flex-1 flex p-4 gap-4">
                  {/* Fake Sidebar */}
                  <div className="w-16 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col items-center py-4 gap-4">
                    <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4"><Layers className="size-4" /></div>
                    <div className="size-8 rounded-lg bg-white/5" />
                    <div className="size-8 rounded-lg bg-white/5" />
                    <div className="size-8 rounded-lg bg-white/5" />
                  </div>
                  {/* Fake Chat Interface */}
                  <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col">
                    <div className="h-14 border-b border-white/5 flex items-center px-4 gap-3">
                      <div className="size-8 rounded-full bg-blue-500/20" />
                      <div>
                        <div className="w-24 h-2.5 rounded bg-white/20 mb-1.5" />
                        <div className="w-16 h-2 rounded bg-green-500/50" />
                      </div>
                    </div>
                    <div className="flex-1 p-4 space-y-4">
                      <div className="flex gap-3">
                        <div className="size-6 rounded-full bg-blue-500/20 shrink-0" />
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 w-2/3 h-12" />
                      </div>
                      <div className="flex gap-3 flex-row-reverse">
                        <div className="size-6 rounded-full bg-emerald-500/20 shrink-0" />
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 w-1/2 h-16" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating 3D Elements */}
              <div 
                className="absolute -right-12 top-24 p-4 rounded-xl bg-[#111]/90 border border-white/10 shadow-2xl backdrop-blur-xl flex items-center gap-3"
                style={{ transform: "translateZ(80px)" }}
              >
                <div className="size-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="size-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs text-white/50 mb-0.5">Auto-Booked</div>
                  <div className="text-sm font-bold">Site Visit Confirmed</div>
                </div>
              </div>

              <div 
                className="absolute -left-8 bottom-32 p-4 rounded-xl bg-[#111]/90 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col gap-2"
                style={{ transform: "translateZ(120px)" }}
              >
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-yellow-500" />
                  <div className="text-xs font-bold uppercase tracking-widest text-white/80">Hot Lead Detected</div>
                </div>
                <div className="w-40 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-red-500 w-[85%]" />
                </div>
              </div>

            </div>
          </div>
          
        </div>
      </main>

      {/* ── FEATURES GRID ── */}
      <section id="features" className="py-32 relative z-10 bg-black/50 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-5xl font-display font-bold">Engineered for <span className="text-emerald-400">Excellence.</span></h2>
            <p className="text-white/50 max-w-2xl mx-auto text-lg">Not just a CRM. A complete operating system for custom home builders with AI embedded at the core.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-2 cursor-default">
              <div className="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Bot className="size-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">70B Parameter AI</h3>
              <p className="text-white/50 leading-relaxed">Our concierge uses advanced Llama 3.3 70B logic to converse naturally, answer complex questions, and never hallucinate your calendar.</p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-2 cursor-default">
              <div className="size-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="size-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Multi-Tenant Agency</h3>
              <p className="text-white/50 leading-relaxed">Built for agencies. Manage dozens of builders from a single super-admin dashboard with strict privacy boundaries.</p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-2 cursor-default">
              <div className="size-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="size-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-Time Portal</h3>
              <p className="text-white/50 leading-relaxed">Track exactly when clients are viewing their portal. See WhatsApp-style "Online" indicators instantly on your dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <footer className="py-24 relative z-10 border-t border-white/10 bg-[#050505] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/20 pointer-events-none" />
        <div className="max-w-[800px] mx-auto px-8 text-center space-y-8 relative z-10">
          <h2 className="text-4xl md:text-5xl font-display font-bold">Ready to scale your agency?</h2>
          <p className="text-xl text-white/50 font-light">Deploy WeaverFrame for your builders today and watch conversion rates soar.</p>
          <a 
            href="mailto:contact@weaverframe.com"
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-black font-bold rounded-xl text-lg hover:bg-emerald-400 transition-colors duration-300"
          >
            Contact Sales <ArrowRight className="size-5" />
          </a>
        </div>
        
        <div className="mt-24 pt-8 border-t border-white/5 text-center text-sm text-white/30">
          © {new Date().getFullYear()} WeaverFrame. Crafted with precision.
        </div>
      </footer>

      {/* Keyframes for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
