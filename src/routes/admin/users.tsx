import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card, Badge } from "@/components/dashboard/primitives";
import { getGlobalUsersData, toggleUserStatus, deleteUser } from "@/lib/admin";
import { getSessionFn } from "@/lib/auth";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => await getGlobalUsersData(),
  head: () => ({
    meta: [
      { title: "Global Users — LeadForge Admin" },
    ],
  }),
  component: GlobalUsersRoute,
});

function GlobalUsersRoute() {
  const users = Route.useLoaderData();
  const router = useRouter();

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleUserStatus({ data: id })
      await router.invalidate()
    } catch (err) {
      alert('Failed to update user status')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete the user "${name}"?`)) {
      try {
        await deleteUser({ data: id })
        await router.invalidate()
      } catch (err) {
        alert('Failed to delete user')
      }
    }
  }

  return (
    <Shell title="Global Users Directory">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Global Users Directory</h2>
          <p className="text-sm text-muted-foreground mt-1">View and manage all users across the platform.</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">User Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Builder Tenant</th>
                <th className="px-6 py-3 font-semibold text-right">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{user.displayName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>
                      {user.role === 'admin' ? 'System Admin' : user.builderRole}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {user.builder ? user.builder.companyName : <span className="text-muted-foreground/50">Platform Level</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Badge tone={user.isActive ? 'success' : 'cold'}>
                      {user.isActive ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={user.role === 'admin'}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                          user.role === 'admin' 
                            ? 'opacity-50 cursor-not-allowed bg-neutral-800 text-neutral-500' 
                            : user.isActive 
                              ? 'bg-danger/10 text-danger hover:bg-danger/20' 
                              : 'bg-success/10 text-success hover:bg-success/20'
                        }`}
                      >
                        {user.isActive ? 'Suspend' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id, user.displayName)}
                        disabled={user.role === 'admin'}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors border ${
                          user.role === 'admin'
                            ? 'opacity-50 cursor-not-allowed bg-neutral-800 text-neutral-500 border-neutral-700'
                            : 'bg-red-900/20 text-red-500 hover:bg-red-900/40 hover:text-red-400 border-red-900/30'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}
