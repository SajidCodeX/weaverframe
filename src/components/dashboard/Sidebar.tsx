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
  { to: "/leads",        label: "Leads",        icon: Users },
  { to: "/reviews",      label: "Reviews",      icon: Star },
  { to: "/ai-activity",  label: "AI Activity",  icon: Bot,           badge: true },
  { to: "/appointments", label: "Appointments", icon: Calendar },
  { to: "/messages",     label: "Messages",     icon: MessageSquare },
  { to: "/reports",      label: "Reports",      icon: BarChart3 },
  { to: "/team",         label: "Team",         icon: Users },
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

  return (
    <aside
      className={`fixed inset-y-0 left-0 bg-sidebar border-r border-border flex flex-col z-20 transition-all duration-300 ${
        isCollapsed ? "w-[70px]" : "w-[240px]"
      }`}
    >


      {/* ── Logo (Click to Toggle) ── */}
      <div
        onClick={onToggle}
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        className={`h-[60px] flex items-center px-5 border-b border-border transition-all duration-300 cursor-pointer hover:bg-white/[0.02] select-none ${
          isCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        {/* Layers icon logo */}
        <div className="size-8 rounded-lg bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-[#222] shadow-[0_0_15px_rgba(255,255,255,0.05)] flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <span
          className={`font-display text-base font-semibold tracking-[0.08em] uppercase text-foreground transition-all duration-300 origin-left ${
            isCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden ml-0" : "opacity-100 w-auto scale-x-100 ml-0"
          }`}
        >
          WeaverFrame
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
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
              className={`group relative flex items-center rounded-md text-sm transition-all duration-300 ${
                active ? "nav-active" : "nav-inactive"
              } px-3 py-2 ${isCollapsed ? "gap-0" : "gap-3"}`}
              title={isCollapsed ? item.label : undefined}
            >
              {/* Active left indicator */}
              {active && (
                <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-r-full bg-white" />
              )}

              <Icon
                className={`size-4 shrink-0 transition-colors duration-150 ${
                  active ? "text-foreground" : "text-[#454545] group-hover:text-[#D0D0D0]"
                }`}
              />

              <span
                className={`transition-all duration-300 origin-left truncate ${
                  isCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden" : "opacity-100 w-auto scale-x-100"
                }`}
              >
                {item.label}
              </span>

              {/* AI Activity live badge */}
              {item.badge && (
                <span className={`relative flex size-2 shrink-0 transition-all duration-300 ${isCollapsed ? "absolute top-1.5 right-1.5" : ""}`}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex rounded-full size-2 bg-success" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: Company + User ── */}
      <div className="p-3 border-t border-border flex flex-col gap-2 overflow-hidden">
        {/* Company block */}
        <div
          className={`px-2 py-1.5 transition-all duration-300 origin-top overflow-hidden ${
            isCollapsed ? "opacity-0 max-h-0 py-0 mb-0" : "opacity-100 max-h-[100px] mb-1"
          }`}
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            {isAdminView ? 'Administration' : 'Company'}
          </div>
          <div className="text-sm text-foreground font-medium mt-0.5 truncate">
            {isAdminView ? "WeaverFrame" : (session?.companyName || 'Company Name')}
          </div>
        </div>

        {isAdminPreviewingBuilder && !isCollapsed && (
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
          className={`flex items-center rounded-md hover:bg-white/[0.04] transition-all duration-300 overflow-hidden px-2 py-2 ${
            isCollapsed ? "gap-0" : "gap-3"
          }`}
          title={isCollapsed ? "Profile" : undefined}
        >
          <div className="relative shrink-0">
            <div className="size-9 rounded-full bg-white/10 border border-white/15 text-foreground flex items-center justify-center text-sm font-semibold font-display">
               {isAdminView ? 'AD' : (session?.displayName ? session.displayName[0].toUpperCase() : 'U')}
            </div>
            {/* Online dot with premium pulse animation */}
            <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60 ring-2 ring-sidebar" />
              <span className="relative inline-flex rounded-full size-2.5 bg-success ring-2 ring-sidebar" />
            </span>
          </div>

          <div
            className={`min-w-0 transition-all duration-300 origin-left flex-1 ${
              isCollapsed ? "opacity-0 w-0 scale-x-0 overflow-hidden" : "opacity-100 w-auto scale-x-100"
            }`}
          >
            <div className="text-sm text-foreground truncate font-medium">
              {isAdminView ? 'SajidAli Ansari' : (session?.displayName || 'User')}
            </div>
            <div className="text-xs text-muted-foreground capitalize">{isAdminView ? 'Superuser' : (session?.builderRole === 'sales' ? 'Sales Agent' : session?.builderRole || 'Owner')}</div>
          </div>
          
          <button 
            onClick={handleLogout}
            className={`shrink-0 p-1.5 text-muted-foreground hover:text-white rounded-md hover:bg-white/10 transition-colors ${
              isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
            }`}
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
