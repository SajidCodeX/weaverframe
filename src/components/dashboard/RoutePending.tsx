import { Shell } from "@/components/dashboard/Shell";

export type SkeletonType =
  | "overview"
  | "leads"
  | "messages"
  | "reviews"
  | "appointments"
  | "ai-activity"
  | "reports"
  | "team"
  | "settings"
  | "default";

export function RoutePending({
  title = "Loading...",
  type = "default",
}: {
  title?: string;
  type?: SkeletonType;
}) {
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

      case "reviews":
        return (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-card rounded-xl border border-border/40 p-5 space-y-3">
                  <div className="skeleton-block h-3 w-24 rounded" />
                  <div className="skeleton-block h-8 w-16 rounded" />
                  <div className="skeleton-block h-3 w-36 rounded" />
                </div>
              ))}
            </div>
            {/* Main Content Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Review requests table */}
              <div className="col-span-2 skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="skeleton-block h-5 w-36 rounded" />
                  <div className="skeleton-block h-8 w-28 rounded-lg" />
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border/20 last:border-0">
                    <div className="skeleton-block size-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton-block h-3.5 w-1/3 rounded" />
                      <div className="skeleton-block h-2.5 w-1/4 rounded" />
                    </div>
                    <div className="skeleton-block h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
              {/* Public Review feeds */}
              <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="skeleton-block h-5 w-32 rounded" />
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2 p-3 border border-border/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="skeleton-block size-6 rounded-full" />
                      <div className="skeleton-block h-3 w-24 rounded" />
                    </div>
                    <div className="skeleton-block h-3 w-full rounded" />
                    <div className="skeleton-block h-3 w-4/5 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "appointments":
        return (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="skeleton-block h-8 w-48 rounded-lg" />
              <div className="skeleton-block h-9 w-36 rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-6">
              {/* Calendar Grid Skeleton */}
              <div className="col-span-2 skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-border/20">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="skeleton-block h-4 w-8 mx-auto rounded" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="skeleton-card h-16 rounded-lg border border-border/20 p-1 space-y-1">
                      <div className="skeleton-block h-3 w-4 rounded" />
                      {i % 4 === 1 && <div className="skeleton-block h-3 w-full rounded" />}
                    </div>
                  ))}
                </div>
              </div>
              {/* Appointments sidebar list */}
              <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="skeleton-block h-5 w-36 rounded" />
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-3 border border-border/30 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="skeleton-block h-3.5 w-28 rounded" />
                      <div className="skeleton-block h-5 w-14 rounded-full" />
                    </div>
                    <div className="skeleton-block h-3 w-20 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "ai-activity":
        return (
          <div className="space-y-6">
            {/* Top Badges */}
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-card rounded-xl border border-border/40 p-4 space-y-2">
                  <div className="skeleton-block h-3 w-24 rounded" />
                  <div className="skeleton-block h-7 w-20 rounded" />
                </div>
              ))}
            </div>
            {/* Log Feed */}
            <div className="skeleton-card rounded-xl border border-border/40 p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="skeleton-block h-5 w-36 rounded" />
                <div className="skeleton-block h-8 w-48 rounded-lg" />
              </div>
              <div className="space-y-4 relative pl-6 border-l-2 border-border/30">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="relative space-y-2">
                    <div className="absolute -left-[31px] top-1 size-4 rounded-full skeleton-block" />
                    <div className="flex items-center justify-between">
                      <div className="skeleton-block h-4 w-48 rounded" />
                      <div className="skeleton-block h-3 w-20 rounded" />
                    </div>
                    <div className="skeleton-block h-3 w-3/4 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "reports":
        return (
          <div className="space-y-6">
            {/* ROI Metrics */}
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton-card rounded-xl border border-border/40 p-5 space-y-3">
                  <div className="skeleton-block h-3 w-24 rounded" />
                  <div className="skeleton-block h-8 w-28 rounded" />
                  <div className="skeleton-block h-3 w-32 rounded" />
                </div>
              ))}
            </div>
            {/* Charts Container */}
            <div className="grid grid-cols-2 gap-6">
              <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="skeleton-block h-5 w-40 rounded" />
                <div className="skeleton-block h-64 w-full rounded-lg" />
              </div>
              <div className="skeleton-card rounded-xl border border-border/40 p-5 space-y-4">
                <div className="skeleton-block h-5 w-40 rounded" />
                <div className="skeleton-block h-64 w-full rounded-lg" />
              </div>
            </div>
          </div>
        );

      case "team":
        return (
          <div className="space-y-6">
            {/* Header Action Bar */}
            <div className="flex justify-between items-center">
              <div className="skeleton-block h-9 w-64 rounded-lg" />
              <div className="skeleton-block h-9 w-32 rounded-lg" />
            </div>
            {/* Team Grid */}
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card rounded-xl border border-border/40 p-5 flex items-center gap-4">
                  <div className="skeleton-block size-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton-block h-4 w-32 rounded" />
                    <div className="skeleton-block h-3 w-24 rounded" />
                  </div>
                  <div className="skeleton-block h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* Left Nav */}
            <div className="w-56 skeleton-card rounded-xl border border-border/40 p-4 space-y-3 shrink-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-block h-9 w-full rounded-lg" />
              ))}
            </div>
            {/* Right Form */}
            <div className="flex-1 skeleton-card rounded-xl border border-border/40 p-6 space-y-6">
              <div className="skeleton-block h-6 w-48 rounded" />
              <div className="space-y-4 max-w-lg">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="skeleton-block h-3.5 w-24 rounded" />
                    <div className="skeleton-block h-10 w-full rounded-lg" />
                  </div>
                ))}
                <div className="skeleton-block h-10 w-32 rounded-lg mt-4" />
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
        <div
          className="h-full rounded-r-full"
          style={{
            background: "linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)",
            animation: "progressBar 1.8s ease-in-out infinite",
          }}
        />
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
