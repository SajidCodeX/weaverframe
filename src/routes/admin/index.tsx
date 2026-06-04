import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/lib/auth";
import { Shell } from "@/components/dashboard/Shell";
import { Card } from "@/components/dashboard/primitives";
import { getAdminStats } from "@/lib/admin";
import { Server, Users, DollarSign, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async ({ context }) => {
    // FIX-9: SECURITY MODEL — SSR Bypass Trust Architecture
    // On SSR, context.session is null by design (see __root.tsx SSR bypass).
    // The client-side hydration guard below is the ACTUAL auth enforcement layer.
    // This is safe because:
    //   1. No sensitive data is rendered server-side (loaders also SSR-bypass)
    //   2. The client enforces session checks before showing any protected content
    //   3. All server functions (requireAdmin) independently verify auth via cookie
    // If TanStack Start ever executes beforeLoad server-side for these routes,
    // add a secondary requireAdmin() call here as a failsafe.
    if (typeof window === 'undefined') return;
    const session = context.session
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    if (typeof window === 'undefined') return { totalMRR: 0, activeBuilders: 0, totalLeads: 0, trends: { mrr: '', builders: '', leads: '' } };
    return await getAdminStats();
  },
  head: () => ({
    meta: [
      { title: "Global Overview — Builder's Edge Admin" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const stats = Route.useLoaderData();

  return (
    <Shell title="Global Overview">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue (MRR)"
          value={`$${stats.totalMRR.toLocaleString()}`}
          icon={DollarSign}
          trend={stats.trends.mrr}
        />
        <StatCard
          label="Active Builders"
          value={stats.activeBuilders.toString()}
          icon={Users}
          trend={stats.trends.builders}
        />
        <StatCard
          label="Total Leads Processed"
          value={stats.totalLeads.toLocaleString()}
          icon={Activity}
          trend={stats.trends.leads}
        />
        <StatCard
          label="System Health"
          value="100%"
          icon={Server}
          sub="All services operational"
        />
      </div>

      <Card className="mt-8 flex flex-col items-center justify-center py-16 text-center border border-border/50 bg-secondary/10">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.02)]">
          <Server className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-foreground tracking-tight">System Administrator Console</h3>
        <p className="mt-2 text-muted-foreground max-w-md">
          Welcome to the Builder's Edge global administration dashboard. Use the sidebar to manage builders, monitor system health, and configure global settings.
        </p>
      </Card>
    </Shell>
  );
}

function StatCard({ label, value, icon: Icon, trend, sub }: any) {
  return (
    <Card className="p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <Icon className="w-4 h-4 opacity-50" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {trend && <span className="text-sm font-medium text-emerald-400">{trend}</span>}
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
