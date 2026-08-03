import { Shell } from "@/components/dashboard/Shell";

export function RoutePending({ title = "Loading...", type = "default" }: { title?: string, type?: "overview" | "leads" | "messages" | "default" }) {
  
  const renderLayout = () => {
    switch (type) {
      case "leads":
        return (
          <div className="grid grid-cols-4 gap-4 h-[calc(100vh-140px)]">
            {[...Array(4)].map((_, colIdx) => (
              <div key={colIdx} className="skeleton-card rounded-xl border border-border/40 p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="skeleton-block h-4 w-24 rounded" />
                  <div className="skeleton-block size-6 rounded" />
                </div>
                {[...Array(3)].map((_, cardIdx) => (
                  <div key={cardIdx} className="skeleton-block h-28 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        );
      
      case "messages":
        return (
          <div className="flex gap-4 h-[calc(100vh-140px)]">
            {/* Sidebar leads list */}
            <div className="w-80 skeleton-card rounded-xl border border-border/40 p-4 space-y-4 shrink-0">
              <div className="skeleton-block h-10 w-full rounded-lg" />
              <div className="space-y-3 mt-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton-block size-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-block h-3.5 w-3/4 rounded" />
                      <div className="skeleton-block h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Main chat area */}
            <div className="flex-1 skeleton-card rounded-xl border border-border/40 flex flex-col">
              <div className="h-16 border-b border-border/40 flex items-center px-6">
                <div className="skeleton-block h-5 w-40 rounded" />
              </div>
              <div className="flex-1 p-6 space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`flex gap-3 max-w-[80%] ${i % 2 === 0 ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                    <div className="skeleton-block size-8 rounded-full shrink-0" />
                    <div className={`skeleton-block h-16 w-64 rounded-xl ${i % 2 === 0 ? "rounded-tl-none" : "rounded-tr-none"}`} />
                  </div>
                ))}
              </div>
              <div className="h-20 border-t border-border/40 p-4">
                <div className="skeleton-block h-full w-full rounded-lg" />
              </div>
            </div>
          </div>
        );

      case "overview":
      case "default":
      default:
        return (
          <>
            {/* Row 1: Stat cards */}
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton-card rounded-xl border border-border/40 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="skeleton-block h-3 w-20 rounded" />
                    <div className="skeleton-block size-7 rounded-md" />
                  </div>
                  <div className="skeleton-block h-8 w-24 rounded" />
                  <div className="skeleton-block h-3 w-32 rounded" />
                </div>
              ))}
            </div>

            {/* Row 2: Action bar */}
            <div className="flex items-center gap-3">
              <div className="skeleton-block h-9 w-64 rounded-lg" />
              <div className="skeleton-block h-9 w-24 rounded-lg" />
              <div className="skeleton-block h-9 w-24 rounded-lg" />
              <div className="flex-1" />
              <div className="skeleton-block h-9 w-32 rounded-lg" />
            </div>

            {/* Row 3: Content area */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 skeleton-card rounded-xl border border-border/40 p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/20 last:border-0">
                    <div className="skeleton-block size-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-block h-3.5 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                      <div className="skeleton-block h-2.5 w-1/3 rounded" />
                    </div>
                    <div className="skeleton-block h-6 w-16 rounded-full" />
                    <div className="skeleton-block h-6 w-20 rounded" />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                  <div className="skeleton-block h-3 w-28 rounded" />
                  <div className="skeleton-block h-40 w-full rounded-lg" />
                </div>
                <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-3">
                  <div className="skeleton-block h-3 w-24 rounded" />
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="skeleton-block h-3 rounded" style={{ width: `${40 + i * 15}%` }} />
                      <div className="skeleton-block h-3 w-10 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <Shell title={title}>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px]">
        <div className="h-full rounded-r-full" style={{
          background: "linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)",
          animation: "progressBar 1.8s ease-in-out infinite",
        }} />
      </div>

      <div className="p-6 space-y-6 animate-in fade-in duration-300">
        {renderLayout()}
      </div>

      <style>{`
        @keyframes progressBar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 0; }
          100% { width: 0%; margin-left: 100%; }
        }
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-block {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 25%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.03) 75%
          );
          background-size: 800px 100%;
          animation: shimmer 1.6s ease-in-out infinite;
        }
        .skeleton-card {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </Shell>
  );
}
