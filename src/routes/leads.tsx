import { createFileRoute, useLoaderData, useRouter, useRouteContext } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Download, Phone, Calendar, Eye, MoreHorizontal, X, Mail, Check, AlertCircle, Edit, RefreshCw, LayoutGrid, List, MessageSquare, Zap, Star } from "lucide-react";
import { Shell } from "@/components/dashboard/Shell";
import { Card, ScoreBadge, StageBadge } from "@/components/dashboard/primitives";
import { CustomSelect } from "@/components/dashboard/CustomSelect";
import { getLeadsData, addManualLead, deleteLead, logActivity, updateLead, sendSmsOutreach, retriggerLeadFlow } from "@/lib/dashboard";
import { obscurePII } from "@/lib/utils";

type LeadsSearch = {
  stage?: string;
};

export const Route = createFileRoute("/leads")({
  validateSearch: (search: Record<string, unknown>): LeadsSearch => ({
    stage: (search.stage as string) || undefined,
  }),
  loader: async ({ context }) => {
    // SSR Blocking Loader: Fetches data on the server and blocks HTML streaming until ready.
    const activeRole = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('active_role') ?? undefined) 
      : undefined;
      
    return await getLeadsData({ data: { activeRole } });
  },
  staleTime: 60 * 1000, // 1 minute cache
  head: () => ({ meta: [{ title: "Leads — WeaverFrame" }, { name: "description", content: "Manage all your leads." }] }),
  component: LeadsPage,
});

function AiStatus({ status }: { status: string }) {
  if (status === "Replied") return <span className="inline-flex items-center gap-1 text-xs text-success"><span className="size-1.5 rounded-full bg-success inline-block" />Replied</span>;
  if (status === "Awaiting") return <span className="inline-flex items-center gap-1 text-xs text-warning"><span className="size-1.5 rounded-full bg-warning inline-block" />Awaiting</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-danger"><span className="size-1.5 rounded-full bg-danger inline-block" />No response</span>;
}

function LeadsPage() {
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;
  const isSalesAgent = session?.role === 'builder' && session?.builderRole === 'sales';

  const rawLeads = useLoaderData({ from: '/leads' }) || [];
  const router = useRouter();
  const search = Route.useSearch();
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('pipeline');
  const [selected, setSelected] = useState<any | null>(null);
  const [revealedPhones, setRevealedPhones] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // Dropdown filter popover states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const getInitialDateRange = () => {
    if (typeof window === "undefined") {
      return { range: "Today", start: "", end: "" };
    }
    const saved = sessionStorage.getItem("globalDateRange");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.label === "Custom Range") {
          return { range: "Custom Range", start: parsed.start || "", end: parsed.end || "" };
        }
        return { range: parsed.label || "Today", start: "", end: "" };
      } catch (_) {}
    }
    return { range: "Today", start: "", end: "" };
  };

  const [initialDate] = useState(() => getInitialDateRange());
  const [selectedStages, setSelectedStages] = useState<string[]>(() => {
    if (search.stage) {
      if (search.stage === "Qualified") {
        return ["Emailed", "Opened", "Replied", "Appointment"];
      }
      if (search.stage === "Builder Notified") {
        return ["Replied", "Appointment"];
      }
      return [search.stage];
    }
    return [];
  });

  useEffect(() => {
    if (search.stage) {
      if (search.stage === "Qualified") {
        setSelectedStages(["Emailed", "Opened", "Replied", "Appointment"]);
      } else if (search.stage === "Builder Notified") {
        setSelectedStages(["Replied", "Appointment"]);
      } else {
        setSelectedStages([search.stage]);
      }
    }
  }, [search.stage]);

  const [selectedScores, setSelectedScores] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<string>(initialDate.range);
  const [customStart, setCustomStart] = useState(initialDate.start);
  const [customEnd, setCustomEnd] = useState(initialDate.end);
  const [sortOption, setSortOption] = useState<string>("Newest");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedStages, selectedScores, selectedSources, selectedDateRange, customStart, customEnd, sortOption]);

  // Custom simulator triggers
  const [activeEmailLead, setActiveEmailLead] = useState<any | null>(null);
  const [activeScheduleLead, setActiveScheduleLead] = useState<any | null>(null);
  const [activeMoreLead, setActiveMoreLead] = useState<string | null>(null);

  // Modal manual lead creation state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: "",
    phone: "",
    email: "",
    county: "Travis CAD",
    state: "TX",
    landPrice: "",
    estimatedBudget: "",
    status: "New",
    scoreTier: "Hot",
    source: "Austin Building Permits"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Edit lead modal state
  const [editLead, setEditLead] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", email: "", county: "", state: "", landPrice: "", estimatedBudget: "", status: "", scoreTier: "", source: ""
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // SMS send state
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<{ leadId: string; ok: boolean } | null>(null);
  // Retrigger state
  const [retriggerResult, setRetriggerResult] = useState<boolean | null>(null);

  // Refs for click outside dropdowns
  const filterBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Listen to Escape Key to close all interactive drawer overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
        setSelected(null);
        setIsAddModalOpen(false);
        setActiveEmailLead(null);
        setActiveScheduleLead(null);
        setActiveMoreLead(null);
        setEditLead(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync date selection dynamically from TopBar header dispatches
  useEffect(() => {
    const handleGlobalDateChange = (e: any) => {
      const { label, start, end } = e.detail;
      if (label === "Custom Range") {
        setSelectedDateRange("Custom Range");
        setCustomStart(start || "");
        setCustomEnd(end || "");
      } else {
        setSelectedDateRange(label);
      }
    };
    window.addEventListener("globalDateRangeChanged", handleGlobalDateChange);
    return () => window.removeEventListener("globalDateRangeChanged", handleGlobalDateChange);
  }, []);

  const { mappedLeads, availableSources, filtered } = useMemo(() => {
    const mapped = rawLeads.map(l => {
      // Read the accurate source string directly from Postgres
      const source = l.source || "Austin Building Permits";
      const aiStatus = l.status === "New" ? "Awaiting" : l.status === "Replied" ? "Replied" : "Awaiting";

      return {
        ...l,
        firstName: l.name.split(' ')[0],
        lastName: l.name.split(' ').slice(1).join(' '),
        city: l.county,
        budget: `$${(l.estimatedBudget / 1000).toFixed(0)}k`,
        score: (l.scoreTier.toLowerCase() as any),
        stage: l.status,
        source,
        aiStatus
      };
    });

    const sources = Array.from(
      new Set([
        "Austin Building Permits",
        "Travis County Public Records",
        ...mapped.map(l => l.source)
      ])
    ).filter(Boolean) as string[];

    // Interactive filtering engine
    const filt = mapped.filter((l) => {
      // Text search query
      const matchQuery = `${l.firstName} ${l.lastName} ${l.phone || ""} ${l.city}`.toLowerCase().includes(query.toLowerCase());

      // Multi-select status stage filter
      const matchStage = selectedStages.length === 0 || selectedStages.includes(l.stage);

      // Multi-select score tier filter
      const matchScore = selectedScores.length === 0 || selectedScores.includes(l.scoreTier);

      // Multi-select source filter
      const matchSource = selectedSources.length === 0 || selectedSources.includes(l.source);

      // Captured Date range filter
      let matchDate = true;
      if (selectedDateRange !== "All Time") {
        const leadDate = new Date(l.createdAt);
        const now = new Date();

        if (selectedDateRange === "Today") {
          matchDate = leadDate.toDateString() === now.toDateString();
        } else if (selectedDateRange === "Yesterday") {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          matchDate = leadDate.toDateString() === yesterday.toDateString();
        } else if (selectedDateRange === "Last 7 Days") {
          const diffTime = Math.abs(now.getTime() - leadDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) matchDate = false;
        } else if (selectedDateRange === "Last 30 Days") {
          const diffTime = Math.abs(now.getTime() - leadDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 30) matchDate = false;
        } else if (selectedDateRange === "This Month") {
          matchDate = leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
        } else if (selectedDateRange === "Custom Range" || selectedDateRange.includes("to")) {
          if (customStart && customEnd) {
            const startBound = new Date(customStart);
            startBound.setHours(0, 0, 0, 0);
            const endBound = new Date(customEnd);
            endBound.setHours(23, 59, 59, 999);
            matchDate = leadDate >= startBound && leadDate <= endBound;
          } else if (selectedDateRange.includes("to")) {
            const [sStr, eStr] = selectedDateRange.split(" to ");
            const startBound = new Date(sStr.trim());
            startBound.setHours(0, 0, 0, 0);
            const endBound = new Date(eStr.trim());
            endBound.setHours(23, 59, 59, 999);
            matchDate = leadDate >= startBound && leadDate <= endBound;
          }
        }
      }

      return matchQuery && matchStage && matchScore && matchSource && matchDate;
    });

    // Interactive sorting engine
    filt.sort((a, b) => {
      if (sortOption === "Newest") {
        return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
      }
      if (sortOption === "Oldest") {
        return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
      }
      if (sortOption === "Budget: High to Low") {
        return b.estimatedBudget - a.estimatedBudget;
      }
      if (sortOption === "Budget: Low to High") {
        return a.estimatedBudget - b.estimatedBudget;
      }
      return 0;
    });

    return { mappedLeads: mapped, availableSources: sources, filtered: filt };
  }, [rawLeads, query, selectedStages, selectedScores, selectedSources, selectedDateRange, customStart, customEnd, sortOption]);

  // CSV Export Engine
  const exportToCSV = () => {
    const headers = ["Name", "Phone", "Email", "County", "Budget", "Score", "Stage", "Source", "Purchase Date", "Captured At"];
    const rows = filtered.map(l => [
      isPrivacyMode ? obscurePII(`${l.firstName} ${l.lastName}`, 'name') : `${l.firstName} ${l.lastName}`,
      isPrivacyMode ? obscurePII(l.phone, 'phone') : (l.phone || ""),
      isPrivacyMode ? obscurePII(l.email, 'email') : (l.email || ""),
      l.city || "",
      l.budget || "",
      l.scoreTier || "",
      l.stage || "",
      l.source || "",
      new Date(l.purchaseDate).toLocaleDateString(),
      new Date(l.createdAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual lead dialog form
  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.name || !modalForm.landPrice) {
      setModalError("Please provide name and land purchase price");
      return;
    }

    const price = parseInt(modalForm.landPrice);
    if (isNaN(price) || price <= 0) {
      setModalError("Land purchase price must be a positive number");
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    try {
      await addManualLead({
        data: {
          name: modalForm.name,
          phone: modalForm.phone || undefined,
          email: modalForm.email || undefined,
          county: modalForm.county,
          state: modalForm.state,
          landPrice: price,
          estimatedBudget: modalForm.estimatedBudget ? parseInt(modalForm.estimatedBudget) : 0,
          status: modalForm.status,
          scoreTier: modalForm.scoreTier,
          source: modalForm.source
        }
      });

      // Clear form and reload route state
      setModalForm({
        name: "",
        phone: "",
        email: "",
        county: "Travis CAD",
        state: "TX",
        landPrice: "",
        estimatedBudget: "",
        status: "New",
        scoreTier: "Hot",
        source: "Austin Building Permits"
      });
      setIsAddModalOpen(false);
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || "Failed to create manual lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead || !editForm.name) { setEditError("Name is required"); return; }
    const price = parseInt(editForm.landPrice);
    if (isNaN(price) || price <= 0) { setEditError("Land price must be a positive number"); return; }
    setIsEditSubmitting(true);
    setEditError("");
    try {
      await updateLead({
        data: {
          id: editLead.id,
          name: editForm.name,
          phone: editForm.phone || undefined,
          email: editForm.email || undefined,
          county: editForm.county,
          state: editForm.state,
          landPrice: price,
          estimatedBudget: editForm.estimatedBudget ? parseInt(editForm.estimatedBudget) : 0,
          status: editForm.status,
          scoreTier: editForm.scoreTier,
          source: editForm.source,
        }
      });
      setEditLead(null);
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Failed to update lead.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const toggleStageFilter = (stage: string) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  const toggleScoreFilter = (score: string) => {
    setSelectedScores(prev =>
      prev.includes(score) ? prev.filter(s => s !== score) : [...prev, score]
    );
  };

  const toggleSourceFilter = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  return (
    <Shell title="Leads">
      {smsResult && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-none border text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 ${smsResult.ok ? 'bg-success/10 border-success/30 text-success' : 'bg-secondary border-border text-foreground'}`}>
          <Check className="size-4" />
          {smsResult.ok ? 'SMS sent via Twilio!' : 'SMS outreach logged — configure Twilio in Settings to send live.'}
        </div>
      )}
      {retriggerResult !== null && (
        <div className={`fixed bottom-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-none border text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 ${retriggerResult ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          <Check className="size-4" />
          {retriggerResult ? 'AI intake flow re-triggered! Lead reset to New.' : 'Failed to re-trigger flow. Try again.'}
        </div>
      )}
      <Card className="flex flex-col h-[calc(100vh-108px)]">
        {/* Filter bar container */}
        <div ref={filterBarRef} className="flex items-center gap-2 px-4 py-3 border-b border-border relative z-20 shrink-0">
          <div className="relative w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, city..."
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all duration-150"
            />
          </div>

          {/* Score Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "score" ? null : "score")}
              className={`text-sm border rounded-md px-3 py-2 text-foreground flex items-center gap-1 hover:bg-secondary/80 transition-colors ${selectedScores.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}
            >
              Score {selectedScores.length > 0 && `(${selectedScores.length})`} <span className="text-muted-foreground">▾</span>
            </button>
            {activeDropdown === "score" && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-lg bg-card border border-border p-1.5 shadow-none z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest px-3 py-1.5 border-b border-border/40 mb-1">Filter Score</div>
                {["Hot", "Warm", "Cold"].map(s => (
                  <button
                    key={s}
                    onClick={() => toggleScoreFilter(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-white/[0.08] hover:text-white flex items-center justify-between text-foreground/95 transition-colors font-medium"
                  >
                    <span>{s}</span>
                    {selectedScores.includes(s) && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stage Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "stage" ? null : "stage")}
              className={`text-sm border rounded-md px-3 py-2 text-foreground flex items-center gap-1 hover:bg-secondary/80 transition-colors ${selectedStages.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}
            >
              Stage {selectedStages.length > 0 && `(${selectedStages.length})`} <span className="text-muted-foreground">▾</span>
            </button>
            {activeDropdown === "stage" && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-lg bg-card border border-border p-1.5 shadow-none z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest px-3 py-1.5 border-b border-border/40 mb-1">Filter Stage</div>
                {["New", "Emailed", "Opened", "Replied", "Appointment"].map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStageFilter(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-white/[0.08] hover:text-white flex items-center justify-between text-foreground/95 transition-colors font-medium"
                  >
                    <span>{s}</span>
                    {selectedStages.includes(s) && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Source Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "source" ? null : "source")}
              className={`text-sm border rounded-md px-3 py-2 text-foreground flex items-center gap-1 hover:bg-secondary/80 transition-colors ${selectedSources.length > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}
            >
              Source {selectedSources.length > 0 && `(${selectedSources.length})`} <span className="text-muted-foreground">▾</span>
            </button>
            {activeDropdown === "source" && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-lg bg-card border border-border p-1.5 shadow-none z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest px-3 py-1.5 border-b border-border/40 mb-1">Filter Source</div>
                {availableSources.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleSourceFilter(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-white/[0.08] hover:text-white flex items-center justify-between text-foreground/95 transition-colors font-medium"
                  >
                    <span>{s}</span>
                    {selectedSources.includes(s) && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === "sort" ? null : "sort")}
              className="text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground hover:bg-secondary/80 transition-colors"
            >
              Sort: {sortOption} <span className="text-muted-foreground">▾</span>
            </button>
            {activeDropdown === "sort" && (
              <div className="absolute left-0 mt-1.5 w-56 rounded-lg bg-card border border-border p-1.5 shadow-none z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest px-3 py-1.5 border-b border-border/40 mb-1">Sort By</div>
                {["Newest", "Oldest", "Budget: High to Low", "Budget: Low to High"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => {
                      setSortOption(opt);
                      setActiveDropdown(null);
                    }}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-white/[0.08] hover:text-white flex items-center justify-between text-foreground/95 transition-colors font-medium"
                  >
                    <span>{opt}</span>
                    {sortOption === opt && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex gap-1.5 items-center">
            {/* View Toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('pipeline')}
                title="Pipeline View"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                  viewMode === 'pipeline'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">Pipeline</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-l border-border ${
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <button
              onClick={() => {
                const icon = document.getElementById('leads-refresh-icon');
                if (icon) icon.classList.add('animate-spin');
                router.invalidate().finally(() => {
                  if (icon) icon.classList.remove('animate-spin');
                });
              }}
              className="inline-flex items-center gap-1 text-xs border border-border rounded-md px-2.5 py-1.5 text-foreground hover:bg-secondary transition-colors"
              title="Refresh Data"
            >
              <RefreshCw id="leads-refresh-icon" className="size-3.5" /> Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-1 text-xs border border-border rounded-md px-2.5 py-1.5 text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
            >
              <Download className="size-3.5" /> Export CSV
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 font-medium hover:bg-primary/90 focus:ring-0 focus:outline-none transition-colors duration-75 whitespace-nowrap"
            >
              <Plus className="size-3.5" /> Add Lead
            </button>
          </div>
        </div>

        {viewMode === 'pipeline' ? (
          /* ──────── PIPELINE / KANBAN VIEW ──────── */
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
            <KanbanBoard
              leads={filtered}
              isPrivacyMode={isPrivacyMode}
              onSelectLead={setSelected}
              onEmailLead={setActiveEmailLead}
              onScheduleLead={setActiveScheduleLead}
              onEditLead={(lead) => {
                setEditForm({
                  name: lead.name,
                  phone: lead.phone || "",
                  email: lead.email || "",
                  county: lead.county,
                  state: lead.state,
                  landPrice: String(lead.landPrice),
                  estimatedBudget: String(lead.estimatedBudget || ""),
                  status: lead.status,
                  scoreTier: lead.scoreTier,
                  source: lead.source,
                });
                setEditError("");
                setEditLead(lead);
              }}
              onDeleteLead={async (lead) => {
                if (confirm(`Are you sure you want to delete ${lead.firstName}?`)) {
                  try {
                    await deleteLead({ data: lead.id });
                    await router.invalidate();
                  } catch (err) {
                    console.error("Failed to delete lead", err);
                  }
                }
              }}
              onSendSms={(lead) => {
                const defaultMsg = `Hi ${lead.firstName}, this is Your Company. We noticed your recent permit application in ${lead.county}. Have you selected a builder yet? Reply YES or NO.`;
                const msg = prompt(`SMS message to ${lead.firstName}:`, defaultMsg);
                if (!msg) return;
                setSmsSending(lead.id);
                setSmsResult(null);
                sendSmsOutreach({ data: { leadId: lead.id, message: msg } })
                  .then(r => { setSmsResult({ leadId: lead.id, ok: r.sent }); setTimeout(() => setSmsResult(null), 4000); })
                  .catch(() => { setSmsResult({ leadId: lead.id, ok: false }); setTimeout(() => setSmsResult(null), 4000); })
                  .finally(() => setSmsSending(null));
              }}
              onRetrigger={async (lead) => {
                if (!confirm(`Re-trigger AI intake flow for ${lead.firstName}? This will reset their status to New.`)) return;
                try {
                  await retriggerLeadFlow({ data: lead.id });
                  setRetriggerResult(true);
                  setTimeout(() => setRetriggerResult(null), 3500);
                  await router.invalidate();
                } catch (err) {
                  console.error(err);
                  setRetriggerResult(false);
                  setTimeout(() => setRetriggerResult(null), 3500);
                }
              }}
            />
          </div>
        ) : (
          /* ──────── TABLE VIEW ──────── */
          <>
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-t border-border custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr className="text-center text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium text-center">#</th>
                    <th className="px-4 py-3 font-medium text-center">Name</th>
                    <th className="px-4 py-3 font-medium text-center">Phone</th>
                    <th className="px-4 py-3 font-medium text-center">Budget</th>
                    <th className="px-4 py-3 font-medium text-center">Score</th>
                    <th className="px-4 py-3 font-medium text-center">Stage</th>
                    <th className="px-4 py-3 font-medium text-center">Source</th>
                    <th className="px-4 py-3 font-medium text-center">Captured</th>
                    <th className="px-4 py-3 font-medium text-center">AI Status</th>
                    <th className="px-4 py-3 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((lead, i) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + i;
                    const revealed = revealedPhones.has(lead.id);
                    const safePhone = lead.phone || "No phone";
                    const displayPhone = revealed ? safePhone : safePhone.length > 4 ? safePhone.replace(/\d{4}$/, "****") : safePhone;
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelected(lead)}
                        className={`border-t border-border cursor-pointer transition-all duration-150 hover:bg-white/[0.03] hover:border-l-2 hover:border-l-white/20 ${i % 2 ? "bg-card" : "bg-card/60"}`}
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground text-xs text-center">{String(globalIndex + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3 font-medium text-foreground text-center">
                          {isPrivacyMode 
                            ? obscurePII(`${lead.firstName} ${lead.lastName || ''}`, 'name')
                            : lead.lastName ? `${lead.firstName} ${lead.lastName.split(/\s+/).map((p: string) => p.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()).filter(Boolean).join('. ')}.` : lead.firstName
                          }
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-center">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (!isPrivacyMode) {
                                setRevealedPhones((s) => { const n = new Set(s); n.add(lead.id); return n; }); 
                              }
                            }}
                            className={`text-foreground transition-colors ${!isPrivacyMode ? 'hover:text-white/80' : 'cursor-default'}`}
                          >
                            {isPrivacyMode ? obscurePII(safePhone, 'phone') : displayPhone}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground text-center">{lead.budget}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <ScoreBadge score={lead.score} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <StageBadge stage={lead.stage} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-muted-foreground">{lead.source}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs text-foreground font-medium">
                              {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              })}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {new Date(lead.createdAt).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <AiStatus status={lead.aiStatus} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveEmailLead(lead); }}
                              title="Compose Outreach Email"
                              className="size-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                              <Mail className="size-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveScheduleLead(lead); }}
                              className="size-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                              <Calendar className="size-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelected(lead); }}
                              className="size-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            >
                              <Eye className="size-3.5" />
                            </button>

                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveMoreLead(activeMoreLead === lead.id ? null : lead.id); }}
                                className="size-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </button>

                              {activeMoreLead === lead.id && (
                                <div className="absolute right-0 mt-1 w-36 rounded-lg bg-card/95 backdrop-blur-xl border border-border p-1 shadow-none z-30 animate-in fade-in duration-100">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setActiveMoreLead(null);
                                      setEditForm({
                                        name: lead.name,
                                        phone: lead.phone || "",
                                        email: lead.email || "",
                                        county: lead.county,
                                        state: lead.state,
                                        landPrice: String(lead.landPrice),
                                        estimatedBudget: String(lead.estimatedBudget || ""),
                                        status: lead.status,
                                        scoreTier: lead.scoreTier,
                                        source: lead.source,
                                      });
                                      setEditError("");
                                      setEditLead(lead);
                                    }}
                                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors flex items-center gap-1.5"
                                  >
                                    <Edit className="size-3" /> Edit Lead
                                  </button>
                                  {!isSalesAgent && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setActiveMoreLead(null);
                                        if (confirm(`Are you sure you want to delete ${lead.firstName}?`)) {
                                          try {
                                            await deleteLead({ data: lead.id });
                                            await router.invalidate();
                                          } catch (err) {
                                            console.error("Failed to delete lead", err);
                                          }
                                        }
                                      }}
                                      className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-danger/10 text-danger font-medium transition-colors"
                                    >
                                      Delete Lead
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMoreLead(null);
                                      const defaultMsg = `Hi ${lead.firstName}, this is Your Company. We noticed your recent permit application in ${lead.county}. Have you selected a builder yet? Reply YES or NO.`;
                                      const msg = prompt(`SMS message to ${lead.firstName}:`, defaultMsg);
                                      if (!msg) return;
                                      setSmsSending(lead.id);
                                      setSmsResult(null);
                                      sendSmsOutreach({ data: { leadId: lead.id, message: msg } })
                                        .then(r => { setSmsResult({ leadId: lead.id, ok: r.sent }); setTimeout(() => setSmsResult(null), 4000); })
                                        .catch(() => { setSmsResult({ leadId: lead.id, ok: false }); setTimeout(() => setSmsResult(null), 4000); })
                                        .finally(() => setSmsSending(null));
                                    }}
                                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors"
                                  >
                                    Send SMS
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setActiveMoreLead(null);
                                      if (!confirm(`Re-trigger AI intake flow for ${lead.firstName}? This will reset their status to New.`)) return;
                                      try {
                                        await retriggerLeadFlow({ data: lead.id });
                                        setRetriggerResult(true);
                                        setTimeout(() => setRetriggerResult(null), 3500);
                                        await router.invalidate();
                                      } catch (err) {
                                        console.error(err);
                                        setRetriggerResult(false);
                                        setTimeout(() => setRetriggerResult(null), 3500);
                                      }
                                    }}
                                    className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors"
                                  >
                                    Re-trigger Flow
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-sm text-muted-foreground font-mono">
                        No leads match the active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of{" "}
                  <span className="font-medium text-foreground">{filtered.length}</span> leads
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filtered.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filtered.length / itemsPerPage)}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {selected && <LeadDetailPanel lead={selected} onClose={() => setSelected(null)} />}

      {/* Edit Lead Modal */}
      {editLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditLead(null)}>
          <form
            onSubmit={handleEditLead}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card border border-border rounded-xl shadow-none p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Edit Lead</h2>
              <button type="button" onClick={() => setEditLead(null)} className="size-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center"><X className="size-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Full Name *</label><input required value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Phone</label><input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Email</label><input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">County</label><input value={editForm.county} onChange={e => setEditForm(p => ({ ...p, county: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">State</label><input value={editForm.state} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Land Price ($) *</label><input type="number" value={editForm.landPrice} onChange={e => setEditForm(p => ({ ...p, landPrice: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Project Budget ($)</label><input type="number" value={editForm.estimatedBudget} onChange={e => setEditForm(p => ({ ...p, estimatedBudget: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Source</label><input value={editForm.source} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">Stage</label>
                <CustomSelect value={editForm.status} onChange={val => setEditForm(p => ({ ...p, status: val }))} options={["New","Emailed","Opened","Replied","Appointment","Qualified","Closed Lost","Closed Won"].map(s => ({label: s, value: s}))} />
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">Score Tier</label>
                <CustomSelect value={editForm.scoreTier} onChange={val => setEditForm(p => ({ ...p, scoreTier: val }))} options={["Hot","Warm","Cold"].map(s => ({label: s, value: s}))} />
              </div>
            </div>
            {editError && <p className="text-xs text-danger">{editError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditLead(null)} className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button type="submit" disabled={isEditSubmitting} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                {isEditSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Premium Outreach Email Simulator Overlay */}
      {activeEmailLead && (
        <EmailSimulatorModal
          lead={activeEmailLead}
          onClose={() => setActiveEmailLead(null)}
        />
      )}

      {/* Schedule Appointment overlay */}
      {activeScheduleLead && (
        <ScheduleAppointmentModal
          lead={activeScheduleLead}
          onClose={() => setActiveScheduleLead(null)}
          onSchedule={async (date, time, type) => {
            alert(`Appointment scheduled successfully for ${activeScheduleLead.firstName} on ${date} at ${time} (${type})`);
            await router.invalidate();
          }}
        />
      )}

      {/* Manual Lead Creation Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-none overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display text-base font-semibold text-foreground">Add Manual Lead</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="size-8 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Error block */}
            {modalError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-start gap-2 animate-in fade-in duration-100">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddManualLead} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Full Name *</label>
                  <input
                    required
                    value={modalForm.name}
                    onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Land Purchase Price ($) *</label>
                  <input
                    required
                    type="number"
                    value={modalForm.landPrice}
                    onChange={(e) => setModalForm({ ...modalForm, landPrice: e.target.value })}
                    placeholder="e.g. 150000"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Project Budget ($) *</label>
                  <input
                    required
                    type="number"
                    value={modalForm.estimatedBudget}
                    onChange={(e) => setModalForm({ ...modalForm, estimatedBudget: e.target.value })}
                    placeholder="e.g. 600000"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Phone Number</label>
                  <input
                    value={modalForm.phone}
                    onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                    placeholder="e.g. (512) 555-0199"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    value={modalForm.email}
                    onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">County Location</label>
                  <input
                    value={modalForm.county}
                    onChange={(e) => setModalForm({ ...modalForm, county: e.target.value })}
                    placeholder="e.g. Travis CAD"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">State</label>
                  <input
                    value={modalForm.state}
                    onChange={(e) => setModalForm({ ...modalForm, state: e.target.value })}
                    placeholder="e.g. TX"
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Score Tier</label>
                  <div className="mt-1">
                    <CustomSelect
                      value={modalForm.scoreTier}
                      onChange={(val) => setModalForm({ ...modalForm, scoreTier: val })}
                      options={[{label: "Hot", value: "Hot"}, {label: "Warm", value: "Warm"}, {label: "Cold", value: "Cold"}]}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Stage Status</label>
                  <div className="mt-1">
                    <CustomSelect
                      value={modalForm.status}
                      onChange={(val) => setModalForm({ ...modalForm, status: val })}
                      options={[{label: "New", value: "New"}, {label: "Emailed", value: "Emailed"}, {label: "Opened", value: "Opened"}, {label: "Replied", value: "Replied"}, {label: "Appointment", value: "Appointment"}]}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Lead Source</label>
                <div className="mt-1">
                  <CustomSelect
                    value={modalForm.source}
                    onChange={(val) => setModalForm({ ...modalForm, source: val })}
                    options={[{label: "Austin Building Permits", value: "Austin Building Permits"}, {label: "Travis County Public Records", value: "Travis County Public Records"}]}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs border border-border text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-all duration-150 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? "Saving..." : "Add Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

// Premium Database-linked Email Outreach Simulator Component
function EmailSimulatorModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const router = useRouter();
  const presets = [
    {
      label: "Welcome & Land Survey",
      subject: `Welcome ${lead.firstName} - Land Evaluation Questionnaire`,
      body: `Hi ${lead.firstName},\n\nThanks for reaching out! I noticed you are evaluating land options in ${lead.city}, ${lead.state || "TX"}.\n\nTo help us design the perfect home style for your property, could you share:\n1. Have you officially surveyed the boundaries?\n2. What is your preferred layout style (e.g. Custom Modern Ranch)?\n\nLooking forward to building your dream home!\n\nBest regards,\nBuild Expert`
    },
    {
      label: "Design Strategy Workshop",
      subject: `Schedule Your Design Strategy Workshop - ${lead.firstName} ${lead.lastName}`,
      body: `Hi ${lead.firstName},\n\nCongratulations on your pre-approval! We would love to invite you to our studio for a custom Design Strategy Workshop.\n\nWe will review your estimated budget of ${lead.budget} and walk through floor plans tailored to modern living layouts.\n\nLet me know if this week works for a 30-minute session!\n\nWarmly,\nLead Architect`
    },
    {
      label: "Travis CAD Permit Follow-up",
      subject: `Outreach regarding Travis CAD Boundary & Permitting`,
      body: `Hi ${lead.firstName},\n\nI am following up on your custom modern ranch build. We checked the local Travis CAD zoning for your lot and have a few updates on utility connections.\n\nLet's connect this Friday to finalize the initial permit submissions.\n\nBest,\nPermitting Coordinator`
    }
  ];

  const [selectedPreset, setSelectedPreset] = useState(0);
  const [subject, setSubject] = useState(presets[0].subject);
  const [body, setBody] = useState(presets[0].body);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSubject(presets[selectedPreset].subject);
    setBody(presets[selectedPreset].body);
  }, [selectedPreset]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await logActivity({
        data: {
          leadId: lead.id,
          action: `📧 Outreach email sent — Subject: "${subject}" · Preview: "${body.substring(0, 80).replace(/\n/g, ' ')}..."`
        }
      });
      // Update lead status to "Emailed" if it's still New
      if (lead.status === 'New') {
        await updateLead({ data: { id: lead.id, status: 'Emailed' } });
      }
      setIsSending(false);
      setSuccess(true);
      setTimeout(async () => {
        await router.invalidate();
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsSending(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-none p-6 text-left animate-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>

        <h3 className="font-display text-base font-semibold text-foreground mb-4">Compose Outreach Email</h3>

        {!success ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">To</label>
              <input
                disabled
                type="text"
                value={`${lead.firstName} ${lead.lastName} <${lead.email || "no-email@example.com"}>`}
                className="w-full bg-secondary/50 border border-border/60 rounded-md px-3 py-2 text-xs text-muted-foreground focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Select Preset Template</label>
              <CustomSelect
                value={String(selectedPreset)}
                onChange={(val) => setSelectedPreset(Number(val))}
                options={presets.map((p, idx) => ({label: p.label, value: String(idx)}))}
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 font-mono resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs border border-border text-foreground hover:bg-secondary rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isSending}
                className="px-4 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSending ? "Sending Outreach..." : "Send Outreach"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <div className="size-12 rounded-full bg-success/10 border border-success/20 text-success flex items-center justify-center mx-auto">
              <Check className="size-6 animate-bounce" />
            </div>
            <h4 className="font-display text-sm font-semibold text-foreground">Email Dispatched Successfully</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">CRM activity logged and timeline updated in direct PostgreSQL.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom Appointment Scheduling Component
function ScheduleAppointmentModal({ lead, onClose, onSchedule }: { lead: any; onClose: () => void; onSchedule: (date: string, time: string, type: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("Phone Consult");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSchedule(date, time, type);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-none p-6 animate-in zoom-in-95 duration-150">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>

        <h3 className="font-display text-base font-semibold text-foreground mb-4">Schedule for {lead.firstName}</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Appointment Type</label>
            <CustomSelect
              value={type}
              onChange={(val) => setType(val)}
              options={[{label: "Phone Consult", value: "Phone Consult"}, {label: "Land Inspection", value: "Land Inspection"}, {label: "Design Workshop", value: "Design Workshop"}]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Select Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Select Time</label>
              <input
                required
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-border text-foreground hover:bg-secondary rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Confirm Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Premium Individual Lead Detail Drawer (No Dummy Data)
function LeadDetailPanel({ lead, onClose }: { lead: any; onClose: () => void }) {
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;

  const budgetConfirmed = lead.estimatedBudget >= 200000;
  const isEngaged = lead.stage !== "New";
  const scoreTierPts = lead.scoreTier === "Hot" ? 20 : lead.scoreTier === "Warm" ? 10 : 0;

  const breakdown = [
    { label: "High Budget Confirmed", val: budgetConfirmed, pts: 50 },
    { label: "Pipeline Engagement", val: isEngaged, pts: 30 },
    { label: "Hot Score Tier", val: lead.scoreTier === "Hot", pts: 20 },
  ];

  const totalScore = (budgetConfirmed ? 50 : 0) + (isEngaged ? 30 : 0) + scoreTierPts;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 top-[60px] bg-black/40 z-30 animate-in fade-in duration-200" onClick={onClose} />
      <aside className="fixed top-[60px] right-0 bottom-0 w-[480px] bg-card border-l border-border z-40 overflow-y-auto shadow-none animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isPrivacyMode ? obscurePII(`${lead.firstName} ${lead.lastName || ''}`, 'name') : `${lead.firstName} ${lead.lastName || ''}`}
              </h2>
              <ScoreBadge score={lead.score} />
              <StageBadge stage={lead.stage} />
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground text-left">
              <a href={isPrivacyMode ? '#' : `tel:${lead.phone || ""}`} className={`inline-flex items-center gap-1.5 transition-colors ${!isPrivacyMode ? 'hover:text-foreground' : 'cursor-default'}`}>
                <Phone className="size-3" />{isPrivacyMode ? obscurePII(lead.phone, 'phone') : (lead.phone || "No phone")}
              </a>
              <a href={isPrivacyMode ? '#' : `mailto:${lead.email || ""}`} className={`inline-flex items-center gap-1.5 transition-colors ${!isPrivacyMode ? 'hover:text-foreground' : 'cursor-default'}`}>
                <Mail className="size-3" />{isPrivacyMode ? obscurePII(lead.email, 'email') : (lead.email || "No email")}
              </a>
              <span>{lead.source} · received {new Date(lead.purchaseDate).toLocaleDateString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>

        <div className="p-5 space-y-6 text-left">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">Lead Profile</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Budget" value={lead.budget} mono />
              <Field label="County / City" value={`${lead.state || "TX"} · ${lead.city}`} />
              <Field label="Living situation" value={lead.landPrice > 0 ? `Bought land for $${(lead.landPrice / 1000).toFixed(0)}k` : "Evaluating land"} />
              <Field label="Estimated Land Value" value={`$${(lead.landPrice / 1000).toFixed(0)}k`} />
            </dl>
          </section>

          {/* Real PostgreSQL seeded activity logs */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">Activity History</h3>
            {lead.activities && lead.activities.length > 0 ? (
              <div className="space-y-3 font-mono text-xs">
                {lead.activities.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-2.5 border-l border-border pl-3 pb-2 last:pb-0 relative">
                    <span className="absolute -left-[4.5px] top-1.5 size-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-foreground leading-normal">{act.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(act.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic font-mono">No logged activity logs.</p>
            )}
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">Lead Score Breakdown</h3>
            <div className="border border-border rounded-md overflow-hidden">
              {breakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-0">
                  <span className="text-foreground">{b.label}</span>
                  <span className={`font-mono ${b.val ? "text-success" : "text-muted-foreground"}`}>
                    {b.val ? `✓ +${b.pts} pts` : "✗ 0 pts"}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2.5 text-sm bg-secondary">
                <span className="font-semibold text-foreground">Total Score</span>
                <span className="font-mono font-semibold text-foreground">{totalScore} / 100 · {lead.score.toUpperCase()}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-mono">Builder Notes</h3>
            <textarea
              placeholder="Private notes (auto-saved)..."
              className="w-full h-24 bg-secondary border border-border rounded-md p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 resize-none transition-all duration-150 text-foreground"
            />
          </section>
        </div>
      </aside>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="text-left">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Bubble({ side, time, text }: { side: "left" | "right"; time: string; text: string }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${side === "right" ? "bg-white/[0.08] text-foreground border border-white/15" : "bg-secondary text-foreground border border-border"}`}>
        <p>{text}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">{time}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN / PIPELINE BOARD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type KanbanBoardProps = {
  leads: any[];
  isPrivacyMode: boolean;
  onSelectLead: (lead: any) => void;
  onEmailLead: (lead: any) => void;
  onScheduleLead: (lead: any) => void;
  onEditLead: (lead: any) => void;
  onDeleteLead: (lead: any) => void;
  onSendSms: (lead: any) => void;
  onRetrigger: (lead: any) => void;
};

const KANBAN_COLUMNS = [
  {
    id: 'new',
    label: 'New Leads',
    stages: ['New'],
    icon: '📥',
    accent: 'border-t-slate-500',
    headerBg: 'bg-slate-500/10',
    headerText: 'text-slate-300',
    countBg: 'bg-slate-500/20 text-slate-300',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'outreach',
    label: 'Outreach Sent',
    stages: ['Emailed'],
    icon: '📧',
    accent: 'border-t-blue-500',
    headerBg: 'bg-blue-500/10',
    headerText: 'text-blue-300',
    countBg: 'bg-blue-500/20 text-blue-300',
    dotColor: 'bg-blue-400',
  },
  {
    id: 'engaged',
    label: 'Engaged',
    stages: ['Opened', 'Replied'],
    icon: '💬',
    accent: 'border-t-amber-500',
    headerBg: 'bg-amber-500/10',
    headerText: 'text-amber-300',
    countBg: 'bg-amber-500/20 text-amber-300',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'qualified',
    label: 'Qualified (Hot)',
    stages: ['Qualified', 'Closed Won'],
    icon: '⭐',
    accent: 'border-t-green-500',
    headerBg: 'bg-green-500/10',
    headerText: 'text-green-300',
    countBg: 'bg-green-500/20 text-green-300',
    dotColor: 'bg-green-400',
  },
];

function KanbanBoard(props: KanbanBoardProps) {
  const { leads, ...rest } = props;

  return (
    <div className="flex gap-3 h-full px-4 py-4">
      {KANBAN_COLUMNS.map(col => {
        const colLeads = leads.filter(l => col.stages.includes(l.status || l.stage));
        return (
          <KanbanColumn
            key={col.id}
            column={col}
            leads={colLeads}
            {...rest}
          />
        );
      })}
    </div>
  );
}

type KanbanColumnProps = {
  column: typeof KANBAN_COLUMNS[0];
  leads: any[];
  isPrivacyMode: boolean;
  onSelectLead: (lead: any) => void;
  onEmailLead: (lead: any) => void;
  onScheduleLead: (lead: any) => void;
  onEditLead: (lead: any) => void;
  onDeleteLead: (lead: any) => void;
  onSendSms: (lead: any) => void;
  onRetrigger: (lead: any) => void;
};

function KanbanColumn({ column, leads, ...cardProps }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col flex-1 min-w-0 rounded-xl border-t-2 ${column.accent} bg-card/60 border border-border overflow-hidden`}>
      {/* Column Header */}
      <div className={`px-3 py-2.5 ${column.headerBg} border-b border-border flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{column.icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${column.headerText}`}>
            {column.label}
          </span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${column.countBg}`}>
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className={`size-2 rounded-full ${column.dotColor} mb-2 opacity-40`} />
            <p className="text-[11px] text-muted-foreground/60 font-mono">No leads here</p>
          </div>
        ) : (
          leads.map(lead => (
            <LeadKanbanCard
              key={lead.id}
              lead={lead}
              column={column}
              {...cardProps}
            />
          ))
        )}
      </div>
    </div>
  );
}

type LeadKanbanCardProps = {
  lead: any;
  column: typeof KANBAN_COLUMNS[0];
  isPrivacyMode: boolean;
  onSelectLead: (lead: any) => void;
  onEmailLead: (lead: any) => void;
  onScheduleLead: (lead: any) => void;
  onEditLead: (lead: any) => void;
  onDeleteLead: (lead: any) => void;
  onSendSms: (lead: any) => void;
  onRetrigger: (lead: any) => void;
};

function LeadKanbanCard({ lead, column, isPrivacyMode, onSelectLead, onEmailLead, onScheduleLead, onEditLead, onDeleteLead, onSendSms, onRetrigger }: LeadKanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const displayName = isPrivacyMode
    ? obscurePII(`${lead.firstName} ${lead.lastName || ''}`, 'name')
    : lead.lastName
      ? `${lead.firstName} ${lead.lastName.split(/\s+/).map((p: string) => p.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase()).filter(Boolean).join('. ')}.`
      : lead.firstName;

  const daysAgo = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;

  const scoreColors: Record<string, string> = {
    hot: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    warm: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    cold: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  };
  const scoreColor = scoreColors[lead.score] || scoreColors.cold;

  const aiDot = lead.aiStatus === 'Replied'
    ? 'bg-green-400'
    : lead.aiStatus === 'Awaiting'
    ? 'bg-yellow-400'
    : 'bg-red-400';

  return (
    <div
      onClick={() => onSelectLead(lead)}
      className="group relative bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-white/20 hover:bg-card/80 transition-all duration-150 animate-in fade-in duration-200"
    >
      {/* Top row: name + score badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{lead.city}, {lead.state || 'TX'}</p>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide shrink-0 ${scoreColor}`}>
          {lead.scoreTier === 'Hot' ? '🔥' : lead.scoreTier === 'Warm' ? '🌡' : '❄️'} {lead.scoreTier}
        </span>
      </div>

      {/* Budget row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold text-foreground">{lead.budget}</span>
          <span className="text-[10px] text-muted-foreground">budget</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`size-1.5 rounded-full ${aiDot}`} />
          <span className="text-[10px] text-muted-foreground">{lead.aiStatus}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50 mb-2" />

      {/* Footer: days ago + action buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">{daysLabel}</span>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEmailLead(lead)}
            title="Send Email"
            className="size-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="size-3" />
          </button>
          <button
            onClick={() => onScheduleLead(lead)}
            title="Schedule Appointment"
            className="size-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Calendar className="size-3" />
          </button>
          <button
            onClick={() => onSelectLead(lead)}
            title="View Lead Detail"
            className="size-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="size-3" />
          </button>

          {/* More actions menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(p => !p)}
              title="More Actions"
              className="size-6 rounded hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="size-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-7 w-36 rounded-lg bg-card/95 backdrop-blur-xl border border-border p-1 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-100">
                <button
                  onClick={() => { setMenuOpen(false); onEditLead(lead); }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Edit className="size-3" /> Edit Lead
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onSendSms(lead); }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare className="size-3" /> Send SMS
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onRetrigger(lead); }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-white/[0.04] text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Zap className="size-3" /> Re-trigger AI
                </button>
                <div className="border-t border-border/40 my-1" />
                <button
                  onClick={() => { setMenuOpen(false); onDeleteLead(lead); }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-danger/10 text-danger font-medium transition-colors"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
