import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card, Badge } from "@/components/dashboard/primitives";
import { CustomSelect } from "@/components/dashboard/CustomSelect";
import { getBuildersData, getAdminStats, updateBuilderPlan } from "@/lib/admin";
import { getSessionFn } from "@/lib/auth";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { DollarSign, CreditCard, Sparkles, Building2, RefreshCw, CheckCircle2 } from "lucide-react";

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

const planOptions = [
  { label: "Free Trial (14 Days)", value: "trial" },
  { label: "Professional ($399/mo)", value: "professional" },
  { label: "Enterprise Scale ($799/mo)", value: "enterprise" },
];

function AdminBillingRoute() {
  const { builders, stats } = Route.useLoaderData();
  const router = useRouter();

  const handlePlanChange = async (builderId: string, plan: string) => {
    try {
      await updateBuilderPlan({ data: { builderId, plan } });
      await router.invalidate();
    } catch (err) {
      alert("Failed to update plan");
    }
  };

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
            ${stats.totalMRR.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
            {stats.totalMRR > 0 ? "From active paid subscriptions" : "No paid subscriptions currently"}
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

      {/* ── Subscriptions Table ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
            Tenant Subscription Matrix
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {builders.length} Total Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.16em] bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Builder Organization</th>
                <th className="px-6 py-4 font-semibold">Tier Status</th>
                <th className="px-6 py-4 font-semibold text-right">Contract Value</th>
                <th className="px-6 py-4 font-semibold text-right">Manage Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {builders.map(builder => {
                const planValue = builder.plan === 'enterprise' ? 799 : builder.plan === 'trial' ? 0 : 399;
                return (
                  <tr key={builder.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center font-nevera text-xs font-bold text-[#c9a84c] dark:text-[#e5d9c5]">
                          {builder.companyName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors block">
                            {builder.companyName}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            ID: {builder.id.slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold tracking-wider ${
                        builder.plan === 'enterprise' 
                          ? 'bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30 dark:border-[#e5d9c5]/30' 
                          : builder.plan === 'trial' 
                            ? 'bg-muted text-muted-foreground border border-border' 
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {builder.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-foreground font-medium">
                      ${planValue}/mo
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <CustomSelect 
                          value={builder.plan}
                          onChange={(val) => handlePlanChange(builder.id, val)}
                          options={planOptions}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {builders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-xs font-mono">
                    No subscriptions found in registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
