import { useState, type ReactNode } from "react";
import { useRouteContext, useLocation } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ 
  title, 
  children, 
  noPadding = false,
  lastSyncAt 
}: { 
  title: string; 
  children: ReactNode; 
  noPadding?: boolean;
  lastSyncAt?: string | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;
  
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  const showLockScreen = isPrivacyMode && !isSettings;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      <TopBar title={title} isCollapsed={isCollapsed} lastSyncAt={lastSyncAt} />
      <main
        className={`fixed top-[60px] bottom-0 right-0 custom-scrollbar transition-all duration-300 ${
          isCollapsed ? "left-[70px]" : "left-[240px]"
        } ${noPadding ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {showLockScreen ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="size-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <Lock className="size-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">Privacy Maintenance Mode</h2>
              <p className="text-sm text-muted-foreground max-w-[400px] mx-auto leading-relaxed">
                Client data is strictly locked and cannot be viewed or edited during impersonation.
                Only system configurations in <strong className="text-white">Settings</strong> are accessible.
              </p>
            </div>
          </div>
        ) : noPadding ? (
          children
        ) : (
          <div className="px-6 py-6 max-w-[1600px] mx-auto">{children}</div>
        )}
      </main>
    </div>
  );
}

