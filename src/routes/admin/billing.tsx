import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { getBuildersData, getAdminStats, updateBuilderPlan } from "@/lib/admin";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { 
  DollarSign, 
  CreditCard, 
  Sparkles, 
  Building2, 
  Check, 
  ChevronRight, 
  ChevronsUpDown, 
  Search, 
  CheckCircle2,
  Zap,
  ShieldCheck,
  RefreshCw,
  Loader2
} from "lucide-react";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Subscriptions — WeaverFrame HQ" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: () => {
    if (typeof window === 'undefined') return { builders: [], stats: { totalMRR: 0, activeBuilders: 0, totalLeads: 0, trends: { mrr: '', builders: '', leads: '' } } };
    return Promise.all([getBuildersData(), getAdminStats()]).then(([builders, stats]) => ({ builders, stats }));
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Subscriptions & Billing" type="reviews" />,
  component: AdminBillingRoute,
});

const planTiers = [
  {
    id: "trial",
    name: "Free Trial",
    price: "$0",
    period: "/ 14 days",
    badge: "EVALUATION",
    description: "Sandbox evaluation with standard lead capture & simulation.",
    features: ["Standard Lead Ingestion", "Automated AI Email Outreach"]
  },
  {
    id: "starter",
    name: "Starter",
    price: "$149",
    period: "/ month",
    badge: "STARTER",
    description: "Up to 50 leads/month. Autonomous email follow-ups & AI qualification.",
    features: ["Up to 50 Leads / Month", "Smart Lead Memory & Scoring", "High-Alert Notifications"]
  },
  {
    id: "growth",
    name: "Growth",
    price: "$349",
    period: "/ month",
    badge: "RECOMMENDED",
    description: "Up to 200 leads/month. Full AI sales concierge & live walkthrough booking.",
    features: ["Up to 200 Leads / Month", "Live Calendar Booking", "Multi-Turn AI Sales Brain"]
  }
];

function AdminBillingRoute() {
  const { builders, stats } = Route.useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [updatingState, setUpdatingState] = useState<{ builderId: string; tierId: string } | null>(null);
  const router = useRouter();

  // Filter builders based on search query
  const filteredBuilders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return builders;
    return builders.filter(b => 
      b.companyName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.plan || '').toLowerCase().includes(q)
    );
  }, [builders, searchQuery]);

  const toggleGroup = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      const isExpanding = !next.has(key);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      // Auto-scroll expanded card smoothly into view
      if (isExpanding) {
        setTimeout(() => {
          const el = document.getElementById(`builder-billing-${key}`);
          if (el) {
            const yOffset = -90;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 120);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(filteredBuilders.map(b => b.id)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const isGroupExpanded = (key: string) => {
    if (searchQuery.trim().length > 0) return true;
    return expandedKeys.has(key);
  };

  const handlePlanChange = async (builderId: string, plan: string) => {
    setUpdatingState({ builderId, tierId: plan });
    try {
      await updateBuilderPlan({ data: { builderId, plan } });
      await router.invalidate();
    } catch (err) {
      alert("Failed to update plan");
    } finally {
      setUpdatingState(null);
    }
  };

  // Compute live real-time MRR directly from builders
  const liveTotalMRR = useMemo(() => {
    return builders.reduce((acc, b) => {
      const plan = (b.plan || 'trial').toLowerCase();
      if (plan === 'growth' || plan === 'enterprise') return acc + 349;
      if (plan === 'starter' || plan === 'professional') return acc + 149;
      return acc;
    }, 0);
  }, [builders]);

  return (
    <Shell title="Subscriptions & Billing">
      {/* ── 3 Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-8">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider">Estimated MRR</span>
            <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="font-nevera text-2xl sm:text-3xl font-normal text-foreground">
            ${liveTotalMRR.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
            {liveTotalMRR > 0 ? "From active paid subscriptions" : "No paid subscriptions currently"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider">Active Subscriptions</span>
            <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="font-nevera text-2xl sm:text-3xl font-normal text-foreground">
            {builders.filter(b => b.plan !== 'trial').length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
            Paying builder accounts
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider">Builders on Trial</span>
            <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="font-nevera text-2xl sm:text-3xl font-normal text-foreground">
            {builders.filter(b => b.plan === 'trial').length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
            Active evaluation accounts
          </p>
        </div>
      </div>

      {/* ── Top Bar: Search, Title & Expand Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-nevera text-lg text-foreground font-normal tracking-wide">
            Tenant Subscription Matrix
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredBuilders.length} {filteredBuilders.length === 1 ? 'Client Organization' : 'Client Organizations'} &middot; Manage subscription tiers & contract values
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search builders or plans..."
              className="w-64 sm:w-72 bg-card border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none shadow-sm transition-all"
            />
          </div>

          <button
            onClick={expandedKeys.size > 0 ? collapseAll : expandAll}
            className="px-3 py-2 text-xs font-mono font-medium rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            title={expandedKeys.size > 0 ? "Collapse All" : "Expand All"}
          >
            <ChevronsUpDown className="size-3.5" />
            <span className="hidden md:inline">{expandedKeys.size > 0 ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Tenant Subscription Cards ── */}
      <div className="space-y-3">
        {filteredBuilders.map(builder => {
          const expanded = isGroupExpanded(builder.id);
          const planValue = (builder.plan === 'growth' || builder.plan === 'enterprise') ? 349 : builder.plan === 'trial' ? 0 : 149;
          const annualValue = planValue * 12;
          const initials = builder.companyName
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const isUpdatingThisBuilder = updatingState?.builderId === builder.id;

          return (
            <div 
              key={builder.id} 
              id={`builder-billing-${builder.id}`}
              className={`rounded-2xl border transition-all duration-200 bg-card overflow-hidden shadow-sm scroll-mt-24 ${
                expanded ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-border'
              }`}
            >
              {/* Card Header (Click to Toggle Accordion) */}
              <div
                onClick={() => toggleGroup(builder.id)}
                className="p-4 sm:p-4.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors select-none group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-6 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                    expanded ? 'rotate-90 text-[#c9a84c] dark:text-[#e5d9c5]' : ''
                  }`}>
                    <ChevronRight className="size-4" />
                  </div>

                  <div className="size-8.5 rounded-xl bg-secondary border border-border flex items-center justify-center font-nevera text-xs font-bold text-[#c9a84c] dark:text-[#e5d9c5] shrink-0">
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-medium text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                        {builder.companyName}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-semibold tracking-wider ${
                        builder.plan === 'enterprise'
                          ? 'bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30'
                          : builder.plan === 'trial'
                            ? 'bg-muted text-muted-foreground border border-border'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {builder.plan ? builder.plan.toUpperCase() : 'TRIAL'}
                      </span>
                      {isUpdatingThisBuilder && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] dark:text-[#e5d9c5] text-[9.5px] font-mono font-bold animate-pulse">
                          <RefreshCw className="size-2.5 animate-spin" />
                          UPDATING...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-light mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px]">ID: {builder.id.slice(0, 12)}...</span>
                      {builder.users && (
                        <>
                          <span className="opacity-40">&middot;</span>
                          <span>{builder.users.length} {builder.users.length === 1 ? 'user account' : 'user accounts'}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-sm font-mono font-bold text-foreground block">
                      ${planValue}/mo
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      ${annualValue.toLocaleString()}/yr contract
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary text-xs font-mono text-foreground group-hover:border-primary/40 transition-colors">
                    <span>{expanded ? "Collapse" : "Change Plan"}</span>
                  </div>
                </div>
              </div>

              {/* Card Expanded Content: Balanced 3-Column Informative Plan Cards */}
              {expanded && (
                <div className="border-t border-border/80 bg-muted/10 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-150">
                  {/* Summary Strip */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-muted-foreground uppercase tracking-wider font-semibold">
                        Plan Management:
                      </span>
                      <span className="text-foreground font-medium">
                        {builder.companyName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      {isUpdatingThisBuilder ? (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#c9a84c]/15 border border-[#c9a84c]/35 text-[#c9a84c] dark:text-[#e5d9c5] font-bold animate-pulse">
                          <RefreshCw className="size-3 animate-spin" />
                          <span>Updating subscription tier...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-foreground">Active Subscription</span>
                          </div>
                          <span className="opacity-40">&middot;</span>
                          <span>Run-rate: <strong className="text-foreground">${annualValue.toLocaleString()}/yr</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 3 Compact Plan Cards Side-by-Side */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {planTiers.map(tier => {
                      const isActive = (builder.plan || 'trial').toLowerCase() === tier.id;
                      const isUpdatingThisTier = isUpdatingThisBuilder && updatingState?.tierId === tier.id;

                      return (
                        <div
                          key={tier.id}
                          onClick={() => !isActive && !isUpdatingThisBuilder && handlePlanChange(builder.id, tier.id)}
                          className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between select-none ${
                            isActive
                              ? "bg-card border-primary ring-1 ring-primary/30 shadow-md cursor-default"
                              : isUpdatingThisBuilder
                                ? "bg-card/40 border-border opacity-70 cursor-wait"
                                : "bg-card/40 border-border hover:border-primary/40 hover:bg-card/90 cursor-pointer"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                                {tier.name}
                              </span>
                              {isActive && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-mono font-bold">
                                  <Check className="size-2.5" />
                                  CURRENT
                                </span>
                              )}
                            </div>

                            <div className="flex items-baseline gap-1 my-2">
                              <span className="font-nevera text-2xl text-foreground font-normal">
                                {tier.price}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {tier.period}
                              </span>
                            </div>

                            <p className="text-[11px] text-muted-foreground font-light mb-3 line-clamp-2">
                              {tier.description}
                            </p>

                            {/* Features list */}
                            <div className="space-y-1.5 pt-2.5 border-t border-border/50">
                              {tier.features.map((feat, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                                  <CheckCircle2 className={`size-3 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                  <span className="truncate">{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Action Button with Loading Spinner */}
                          <div className="mt-4 pt-2">
                            <button
                              type="button"
                              disabled={isActive || isUpdatingThisBuilder}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isActive && !isUpdatingThisBuilder) handlePlanChange(builder.id, tier.id);
                              }}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                isActive
                                  ? "bg-secondary text-primary border border-border cursor-default"
                                  : isUpdatingThisTier
                                    ? "bg-primary/80 text-primary-foreground cursor-wait animate-pulse"
                                    : isUpdatingThisBuilder
                                      ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                                      : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                              }`}
                            >
                              {isUpdatingThisTier ? (
                                <>
                                  <RefreshCw className="size-3.5 animate-spin" />
                                  <span>Updating Tier...</span>
                                </>
                              ) : isActive ? (
                                "Active Plan"
                              ) : (
                                `Switch to ${tier.name}`
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredBuilders.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground font-mono text-xs shadow-sm">
            No builder organizations found matching your search.
          </div>
        )}
      </div>
    </Shell>
  );
}

