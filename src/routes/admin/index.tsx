import { createFileRoute, redirect, Link, useRouter, useRouteContext } from "@tanstack/react-router";
import { getSessionFn } from "@/lib/auth";
import { Shell } from "@/components/dashboard/Shell";
import { getAdminStats, createBuilderInvite } from "@/lib/admin";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { useState, useEffect } from "react";
import { 
  Users, 
  DollarSign, 
  Activity, 
  Building2, 
  Shield, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldCheck, 
  UserCheck, 
  Flame, 
  Mail, 
  Phone, 
  Clock, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Send, 
  X,
  Plus,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Global Platform Overview — WeaverFrame HQ" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  loader: () => {
    if (typeof window === 'undefined') return { totalMRR: 0, activeBuilders: 0, totalLeads: 0, trends: { mrr: '', builders: '', leads: '' }, demoRequests: [], demoRequestsCount: 0 };
    return getAdminStats();
  },
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Global Platform Overview" type="overview" />,
  component: AdminOverview,
});

function AdminOverview() {
  const stats = Route.useLoaderData();
  const router = useRouter();
  const context = useRouteContext({ strict: false }) as any;
  const adminEmail = (context?.session?.email || '').toLowerCase();
  
  // Selected Prospect Detail Modal
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Seen / Unseen tracking (Gmail-style)
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('weaver_seen_demo_requests') || '[]');
    } catch {
      return [];
    }
  });

  const markAsSeen = (id: string) => {
    if (!id || seenIds.includes(id)) return;
    const updated = [...seenIds, id];
    setSeenIds(updated);
    try {
      localStorage.setItem('weaver_seen_demo_requests', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('weaver_requests_updated'));
    } catch {}
  };

  // Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRequest(null);
        setInviteModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getProspectEmailDraft = (req: any) => {
    const firstName = req?.name ? req.name.trim().split(' ')[0] : 'there';
    const company = req?.company || 'your company';
    const volume = req?.volume || '$1M - $3M';
    return {
      subject: `WeaverFrame — Private OS Demonstration for ${company}`,
      body: `Hi ${firstName},

Thank you for requesting a private WeaverFrame demonstration for ${company}.

We reviewed your build volume profile (${volume}) and would be delighted to host an architectural walkthrough tailored to your custom home operations.

Could you let us know your availability for a 20-minute executive briefing this week? Alternatively, feel free to reply with a preferred date and time that works best for your schedule.

Looking forward to connecting with you.

Best regards,
WeaverFrame Executive Advisory`
    };
  };

  // Smart Domain-Aware Email Launcher (Gmail vs Outlook vs Default)
  const getEmailLauncher = (req: any) => {
    if (!req?.email) return { url: '#', label: 'Email Prospect', isWebmail: false };
    const draft = getProspectEmailDraft(req);

    if (adminEmail.endsWith('@gmail.com') || adminEmail.includes('google')) {
      return {
        url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(req.email)}&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`,
        label: 'Open in Gmail',
        isWebmail: true
      };
    }

    if (adminEmail.endsWith('@outlook.com') || adminEmail.endsWith('@hotmail.com') || adminEmail.endsWith('@live.com') || adminEmail.endsWith('@msn.com')) {
      return {
        url: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(req.email)}&subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`,
        label: 'Open in Outlook',
        isWebmail: true
      };
    }

    return {
      url: `mailto:${req.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`,
      label: 'Send Email',
      isWebmail: false
    };
  };

  const handleCopyDraft = (req: any) => {
    const draft = getProspectEmailDraft(req);
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopiedDraft(true);
    toast.success("Pre-composed email draft copied to clipboard");
    setTimeout(() => setCopiedDraft(false), 2500);
  };

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    try {
      const minSpin = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([router.invalidate(), minSpin]);
      toast.success("Feed updated with latest inquiries");
    } catch (err) {
      toast.error("Failed to refresh feed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenInvite = (company: string, email: string) => {
    setInviteCompany(company || "");
    setInviteEmail(email || "");
    setGeneratedInviteLink("");
    setInviteModalOpen(true);
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCompany.trim() || !inviteEmail.trim()) {
      toast.error("Please enter both company name and email");
      return;
    }
    setIsCreatingInvite(true);
    try {
      const res = await createBuilderInvite({
        data: {
          companyName: inviteCompany.trim(),
          email: inviteEmail.trim(),
        }
      });
      if (res?.inviteLink) {
        const fullUrl = `${window.location.origin}${res.inviteLink}`;
        setGeneratedInviteLink(fullUrl);
        toast.success("Builder account created & invite link generated");
        await router.invalidate();
      }
    } catch (err: any) {
      console.error("Failed to create invite:", err);
      toast.error(err?.message || "Failed to create builder invite");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopiedLink(true);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyText = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
    toast.success(`Copied ${type} to clipboard`);
  };

  const unseenRequestsCount = stats.demoRequests?.filter((r: any) => !seenIds.includes(r.id)).length || 0;

  return (
    <Shell title="Global Platform Overview">
      {/* ── 4 Metric Cards (Monochrome Luxury) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        <StatCard
          label="Recurring Revenue"
          value={`$${stats.totalMRR.toLocaleString()}`}
          icon={DollarSign}
          badge={stats.trends.mrr}
          sub={stats.totalMRR > 0 ? "Active paid builder plans" : "No paid plans active"}
        />
        <StatCard
          label="Active Builders"
          value={stats.activeBuilders.toString()}
          icon={Building2}
          badge={stats.trends.builders}
          sub={`${stats.activeBuilders} active builder clients`}
        />
        <StatCard
          label="Inbound Inquiries"
          value={stats.demoRequestsCount.toString()}
          icon={Activity}
          badge={unseenRequestsCount > 0 ? `${unseenRequestsCount} New` : "Active"}
          isHighlight={unseenRequestsCount > 0}
          sub={`${stats.demoRequestsCount} total walkthrough inquiries`}
        />
        <StatCard
          label="Total Leads Processed"
          value={stats.totalLeads.toLocaleString()}
          icon={Users}
          badge={stats.trends.leads}
          sub={`${stats.totalLeads} total leads in database`}
        />
      </div>

      {/* ── LIVE DEMO WALKTHROUGH REQUESTS FEED ── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-nevera text-base sm:text-lg text-foreground font-normal tracking-wide">
                  Inbound Demo & Walkthrough Inquiries
                </h3>
                {unseenRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border border-border bg-secondary text-foreground font-semibold">
                    {unseenRequestsCount} New
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                Prospective luxury builders and architectural clients who requested a private demonstration.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              to="/admin/demo-requests"
              className="text-xs font-mono text-[#c9a84c] dark:text-[#e5d9c5] hover:underline flex items-center gap-1 mr-2"
            >
              <span>Manage Demo Requests</span>
              <ArrowUpRight className="size-3.5" />
            </Link>

            <button
              onClick={handleRefreshFeed}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 text-[11px] font-mono tracking-wider uppercase border border-border hover:border-primary/40 bg-secondary/50 text-foreground rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#c9a84c] dark:text-[#e5d9c5]" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh Feed"}</span>
            </button>
          </div>
        </div>

        {/* Requests Cards Grid */}
        <div className={`transition-opacity duration-300 mt-5 ${isRefreshing ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        {(!stats.demoRequests || stats.demoRequests.length === 0) ? (
          <div className="py-12 text-center">
            <div className="size-12 rounded-full bg-secondary border border-border flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <Mail className="size-5" />
            </div>
            <p className="text-sm font-medium text-foreground">No Inquiries Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              When prospective clients submit the demonstration request form, their cards will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {stats.demoRequests.map((req: any) => {
              let volume = "$1M - $3M";
              let company = req.county || "Custom Builder";
              try {
                const mem = JSON.parse(req.leadMemory || "{}");
                if (mem.buildVolume) volume = mem.buildVolume;
                if (mem.company) company = mem.company;
              } catch {}

              const isUnseen = !seenIds.includes(req.id);
              const formattedDate = new Date(req.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={req.id}
                  onClick={() => {
                    markAsSeen(req.id);
                    setSelectedRequest({ ...req, volume, company, formattedDate });
                  }}
                  className={`p-4.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm relative overflow-hidden ${
                    isUnseen 
                      ? "border-border bg-secondary/60 hover:bg-secondary/90 hover:border-primary/40" 
                      : "border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="size-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs uppercase text-foreground shrink-0">
                          {req.name.slice(0, 2)}
                        </div>
                        {isUnseen && (
                          <span className="absolute -top-1 -right-1 size-2 rounded-full bg-[#c9a84c] dark:bg-[#e5d9c5]" />
                        )}
                      </div>
                      <div>
                        <h4 className={`text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2 ${
                          isUnseen ? "font-bold" : "font-normal text-foreground/85"
                        }`}>
                          <span>{req.name}</span>
                        </h4>
                        <span className="text-xs text-muted-foreground font-mono block mt-0.5">
                          {company}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-card text-muted-foreground">
                        {volume}
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{req.email}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0 opacity-75">
                      <Clock className="size-3" />
                      {formattedDate}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* ── PROSPECT DETAILS MODAL (OPENED ON CARD CLICK) ── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground p-1.5 rounded-lg border border-border bg-secondary cursor-pointer"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </button>

            {/* Header Profile */}
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border">
              <div className="size-14 rounded-xl bg-secondary border border-border flex items-center justify-center font-bold text-base uppercase text-foreground">
                {selectedRequest.name.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-nevera text-lg text-foreground font-semibold">
                    {selectedRequest.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border border-border bg-secondary text-muted-foreground">
                    Inbound Prospect
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground block mt-1">
                  {selectedRequest.company} · Submitted {selectedRequest.formattedDate}
                </span>
              </div>
            </div>

            {/* Structured Specifications Grid (Clean 4-Box Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Typical Build Volume
                </span>
                <span className="font-semibold text-sm text-foreground font-mono">
                  {selectedRequest.volume}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Inbound Channel
                </span>
                <span className="font-semibold text-sm text-foreground font-mono">
                  Website Demonstration Request
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Email Address
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground font-mono truncate">
                    {selectedRequest.email}
                  </span>
                  <button
                    onClick={() => handleCopyText(selectedRequest.email, 'email')}
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Phone Number
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground font-mono">
                    {selectedRequest.phone || "Not provided"}
                  </span>
                  {selectedRequest.phone && (
                    <button
                      onClick={() => handleCopyText(selectedRequest.phone, 'phone')}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy Phone"
                    >
                      {copiedPhone ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inbound Message Brief */}
            <div className="mb-6">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                Inbound Request Message
              </span>
              <div className="p-4 rounded-xl border border-border bg-secondary/20 font-mono text-xs text-foreground/90 leading-relaxed">
                {selectedRequest.messages?.[0]?.content || `Hello, I requested a private WeaverFrame demonstration for ${selectedRequest.company}. (Typical build volume: ${selectedRequest.volume})`}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedRequest.email && (() => {
                  const launcher = getEmailLauncher(selectedRequest);
                  return (
                    <a
                      href={launcher.url}
                      target={launcher.isWebmail ? "_blank" : undefined}
                      rel={launcher.isWebmail ? "noopener noreferrer" : undefined}
                      className="px-4 py-2 border border-border bg-secondary hover:bg-muted text-foreground text-xs font-mono uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      title={`Compose email using ${launcher.label}`}
                    >
                      <Send className="size-3.5" />
                      <span>{launcher.label}</span>
                    </a>
                  );
                })()}

                <Link
                  to="/admin/demo-requests"
                  className="px-3.5 py-2 border border-border hover:border-primary/40 bg-secondary hover:bg-muted text-foreground text-xs font-mono uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Open in Demo Requests Workspace"
                >
                  <Sparkles className="size-3.5 text-[#c9a84c] dark:text-[#e5d9c5]" />
                  <span>Open Request</span>
                </Link>

                <button
                  onClick={() => handleCopyDraft(selectedRequest)}
                  className="p-2 border border-border hover:border-primary/40 bg-secondary/50 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                  title="Copy pre-composed draft text"
                >
                  {copiedDraft ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const req = selectedRequest;
                    setSelectedRequest(null);
                    handleOpenInvite(req.company, req.email);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#e5d9c5] hover:bg-white text-black text-xs font-bold uppercase font-mono tracking-wider rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Invite as Builder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Management Quick Actions Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Info Panel */}
        <div className="lg:col-span-6 rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
                <Shield className="size-4" />
              </div>
              <div>
                <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                  Super Admin Management
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  WeaverFrame Master Control
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-light text-muted-foreground leading-relaxed mt-3">
              Manage builder accounts, send invites to new builder clients, adjust subscription plans, inspect system users, and configure global platform maintenance settings.
            </p>
          </div>

          <div className="pt-6 mt-6 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Database: Connected</span>
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Active
            </span>
          </div>
        </div>

        {/* Right Navigation Actions */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <QuickActionLink
            to="/admin/builders"
            title="Manage Builders"
            desc="Invite and manage builder accounts."
            icon={Building2}
          />
          <QuickActionLink
            to="/admin/billing"
            title="Billing & Plans"
            desc="Manage subscription tiers and pricing."
            icon={DollarSign}
          />
          <QuickActionLink
            to="/admin/users"
            title="Users Directory"
            desc="View all users across all accounts."
            icon={Users}
          />
          <QuickActionLink
            to="/admin/settings"
            title="Platform Settings"
            desc="Global maintenance and support email."
            icon={Shield}
          />
        </div>
      </div>

      {/* ── QUICK INVITE BUILDER MODAL ── */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
                <Building2 className="size-4" />
              </div>
              <div>
                <h3 className="font-nevera text-base text-foreground font-semibold">
                  Convert Demo Prospect to Builder
                </h3>
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Generate Onboarding Invite Link
                </span>
              </div>
            </div>

            {!generatedInviteLink ? (
              <form onSubmit={handleGenerateInvite} className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteCompany}
                    onChange={(e) => setInviteCompany(e.target.value)}
                    placeholder="e.g. Nexora Luxury Homes"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Owner Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="prospect@company.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingInvite}
                    className="px-5 py-2.5 bg-[#e5d9c5] hover:bg-white text-black text-xs font-bold uppercase font-mono tracking-wider rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingInvite ? "Creating..." : "Generate Invite Link"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                  ✓ Builder account created for <strong>{inviteCompany}</strong>!
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">
                    One-Time Onboarding Invite Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-2.5 bg-[#e5d9c5] hover:bg-white text-black rounded-lg transition-all shrink-0 cursor-pointer"
                      title="Copy Link"
                    >
                      {copiedLink ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 bg-secondary text-foreground text-xs font-mono uppercase rounded-lg border border-border hover:bg-muted"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

function StatCard({ label, value, icon: Icon, sub, badge, isHighlight }: any) {
  return (
    <div className={`rounded-xl border bg-card p-5 flex flex-col justify-between hover:border-primary/40 transition-all duration-200 shadow-sm ${
      isHighlight ? "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.04] to-transparent" : "border-border"
    }`}>
      <div>
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-[11px] font-mono uppercase tracking-wider">{label}</span>
          <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
            <Icon className="size-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          <div className="font-nevera text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
            {value}
          </div>
          {badge && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
              {badge}
            </span>
          )}
        </div>
      </div>
      {sub && <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">{sub}</p>}
    </div>
  );
}

function QuickActionLink({ to, title, desc, icon: Icon }: any) {
  return (
    <Link
      to={to}
      className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-200 flex items-center justify-between group shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5] group-hover:border-primary/40 transition-colors shrink-0">
          <Icon className="size-4" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h4>
          <p className="text-[11px] font-light text-muted-foreground mt-0.5 line-clamp-1">
            {desc}
          </p>
        </div>
      </div>
      <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-1.5" />
    </Link>
  );
}

