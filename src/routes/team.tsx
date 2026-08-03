import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Card } from '@/components/dashboard/primitives'
import { CustomSelect } from '@/components/dashboard/CustomSelect'
import { getTeamData, createTeamInvite, removeTeamMember, generatePasswordResetLink } from '@/lib/dashboard'
import { X, Trash2, Mail, Clock, Shield, KeyRound, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/team')({
  head: () => ({
    meta: [{ title: 'Manage Team — Builder\'s Edge' }]
  }),
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return
    const session = (context as any).session
    if (session && session.role === 'builder' && (session.builderRole === 'manager' || session.builderRole === 'sales')) {
      const { redirect } = await import('@tanstack/react-router')
      throw redirect({ to: '/' })
    }
  },
  loader: () => getTeamData({ data: { activeRole: typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined } }),
  staleTime: 60_000, // 60s — fresh data, instant revisits within a minute
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading..." />,
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
  const [isCopied, setIsCopied] = useState(false)
  
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

  const handleCopyLink = (linkToCopy: string) => {
    try {
      navigator.clipboard.writeText(linkToCopy)
      setIsCopied(true)
      toast.success("Invite link copied to clipboard!")
      setTimeout(() => setIsCopied(false), 2500)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await createTeamInvite({ data: { name, email, role } })
      if (res.success && res.inviteLink) {
        const fullLink = window.location.origin + res.inviteLink
        setInviteLink(fullLink)
        handleCopyLink(fullLink)
        setName('')
        setEmail('')
        setRole('sales')
        await router.invalidate()
      }
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to send invite: ${err?.message || 'Check console for details.'}`)
    }
  }

  const handleRemove = async (id: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      try {
        await removeTeamMember({ data: id })
        setSelectedMember(null)
        await router.invalidate()
      } catch (err) {
        toast.error("Failed to remove team member")
      }
    }
  }

  const handleResetPassword = async (id: string) => {
    try {
      const res = await generatePasswordResetLink({ data: id })
      if (res.success && res.inviteLink) {
        const link = window.location.origin + res.inviteLink
        setInviteLink(link)
        handleCopyLink(link)
      }
    } catch (err: any) {
      toast.error(`Failed to generate reset link: ${err?.message}`)
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
              <CustomSelect
                value={role}
                onChange={val => setRole(val)}
                className="w-full"
                options={[
                  { label: "Sales Agent", value: "sales" },
                  { label: "Manager", value: "manager" },
                  { label: "Admin", value: "admin" }
                ]}
              />
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
                  onClick={() => handleCopyLink(inviteLink)}
                  className={`text-xs font-medium px-3 py-1 rounded transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                    isCopied 
                      ? 'bg-success text-black font-semibold shadow-[0_0_10px_rgba(48,209,88,0.4)]' 
                      : 'bg-success/20 hover:bg-success/30 text-success'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy
                    </>
                  )}
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
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr 
                  key={u.id} 
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                  onClick={() => setSelectedMember(u)}
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
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedMember(u); }}
                      className="text-xs px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors"
                    >
                      View
                    </button>
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
              <div className="pt-6 border-t border-border flex flex-col gap-3">
                <button 
                  onClick={() => handleResetPassword(selectedMember.id)}
                  className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold rounded-md border border-primary/20 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="size-4" /> Reset Password Link
                </button>
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
