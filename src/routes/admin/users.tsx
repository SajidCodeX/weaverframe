import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { getGlobalUsersData, toggleUserStatus, deleteUser } from "@/lib/admin";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { Users, Shield, Building2, ChevronRight, ChevronDown, Trash2, Search, ChevronsUpDown } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Global Users — WeaverFrame HQ" },
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
    if (typeof window === 'undefined') return [];
    return getGlobalUsersData();
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Global Users Directory" type="team" />,
  component: GlobalUsersRoute,
});

function GlobalUsersRoute() {
  const users = Route.useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const router = useRouter();

  // Group users by client / tenant organization
  const clientGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      name: string;
      isPlatformHq: boolean;
      plan?: string;
      isActive?: boolean;
      ownerEmail?: string;
      users: any[];
    }>();

    for (const u of users) {
      if (!u.builder) {
        // Platform HQ / Super Admin
        const key = '__platform_hq__';
        if (!map.has(key)) {
          map.set(key, {
            key,
            name: 'Platform HQ (Super Admins)',
            isPlatformHq: true,
            plan: 'SYSTEM',
            isActive: true,
            users: []
          });
        }
        map.get(key)!.users.push(u);
      } else {
        const key = u.builder.id || u.builder.companyName;
        if (!map.has(key)) {
          map.set(key, {
            key,
            name: u.builder.companyName,
            isPlatformHq: false,
            plan: u.builder.plan,
            isActive: u.builder.isActive ?? true,
            ownerEmail: u.builder.email,
            users: []
          });
        }
        map.get(key)!.users.push(u);
      }
    }

    return Array.from(map.values());
  }, [users]);

  // Filter groups based on search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clientGroups;

    return clientGroups
      .map(group => {
        const matchesGroupName = group.name.toLowerCase().includes(q);
        const matchingUsers = group.users.filter(u =>
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.builderRole || '').toLowerCase().includes(q)
        );

        if (matchesGroupName) {
          return group;
        }
        if (matchingUsers.length > 0) {
          return {
            ...group,
            users: matchingUsers
          };
        }
        return null;
      })
      .filter(Boolean) as typeof clientGroups;
  }, [clientGroups, searchQuery]);

  const toggleGroup = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(filteredGroups.map(g => g.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const isGroupExpanded = (key: string) => {
    if (searchQuery.trim().length > 0) return true;
    return expandedKeys.has(key);
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleUserStatus({ data: id });
      await router.invalidate();
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete the user "${name}"?`)) {
      try {
        await deleteUser({ data: id });
        await router.invalidate();
      } catch (err) {
        alert('Failed to delete user');
      }
    }
  };

  const totalVisibleUsers = filteredGroups.reduce((acc, g) => acc + g.users.length, 0);

  return (
    <Shell title="Global Users Directory">
      {/* ── Top Bar: Search, Stats & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-nevera text-lg text-foreground font-normal tracking-wide">
            Client Organizations & Teams
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredGroups.length} {filteredGroups.length === 1 ? 'Client Organization' : 'Client Organizations'} &middot; {totalVisibleUsers} total users
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search clients or users..."
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

      {/* ── Client Cards / Accordions ── */}
      <div className="space-y-3.5">
        {filteredGroups.map(group => {
          const expanded = isGroupExpanded(group.key);
          const initials = group.isPlatformHq 
            ? "HQ" 
            : group.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

          return (
            <div 
              key={group.key} 
              className={`rounded-2xl border transition-all duration-200 bg-card overflow-hidden shadow-sm ${
                expanded ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-border'
              }`}
            >
              {/* Client Accordion Header */}
              <div
                onClick={() => toggleGroup(group.key)}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors select-none group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`size-6 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                    expanded ? 'rotate-90 text-[#c9a84c] dark:text-[#e5d9c5]' : ''
                  }`}>
                    <ChevronRight className="size-4" />
                  </div>

                  <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center font-nevera text-xs font-bold text-[#c9a84c] dark:text-[#e5d9c5] shrink-0">
                    {group.isPlatformHq ? <Shield className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" /> : initials}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-medium text-sm sm:text-base text-foreground group-hover:text-primary transition-colors truncate">
                        {group.name}
                      </h3>
                      {group.plan && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-semibold tracking-wider ${
                          group.isPlatformHq
                            ? 'bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30'
                            : group.plan === 'enterprise'
                              ? 'bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30'
                              : group.plan === 'trial'
                                ? 'bg-muted text-muted-foreground border border-border'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {group.plan.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-light mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{group.users.length} {group.users.length === 1 ? 'associated account' : 'associated accounts'}</span>
                      {!group.isPlatformHq && (group.ownerEmail || group.users[0]?.email) && (
                        <>
                          <span className="opacity-40">&middot;</span>
                          <span className="font-mono text-[11px] text-muted-foreground truncate">
                            {group.ownerEmail || group.users.find(u => u.builderRole === 'owner')?.email || group.users[0].email}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    group.isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  }`}>
                    <span className={`size-1.5 rounded-full ${group.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {group.isActive ? 'Active Client' : 'Suspended'}
                  </span>

                  <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-lg border border-border">
                    <Users className="size-3.5 text-[#c9a84c] dark:text-[#e5d9c5]" />
                    <span>{group.users.length}</span>
                  </span>
                </div>
              </div>

              {/* Expanded Client Users Table */}
              {expanded && (
                <div className="border-t border-border bg-muted/15 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.16em] bg-muted/40 border-b border-border">
                        <tr>
                          <th className="px-6 py-3 font-semibold">User Profile</th>
                          <th className="px-6 py-3 font-semibold">Email Address</th>
                          <th className="px-6 py-3 font-semibold">Access Level</th>
                          <th className="px-6 py-3 font-semibold text-right">Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Security Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.users.map((user: any) => {
                          const userInitials = (user.displayName || user.email || 'U')
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="size-7 rounded-full bg-secondary border border-border text-[#c9a84c] dark:text-[#e5d9c5] flex items-center justify-center font-nevera text-[11px] font-bold shrink-0">
                                    {userInitials}
                                  </div>
                                  <span className="font-medium text-xs sm:text-sm text-foreground">
                                    {user.displayName || "Anonymous User"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-muted-foreground font-mono text-xs">
                                {user.email}
                              </td>
                              <td className="px-6 py-3.5">
                                {user.role === 'admin' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold tracking-wider bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30">
                                    <Shield className="size-2.5" />
                                    SUPER ADMIN
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9.5px] font-mono tracking-wider uppercase ${
                                    user.builderRole === 'owner'
                                      ? 'bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30 font-semibold'
                                      : 'bg-muted text-foreground/80 border border-border'
                                  }`}>
                                    {user.builderRole || 'MEMBER'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-medium ${
                                  user.isActive 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                }`}>
                                  <span className={`size-1 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  {user.isActive ? 'Active' : 'Suspended'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(user.id); }}
                                    disabled={user.role === 'admin'}
                                    className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                      user.role === 'admin' 
                                        ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground' 
                                        : user.isActive 
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' 
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                                    }`}
                                  >
                                    {user.isActive ? 'Suspend' : 'Activate'}
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(user.id, user.displayName); }}
                                    disabled={user.role === 'admin'}
                                    className={`text-[11px] font-mono font-medium px-2 py-1 rounded-lg transition-colors border cursor-pointer ${
                                      user.role === 'admin'
                                        ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground border-transparent'
                                        : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/25'
                                    }`}
                                    title="Delete User"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground text-xs font-mono">
            No client organizations or users match your search query.
          </div>
        )}
      </div>
    </Shell>
  );
}
