import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ 
  title, 
  children, 
  noPadding = false 
}: { 
  title: string; 
  children: ReactNode; 
  noPadding?: boolean 
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      <TopBar title={title} isCollapsed={isCollapsed} />
      <main
        className={`fixed top-[60px] bottom-0 right-0 custom-scrollbar transition-all duration-300 ${
          isCollapsed ? "left-[70px]" : "left-[240px]"
        } ${noPadding ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {noPadding ? (
          children
        ) : (
          <div className="px-6 py-6 max-w-[1600px] mx-auto">{children}</div>
        )}
      </main>
    </div>
  );
}

