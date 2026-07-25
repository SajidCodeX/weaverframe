import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card } from "@/components/dashboard/primitives";
import { getSessionFn } from "@/lib/auth";
import { getPlatformSettings, updatePlatformSettings, getBlockedUsers, toggleUserStatus } from "@/lib/admin";
import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    if (typeof window === 'undefined') return { settings: { supportEmail: '', defaultTrialDays: 14, maintenanceMode: false }, blockedUsers: [] };
    const settings = await getPlatformSettings();
    const blockedUsers = await getBlockedUsers();
    return { settings, blockedUsers };
  },
  head: () => ({
    meta: [
      { title: "Platform Settings — WeaverFrame Admin" },
    ],
  }),
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
      alert('Settings saved successfully!');
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Platform Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure global platform integrations and defaults.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">General Preferences</h3>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Support Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#666]" 
              />
              <p className="text-xs text-muted-foreground mt-1">This email will receive alerts for new signups and billing issues.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Default Trial Period (Days)</label>
              <input 
                type="number" 
                value={trialDays}
                onChange={e => setTrialDays(Number(e.target.value))}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#666]" 
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-3">Theme Preference</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                    theme === "light" 
                      ? "bg-white text-black border-white" 
                      : "bg-[#0a0a0a] text-muted-foreground border-[#333] hover:text-white"
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                    theme === "dark" 
                      ? "bg-white text-black border-white" 
                      : "bg-[#0a0a0a] text-muted-foreground border-[#333] hover:text-white"
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                    theme === "system" 
                      ? "bg-white text-black border-white" 
                      : "bg-[#0a0a0a] text-muted-foreground border-[#333] hover:text-white"
                  }`}
                >
                  System
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-red-900/30">
          <h3 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h3>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Maintenance Mode</h4>
              <p className="text-xs text-muted-foreground mt-1">Disable builder logins and show a maintenance page. Admins can still log in.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={maintenance}
                onChange={e => setMaintenance(e.target.checked)}
              />
              <div className="w-11 h-6 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-white">Blocked & Suspended Users</h3>
            <p className="text-sm text-muted-foreground mt-1">Review all users currently prevented from accessing the platform.</p>
          </div>
          <div className="divide-y divide-border">
            {blockedUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No blocked users found.
              </div>
            ) : (
              blockedUsers.map((user: any) => (
                <div key={user.id} className="p-4 px-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="font-medium text-sm text-foreground">{user.displayName}</div>
                    <div className="text-xs text-muted-foreground">{user.email} &middot; {user.builder ? user.builder.companyName : "Platform"}</div>
                  </div>
                  <button 
                    onClick={() => handleUnblock(user.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded transition-colors bg-[#0a0a0a] border border-[#333] hover:bg-white/10 text-white"
                  >
                    Unblock User
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
