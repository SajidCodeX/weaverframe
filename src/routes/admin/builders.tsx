import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Card } from '@/components/dashboard/primitives'
import { getBuildersData, createBuilderInvite, toggleBuilderStatus, deleteBuilder, startBuilderPreview } from '@/lib/admin'
import { getSessionFn } from '@/lib/auth'
import { MoreHorizontal } from 'lucide-react'

export const Route = createFileRoute('/admin/builders')({
  head: () => ({
    meta: [{ title: "Manage Builders — WeaverFrame Admin" }]
  }),
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    if (typeof window === 'undefined') return [];
    return await getBuildersData();
  },
  component: BuildersRoute,
})

function BuildersRoute() {
  const builders = Route.useLoaderData()
  const [isInviting, setIsInviting] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const handleDocClick = () => setOpenMenuId(null)
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleBuilderStatus({ data: id })
      await router.invalidate()
    } catch (err) {
      alert('Failed to update status')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete the builder "${name}" and all of their data? This action cannot be undone.`)) {
      try {
        await deleteBuilder({ data: id })
        await router.invalidate()
      } catch (err) {
        alert('Failed to delete builder')
      }
    }
  }

  const handlePreviewBuilder = async (id: string) => {
    try {
      sessionStorage.setItem('active_role', 'admin')
      await startBuilderPreview({ data: id })
      window.location.href = '/'
    } catch (err) {
      alert('Failed to open builder preview')
    }
  }

  const handleResetPassword = async (userId: string) => {
    const { generatePasswordResetLink } = await import('@/lib/dashboard')
    try {
      const res = await generatePasswordResetLink({ data: userId })
      if (res.success && res.inviteLink) {
        const link = window.location.origin + res.inviteLink
        navigator.clipboard.writeText(link)
        alert(`Reset link generated for owner and copied to clipboard!\n\n${link}`)
      }
    } catch (err: any) {
      alert(`Failed to generate reset link: ${err?.message}`)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await createBuilderInvite({ data: { companyName, email } })
      if (res.success && res.inviteLink) {
        // Provide the full URL
        setInviteLink(window.location.origin + res.inviteLink)
        setCompanyName('')
        setEmail('')
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to create invite')
    }
  }

  return (
    <Shell title="Builders">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Platform Builders</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage active builder accounts and send invites.</p>
        </div>
        <button
          onClick={() => setIsInviting(!isInviting)}
          className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          {isInviting ? 'Cancel' : 'Invite New Builder'}
        </button>
      </div>

      {isInviting && (
        <Card className="mb-8 p-6 bg-secondary/20 border-border/50">
          <h3 className="text-lg font-semibold text-white mb-4">Send Builder Invite</h3>
          <form onSubmit={handleInvite} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-white outline-none"
                placeholder="Apex Homes"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Owner Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-white outline-none"
                placeholder="owner@apexhomes.com"
              />
            </div>
            <button type="submit" className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors">
              Generate Link
            </button>
          </form>

          {inviteLink && (
            <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-md">
              <p className="text-sm text-success font-medium mb-2">Invite generated successfully! Send this link to the builder:</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={inviteLink} 
                  className="flex-1 bg-black/50 border border-success/30 rounded px-2 py-1 text-xs font-mono text-white selection:bg-success/30"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button 
                  onClick={handleCopy}
                  className="text-xs bg-success/20 hover:bg-success/30 text-success px-2 py-1 rounded transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto transition-all duration-200 ease-in-out" style={{ paddingBottom: openMenuId ? '180px' : '0' }}>
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-muted-foreground uppercase tracking-wider bg-secondary/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Company</th>
                <th className="px-6 py-3 font-semibold">Owner Email</th>
                <th className="px-6 py-3 font-semibold text-right">Total Leads</th>
                <th className="px-6 py-3 font-semibold text-right">Joined</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {builders.map(builder => {
                const owner = builder.users.find((u: any) => u.builderRole === 'owner') || builder.users[0]
                return (
                  <tr key={builder.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{builder.companyName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{owner?.email || 'N/A'}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">{builder._count.leads}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {new Date(builder.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation()
                          e.nativeEvent.stopImmediatePropagation()
                          setOpenMenuId(openMenuId === builder.id ? null : builder.id) 
                        }}
                        className="text-muted-foreground hover:text-white p-2 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      
                      {openMenuId === builder.id && (
                        <div 
                          className="absolute right-8 top-10 w-40 bg-[#111] border border-[#333] rounded-md shadow-2xl z-10 py-1 overflow-hidden"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.nativeEvent.stopImmediatePropagation()
                          }}
                        >
                          <button 
                            onClick={() => { setOpenMenuId(null); handlePreviewBuilder(builder.id); }}
                            className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/10 transition-colors"
                          >
                            Open Dashboard
                          </button>
                          {owner && (
                            <button 
                              onClick={() => { setOpenMenuId(null); handleResetPassword(owner.id); }}
                              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/10 transition-colors"
                            >
                              Reset Password
                            </button>
                          )}
                          <button 
                            onClick={() => { setOpenMenuId(null); handleToggleStatus(builder.id); }}
                            className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/10 transition-colors"
                          >
                            {builder.isActive ? 'Suspend Builder' : 'Activate Builder'}
                          </button>
                          <div className="h-px bg-[#333] my-1" />
                          <button 
                            onClick={() => { setOpenMenuId(null); handleDelete(builder.id, builder.companyName); }}
                            className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/20 transition-colors"
                          >
                            Delete Builder
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {builders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No builders active yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  )
}
