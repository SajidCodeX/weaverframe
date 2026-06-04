import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card, Badge } from "@/components/dashboard/primitives";
import { CustomSelect } from "@/components/dashboard/CustomSelect";
import { getBuildersData, getAdminStats, updateBuilderPlan } from "@/lib/admin";
import { getSessionFn } from "@/lib/auth";

export const Route = createFileRoute("/admin/billing")({
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    if (typeof window === 'undefined') return { builders: [], stats: { totalMRR: 0, activeBuilders: 0, totalLeads: 0, trends: { mrr: '', builders: '', leads: '' } } };
    const builders = await getBuildersData();
    const stats = await getAdminStats();
    return { builders, stats };
  },
  head: () => ({
    meta: [
      { title: "Billing & Subscriptions — Builder's Edge Admin" },
    ],
  }),
  component: AdminBillingRoute,
});

const planOptions = [
  { label: "Trial", value: "trial" },
  { label: "Professional", value: "professional" },
  { label: "Enterprise", value: "enterprise" },
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Subscription Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage builder billing, trials, and platform revenue.</p>
        </div>
        <button className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
          Sync with Stripe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Estimated MRR</div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold text-foreground">${stats.totalMRR.toLocaleString()}</div>
            <div className={`text-sm font-medium ${stats.trends.mrr.startsWith('+') ? 'text-success' : 'text-danger'}`}>{stats.trends.mrr}</div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Active Subscriptions</div>
          <div className="text-3xl font-bold text-foreground">{builders.filter(b => b.plan !== 'trial').length}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Builders on Trial</div>
          <div className="text-3xl font-bold text-foreground">{builders.filter(b => b.plan === 'trial').length}</div>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Builder</th>
                <th className="px-6 py-3 font-semibold">Current Plan</th>
                <th className="px-6 py-3 font-semibold text-right">Estimated Value</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {builders.map(builder => {
                const planValue = builder.plan === 'enterprise' ? 999 : builder.plan === 'trial' ? 0 : 299;
                return (
                  <tr key={builder.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{builder.companyName}</td>
                    <td className="px-6 py-4">
                      <Badge tone={builder.plan === 'enterprise' ? 'success' : builder.plan === 'trial' ? 'neutral' : 'info'}>
                        {builder.plan.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
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
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No subscriptions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}
