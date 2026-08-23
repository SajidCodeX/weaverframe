import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Shell } from '@/components/dashboard/Shell'
import { Card, Badge } from '@/components/dashboard/primitives'
import { getBuildersData, createBuilderInvite, toggleBuilderStatus, deleteBuilder, startBuilderPreview } from '@/lib/admin'
import { getSessionFn } from '@/lib/auth'
import { RoutePending } from '@/components/dashboard/RoutePending'
import { MoreHorizontal, Building2, Plus, Copy, Check, ExternalLink, Key, Power, Trash2, Users, ArrowUpRight, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/admin/builders')({
  head: () => ({
    meta: [{ title: "Manage Builders — WeaverFrame HQ" }]
  }),
  beforeLoad: ({ context }) => {
    if (typeof window === 'undefined') return;
    const session = context.session
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
  loader: () => {
    if (typeof window === 'undefined') return [];
    return getBuildersData();
  },
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Platform Builders" type="team" />,
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
  const [searchQuery, setSearchQuery] = useState('')
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
        setInviteLink(window.location.origin + res.inviteLink)
        setCompanyName('')
        setEmail('')
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to create invite')
    }
  }

  const filteredBuilders = builders.filter((b: any) =>
    b.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.users.some((u: any) => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <Shell title="Platform Builders">
      {/* ── Top Actions Bar ── */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-white/50">
            Registered Builders (<strong className="text-white">{builders.length}</strong>)
          </span>
        </div>

        <button
          onClick={() => setIsInviting(!isInviting)}
          className="px-4 py-2.5 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2 rounded-lg shadow-md cursor-pointer shrink-0"
        >
          <Plus className="size-4" />
          {isInviting ? 'Close Form' : 'Invite New Builder'}
        </button>
      </div>

      {/* ── Provisioning Card ── */}
      {isInviting && (
        <div className="mb-8 p-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
            <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
              Invite New Builder
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-5 font-light">
            Creates a new builder organization and generates an onboarding setup link.
          </p>

          <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                Builder Firm / Company Name
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                placeholder="e.g. Apex Luxury Estates"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                Principal Owner Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                placeholder="owner@apexluxury.com"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#e5d9c5] text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-white transition-all shadow-md cursor-pointer"
              >
                Generate Link
              </button>
            </div>
          </form>

          {inviteLink && (
            <div className="mt-5 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
              <p className="text-xs text-emerald-500 dark:text-emerald-400 font-mono font-medium mb-2 flex items-center gap-2">
                <Check className="size-3.5" />
                Tenant provisioned successfully! Share this private activation link:
              </p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={inviteLink} 
                  className="flex-1 bg-input border border-emerald-500/30 rounded-lg px-3 py-2 text-xs font-mono text-foreground selection:bg-emerald-500/30 outline-none"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button 
                  onClick={handleCopy}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 rounded-lg border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Table Controls & Search ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
              Active Tenants ({filteredBuilders.length})
            </span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by company or email..."
            className="w-64 bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto transition-all duration-200 ease-in-out" style={{ paddingBottom: openMenuId ? '200px' : '0' }}>
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.16em] bg-muted/40 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Company / Brand</th>
                <th className="px-6 py-4 font-semibold">Principal Owner</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Leads Processed</th>
                <th className="px-6 py-4 font-semibold text-right">Provisioned</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBuilders.map(builder => {
                const owner = builder.users.find((u: any) => u.builderRole === 'owner') || builder.users[0]
                const initials = builder.companyName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <tr key={builder.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-secondary border border-border flex items-center justify-center font-nevera text-xs font-bold text-[#c9a84c] dark:text-[#e5d9c5] shrink-0">
                          {initials}
                        </div>
                        <div>
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors block">
                            {builder.companyName}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            Plan: {builder.plan?.toUpperCase() || 'TRIAL'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                      {owner?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium ${
                        builder.isActive 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`size-1.5 rounded-full ${builder.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {builder.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-foreground font-medium">
                      {builder._count.leads.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-mono text-muted-foreground">
                      {new Date(builder.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation()
                          e.nativeEvent.stopImmediatePropagation()
                          setOpenMenuId(openMenuId === builder.id ? null : builder.id) 
                        }}
                        className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        title="Actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      
                      {openMenuId === builder.id && (
                        <div 
                          className="absolute right-6 top-10 w-48 bg-popover border border-border rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.nativeEvent.stopImmediatePropagation()
                          }}
                        >
                          <button 
                            onClick={() => { setOpenMenuId(null); handlePreviewBuilder(builder.id); }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <ExternalLink className="size-3.5" />
                            Open Dashboard
                          </button>
                          {owner && (
                            <button 
                              onClick={() => { setOpenMenuId(null); handleResetPassword(owner.id); }}
                              className="w-full text-left px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <Key className="size-3.5" />
                              Reset Password Link
                            </button>
                          )}
                          <button 
                            onClick={() => { setOpenMenuId(null); handleToggleStatus(builder.id); }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Power className="size-3.5" />
                            {builder.isActive ? 'Suspend Builder' : 'Activate Builder'}
                          </button>
                          <div className="h-px bg-border my-1.5" />
                          <button 
                            onClick={() => { setOpenMenuId(null); handleDelete(builder.id, builder.companyName); }}
                            className="w-full text-left px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            Delete Tenant
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredBuilders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-xs font-mono">
                    No builders match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}
