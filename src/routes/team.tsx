import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Card } from '@/components/dashboard/primitives'
import { CustomSelect } from '@/components/dashboard/CustomSelect'
import { getTeamData, createTeamInvite, removeTeamMember } from '@/lib/dashboard'
import { X, Trash2, Mail, Clock, Shield } from 'lucide-react'

export const Route = createFileRoute('/team')({
  head: () => ({
    meta: [{ title: 'Manage Team — Builder\'s Edge' }]
  }),
  loader: async () => await getTeamData(),
  component: TeamRoute,
})

function TeamRoute() {
  const users = Route.useLoaderData()
  const router = useRouter()
  const [isInviting, setIsInviting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('sales')
  const [inviteLink, setInviteLink] = useState('')
  
  // Member detail view state
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  
  // Escape key listener to collapse active overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedMember(null);
        setIsInviting(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await createTeamInvite({ data: { name, email, role } })
      if (res.success && res.inviteLink) {
        setInviteLink(window.location.origin + res.inviteLink)
        setName('')
        setEmail('')
        setRole('sales')
        await router.invalidate()
      }
    } catch (err: any) {
      console.error(err)
      alert(`Failed to send invite: ${err?.message || 'Check console for details.'}`)
    }
  }

  const handleRemove = async (id: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      try {
        await removeTeamMember({ data: id })
        setSelectedMember(null)
        await router.invalidate()
      } catch (err) {
        alert("Failed to remove team member")
      }
    }
  }

  return (
    <Shell title="Team">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Team Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage staff access and send invitations.</p>
        </div>
        <button
          onClick={() => setIsInviting(!isInviting)}
          className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          {isInviting ? 'Cancel' : 'Invite Member'}
        </button>
      </div>

      {isInviting && (
        <Card className="mb-8 p-6 bg-secondary/20 border-border/50">
          <h3 className="text-lg font-semibold text-white mb-4">Send Team Invite</h3>
          <form onSubmit={handleInvite} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-white outline-none"
                placeholder="Jane Doe"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-white outline-none"
                placeholder="jane@company.com"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
              <div className="mt-1">
                <CustomSelect
                  value={role}
                  onChange={val => setRole(val)}
                  className="w-full bg-[#0a0a0a] border border-[#333] h-[38px] rounded-md px-3 py-2 text-sm text-white"
                  options={[
                    { label: "Sales Agent", value: "sales" },
                    { label: "Manager", value: "manager" },
                    { label: "Admin", value: "admin" }
                  ]}
                />
              </div>
            </div>
            <button type="submit" className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
              Generate Link
            </button>
          </form>

          {inviteLink && (
            <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-md">
              <p className="text-sm text-success font-medium mb-2">Invite generated successfully! Send this link to your team member:</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={inviteLink} 
                  className="flex-1 bg-black/50 border border-success/30 rounded px-2 py-1 text-xs font-mono text-white selection:bg-success/30"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="text-xs bg-success/20 hover:bg-success/30 text-success px-2 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr 
                  key={u.id} 
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                  onDoubleClick={() => setSelectedMember(u)}
                >
                  <td className="px-6 py-4 font-medium text-foreground">{u.displayName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-xs px-2 py-1 bg-white/10 rounded-md text-muted-foreground">
                      {u.builderRole}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.isActive ? (
                      <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-md">Active</span>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded-md">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Member Details Slide-out */}
      {selectedMember && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSelectedMember(null)} />
          <aside className="fixed top-[60px] right-0 bottom-0 w-[400px] bg-card border-l border-border z-40 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-display font-semibold text-lg text-foreground">Team Member Profile</h3>
              <button onClick={() => setSelectedMember(null)} className="text-muted-foreground hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Name</p>
                <p className="text-sm font-semibold text-foreground">{selectedMember.displayName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1"><Mail className="size-3 inline mr-1" />Email</p>
                <p className="text-sm text-foreground">{selectedMember.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1"><Shield className="size-3 inline mr-1" />Role</p>
                <p className="text-sm capitalize text-foreground">{selectedMember.builderRole}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Status</p>
                {selectedMember.isActive ? (
                  <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-md inline-block">Active</span>
                ) : (
                  <span className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded-md inline-block">Inactive</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1"><Clock className="size-3 inline mr-1" />Last Login</p>
                <p className="text-sm text-foreground">{selectedMember.lastLoginAt ? new Date(selectedMember.lastLoginAt).toLocaleString() : 'Never logged in'}</p>
              </div>
              <div className="pt-6 border-t border-border">
                <button 
                  onClick={() => handleRemove(selectedMember.id)}
                  className="w-full py-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-semibold rounded-md border border-danger/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" /> Remove Team Member
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

    </Shell>
  )
}
