import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { getSessionFn } from "@/lib/auth";
import { Shell } from "@/components/dashboard/Shell";
import { getAdminStats } from "@/lib/admin";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { Users, DollarSign, Activity, Building2, Shield, ArrowUpRight, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";

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
    if (typeof window === 'undefined') return { totalMRR: 0, activeBuilders: 0, totalLeads: 0, trends: { mrr: '', builders: '', leads: '' } };
    return getAdminStats();
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Global Platform Overview" type="overview" />,
  component: AdminOverview,
});

function AdminOverview() {
  const stats = Route.useLoaderData();

  return (
    <Shell title="Global Platform Overview">
      {/* ── 3 Authentic DB Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-8">
        <StatCard
          label="Recurring Revenue (MRR)"
          value={`$${stats.totalMRR.toLocaleString()}`}
          icon={DollarSign}
          sub={stats.totalMRR > 0 ? "Active paid builder subscriptions" : "No paid subscriptions active yet"}
        />
        <StatCard
          label="Active Builders"
          value={stats.activeBuilders.toString()}
          icon={Building2}
          sub={`${stats.activeBuilders} registered builder accounts`}
        />
        <StatCard
          label="Total Leads Processed"
          value={stats.totalLeads.toLocaleString()}
          icon={Activity}
          sub={`${stats.totalLeads} total leads in database`}
        />
      </div>

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
    </Shell>
  );
}

function StatCard({ label, value, icon: Icon, sub }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 flex flex-col justify-between hover:border-primary/40 transition-all duration-200 shadow-sm">
      <div>
        <div className="flex items-center justify-between text-muted-foreground mb-3">
          <span className="text-[11px] font-mono uppercase tracking-wider">{label}</span>
          <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
            <Icon className="size-4" />
          </div>
        </div>
        <div className="font-nevera text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
          {value}
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
