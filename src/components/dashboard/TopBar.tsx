import { useState, useEffect, useRef } from "react";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { Bell, Calendar as CalIcon, ChevronDown, Search, X, Check, ArrowRight, RefreshCw } from "lucide-react";
import { getLeadsData, getNotificationsData, getLastSyncTime } from "@/lib/dashboard";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function formatLiveSyncTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) {
    return "Just now";
  } else if (diffSec < 60) {
    return `${diffSec}s ago`;
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
}

export function TopBar({ title, isCollapsed, lastSyncAt }: { title: string; isCollapsed?: boolean; lastSyncAt?: string | null }) {
  const router = useRouter();
  const { session } = useRouteContext({ strict: false }) as any;
  const isAdmin = session?.role === "admin" && !session?.actingAsBuilderId;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userInitials, setUserInitials] = useState("?");
  const [realSyncTime, setRealSyncTime] = useState<string | null>(lastSyncAt || null);
  const [tick, setTick] = useState(0);

  // Sync realSyncTime when lastSyncAt prop changes
  useEffect(() => {
    if (lastSyncAt) {
      setRealSyncTime(lastSyncAt);
    }
  }, [lastSyncAt]);

  // Tick for live-updating relative timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastSyncAt && !isAdmin) {
      const activeRole = sessionStorage.getItem('active_role') ?? undefined;
      getLastSyncTime({ data: { activeRole } }).then(time => {
        if (time) setRealSyncTime(time);
      });
    }
  }, [lastSyncAt, isAdmin]);

  // Reset activeIndex when query or open status changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, isSearchOpen]);

  // Fetch dynamic user profile for avatar
  useEffect(() => {
    if (session?.displayName) {
      const initials = session.displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      setUserInitials(initials || "?");
    }
    if (isAdmin) {
      return;
    }
    import("@/lib/dashboard").then(({ getBuilderProfile }) => {
      const activeRole = sessionStorage.getItem('active_role') ?? undefined;
      getBuilderProfile({ data: { activeRole } }).then((profile) => {
        if (profile?.primaryContact) {
          const initials = profile.primaryContact
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          setUserInitials(initials || "?");
        }
      });
    });
  }, [isAdmin, session?.displayName]);

  const quickNavItems = isAdmin
    ? [
        { title: "Global Overview", url: "/admin/" },
        { title: "Builders", url: "/admin/builders" },
        { title: "Billing", url: "/admin/billing" },
        { title: "Users", url: "/admin/users" },
        { title: "Platform Settings", url: "/admin/settings" },
      ]
    : [
        { title: "Dashboard Overview", url: "/" },
        { title: "Messages & Inbox", url: "/messages" },
        { title: "Leads Database", url: "/leads" },
        { title: "Appointments Calendar", url: "/appointments" },
        { title: "AI Brain & Knowledge Engine", url: "/ai-activity" },
        // { title: "Review Booster", url: "/reviews" },
        // { title: "Reports", url: "/reports" },
        // { title: "Team Management", url: "/team" },
        { title: "Settings", url: "/settings" },
      ];

  const builderRole = session?.builderRole || 'sales';
  const filteredQuickNavItems = quickNavItems.filter(item => {
    if (item.url === '/reports' && builderRole === 'sales') return false;
    if ((item.url === '/team' || item.url === '/settings') && (builderRole === 'sales' || builderRole === 'manager')) return false;
    return true;
  });

  // Popover states
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("globalDateRange");
      if (saved) {
        try {
          return JSON.parse(saved).label;
        } catch (_) {}
      }
    }
    return title === "Reports" ? "This Month" : "Today";
  });
  const [customStart, setCustomStart] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("globalDateRange");
      if (saved) {
        try {
          return JSON.parse(saved).start || "";
        } catch (_) {}
      }
    }
    return "";
  });
  const [customEnd, setCustomEnd] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("globalDateRange");
      if (saved) {
        try {
          return JSON.parse(saved).end || "";
        } catch (_) {}
      }
    }
    return "";
  });

  const changeDateRange = (label: string, start?: string, end?: string) => {
    setSelectedRange(label);
    if (typeof window !== "undefined") {
      const rangeData = { label, start, end };
      sessionStorage.setItem("globalDateRange", JSON.stringify(rangeData));
      (window as any).__globalDateRange = rangeData;
      window.dispatchEvent(
        new CustomEvent("globalDateRangeChanged", {
          detail: rangeData,
        }),
      );
    }
  };

  // Sync default range with active section on title changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("globalDateRange");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.label) {
            setSelectedRange(parsed.label);
            return;
          }
        } catch (_) {}
      }
    }
    const initialLabel = title === "Reports" ? "This Month" : title === "Overview" ? "All Time" : "Today";
    changeDateRange(initialLabel);
  }, [title]);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  // Fetch dynamic notifications on open/mount
  useEffect(() => {
    if (isAdmin) {
      setNotifications([]);
      return;
    }
    const activeRole =
      sessionStorage.getItem('active_role') ??
      undefined;
    getNotificationsData({ data: { activeRole } })
      .then((data) => {
        try {
          const readIds = JSON.parse(sessionStorage.getItem('read_notifs') || '[]');
          const updated = data.map(n => readIds.includes(n.id) ? { ...n, unread: false } : n);
          setNotifications(updated);
        } catch {
          setNotifications(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load notifications:", err);
      });
  }, [isAdmin]);

  const hasUnread = notifications.some((n) => n.unread);

  // OS Detection
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.userAgent.toLowerCase().includes("mac"));
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTriggered = isMac
        ? e.metaKey && e.key.toLowerCase() === "f"
        : e.altKey && e.key.toLowerCase() === "f";
      if (isTriggered) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsNotifOpen(false);
        setIsDateOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMac]);

  // Fetch leads on search open
  useEffect(() => {
    if (isAdmin) {
      return;
    }
    if (isSearchOpen && leads.length === 0) {
      setLoadingLeads(true);
      const activeRole = sessionStorage.getItem('active_role') ?? undefined;
      getLeadsData({ data: { activeRole } })
        .then((data) => {
          setLeads(data);
          setLoadingLeads(false);
        })
        .catch(() => setLoadingLeads(false));
    }
  }, [isAdmin, isSearchOpen, leads.length]);

  // Click outside hooks
  const notifRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setIsDateOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, unread: false }));
    setNotifications(updated);
    try {
      const readIds = updated.filter(u => !u.unread).map(u => u.id);
      sessionStorage.setItem('read_notifs', JSON.stringify(readIds));
    } catch {}
  };

  // Global search filters
  const filteredLeads =
    searchQuery.trim() === ""
      ? []
      : leads
          .filter(
            (l) =>
              l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              l.county.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (l.phone && l.phone.includes(searchQuery)),
          )
          .slice(0, 5);
  const filteredNavItems =
    searchQuery.trim() === ""
      ? quickNavItems
      : quickNavItems.filter((nav) => nav.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const shortcutText = isMac ? "⌘F" : "Alt+F";

  return (
    <>
      <header
        className={`fixed top-0 right-0 h-[64px] bg-background/85 backdrop-blur-2xl border-b border-border z-30 flex items-center justify-between px-6 transition-all duration-300 ${
          isCollapsed ? "left-[70px]" : "left-[240px]"
        }`}
      >
        {/* Page Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <h1 className="font-nevera text-sm sm:text-base font-normal tracking-[0.04em] text-foreground">
            {title}
          </h1>
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest bg-secondary/80 px-2.5 py-1 rounded-full border border-border">
            <span className="size-1 rounded-full bg-[#c9a84c] dark:bg-[#e5d9c5]" />
            <span>{isAdmin ? 'WeaverFrame HQ' : 'Estate Builder OS'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => {
              const icon = document.getElementById('global-refresh-icon');
              if (icon) icon.classList.add('animate-spin');
              router.invalidate().finally(() => {
                if (icon) icon.classList.remove('animate-spin');
              });
            }}
            className="hidden sm:flex items-center justify-center size-9 text-muted-foreground bg-card border border-border rounded-xl hover:border-primary/40 hover:text-foreground transition-all duration-150 cursor-pointer shadow-sm shrink-0"
            title="Refresh Page Data"
          >
            <RefreshCw id="global-refresh-icon" className="size-3.5 text-muted-foreground" />
          </button>

          {/* Cmd+K Search trigger */}
          <button
            id="topbar-search"
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-3 h-9 text-xs text-muted-foreground bg-card border border-border rounded-xl px-3 hover:border-primary/40 hover:text-foreground transition-all duration-150 group cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
          >
            <div className="flex items-center gap-2 shrink-0">
              <Search className="size-3.5 text-muted-foreground group-hover:text-[#c9a84c] dark:group-hover:text-[#e5d9c5] transition-colors shrink-0" />
              <span className="text-xs font-normal whitespace-nowrap">Search OS</span>
            </div>
            <kbd className="font-mono text-[9px] bg-secondary px-1.5 py-0.5 rounded border border-border text-foreground font-semibold shrink-0">
              {shortcutText}
            </kbd>
          </button>

          {/* Live DB Sync */}
          <div className="hidden sm:flex items-center justify-center h-9 text-[10.5px] text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 cursor-default font-mono tracking-wider shadow-sm shrink-0 whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-2 animate-pulse shrink-0" />
            <span className="whitespace-nowrap">Sync: {realSyncTime ? formatLiveSyncTime(realSyncTime) : "Just now"}</span>
          </div>

          {/* Today's Date */}
          <div className="hidden lg:flex items-center justify-center h-9 px-3 text-xs text-muted-foreground font-mono tracking-widest bg-card border border-border rounded-xl cursor-default shrink-0 whitespace-nowrap">
            {new Date().toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "2-digit",
            })}
          </div>

          {/* Date range - Visible on Overview, Leads & Reports pages */}
          {(title === "Overview" || title === "Leads" || title === "Reports") && (
            <div className="relative" ref={dateRef}>
              <button
                id="topbar-daterange"
                onClick={() => setIsDateOpen(!isDateOpen)}
                className="flex items-center gap-1.5 text-xs text-foreground bg-card border border-border rounded-xl px-3 h-9 hover:border-primary/40 transition-all duration-150 cursor-pointer shrink-0"
              >
                <CalIcon className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground whitespace-nowrap">{selectedRange}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>

              {isDateOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-card border border-border p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 border-b border-border/40 mb-1 font-mono">
                    Select Range
                  </div>
                  <div className="space-y-0.5 py-1">
                    {[
                      "All Time",
                      "Today",
                      "Yesterday",
                      "Last 7 Days",
                      "Last 30 Days",
                      "This Month",
                    ].map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          changeDateRange(range);
                          setIsDateOpen(false);
                        }}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg text-foreground hover:bg-accent flex items-center justify-between transition-colors font-medium cursor-pointer"
                      >
                        <span>{range}</span>
                        {selectedRange === range && <Check className="size-3.5 text-emerald-500" />}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Inputs inside the popup */}
                  <div className="flex flex-col gap-2 p-2 border-t border-border/40 mt-1.5 pt-2">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold font-mono">
                      Custom Range
                    </div>
                    <div className="flex gap-1.5 items-center justify-between">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="bg-input text-xs border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-[100px] text-[10px] font-mono focus:border-primary"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">to</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="bg-input text-xs border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-[100px] text-[10px] font-mono focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (customStart && customEnd) {
                          changeDateRange("Custom Range", customStart, customEnd);
                          setIsDateOpen(false);
                        }
                      }}
                      disabled={!customStart || !customEnd}
                      className="w-full mt-1 bg-primary text-primary-foreground font-semibold text-[11px] py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Apply Custom Range
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              id="topbar-notifications"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative size-9 rounded-xl bg-card border border-border hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer shrink-0 shadow-sm"
            >
              <Bell className="size-3.5" />
              {hasUnread && (
                <span className="absolute top-2 right-2 size-2 bg-emerald-500 rounded-full ring-2 ring-background animate-pulse" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg bg-card border border-border p-2 shadow-none z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 mb-1">
                  <span className="text-xs font-semibold text-white/90">Notifications</span>
                  {hasUnread && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        const updated = notifications.map((item) =>
                          item.id === n.id ? { ...item, unread: false } : item
                        );
                        setNotifications(updated);
                        try {
                          sessionStorage.setItem('read_notifs', JSON.stringify(updated.filter(u => !u.unread).map(u => u.id)));
                        } catch {}
                        setIsNotifOpen(false);
                        window.location.href =
                          n.title.toLowerCase().includes("lead") ||
                          n.title.toLowerCase().includes("appointment")
                            ? "/leads"
                            : "/messages";
                      }}
                      className={`p-2.5 rounded-md text-left transition-colors cursor-pointer border ${
                        n.title.includes("🚨") || n.title.includes("🔥")
                          ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/15"
                          : n.unread
                            ? "bg-white/[0.05] border-white/10 hover:bg-white/[0.09]"
                            : "border-transparent hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs font-medium ${
                            n.title.includes("🚨") || n.title.includes("🔥")
                              ? "text-red-400 font-bold"
                              : n.unread
                                ? "text-white font-semibold"
                                : "text-foreground/80"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[9px] text-foreground/45 shrink-0 font-mono mt-0.5">
                          {formatRelativeTime(n.time)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 mt-0.5 leading-snug">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar removed as requested */}
        </div>
      </header>

      {/* Global Command Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Search header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="size-4 text-foreground/60 shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  const isQueryEmpty = searchQuery.trim() === "";
                  const itemsCount = isQueryEmpty
                    ? filteredQuickNavItems.length
                    : isAdmin
                      ? filteredNavItems.length
                      : filteredLeads.length;
                  if (itemsCount === 0) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev + 1) % itemsCount);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev - 1 + itemsCount) % itemsCount);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    setIsSearchOpen(false);
                    if (isQueryEmpty || isAdmin) {
                      const selectedNav = (isQueryEmpty ? filteredQuickNavItems : filteredNavItems)[
                        activeIndex
                      ];
                      if (selectedNav) {
                        window.location.href = selectedNav.url;
                      }
                    } else {
                      const selectedLead = filteredLeads[activeIndex];
                      if (selectedLead) {
                        window.location.href = `/leads?id=${selectedLead.id}`;
                      }
                    }
                  }
                }}
                placeholder={
                  isAdmin ? "Search admin navigation..." : "Search leads by name, city, or phone..."
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="size-6 hover:bg-white/[0.08] text-muted-foreground hover:text-foreground rounded flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Results */}
            <div className="p-2 max-h-80 overflow-y-auto">
              {searchQuery.trim() === "" ? (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5">
                    Quick Navigation
                  </div>
                  {filteredQuickNavItems.map((nav, index) => (
                    <a
                      key={nav.title}
                      href={nav.url}
                      onClick={() => setIsSearchOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs text-foreground transition-colors ${
                        index === activeIndex
                          ? "bg-white/[0.08] border-l-2 border-l-primary pl-2.5"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{nav.title}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              ) : isAdmin ? (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5">
                    Navigation Results ({filteredNavItems.length})
                  </div>
                  {filteredNavItems.length > 0 ? (
                    filteredNavItems.map((nav, index) => (
                      <a
                        key={nav.title}
                        href={nav.url}
                        onClick={() => setIsSearchOpen(false)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs text-foreground transition-colors ${
                          index === activeIndex
                            ? "bg-white/[0.08] border-l-2 border-l-primary pl-2.5"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <span>{nav.title}</span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </a>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground font-mono">
                      No matching admin routes
                    </div>
                  )}
                </div>
              ) : loadingLeads ? (
                <div className="text-center py-6 text-xs text-muted-foreground font-mono">
                  Searching database...
                </div>
              ) : filteredLeads.length > 0 ? (
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5">
                    Leads Found ({filteredLeads.length})
                  </div>
                  {filteredLeads.map((l, index) => (
                    <a
                      key={l.id}
                      href={`/leads?id=${l.id}`}
                      onClick={() => setIsSearchOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-left transition-colors ${
                        index === activeIndex
                          ? "bg-white/[0.08] border-l-2 border-l-primary pl-2.5"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{l.name}</span>
                        <span className="text-[10px] font-mono bg-white/[0.06] text-muted-foreground px-2 py-0.5 rounded border border-white/5">
                          {l.scoreTier}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        {l.county} · {l.phone || "No phone"}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground font-mono">
                  No matching records found
                </div>
              )}
            </div>

            {/* Footer help */}
            <div className="px-4 py-2 bg-secondary border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>Use arrows to navigate, enter to select</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
