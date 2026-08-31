import { createFileRoute, useLoaderData, useRouter, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { RoutePending } from "@/components/dashboard/RoutePending";
import {
  getAdminDemoRequests,
  updateDemoRequestStatus,
  deleteDemoRequest,
  sendAdminDemoDirectEmail,
} from "@/lib/admin";
import {
  Sparkles,
  Send,
  Search,
  Calendar,
  Phone,
  Mail,
  Loader2,
  Check,
  Clock,
  X,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Building2,
  ChevronRight,
  ExternalLink,
  Edit3,
  User,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/demo-requests")({
  beforeLoad: ({ context }) => {
    const session = context.session as any;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  loader: () => {
    if (typeof window === 'undefined') return { demoRequests: [] };
    return getAdminDemoRequests().then(d => ({ demoRequests: d || [] }));
  },
  staleTime: 30_000,
  head: () => ({
    meta: [
      { title: "Demo Requests — WeaverFrame HQ" },
      { name: "description", content: "Executive Inbound Demonstration Requests & Lead Intelligence." },
    ],
  }),
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading Demo Requests..." type="leads" />,
  component: AdminDemoRequestsPage,
});

function AdminDemoRequestsPage() {
  const router = useRouter();
  const loaderData = (useLoaderData({ from: "/admin/demo-requests" }) || {}) as any;
  const initialRequests = loaderData?.demoRequests || [];

  const [requestsList, setRequestsList] = useState<any[]>(initialRequests || []);

  useEffect(() => {
    if (initialRequests && Array.isArray(initialRequests)) {
      setRequestsList(initialRequests);
    }
  }, [initialRequests]);

  // Track seen demo requests for Bold/Normal text formatting
  const [seenRequests, setSeenRequests] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("weaver_seen_demo_requests") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  const markRequestAsSeen = (id: string) => {
    if (typeof window !== "undefined") {
      try {
        const currentSeen = JSON.parse(localStorage.getItem("weaver_seen_demo_requests") || "[]");
        if (!currentSeen.includes(id)) {
          const updated = [...currentSeen, id];
          localStorage.setItem("weaver_seen_demo_requests", JSON.stringify(updated));
          setSeenRequests(updated);
          window.dispatchEvent(new Event("weaver_requests_updated"));
        }
      } catch {}
    }
  };

  // Poll demo requests every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      router.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  // Selected Demo Request
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drag resizable split panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("demo-requests-split-width");
      return saved ? parseInt(saved, 10) : 380;
    }
    return 380;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const clampedWidth = Math.max(300, Math.min(650, newWidth));
      setLeftWidth(clampedWidth);
      localStorage.setItem("demo-requests-split-width", String(clampedWidth));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Search & Filter Tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "new" | "contacted" | "scheduled">("all");
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Email reply composer states (100% Direct Human Email - Zero AI)
  const [replyMessage, setReplyMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Internal notes editor
  const [adminNotes, setAdminNotes] = useState("");
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  // Schedule modal state
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [apptDateTime, setApptDateTime] = useState("");
  const [apptLocation, setApptLocation] = useState("WeaverFrame Executive Virtual Briefing");
  const [isBooking, setIsBooking] = useState(false);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    let list = requestsList;

    if (activeTab === "new") {
      list = list.filter((r) => r.status === "new");
    } else if (activeTab === "contacted") {
      list = list.filter((r) => r.status === "contacted");
    } else if (activeTab === "scheduled") {
      list = list.filter((r) => r.status === "scheduled");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.company?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [requestsList, activeTab, searchQuery]);

  // Default selection
  useEffect(() => {
    if (!selectedId && filteredRequests.length > 0) {
      const first = filteredRequests[0];
      setSelectedId(first.id);
      markRequestAsSeen(first.id);
    }
  }, [filteredRequests, selectedId]);

  const selectedRequest = useMemo(() => {
    return requestsList.find((r) => r.id === selectedId) || null;
  }, [requestsList, selectedId]);

  useEffect(() => {
    if (selectedRequest) {
      setEmailSubject(`WeaverFrame Demonstration Walkthrough — ${selectedRequest.company || selectedRequest.name}`);
      setAdminNotes(selectedRequest.notes || "");
    }
  }, [selectedRequest]);

  const handleSendDirectEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !replyMessage.trim() || isSendingEmail) return;

    setIsSendingEmail(true);
    try {
      await sendAdminDemoDirectEmail({
        data: {
          demoRequestId: selectedRequest.id,
          recipientEmail: selectedRequest.email,
          recipientName: selectedRequest.name,
          subject: emailSubject.trim() || `WeaverFrame Demonstration Walkthrough — ${selectedRequest.company}`,
          message: replyMessage.trim(),
        },
      });

      toast.success(`Executive email dispatched to ${selectedRequest.email}`);
      setReplyMessage("");
      await router.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedRequest) return;
    try {
      await updateDemoRequestStatus({
        data: {
          id: selectedRequest.id,
          status: newStatus,
        },
      });
      setRequestsList((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? { ...r, status: newStatus } : r))
      );
      toast.success(`Status updated to ${newStatus}`);
      await router.invalidate();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest || isUpdatingNotes) return;
    setIsUpdatingNotes(true);
    try {
      await updateDemoRequestStatus({
        data: {
          id: selectedRequest.id,
          status: selectedRequest.status,
          notes: adminNotes.trim(),
        },
      });
      toast.success("Executive notes saved");
      await router.invalidate();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRequest) return;
    if (confirm(`Delete demo request from ${selectedRequest.name} (${selectedRequest.company})?`)) {
      try {
        await deleteDemoRequest({ data: { id: selectedRequest.id } });
        toast.success("Demo request deleted");
        setSelectedId(null);
        await router.invalidate();
      } catch {
        toast.error("Failed to delete request");
      }
    }
  };

  return (
    <Shell title="Demo Requests">
      <div
        ref={containerRef}
        className="flex h-[calc(100vh-100px)] min-h-[620px] rounded-2xl border border-border bg-[#07080b] overflow-hidden shadow-2xl relative select-none"
      >
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN: DEMO REQUESTS INQUIRIES LIST (RESIZABLE)
            ════════════════════════════════════════════════════════════════ */}
        <div
          style={{ width: `${leftWidth}px` }}
          className="border-r border-border flex flex-col h-full min-h-0 bg-[#080808]/95 shrink-0 relative"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#e5d9c5] dark:text-[#e5d9c5]" />
                <span>Inbound Demo Inquiries</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (isManualSyncing) return;
                  setIsManualSyncing(true);
                  try {
                    await router.invalidate();
                    toast.success("Demo inquiries synchronized");
                  } finally {
                    setTimeout(() => setIsManualSyncing(false), 600);
                  }
                }}
                disabled={isManualSyncing}
                className="size-7 rounded-md bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                title="Sync Inquiries"
              >
                <RefreshCw className={`size-3 transition-transform duration-300 ${isManualSyncing ? "animate-spin text-[#e5d9c5]" : ""}`} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by prospect, company, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#e5d9c5] placeholder:text-muted-foreground transition-colors font-mono"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-0.5 bg-secondary/60 rounded-lg">
              {(["all", "new", "contacted", "scheduled"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[10.5px] font-medium capitalize rounded-md transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-card text-[#e5d9c5] dark:text-[#e5d9c5] shadow-sm font-semibold border border-[#e5d9c5]/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 custom-scrollbar">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => {
                const isActive = req.id === selectedId;
                const isSeen = seenRequests.includes(req.id);
                const isUnseen = !isSeen;
                const initials = (req.name || "P")
                  .split(" ")
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "P";

                return (
                  <button
                    key={req.id}
                    onClick={() => {
                      setSelectedId(req.id);
                      markRequestAsSeen(req.id);
                    }}
                    className={`w-full text-left p-3.5 flex gap-3 transition-colors hover:bg-secondary/40 select-none outline-none focus:bg-secondary/40 relative cursor-pointer ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#e5d9c5] dark:bg-[#e5d9c5] animate-in fade-in duration-100" />
                    )}

                    <div className="relative shrink-0">
                      <div className="size-9 rounded-full flex items-center justify-center text-xs font-semibold border bg-[#e5d9c5]/15 border-[#e5d9c5]/30 text-[#e5d9c5] dark:text-[#e5d9c5]">
                        {initials}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${isUnseen ? "font-bold text-white tracking-tight" : "font-normal text-foreground/80"}`}>
                          {req.name}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 select-none ${isUnseen ? "text-[#e5d9c5] dark:text-[#e5d9c5] font-semibold" : "text-muted-foreground"}`}>
                          {new Date(req.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-white/5 text-slate-300 border border-white/10">
                          {req.company}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${
                          req.status === "new"
                            ? "bg-[#e5d9c5]/20 text-[#e5d9c5] border border-[#e5d9c5]/40"
                            : req.status === "scheduled"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[11px] truncate leading-relaxed flex-1 font-mono ${isUnseen ? "font-semibold text-white/90" : "text-muted-foreground"}`}>
                          Volume: {req.buildVolume} · {req.email}
                        </p>
                        {isUnseen && (
                          <span className="shrink-0 px-1.5 py-0.2 bg-[#e5d9c5] text-black text-[8.5px] font-mono font-bold rounded-full select-none">
                            NEW
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                No demo requests found.
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          onMouseDown={startDrag}
          className={`w-[4px] hover:w-[6px] cursor-col-resize h-full hover:bg-[#e5d9c5]/50 active:bg-[#e5d9c5] z-40 shrink-0 relative flex items-center justify-center transition-all duration-100 select-none ${
            isDragging ? "bg-[#e5d9c5] w-[6px]" : "bg-border/40"
          }`}
          title="Drag to resize panels"
        >
          <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-8 rounded bg-muted-foreground/30 pointer-events-none" />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN: SELECTED DEMO REQUEST WORKSPACE
            ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 bg-card/25 backdrop-blur-md relative overflow-hidden">
          {selectedRequest ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Top Action Bar */}
              <div className="px-5 py-3 bg-[#0a0b0f] border-b border-border/60 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-[#e5d9c5]/15 border border-[#e5d9c5]/30 flex items-center justify-center text-[#e5d9c5]">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground truncate">
                      {selectedRequest.name} — {selectedRequest.company}
                    </h2>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Received {new Date(selectedRequest.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Dropdown */}
                  <select
                    value={selectedRequest.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-foreground text-xs font-mono font-semibold cursor-pointer focus:outline-none focus:border-[#e5d9c5]"
                  >
                    <option value="new">Status: New</option>
                    <option value="contacted">Status: Contacted</option>
                    <option value="scheduled">Status: Scheduled</option>
                    <option value="completed">Status: Completed</option>
                    <option value="archived">Status: Archived</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsSchedulingOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#e5d9c5] text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-[#e5d9c5]/90 transition-all cursor-pointer"
                  >
                    <Calendar className="size-3.5" />
                    <span>Schedule Demo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger border border-transparent hover:border-danger/30 transition-colors cursor-pointer"
                    title="Delete Request"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Main Content Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
                {/* Executive Prospect Intelligence Card */}
                <div className="rounded-2xl border border-border/80 bg-[#08090d] p-5 shadow-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8">
                    
                    {/* Left Column: Organization & Direct Email */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10.5px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Building2 className="size-3.5 text-[#e5d9c5]" /> Company / Architectural Firm
                        </span>
                        <p className="text-sm font-semibold text-foreground tracking-tight">
                          {selectedRequest.company || "Not specified"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10.5px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Mail className="size-3.5 text-[#e5d9c5]" /> Direct Contact Email
                        </span>
                        <div className="flex items-center gap-2">
                          <a
                            href={`mailto:${selectedRequest.email}`}
                            className="text-sm font-mono font-medium text-foreground hover:text-[#e5d9c5] transition-colors underline-offset-4 hover:underline"
                            title={selectedRequest.email}
                          >
                            {selectedRequest.email || "No email provided"}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Phone & Typical Volume */}
                    <div className="space-y-4 md:border-l md:border-border/50 md:pl-8">
                      <div>
                        <span className="text-[10.5px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Phone className="size-3.5 text-[#e5d9c5]" /> Phone Number
                        </span>
                        <div>
                          <a
                            href={`tel:${selectedRequest.phone}`}
                            className="text-sm font-mono font-medium text-foreground hover:text-[#e5d9c5] transition-colors"
                          >
                            {selectedRequest.phone || "No phone provided"}
                          </a>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10.5px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1.5">
                          <DollarSign className="size-3.5 text-[#e5d9c5]" /> Typical Build Volume
                        </span>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#e5d9c5]/10 border border-[#e5d9c5]/25 text-[#e5d9c5] text-xs font-mono font-semibold">
                          <span>{selectedRequest.buildVolume}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Direct Human Email Reply Composer (100% Direct - ZERO AI) */}
                <div className="rounded-2xl border border-border/80 bg-[#08090d] p-4 sm:p-5 shadow-lg space-y-3.5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-[#e5d9c5]" />
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground">Direct Executive Email Reply</h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="size-3.5" />
                      <span>Human-Operated · Zero AI</span>
                    </span>
                  </div>

                  <form onSubmit={handleSendDirectEmail} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/50 text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Message Content</label>
                      <textarea
                        rows={5}
                        required
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder={`Dear ${selectedRequest.name},\n\nThank you for requesting a private WeaverFrame architectural demonstration...`}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5] resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10.5px] font-mono text-muted-foreground">
                        Dispatches directly to <strong>{selectedRequest.email}</strong> from <strong>advisory@weaverframe.com</strong>
                      </span>
                      <button
                        type="submit"
                        disabled={isSendingEmail || !replyMessage.trim()}
                        className="px-5 py-2.5 bg-[#e5d9c5] hover:bg-[#e5d9c5]/90 text-black font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSendingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        <span>{isSendingEmail ? "Dispatching..." : "Dispatch Email"}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Internal Executive Notes */}
                <div className="rounded-2xl border border-border/60 bg-[#08090d] p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <Edit3 className="size-3.5 text-[#e5d9c5]" />
                      <h4 className="font-semibold text-xs text-foreground">Internal Advisory Notes & Log</h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isUpdatingNotes}
                      className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[11px] font-mono font-semibold transition-colors cursor-pointer border border-border/50"
                    >
                      {isUpdatingNotes ? "Saving..." : "Save Notes"}
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add private internal notes regarding this demo request or client conversation..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5] resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground font-mono text-xs">
              <Sparkles className="size-10 mb-3 opacity-30 text-[#e5d9c5]" />
              <span>Select an inbound demo inquiry to inspect and reply</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Walkthrough Modal */}
      {isSchedulingOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 relative animate-in fade-in">
            <button
              onClick={() => setIsSchedulingOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#e5d9c5]">
                <Calendar className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Schedule Demonstration Walkthrough</h3>
                <span className="text-[10px] font-mono text-muted-foreground">Book session with {selectedRequest.name} ({selectedRequest.company})</span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!apptDateTime) return;
                setIsBooking(true);
                try {
                  const updatedNotes = (selectedRequest.notes ? selectedRequest.notes + '\n\n' : '') + `[${new Date().toLocaleString()} DEMO SCHEDULED]:\nDate: ${apptDateTime}\nLocation: ${apptLocation}`;
                  await updateDemoRequestStatus({
                    data: {
                      id: selectedRequest.id,
                      status: "scheduled",
                      notes: updatedNotes,
                    },
                  });
                  toast.success("Demonstration walkthrough scheduled");
                  setIsSchedulingOpen(false);
                  await router.invalidate();
                } catch {
                  toast.error("Failed to schedule demonstration");
                } finally {
                  setIsBooking(false);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={apptDateTime}
                  onChange={(e) => setApptDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Location / Meeting Link</label>
                <input
                  type="text"
                  value={apptLocation}
                  onChange={(e) => setApptLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSchedulingOpen(false)}
                  className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBooking}
                  className="px-5 py-2 bg-[#e5d9c5] text-black font-semibold text-xs rounded-lg transition-all"
                >
                  {isBooking ? "Confirming..." : "Confirm Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
