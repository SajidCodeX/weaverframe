import { useState } from "react";
import { Link, useRouterState, useRouteContext } from "@tanstack/react-router";
import {
  Home,
  Users,
  Star,
  Bot,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  Building2,
  Shield,
  LogOut,
  DollarSign,
  Layers,
  EyeOff,
} from "lucide-react";
import { logoutFn } from "@/lib/auth";
import { stopBuilderPreview } from "@/lib/admin";

const builderItems = [
  { to: "/",             label: "Overview",     icon: Home,          exact: true },
  { to: "/messages",     label: "Inbox",        icon: MessageSquare },
  { to: "/leads",        label: "Leads",        icon: Users },
  { to: "/appointments", label: "Appointments", icon: Calendar },
  { to: "/ai-activity",  label: "AI Brain",     icon: Bot,           badge: true },
  // { to: "/reviews",      label: "Reviews",      icon: Star },
  // { to: "/reports",      label: "Reports",      icon: BarChart3 },
  // { to: "/team",         label: "Team",         icon: Users },
  { to: "/settings",     label: "Settings",     icon: Settings },
];

const adminItems = [
  { to: '/admin/',             label: 'Global Stats', icon: BarChart3, exact: true },
  { to: '/admin/builders',    label: 'Builders',     icon: Building2 },
  { to: '/admin/billing',     label: 'Billing',      icon: DollarSign },
  { to: '/admin/users',       label: 'Users',        icon: Users },
  { to: '/admin/settings',    label: 'Settings',     icon: Shield },
];

export function Sidebar({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useRouteContext({ strict: false }) as any;
  const isAdminView = pathname.startsWith('/admin');
  const isAdminPreviewingBuilder = session?.role === 'admin' && !!session?.actingAsBuilderId;
  
  const builderRole = session?.builderRole || 'sales';
  const filteredBuilderItems = builderItems.filter(item => {
    if (item.to === '/reports' && builderRole === 'sales') return false;
    if ((item.to === '/team' || item.to === '/settings') && (builderRole === 'sales' || builderRole === 'manager')) return false;
    return true;
  });

  const items = isAdminView ? adminItems : filteredBuilderItems;

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      const tabId = sessionStorage.getItem('tab_id');
      if (tabId) {
        localStorage.removeItem(`role_${tabId}`);
      }
      localStorage.removeItem('active_role');    // BUG-05 FIX: clear persisted role
      sessionStorage.removeItem('active_role');
      sessionStorage.removeItem('tab_id');
    }
    await logoutFn();
    window.location.href = '/login';
  };

  const handleExitPreview = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_role', 'admin');
      const tabId = sessionStorage.getItem('tab_id');
      if (tabId) {
        localStorage.setItem(`role_${tabId}`, 'admin');
      }
    }
    await stopBuilderPreview();
    window.location.href = '/admin/builders';
  };

  const [isHovered, setIsHovered] = useState(false);
  
  // The sidebar is visually collapsed ONLY if it is pinned collapsed AND not hovered
  const actuallyCollapsed = isCollapsed && !isHovered;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed inset-y-0 left-0 bg-sidebar border-r border-border flex flex-col z-50 transition-all duration-300 ${
        actuallyCollapsed ? "w-[70px]" : "w-[240px]"
      } ${isHovered && isCollapsed ? "shadow-2xl border-r-white/10" : ""}`}
    >


      {/* ── Logo (Click to Toggle) ── */}
      <div
        onClick={onToggle}
        title={actuallyCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        className={`h-[64px] flex items-center px-4 border-b border-border transition-all duration-300 cursor-pointer hover:bg-white/[0.02] select-none ${
          actuallyCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        {/* Brand Monogram */}
        <div className="size-8 rounded-lg bg-gradient-to-br from-[#141417] to-[#08080a] border border-[#e5d9c5]/25 shadow-[0_0_15px_rgba(201,168,76,0.12)] flex items-center justify-center font-nevera text-sm font-bold text-[#e5d9c5] shrink-0">
          W
        </div>
        <div
          className={`transition-all duration-300 origin-left ${
            actuallyCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden ml-0" : "opacity-100 w-auto scale-x-100 ml-0"
          }`}
        >
          <span className="font-nevera text-sm tracking-[0.14em] uppercase text-foreground font-semibold block leading-none">
            WeaverFrame
          </span>
          <span className="text-[8.5px] font-mono tracking-widest text-[#c9a84c] dark:text-[#e5d9c5]/70 uppercase block mt-1">
            Architecture & AI OS
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {(items as any[]).map((item: any) => {
          const active = item.exact
            ? pathname === item.to
            : pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              preload="intent"
              preloadDelay={50}
              className={`group relative flex items-center rounded-lg text-xs font-medium tracking-wide transition-all duration-200 ${
                active ? "nav-active" : "nav-inactive"
              } px-3 py-2.5 ${actuallyCollapsed ? "gap-0" : "gap-3"}`}
              title={actuallyCollapsed ? item.label : undefined}
            >
              {/* Active left indicator */}
              {active && (
                <span className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full bg-[#c9a84c] dark:bg-[#e5d9c5] shadow-[0_0_10px_rgba(201,168,76,0.6)]" />
              )}

              <Icon
                className={`size-4 shrink-0 transition-colors duration-200 ${
                  active ? "text-[#c9a84c] dark:text-[#e5d9c5]" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />

              <span
                className={`transition-all duration-300 origin-left truncate ${
                  actuallyCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden" : "opacity-100 w-auto scale-x-100"
                }`}
              >
                {item.label}
              </span>

              {/* AI Activity live badge */}
              {item.badge && (
                <span className={`relative flex size-2 shrink-0 transition-all duration-300 ${actuallyCollapsed ? "absolute top-1.5 right-1.5" : "ml-auto"}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: Company + User ── */}
      <div className="p-3 border-t border-border flex flex-col gap-2 overflow-hidden bg-sidebar">
        {/* Company block */}
        <div
          className={`px-2 py-1.5 transition-all duration-300 origin-top overflow-hidden ${
            actuallyCollapsed ? "opacity-0 max-h-0 py-0 mb-0" : "opacity-100 max-h-[100px] mb-1"
          }`}
        >
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest flex items-center justify-between">
            <span>{isAdminView ? 'Administration' : 'Estate Builder OS'}</span>
            <span className="size-1 rounded-full bg-[#c9a84c] dark:bg-[#e5d9c5]" />
          </div>
          <div className="text-xs text-foreground font-semibold mt-0.5 truncate tracking-wide">
            {isAdminView ? "WeaverFrame HQ" : (session?.companyName || 'Company Name')}
          </div>
        </div>

        {isAdminPreviewingBuilder && !actuallyCollapsed && (
          <button
            onClick={handleExitPreview}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-md border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
            title="Exit Builder Preview"
          >
            <EyeOff className="size-3.5" />
            Exit Preview Mode
          </button>
        )}

        {/* Profile row */}
        <div
          className={`flex items-center rounded-lg hover:bg-accent/60 transition-all duration-200 overflow-hidden px-2 py-2 border border-transparent hover:border-border ${
            actuallyCollapsed ? "gap-0" : "gap-3"
          }`}
          title={actuallyCollapsed ? "Profile" : undefined}
        >
          <div className="relative shrink-0">
            <div className="size-8 rounded-full bg-[#101014] border border-[#e5d9c5]/30 text-[#e5d9c5] flex items-center justify-center text-xs font-bold font-nevera shadow-sm shadow-[#e5d9c5]/10">
               {isAdminView ? 'AD' : (session?.displayName ? session.displayName[0].toUpperCase() : 'U')}
            </div>
            {/* Online dot with premium pulse animation */}
            <span className="absolute -bottom-0.5 -right-0.5 flex size-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 ring-2 ring-sidebar" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-400 ring-2 ring-sidebar" />
            </span>
          </div>

          <div
            className={`min-w-0 transition-all duration-300 origin-left flex-1 ${
              actuallyCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden" : "opacity-100 w-auto scale-x-100"
            }`}
          >
            <div className="text-xs text-foreground truncate font-medium">
              {isAdminView ? 'SajidAli Ansari' : (session?.displayName || 'User')}
            </div>
            <div className="text-[10px] text-[#c9a84c] dark:text-[#e5d9c5]/80 capitalize font-mono tracking-wider">
              {isAdminView ? 'Superuser' : (session?.builderRole === 'sales' ? 'Sales Exec' : session?.builderRole || 'Owner')}
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className={`shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors ${
              actuallyCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
            }`}
            title="Log out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
