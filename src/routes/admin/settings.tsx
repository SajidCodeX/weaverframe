import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card } from "@/components/dashboard/primitives";
import { getSessionFn } from "@/lib/auth";
import { getPlatformSettings, updatePlatformSettings, getBlockedUsers, toggleUserStatus } from "@/lib/admin";
import { useTheme } from "@/components/ThemeProvider";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { useState } from "react";
import { Shield, Mail, Clock, Palette, AlertTriangle, UserCheck, Check, Save } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — WeaverFrame HQ" },
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
    if (typeof window === 'undefined') return { settings: { supportEmail: '', defaultTrialDays: 14, maintenanceMode: false }, blockedUsers: [] };
    return Promise.all([getPlatformSettings(), getBlockedUsers()]).then(([settings, blockedUsers]) => ({ settings, blockedUsers }));
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Platform Settings" type="settings" />,
  component: AdminSettingsRoute,
});

function AdminSettingsRoute() {
  const { settings, blockedUsers } = Route.useLoaderData();
  const { theme, setTheme } = useTheme();
  
  const [email, setEmail] = useState(settings.supportEmail);
  const [trialDays, setTrialDays] = useState(settings.defaultTrialDays);
  const [maintenance, setMaintenance] = useState(settings.maintenanceMode);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePlatformSettings({ 
        data: { 
          supportEmail: email, 
          defaultTrialDays: Number(trialDays), 
          maintenanceMode: maintenance 
        } 
      });
      await router.invalidate();
      alert('Platform settings saved successfully!');
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      await toggleUserStatus({ data: id });
      await router.invalidate();
    } catch (err) {
      alert('Failed to unblock user');
    }
  };

  return (
    <Shell title="Platform Settings">
      {/* ── Top Actions Bar ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <span className="text-xs font-mono uppercase tracking-wider text-white/50">
          Global Environment & Governance
        </span>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2 rounded-lg shadow-md disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Save className="size-3.5" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* ── General Preferences ── */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Mail className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
            <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
              General Preferences
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5 font-light">
            Configure default operational settings and alert addresses.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                Super Admin Support / Alert Email
              </label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full max-w-xl bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all" 
                placeholder="ops@weaverframe.online"
              />
              <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                Receives system webhooks, billing notifications, and high-priority infrastructure alerts.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                Default Builder Evaluation Window (Days)
              </label>
              <input 
                type="number" 
                value={trialDays}
                onChange={e => setTrialDays(Number(e.target.value))}
                className="w-48 bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all" 
              />
              <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                Duration of trial access before tenant tier auto-locks to read-only.
              </p>
            </div>
          </div>
        </div>

        {/* ── Appearance Theme ── */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Palette className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
            <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
              Interface Theme
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5 font-light">
            Select your preferred interface theme for the admin console.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme("dark")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border cursor-pointer ${
                theme === "dark" 
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm" 
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border"
              }`}
            >
              Dark (Default)
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border cursor-pointer ${
                theme === "light" 
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm" 
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border cursor-pointer ${
                theme === "system" 
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm" 
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border"
              }`}
            >
              System Auto
            </button>
          </div>
        </div>

        {/* ── Danger Zone: Maintenance Mode ── */}
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-card p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <AlertTriangle className="size-4 text-red-500 dark:text-red-400" />
            <h3 className="font-nevera text-base text-red-500 dark:text-red-400 font-normal tracking-wide">
              Emergency Maintenance Mode
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-red-500/20">
            <div>
              <h4 className="text-sm font-medium text-foreground">Global Maintenance Mode</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                Instantly disconnects all builder portal logins and displays a luxury maintenance notice. Super Admins retain full console access.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={maintenance}
                onChange={e => setMaintenance(e.target.checked)}
              />
              <div className="w-12 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 border border-border"></div>
            </label>
          </div>
        </div>

        {/* ── Blocked & Suspended Users ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
                Suspended Access Registry
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accounts locked from accessing tenant or platform interfaces.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {blockedUsers.length} Suspended
            </span>
          </div>

          <div className="divide-y divide-border">
            {blockedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                All accounts are in good standing. Zero active suspensions.
              </div>
            ) : (
              blockedUsers.map((user: any) => (
                <div key={user.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="font-medium text-sm text-foreground">{user.displayName || "Anonymous User"}</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {user.email} &middot; {user.builder ? user.builder.companyName : "Platform Level"}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUnblock(user.id)}
                    className="text-xs font-mono font-medium px-3.5 py-1.5 rounded-lg transition-colors bg-secondary border border-border hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-foreground cursor-pointer"
                  >
                    Lift Suspension
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
