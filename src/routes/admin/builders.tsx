import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Card } from '@/components/dashboard/primitives'
import { getBuildersData, createBuilderInvite, toggleBuilderStatus, deleteBuilder } from '@/lib/admin'
import { getSessionFn } from '@/lib/auth'

export const Route = createFileRoute('/admin/builders')({
  head: () => ({
    meta: [{ title: "Manage Builders — Builder's Edge Admin" }]
  }),
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: async () => await getBuildersData(),
  component: BuildersRoute,
})

function BuildersRoute() {
  const builders = Route.useLoaderData()
  const [isInviting, setIsInviting] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const router = useRouter()

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
        <div className="overflow-x-auto">
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleToggleStatus(builder.id)}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                            builder.isActive 
                              ? 'bg-danger/10 text-danger hover:bg-danger/20' 
                              : 'bg-success/10 text-success hover:bg-success/20'
                          }`}
                        >
                          {builder.isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => handleDelete(builder.id, builder.companyName)}
                          className="text-xs font-medium px-2 py-1 rounded transition-colors bg-red-900/20 text-red-500 hover:bg-red-900/40 hover:text-red-400 border border-red-900/30"
                        >
                          Delete
                        </button>
                      </div>
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
