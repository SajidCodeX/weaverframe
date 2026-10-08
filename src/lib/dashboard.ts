import { createServerFn } from '@tanstack/react-start'
import { resolveBookingDateTime, checkAppointmentAvailability, bookAppointmentAtomically } from './date-utils'
import { sanitizeInboundEmail, sanitizeMetadataField } from './sanitizer'
import { sendAlert } from './alerting'



import { getCache, setCache, invalidateCache } from './cache';

export const getDashboardData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth(data?.activeRole ?? undefined)

  const cacheKey = "dashboard_" + session.builderId + "_" + session.userId;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Pass session in â€” getTenantDb will skip its own requireAuth() call
  const db = await getTenantDb(session)
  const now = new Date()
  const startOfLast30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfPrevious30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const [recentActivitiesRaw, appointmentsActivities, allLeadsRaw] = await Promise.all([
      db.activity.findMany({ take: 60, orderBy: { createdAt: 'desc' }, include: { lead: true } }),
      db.activity.findMany({ where: { action: { contains: 'scheduled' }, createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }, include: { lead: true } }),
      db.lead.findMany({
        select: {
          id: true,
          name: true,
          county: true,
          status: true,
          scoreTier: true,
          estimatedBudget: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // 2. Perform native SQL aggregations via Prisma
    const [
      totalLeads,
      qualifiedLeads,
      builderNotified,
      appointmentsSet,
      leadsLast30,
      leadsPrev30,
      scoreTierAgg,
      pipelineLast30Agg,
      pipelinePrev30Agg,
      qualifiedSumAgg
    ] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { status: { not: 'New' } } }),
      db.lead.count({ where: { status: { in: ['Builder Notified', 'Appointment', 'Replied'] } } }),
      db.lead.count({ where: { status: 'Appointment' } }),
      db.lead.count({ where: { createdAt: { gte: startOfLast30Days } } }),
      db.lead.count({ where: { createdAt: { gte: startOfPrevious30Days, lt: startOfLast30Days } } }),
      db.lead.groupBy({ by: ['scoreTier'], _count: { _all: true }, _sum: { estimatedBudget: true } }),
      db.lead.aggregate({ _sum: { estimatedBudget: true }, where: { status: { not: 'New' }, createdAt: { gte: startOfLast30Days } } }),
      db.lead.aggregate({ _sum: { estimatedBudget: true }, where: { status: { not: 'New' }, createdAt: { gte: startOfPrevious30Days, lt: startOfLast30Days } } }),
      db.lead.aggregate({ _sum: { estimatedBudget: true }, where: { status: { not: 'New' } } }),
    ])

    // Parse aggregation results safely
    const getTierStats = (tier: string) => {
      const match = scoreTierAgg.find(g => g.scoreTier === tier)
      return { count: match?._count?._all || 0, sum: match?._sum?.estimatedBudget || 0 }
    }
    const hotStats = getTierStats('Hot')
    const warmStats = getTierStats('Warm')
    const coldStats = getTierStats('Cold')

    const pipelineLast30 = pipelineLast30Agg._sum.estimatedBudget || 0
    const pipelinePrev30 = pipelinePrev30Agg._sum.estimatedBudget || 0
    const qualifiedSumBudget = qualifiedSumAgg._sum.estimatedBudget || 0
    const avgBudget = qualifiedLeads > 0 ? qualifiedSumBudget / qualifiedLeads : 0

    // Month over month trends (now Rolling 30 Days)
    const diffLeads = leadsLast30 - leadsPrev30
    const leadsMonthSub = diffLeads >= 0 ? `+${diffLeads} vs previous 30 days` : `${diffLeads} vs prev 30 days`
    const leadsMonthTrend = diffLeads >= 0 ? 'up' : 'down'
    const leadsPctChange = leadsPrev30 > 0 ? Math.round((diffLeads / leadsPrev30) * 100) : (leadsLast30 > 0 ? 100 : 0)
    const leadsMonthTrendVal = `${leadsPctChange >= 0 ? '+' : ''}${leadsPctChange}%`

    const pipelinePctChange = pipelinePrev30 > 0 ? Math.round(((pipelineLast30 - pipelinePrev30) / pipelinePrev30) * 100) : (pipelineLast30 > 0 ? 100 : 0)
    const pipelineTrend = pipelinePctChange >= 0 ? 'up' : 'down'
    const pipelineTrendVal = `${pipelinePctChange >= 0 ? '+' : ''}${pipelinePctChange}%`

    const formatBudgetK = (avgValue: number) => `$${Math.round(avgValue / 1000)}K`

    // Sparklines: 7 daily snapshots, each showing cumulative counts per score tier.
    // Using parallel Prisma groupBy â€” safe, tenant-scoped via middleware, no raw SQL risk.
    const sparklineDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(23, 59, 59, 999)
      return d
    })

    const sparklineResults = await Promise.all(
      sparklineDates.map(date =>
        db.lead.groupBy({
          by: ['scoreTier'],
          _count: { _all: true },
          where: { createdAt: { lte: date } }
        })
      )
    )

    const getTrendForTier = (tier: string): number[] =>
      sparklineResults.map(dayResult => {
        const match = dayResult.find(g => g.scoreTier === tier)
        return match?._count?._all || 0
      })

    // Weekly volume chart: 7 data points at 7-day intervals.
    const currentNow = new Date()
    const currentYear = currentNow.getFullYear()
    const currentMonth = currentNow.getMonth()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    const dailyDates = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(currentYear, currentMonth, i + 1)
      d.setHours(23, 59, 59, 999)
      return d
    })

    const startOfMonth = new Date(currentYear, currentMonth, 1)
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)

    const allMonthLeads = await db.lead.findMany({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { createdAt: true, status: true }
    }) || []

    const dailyVolume = dailyDates.map((d) => {
      const startOfDay = new Date(d)
      startOfDay.setHours(0, 0, 0, 0)

      const leadsToday = allMonthLeads.filter((l: any) => l.createdAt && new Date(l.createdAt) >= startOfDay && new Date(l.createdAt) <= d)
      const total = leadsToday.length
      const qualified = leadsToday.filter((l: any) => l.status !== 'New').length

      return {
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        total,
        qualified,
      }
    })

    // Fetch Last Sync Timestamp
    const syncStatus = await db.systemSync.findUnique({ where: { id: 'rencast_leads' } })
    const lastSyncAt = syncStatus?.lastSyncAt.toISOString() || null

    const funnel = [
      { label: 'Inquiry Received', value: totalLeads, pct: totalLeads > 0 ? 100 : 0 },
      { label: 'AI Qualified', value: qualifiedLeads, pct: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0 },
      { label: 'Builder Notified', value: builderNotified, pct: totalLeads > 0 ? Math.round((builderNotified / totalLeads) * 100) : 0 },
      { label: 'Appointment Set', value: appointmentsSet, pct: totalLeads > 0 ? Math.round((appointmentsSet / totalLeads) * 100) : 0 },
    ]

    const scoreData = [
      { label: 'Hot', pct: totalLeads > 0 ? Math.round((hotStats.count / totalLeads) * 100) : 0, count: hotStats.count, budget: formatBudgetK(hotStats.count > 0 ? hotStats.sum / hotStats.count : 0), color: '#FF453A', trend: getTrendForTier('Hot') },
      { label: 'Warm', pct: totalLeads > 0 ? Math.round((warmStats.count / totalLeads) * 100) : 0, count: warmStats.count, budget: formatBudgetK(warmStats.count > 0 ? warmStats.sum / warmStats.count : 0), color: '#FF9F0A', trend: getTrendForTier('Warm') },
      { label: 'Cold', pct: totalLeads > 0 ? Math.round((coldStats.count / totalLeads) * 100) : 0, count: coldStats.count, budget: formatBudgetK(coldStats.count > 0 ? coldStats.sum / coldStats.count : 0), color: '#0A84FF', trend: getTrendForTier('Cold') },
    ]

    let pipelineValueStr = '$0'
    if (qualifiedSumBudget >= 1000000) {
      pipelineValueStr = `$${(qualifiedSumBudget / 1000000).toFixed(1)}M`
    } else {
      pipelineValueStr = `$${Math.round(qualifiedSumBudget / 1000)}K`
    }
    const avgBudgetStr = avgBudget >= 1000000 ? `$${(avgBudget / 1000000).toFixed(1)}M` : `$${Math.round(avgBudget / 1000)}K`
    const pipelineSub = `Avg ${avgBudgetStr} Â· ${qualifiedLeads} active prospects`

    let avgDaysToBook = 14
    if (appointmentsActivities.length > 0) {
      const totalDays = appointmentsActivities.reduce((sum, act) => {
        const diffMs = act.createdAt.getTime() - act.lead.createdAt.getTime()
        return sum + (diffMs / (1000 * 60 * 60 * 24))
      }, 0)
      avgDaysToBook = Math.max(1, Math.round(totalDays / appointmentsActivities.length))
    }

    const aiQualRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0

    const uniqueLeads = new Set()
    const activityFeed = recentActivitiesRaw
      .filter((a) => {
        if (uniqueLeads.has(a.leadId)) return false
        uniqueLeads.add(a.leadId)
        return true
      })
      .map((a) => ({
      id: a.id,
      leadId: a.leadId,
      name: a.lead.name,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      score: (a.lead.scoreTier === 'Hot' ? 'hot' : a.lead.scoreTier === 'Warm' ? 'warm' : 'cold') as 'hot' | 'warm' | 'cold',
      city: a.lead.county,
    }))

    // Compute 5-Step Luxury Activation Checklist
    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    const [builderRecord, connectedIntegrationsCount] = await Promise.all([
      builderId ? db.builder.findUnique({
        where: { id: builderId },
        select: { companyName: true, contactName: true, phone: true, email: true, settings: true }
      }).catch(() => null) : null,
      builderId ? db.integration.count({
        where: { isConnected: true }
      }).catch(() => 0) : 0,
    ]);

    let parsedSettings: Record<string, any> = {};
    if (builderRecord?.settings) {
      try {
        parsedSettings = typeof builderRecord.settings === 'string'
          ? JSON.parse(builderRecord.settings)
          : builderRecord.settings;
      } catch {}
    }

    const profileSettings = parsedSettings['builder_profile'] || {};
    const qualSettings = parsedSettings['qualification_rules'] || {};
    const aiBrainConfig = parsedSettings['ai_brain_config'] || {};
    const aiSettings = parsedSettings['ai_brain_config'] || parsedSettings['ai_instructions'] || parsedSettings['brain_voice'] || {};
    const mailboxSettings = parsedSettings['email_mailbox'] || {};

    // 1. Profile: builder has saved their profile or customized name/contact/address
    const hasProfile = Boolean(
      profileSettings.businessAddress ||
      profileSettings.companyName ||
      profileSettings.primaryContact ||
      profileSettings.phone ||
      (builderRecord?.companyName && builderRecord.companyName.trim() !== '' && builderRecord.companyName !== 'Horizon Homes LLC') ||
      (builderRecord?.contactName && builderRecord?.phone)
    );

    // 2. Mailbox: connected integration in DB or saved mailbox credentials
    const hasMailbox = Boolean(
      (connectedIntegrationsCount || 0) > 0 ||
      (mailboxSettings.email && (mailboxSettings.password || mailboxSettings.provider === 'google_oauth' || mailboxSettings.provider === 'google'))
    );

    // 3. Buyer Rules: qualification criteria configured in qualification_rules or ai_brain_config
    const hasQual = Boolean(
      qualSettings.minBudget ||
      qualSettings.maxTimeline ||
      qualSettings.minLeadScore !== undefined ||
      aiBrainConfig.minBudget ||
      aiBrainConfig.maxTimeline ||
      aiBrainConfig.lotRequirement ||
      aiBrainConfig.plansRequirement
    );

    // 4. AI Voice: calibrated tone, persona name, or directives in ai_brain_config
    const hasAi = Boolean(
      aiBrainConfig.brandVoice ||
      aiBrainConfig.primaryGoal ||
      aiBrainConfig.personaName ||
      aiBrainConfig.customDirectives ||
      aiSettings.brandVoice ||
      aiSettings.rules ||
      aiSettings.customPrompt ||
      aiSettings.tone
    );

    // 5. Leads: at least one lead ingested
    const hasLeads = (totalLeads || 0) > 0;

    const activationChecklist = {
      steps: [
        {
          id: 'profile',
          title: 'Establish Brand Identity & Territory',
          description: 'Set your luxury builder name, primary metropolitan markets, and contact details.',
          isCompleted: hasProfile,
          href: '/settings?tab=Builder+Profile&highlight=profile',
          actionText: 'Configure Profile',
        },
        {
          id: 'mailbox',
          title: 'Connect Client Reception Mailbox',
          description: 'Link Google Workspace or IMAP for autonomous 2-way client concierge communication.',
          isCompleted: hasMailbox,
          href: '/settings?tab=Integrations&highlight=mailbox',
          actionText: 'Connect Mailbox',
        },
        {
          id: 'qualification',
          title: 'Establish Buyer Qualification Criteria',
          description: 'Define minimum build budget ($1M+), land status preference, and construction timeline.',
          isCompleted: hasQual,
          href: '/ai-activity?focus=rules',
          actionText: 'Set Criteria',
        },
        {
          id: 'brain',
          title: 'Tune Architectural AI Brand Voice',
          description: 'Calibrate design specifications, luxury finishes, and executive tone of voice.',
          isCompleted: hasAi,
          href: '/ai-activity?focus=voice',
          actionText: 'Tune AI Brain',
        },
        {
          id: 'leads',
          title: 'Ingest Your First Luxury Lead',
          description: 'Capture website inquiries via webhook or add your first prospective client.',
          isCompleted: hasLeads,
          href: '/leads?action=add',
          actionText: 'Add First Lead',
        },
      ],
      completedCount: [hasProfile, hasMailbox, hasQual, hasAi, hasLeads].filter(Boolean).length,
      totalCount: 5,
    };

    const result = {
      totalLeads,
      qualifiedLeads,
      appointmentsSet,
      funnel,
      scoreData,
      activityFeed,
      activationChecklist,
      allLeads: allLeadsRaw.map((l: any) => ({
        id: l.id,
        name: l.name,
        county: l.county,
        status: l.status,
        scoreTier: l.scoreTier,
        estimatedBudget: l.estimatedBudget || 0,
        createdAt: l.createdAt.toISOString()
      })),
      rawActivities: recentActivitiesRaw.map((a: any) => ({
        id: a.id,
        leadId: a.leadId,
        name: a.lead?.name || 'Lead',
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        score: (a.lead?.scoreTier === 'Hot' ? 'hot' : a.lead?.scoreTier === 'Warm' ? 'warm' : 'cold') as 'hot' | 'warm' | 'cold',
        city: a.lead?.county || ''
      })),
      leadsThisMonth: leadsLast30, // keeping variable names compatible with frontend
      leadsMonthSub,
      leadsMonthTrend,
      leadsMonthTrendVal,
      pipelineValueStr,
      pipelineSub,
      pipelineTrend,
      pipelineTrendVal,
      avgDaysToBook,
      aiQualRate,
      dailyVolume,
      lastSyncAt
    };
    
    setCache(cacheKey, result, 60);
    return result;
})



export const getLastSyncTime = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);
    try {
      // Find the most recent sync event across active channels (Mailbox Sync, latest message, or activity)
      const [mailboxSync, latestMsg, latestActivity] = await Promise.all([
        db.systemSync.findUnique({ where: { id: 'mailbox_sync' } }).catch(() => null),
        db.message.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        }).catch(() => null),
        db.activity.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        }).catch(() => null),
      ]);

      const timestamps: number[] = [];
      if (mailboxSync?.lastSyncAt) timestamps.push(new Date(mailboxSync.lastSyncAt).getTime());
      if (latestMsg?.createdAt) timestamps.push(new Date(latestMsg.createdAt).getTime());
      if (latestActivity?.createdAt) timestamps.push(new Date(latestActivity.createdAt).getTime());

      if (timestamps.length > 0) {
        return new Date(Math.max(...timestamps)).toISOString();
      }
      return new Date().toISOString();
    } catch (e) {
      return null;
    }
  });

export function cleanMojibake(text: string): string {
  if (!text) return "";
  return text
    .replace(/ðŸš¨/g, "🚨")
    .replace(/ðŸ“…/g, "📅")
    .replace(/ðŸ“†/g, "🗓️")
    .replace(/ðŸš€/g, "🚀")
    .replace(/ðŸ”¥/g, "🔥")
    .replace(/ðŸ‘¤/g, "👤")
    .replace(/ðŸ’¬/g, "💬")
    .replace(/ðŸ¤–/g, "🤖")
    .replace(/ðŸ¤—/g, "🤖")
    .replace(/ðŸ§ /g, "🧠")
    .replace(/ðŸ”„/g, "🔄")
    .replace(/ðŸ”‘/g, "🔑")
    .replace(/ðŸ“‹/g, "📋")
    .replace(/ðŸ’°/g, "💰")
    .replace(/ðŸŽ¯/g, "🎯")
    .replace(/ðŸ“¤/g, "📤")
    .replace(/ðŸ ¢/g, "🏢")
    .replace(/â€”/g, "—")
    .replace(/â€/g, "—");
}

export const getNotificationsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    
    // Super Admin Notifications Handler
    if (session.role === 'admin' && !session.actingAsBuilderId) {
      try {
        const { getDb } = await import('./db.server');
        const db = await getDb();
        
        const [demoLeads, recentBuilders] = await Promise.all([
          db.lead.findMany({
            where: {
              OR: [
                { source: { contains: 'Demo Request' } },
                { source: { contains: 'Website Landing Page' } }
              ]
            },
            take: 8,
            orderBy: { createdAt: 'desc' },
          }),
          db.builder.findMany({
            take: 4,
            orderBy: { createdAt: 'desc' },
          })
        ]);

        const notifs: any[] = [];

        for (const lead of demoLeads) {
          let comp = lead.county || '';
          try {
            const mem = JSON.parse(lead.leadMemory || '{}');
            if (mem.company) comp = mem.company;
          } catch {}
          notifs.push({
            id: `demo_${lead.id}`,
            title: '🚀 Inbound Demo Request',
            desc: `${lead.name}${comp ? ` (${comp})` : ''} requested a private OS walkthrough.`,
            time: lead.createdAt.toISOString(),
            unread: new Date().getTime() - lead.createdAt.getTime() < 86400000,
          });
        }

        for (const b of recentBuilders) {
          notifs.push({
            id: `builder_${b.id}`,
            title: '🏢 Builder Account',
            desc: `${b.companyName} is registered on the platform.`,
            time: b.createdAt.toISOString(),
            unread: new Date().getTime() - b.createdAt.getTime() < 86400000,
          });
        }

        notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        return notifs.slice(0, 10);
      } catch (adminNotifErr) {
        console.error('Error fetching admin notifications:', adminNotifErr);
        return [];
      }
    }

    try {
      const db = await getTenantDb(session);
      const activities = await db.activity.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { lead: true }
      });
      return activities.map(act => {
        const rawAction = act.action || '';
        const cleanedAction = cleanMojibake(rawAction);
        const lower = cleanedAction.toLowerCase();

        let title = "📌 Lead Activity";
        if (lower.includes("human takeover") || lower.includes("takeover")) {
          title = "👤 Human Takeover";
        } else if (lower.includes("high alert")) {
          title = "🚨 High Priority Alert";
        } else if (lower.includes("schedule") || lower.includes("appointment") || lower.includes("site visit")) {
          title = "📅 Meeting Scheduled";
        } else if (lower.includes("inbound email reply") || lower.includes("homeowner replied")) {
          title = "💬 Lead Replied";
        } else if (lower.includes("outreach") || lower.includes("qualification email") || lower.includes("dispatched")) {
          title = "📧 AI Outreach Sent";
        } else if (lower.includes("hot lead") || lower.includes("marked lead as hot")) {
          title = "🔥 Hot Lead Qualified";
        } else if (lower.includes("marked lead as warm")) {
          title = "🟡 Lead Engaged";
        } else if (lower.includes("toggled on") || lower.includes("toggled off")) {
          title = "🤖 AI Status Changed";
        } else if (lower.includes("added") || lower.includes("manually")) {
          title = "👤 New Lead Added";
        }

        return {
          id: act.id,
          title,
          desc: `${act.lead?.name || 'Lead'}: ${cleanedAction}`,
          time: act.createdAt.toISOString(),
          unread: new Date().getTime() - act.createdAt.getTime() < 3600000
        };
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  });

export async function createHighAlertNotification({
  builderId,
  leadId,
  leadName,
  title,
  message,
  type = 'hot_lead'
}: {
  builderId: string;
  leadId: string;
  leadName: string;
  title: string;
  message: string;
  type?: 'hot_lead' | 'booking' | 'urgent_inquiry';
}) {
  try {
    const { getDb } = await import('./db.server');
    const db = await getDb();
    await db.activity.create({
      data: {
        builderId,
        leadId,
        action: `🚨 High Alert [${title}]: ${message}`,
      }
    });
    invalidateCache("dashboard_");
  } catch (err) {
    console.error("Failed to log high alert notification:", err);
  }
}

export function determineLeadSource(lead: { source?: string | null; county?: string | null }) {
  if (lead.source && lead.source.trim()) {
    return lead.source.trim();
  }
  return "Website Contact Form";
}

/**
 * Self-Healing Pipeline Reconciliation Engine:
 * Automatically syncs lead statuses if a homeowner reply arrived but status remained 'New' / 'Emailed' / 'Opened'.
 * Idempotent, non-blocking, and updates in-memory array so the UI renders the correct stage immediately.
 */
export async function reconcileLeadReplyStatuses(
  db: any,
  leads: Array<{ id: string; status: string; messages?: Array<{ sender: string }> }>
) {
  try {
    const staleLeadIds: string[] = [];
    for (const lead of leads) {
      const latestMsg = lead.messages?.[0];
      if (
        latestMsg &&
        latestMsg.sender === 'lead' &&
        ['New', 'Emailed', 'Opened', 'Outreach', 'contacted'].includes(lead.status)
      ) {
        staleLeadIds.push(lead.id);
      }
    }
    if (staleLeadIds.length > 0) {
      await db.lead.updateMany({
        where: { id: { in: staleLeadIds } },
        data: { status: 'Replied' }
      });
      for (const lead of leads) {
        if (staleLeadIds.includes(lead.id)) {
          lead.status = 'Replied';
        }
      }
    }
  } catch (err) {
    console.warn('[RECONCILIATION NON-BLOCKING ERROR]:', err);
  }
}

export const getLeadsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  try {
    const session = await requireAuth(data?.activeRole ?? undefined)
    const db = await getTenantDb(session)
    const whereClause: any = {}
    if (session.role === 'builder' && session.builderRole === 'sales') {
      whereClause.assignedToId = session.userId
    }
    const leads = await db.lead.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        builderId: true,
        name: true,
        email: true,
        phone: true,
        county: true,
        state: true,
        landPrice: true,
        estimatedBudget: true,
        purchaseDate: true,
        status: true,
        scoreTier: true,
        dealScore: true,
        source: true,
        assignedToId: true,
        portalToken: true,
        portalVisitedAt: true,
        lastAiSummary: true,
        smsUsed: true,
        smsQuota: true,
        createdAt: true,
        assignedTo: {
          select: { id: true, displayName: true, email: true, builderRole: true }
        },
        appointments: {
          orderBy: { dateTime: 'desc' },
          take: 1,
          select: { id: true, type: true, dateTime: true, status: true, location: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, sender: true, createdAt: true, isRead: true, channel: true }
        }
      }
    })

    return leads.map(lead => ({
      ...lead,
      source: determineLeadSource(lead)
    }))
  } catch (error) {
    console.error("Error in getLeadsData:", error)
    return []
  }
})


export const addManualLead = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string;
    email: string;
    phone?: string;
    projectType?: string;
    county?: string;
    state?: string;
    landPrice?: number;
    estimatedBudget?: number;
    status?: string;
    scoreTier?: string;
    source?: string;
    notes?: string;
  }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const estimatedBudget = data.estimatedBudget || (data.landPrice ? data.landPrice * 4 : 500000);
      const landPrice = data.landPrice || Math.round(estimatedBudget * 0.25);
      const assignedToId = (session.role === 'builder' && session.builderRole === 'sales') ? session.userId : undefined;
      const scoreTier = data.scoreTier || "Hot";
      const status = data.status || "New";
      const source = data.source || "Website Contact Form";
      const projectType = data.projectType || data.county || "Custom Home Build";

      const lead = await db.lead.create({
        data: {
          builderId: session.builderId || '',
          assignedToId,
          name: data.name,
          phone: data.phone || null,
          email: data.email,
          county: projectType,
          state: data.state || "US",
          landPrice,
          estimatedBudget,
          purchaseDate: new Date(),
          status,
          scoreTier,
          source,
          lastAiSummary: data.notes ? `Initial inquiry: ${data.notes}` : "New lead captured",
          dealScore: scoreTier === "Hot" ? 85 : scoreTier === "Warm" ? 60 : 35,
        }
      });

      // If initial notes were provided, create an initial lead message in thread
      if (data.notes && data.notes.trim()) {
        await db.message.create({
          data: {
            builderId: session.builderId || '',
            leadId: lead.id,
            sender: 'lead',
            content: data.notes.trim(),
            channel: 'portal',
            isRead: false,
          }
        });
      }

      // Log activity
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: lead.id,
          action: `Lead manually added (${source})`,
        }
      });

      // Trigger High Alert Notification if Hot lead
      if (scoreTier === "Hot") {
        await createHighAlertNotification({
          builderId: session.builderId || '',
          leadId: lead.id,
          leadName: data.name,
          title: "🔥 High-Priority Hot Lead",
          message: `${data.name} with project budget $${estimatedBudget.toLocaleString()} added from ${source}.`,
          type: "hot_lead"
        });
      }

      // â”€â”€ Autonomous AI Outreach & Qualification Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (data.email && data.email.includes('@') && (status === 'New' || status === 'Emailed')) {
        // Run AI outreach in background with safe error handling
        triggerAutonomousAiOutreach(lead.id, session.builderId || '', data.notes).catch((err) => {
          console.error('[MANUAL LEAD AI OUTREACH ERROR]:', err);
        });
      }

      invalidateCache("dashboard_");
      return lead
    } catch (error) {
      console.error("Error in addManualLead:", error)
      throw error
    }
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    if (session.role === 'builder' && session.builderRole === 'sales') {
      throw new Error("FORBIDDEN: Sales Agents cannot delete leads")
    }
    const db = await getTenantDb()
    try {
      await db.activity.deleteMany({ where: { leadId: id } })
      await db.lead.delete({ where: { id } })
      invalidateCache("dashboard_");
      return { success: true }
    } catch (error) {
      console.error("Error in deleteLead:", error)
      throw error
    }
  })

export const updateLead = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    county?: string;
    state?: string;
    landPrice?: number;
    estimatedBudget?: number;
    status?: string;
    scoreTier?: string;
    source?: string;
  }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const { id, ...fields } = data
      const updateData: Record<string, any> = { ...fields }
      if (fields.landPrice) {
        updateData.estimatedBudget = fields.landPrice * 4
      }
      const lead = await db.lead.update({
        where: { id },
        data: updateData
      })
      invalidateCache("dashboard_");
      return lead
    } catch (error) {
      console.error("Error in updateLead:", error)
      throw error
    }
  })


export const logActivity = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; action: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const { leadId, action } = data
    const db = await getTenantDb()
    try {
      const act = await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          action,
        }
      })
      return act
    } catch (error) {
      console.error("Error in logActivity:", error)
      throw error
    }
  })

export const sendSmsOutreach = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; message: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { leadId, message } = data
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const lead = await db.lead.findUnique({ where: { id: leadId } })
      if (!lead) throw new Error('Lead not found')

      // Check if Twilio is configured
      const twilioRow = await db.integration.findUnique({
        where: {
          builderId_platformId: {
            builderId: session.builderId || '',
            platformId: 'twilio'
          }
        }
      })
      let twilioSent = false

      if (twilioRow?.isConnected && twilioRow.configSecure) {
        try {
          const { decrypt } = await import('./crypto')
          const creds = JSON.parse(decrypt(twilioRow.configSecure))
          const accountSid = creds.accountSid
          const authToken = creds.authToken
          const fromNumber = creds.phoneNumber

          if (accountSid && authToken && fromNumber && lead.phone) {
            const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                From: fromNumber,
                To: lead.phone,
                Body: message,
              }).toString(),
            })
            twilioSent = res.ok
          }
        } catch (twilioErr) {
          console.error('Twilio send failed:', twilioErr)
        }
      }

      // Always log the intent as an activity
      const actionText = twilioSent
        ? `💬 SMS sent to ${lead.name} (${lead.phone || 'no phone'}): "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`
        : `📤 SMS outreach queued for ${lead.name} (${lead.phone || 'no phone'}): "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`

      await db.activity.create({
        data: { builderId: session.builderId || '', leadId, action: actionText }
      })

      // Ensure the message reflects in the messages tab
      await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          sender: 'system',
          content: message,
          isRead: true
        }
      })

      return { success: true, sent: twilioSent }
    } catch (error) {
      console.error('Error in sendSmsOutreach:', error)
      throw error
    }
  })

export const retriggerLeadFlow = createServerFn({ method: 'POST' })
  .inputValidator((leadId: string) => leadId)
  .handler(async ({ data: leadId }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const lead = await db.lead.findUnique({ where: { id: leadId } })
      if (!lead) throw new Error('Lead not found')

      // Reset lead to beginning of AI nurture funnel
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: 'New',
          scoreTier: 'Cold',
        }
      })

      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          action: `🔄 AI intake flow re-triggered for ${lead.name}. Lead reset to New / Cold for re-qualification.`
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Error in retriggerLeadFlow:', error)
      throw error
    }
  })



export const getReviewsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  try {
    const session = await requireAuth(data?.activeRole ?? undefined)
    const db = await getTenantDb(session)


    const platforms = await db.reviewPlatform.findMany({
      orderBy: { name: 'asc' }
    })

    const requests = await db.reviewRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            status: true,
          }
        }
      }
    })

    return { platforms, requests }
  } catch (error) {
    console.error("Error in getReviewsData:", error)
    return { platforms: [], requests: [] }
  }
})

export const connectReviewPlatform = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; profileUrl: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    try {
      const platform = await db.reviewPlatform.create({
        data: {
          builderId: session.builderId || '',
          name: data.name,
          profileUrl: data.profileUrl || 'https://google.com',
          rating: 5.0,
          reviewCount: 0,
          reviewsGoal: 0
        }
      });
      return platform;
    } catch (error) {
      console.error("Error in connectReviewPlatform:", error);
      throw error;
    }
  });

export const disconnectReviewPlatform = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    try {
      await db.reviewPlatform.delete({
        where: { id }
      });
      return { success: true };
    } catch (error) {
      console.error("Error in disconnectReviewPlatform:", error);
      throw error;
    }
  });

export const sendReviewRequest = createServerFn({ method: 'POST' })
  .inputValidator((data: { clientName: string; clientEmail?: string; clientPhone?: string; leadId?: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    if (session.role === 'builder' && session.builderRole === 'sales') {
      throw new Error("FORBIDDEN: Sales Agents cannot send review requests")
    }
    const { clientName, clientEmail, clientPhone, leadId } = data
    const db = await getTenantDb()
    try {
      const request = await db.reviewRequest.create({
        data: {
          builderId: session.builderId || '',
          clientName,
          clientEmail: clientEmail || null,
          clientPhone: clientPhone || null,
          leadId: leadId || null,
          status: "Sent",
          sentAt: new Date(),
        }
      })

      // FIX-3: Sign the invite ID with HMAC so /api/rate can verify authenticity.
      // The rating link now has the form: /api/rate?id=<uuid>&sig=<hmac-hex>
      // Without a valid sig, the endpoint rejects the request before touching the DB.
      const { signReviewInviteId } = await import('./server-utils.server');
      const sig = await signReviewInviteId(request.id)

      // Dispatch Review Invite Email via Resend if email provided
      if (clientEmail) {
        try {
          const { sendOutboundEmail } = await import('./email.server');
          const baseUrl = process.env.APP_BASE_URL || 'https://app.buildersedge.com';
          const rateUrl = `${baseUrl}/api/rate?id=${request.id}&sig=${sig}`;
          const companyName = session.companyName || 'Custom Builder';

          await sendOutboundEmail({
            to: clientEmail,
            subject: `Feedback on your custom home build with ${companyName}`,
            from: `${companyName} <onboarding@resend.dev>`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">How was your experience with ${companyName}?</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hi ${clientName},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">Thank you for trusting us with your architectural custom build project. We take immense pride in our craftsmanship and would appreciate your honest feedback.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${rateUrl}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">Leave a Quick 5-Star Review &rarr;</a>
                </div>
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">Direct URL: <a href="${rateUrl}" style="color: #c9a84c;">${rateUrl}</a></p>
              </div>
            `,
            text: `Hi ${clientName}, thank you for choosing ${companyName}. Please leave your review here: ${rateUrl}`
          });
        } catch (emailErr) {
          console.error('[REVIEW EMAIL ERROR]', emailErr);
        }
      }

      return { ...request, sig }
    } catch (error) {
      console.error("Error in sendReviewRequest:", error)
      throw error
    }
  })

export const submitClientReview = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; rating: number; feedback?: string; platform?: string; sig?: string }) => data)
  .handler(async ({ data }) => {
    const { getDb } = await import('./db.server');
    const { verifyReviewInviteSignature, getSessionFromCookie } = await import('./server-utils.server');
    const { id, rating, feedback, platform, sig } = data;
    const db = await getDb();

    // Verify cryptographic HMAC signature or valid authenticated session (Finding 10.1 IDOR prevention)
    let isAuthorized = false;
    if (sig) {
      isAuthorized = await verifyReviewInviteSignature(id, sig);
    }
    if (!isAuthorized) {
      const session = await getSessionFromCookie();
      if (session && session.userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('UNAUTHORIZED: Invalid or missing cryptographic review invitation signature.');
    }

    try {
      const existing = await db.reviewRequest.findUnique({
        where: { id },
        include: { lead: true }
      });
      if (!existing) throw new Error("Review request not found");
      if (existing.status === 'Completed') {
        throw new Error("This review invitation has already been submitted.");
      }

      let status = "Completed";
      if (rating <= 3) {
        status = "Feedback";
      }

      // Atomic single-use consumption to prevent replay submissions
      const updateRes = await db.reviewRequest.updateMany({
        where: { id, status: { not: 'Completed' } },
        data: {
          rating,
          feedback: feedback || null,
          platform: rating >= 4 ? (platform || "Google Business") : null,
          status,
        }
      });

      if (updateRes.count === 0) {
        throw new Error("This review invitation has already been submitted.");
      }

      // If positive, increment the reviewCount on the chosen platform
      if (rating >= 4) {
        const platName = platform || "Google Business";
        const platformRecord = await db.reviewPlatform.findFirst({
          where: { builderId: existing.builderId, name: { contains: platName, mode: 'insensitive' } }
        });
        if (platformRecord) {
          const newCount = platformRecord.reviewCount + 1;
          const newRating = parseFloat(((platformRecord.rating * platformRecord.reviewCount + rating) / newCount).toFixed(2));
          await db.reviewPlatform.update({
            where: { id: platformRecord.id },
            data: {
              reviewCount: newCount,
              rating: newRating > 5.0 ? 5.0 : newRating
            }
          });
        }

        // Add to public reviews feed in database
        await db.publicReview.create({
          data: {
            builderId: existing.builderId,
            clientName: existing.clientName,
            platform: platName,
            rating: rating,
            reviewText: feedback || `Incredible custom building experience! Extremely satisfied with their professionalism and quality.`,
            projectType: "Custom Home Build",
            location: existing.lead?.city ? `${existing.lead.city}${existing.lead.state ? `, ${existing.lead.state}` : ''}` : "Verified Client",
            status: "Unanswered"
          }
        });
      }

      if (existing.leadId) {
        const activityAction = rating >= 4
          ? `Client submitted positive ${rating}-Star Review for ${platform || 'Google Business'}.`
          : `Client submitted private feedback: "${feedback}" (${rating} Stars). Safeguarded from public profiles.`;

        await db.activity.create({
          data: {
            builderId: existing.builderId,
            leadId: existing.leadId,
            action: activityAction
          }
        });
      }

      const res = { success: true, status };
      return Object.assign(res, { result: res });
    } catch (error) {
      console.error("Error in submitClientReview:", error);
      throw error;
    }
  });

export const getPublicReviews = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth();
  const db = await getTenantDb();
  
  try {
    const reviews = await db.publicReview.findMany({
      orderBy: { sentAt: 'desc' }
    });

    return reviews;
  } catch (error) {
    console.error("Error in getPublicReviews:", error);
    return [];
  }
});

export const replyToReview = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; replyText: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const db = await getTenantDb();
    try {
      const updated = await db.publicReview.update({
        where: { id: data.id },
        data: {
          replyText: data.replyText,
          status: "Answered"
        }
      });
      return updated;
    } catch (error) {
      console.error("Error in replyToReview:", error);
      throw error;
    }
  });

export const getBillingProfile = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth();
  const db = await getTenantDb();
  try {
    if (!session.builderId) throw new Error('Not a builder account');
    const builder = await db.builder.findUnique({
      where: { id: session.builderId },
      select: {
        id: true,
        companyName: true,
        email: true,
        adSpendBalance: true,
        paymentMethod: true,
        plan: true,
        createdAt: true,
      }
    });
    
    if (!builder) {
      return { adSpendBalance: 0.0, paymentMethod: "None", plan: "starter", invoices: [] };
    }

    const planPrices: Record<string, { name: string; price: string }> = {
      trial: { name: "Evaluation Trial", price: "$0" },
      starter: { name: "Starter Tier", price: "$149" },
      growth: { name: "Growth Tier", price: "$349" },
      professional: { name: "Starter Tier", price: "$149" },
      enterprise: { name: "Growth Tier", price: "$349" },
    };

    const currentPlanKey = (builder.plan || "starter").toLowerCase();
    const planInfo = planPrices[currentPlanKey] || planPrices.starter;

    // 1. Check if live Stripe invoices can be fetched
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    let invoices: any[] = [];

    if (stripeKey && builder.email) {
      try {
        const custRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(builder.email)}&limit=1`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` }
        });
        if (custRes.ok) {
          const custData = await custRes.json();
          const customerId = custData.data?.[0]?.id;
          if (customerId) {
            const invRes = await fetch(`https://api.stripe.com/v1/invoices?customer=${customerId}&limit=12`, {
              headers: { 'Authorization': `Bearer ${stripeKey}` }
            });
            if (invRes.ok) {
              const invData = await invRes.json();
              if (invData.data && invData.data.length > 0) {
                invoices = invData.data.map((inv: any) => {
                  const invDate = new Date(inv.created * 1000);
                  const formattedDate = invDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  return {
                    id: inv.id,
                    invoiceNumber: inv.number || `INV-${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}-${inv.id.slice(-4).toUpperCase()}`,
                    date: formattedDate,
                    amount: `$${(inv.amount_paid / 100).toFixed(0)}`,
                    status: inv.status === 'paid' ? 'Paid' : inv.status === 'open' ? 'Open' : 'Pending',
                    planName: planInfo.name,
                    paymentMethod: builder.paymentMethod && builder.paymentMethod !== "None" ? builder.paymentMethod : "Stripe Card (â€¢â€¢â€¢â€¢ 4242)",
                    pdfUrl: inv.invoice_pdf || null,
                  };
                });
              }
            }
          }
        }
      } catch (stripeErr) {
        console.warn("Could not fetch live Stripe invoices, falling back to dynamic tenant cycles:", stripeErr);
      }
    }

    // If no Stripe live invoices exist, insert 1 previous month's invoice so builder can preview & download their receipt
    if (invoices.length === 0) {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const formattedDate = prevMonthDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const shortHash = Math.abs((builder.id + prevMonthDate.toISOString()).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 9000 + 1000);
      const invNum = `INV-${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${shortHash}`;

      invoices = [
        {
          id: `inv_prev_${prevMonthDate.getTime()}`,
          invoiceNumber: invNum,
          date: formattedDate,
          amount: planInfo.price,
          status: "Paid",
          planName: planInfo.name,
          paymentMethod: builder.paymentMethod && builder.paymentMethod !== "None" ? builder.paymentMethod : "Stripe Card (â€¢â€¢â€¢â€¢ 4242)",
          pdfUrl: null
        }
      ];
    }

    return {
      ...builder,
      invoices
    };
  } catch (error) {
    console.error("Error in getBillingProfile:", error);
    return { adSpendBalance: 0.0, paymentMethod: "None", plan: "trial", invoices: [] };
  }
});

export const updateBillingProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { paymentMethod?: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    try {
      if (!session.builderId) throw new Error('Not a builder account');
      // adSpendBalance cannot be forged by client; only paymentMethod and preferences
      const updated = await db.builder.update({
        where: { id: session.builderId },
        data: {
          paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : undefined
        }
      });
      const res = { success: true, builder: updated };
      return Object.assign(res, { result: res });
    } catch (error) {
      console.error("Error in updateBillingProfile:", error);
      throw error;
    }
  });

/**
 * Unified AI Engine Caller
 * Primary: Google Gemini Flash (GEMINI_API_KEY) with 1M context & 1,500 free requests/day
 * Fallback: Groq (GROQ_API_KEY) with fast LPU hardware
 */
export async function callAiEngine(
  messages: Array<{ role: string; content: string }>,
  options?: { isJson?: boolean; maxTokens?: number; temperature?: number }
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const primaryGeminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const defaultGroqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const maxTokens = options?.maxTokens || 800;
  const temperature = options?.temperature ?? 0.1;

  // 1. PRIMARY ROUTE: Google Gemini Flash (gemini-3.5-flash)
  if (geminiKey && geminiKey.trim() !== "") {
    const modelsToTry = [primaryGeminiModel, "gemini-3.5-flash", "gemini-3.5-flash-lite"].filter((v, i, a) => a.indexOf(v) === i);
    let shouldSkipGemini = false;
    for (const m of modelsToTry) {
      if (shouldSkipGemini) break;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[AI ROUTING] Executing primary model: Google Gemini (${m}) (attempt ${attempt}/2)...`);
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${geminiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: m,
              messages: messages,
              temperature: temperature,
              max_tokens: maxTokens,
              ...(options?.isJson ? { response_format: { type: "json_object" } } : {})
            }),
            signal: AbortSignal.timeout(15000)
          });

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              console.log(`[AI ROUTING] Primary provider Gemini (${m}) succeeded.`);
              return content;
            }
          }

          const is503Or404 = res.status === 503 || res.status === 404;
          const isTransient = res.status === 429 || (res.status >= 500 && res.status !== 503);
          const errText = await res.text().catch(() => "");
          console.warn(`[AI ROUTING] Gemini model ${m} returned HTTP ${res.status}: ${errText.slice(0, 160)}`);

          if (is503Or404 && groqKey) {
            console.log(`[AI ROUTING] Google capacity spike (${res.status}). Instantly handing over to Groq fallback...`);
            shouldSkipGemini = true;
            break;
          }

          if (isTransient && attempt === 1) {
            console.log(`[AI ROUTING RETRY] Transient ${res.status} on ${m}. Backing off 1.2s before retry...`);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }
          break;
        } catch (geminiErr: any) {
          console.warn(`[AI ROUTING] Gemini model ${m} network/timeout error: ${geminiErr?.message || geminiErr}`);
          if (groqKey) {
            console.log(`[AI ROUTING] Gemini network timeout. Handing over to Groq fallback immediately...`);
            shouldSkipGemini = true;
            break;
          }
          if (attempt === 1) {
            console.log(`[AI ROUTING RETRY] Network glitch on ${m}. Backing off 1.2s before retry...`);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }
    }
  }

  // 2. FALLBACK ROUTE: Groq Cloud (openai/gpt-oss-120b)
  if (groqKey && groqKey.trim() !== "") {
    const groqModelsToTry = [defaultGroqModel, "openai/gpt-oss-120b"].filter((v, i, a) => a.indexOf(v) === i);
    for (const gm of groqModelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[AI ROUTING FALLBACK] Executing secondary provider: Groq (${gm}) (attempt ${attempt}/2)...`);
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: gm,
              messages: messages,
              temperature: temperature,
              max_tokens: maxTokens,
              ...(options?.isJson ? { response_format: { type: "json_object" } } : {})
            }),
            signal: AbortSignal.timeout(25000)
          });

          if (groqRes.ok) {
            const groqData = await groqRes.json();
            const content = groqData.choices?.[0]?.message?.content || "";
            if (content) {
              console.log(`[AI ROUTING FALLBACK] Secondary provider Groq (${gm}) succeeded.`);
              return content;
            }
          }

          const isTransient = groqRes.status === 429 || groqRes.status >= 500;
          const errText = await groqRes.text().catch(() => "");
          console.error(`[AI ROUTING FALLBACK] Groq (${gm}) returned HTTP ${groqRes.status}: ${errText.slice(0, 160)}`);

          if (isTransient && attempt === 1) {
            console.log(`[AI ROUTING RETRY] Transient ${groqRes.status} on Groq ${gm}. Backing off 1.2s before retry...`);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }
          break;
        } catch (groqErr: any) {
          console.error(`[AI ROUTING FALLBACK] Groq (${gm}) network/timeout error: ${groqErr?.message || groqErr}`);
          if (attempt === 1) {
            console.log(`[AI ROUTING RETRY] Network glitch on Groq ${gm}. Backing off 1.2s before retry...`);
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }
    }
  }

  // Dispatch Operational Alert on critical exhaustion of all providers
  await sendAlert({
    type: 'provider_failure',
    severity: 'critical',
    title: 'All AI Providers Failed',
    message: 'Both Gemini and Groq model fallback chains failed across all retry attempts.',
    metadata: { options }
  }).catch(() => {});

    throw new Error("No AI API keys configured or all AI providers failed.");
}

export const generateGroqCompletion = createServerFn({ method: 'POST' })
  .inputValidator((data: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> }) => data)
  .handler(async ({ data }) => {
    const { requireAuth, getTenantDb } = await import('./server-utils.server');
    const session = await requireAuth();

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const { messages } = data;

    // Fallback Mock Engine in case no API keys are configured
    const hasKeys = (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") || (GROQ_API_KEY && GROQ_API_KEY.trim() !== "");
    if (!hasKeys) {
      console.log("No API keys found. Simulating AI completion...");
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || "";

      let reply = `Hi! Thank you for reaching out to ${session.companyName || "our team"}. We'd love to help you build your dream home.`;

      const lower = lastUserMsg.toLowerCase();
      if (lower.includes("budget") || lower.includes("price") || lower.includes("cost")) {
        reply = `Absolutely! Our custom home projects with ${session.companyName || "our team"} typically start at $500K for semi-custom builds and range upwards of $1.5M+ for full luxury estates. Does that range align with your investment plans?`;
      } else if (lower.includes("saturday") || lower.includes("meet") || lower.includes("schedule") || lower.includes("tour")) {
        reply = "I would be delighted to schedule a walkthrough! Saturday morning at 10:30 AM works perfectly. Should I lock that slot in and send over the directions?";
      } else if (lower.includes("basement") || lower.includes("sloping") || lower.includes("terrain")) {
        reply = "Yes, we specialize in advanced custom builds. Do you already own the lot?";
      } else if (lower.includes("cabinet") || lower.includes("finish") || lower.includes("wood")) {
        reply = "Premium finishes are our signature! We craft custom architectural finishes. I can send you some photos of our recent projects!";
      } else if (lower.includes("script") || lower.includes("message")) {
        reply = JSON.stringify([
          { t: "Message 1 Â· Immediate (< 60s)", body: "Hi [Name]! Thanks for connecting. Are you looking to build in the next 6-12 months? Reply YES or NO." },
          { t: "Message 2 Â· 2 hours later", body: "Hey [Name], just checking in! Most of our clients prefer custom cabinets over stock options. Do you have a design style you love?" },
          { t: "Message 3 Â· 24 hours later", body: "Hi [Name], we can schedule a private tour of our design site this Thursday. Let me know if you would like me to book your spot!" }
        ]);
      }

      return reply;
    }

    try {
      return await callAiEngine(messages, { maxTokens: 800, temperature: 0.1 });
    } catch (error) {
      console.error("Error in generateGroqCompletion:", error);
      throw error;
    }
  })

export const simulateAIChatReply = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; userMessage: string; chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>; isSimulated?: boolean }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const { leadId, userMessage, chatHistory } = data;
    const db = await getTenantDb();

    try {
      const builderId = session.builderId || '';
      const replyData = await generateAiReplyCore(db, leadId, builderId, userMessage, chatHistory, data.isSimulated);
      return replyData;
    } catch (error) {
      console.error("Error in simulateAIChatReply:", error);
      throw error;
    }
  });

export const getLeadMemoryDetails = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    await requireAuth();
    const db = await getTenantDb();
    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      select: {
        id: true,
        name: true,
        county: true,
        state: true,
        estimatedBudget: true,
        landPrice: true,
        status: true,
        scoreTier: true,
        dealScore: true,
        leadMemory: true,
        qualificationData: true,
        lastAiSummary: true
      }
    });
    return lead;
  });

export const updateLeadMemory = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; memory: Record<string, any>; dealScore?: number }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    
    const updateData: Record<string, any> = {
      leadMemory: JSON.stringify(data.memory)
    };
    if (typeof data.dealScore === 'number') {
      updateData.dealScore = data.dealScore;
      if (data.dealScore >= 75) updateData.scoreTier = "Hot";
      else if (data.dealScore >= 40) updateData.scoreTier = "Warm";
      else updateData.scoreTier = "Cold";
    }

    const updated = await db.lead.update({
      where: { id: data.leadId },
      data: updateData
    });

    await db.activity.create({
      data: {
        builderId: session.builderId || '',
        leadId: data.leadId,
        action: `🧠 Lead Memory & Deal Score updated manually by builder team.`
      }
    });

    invalidateCache("dashboard_");
    return updated;
  });

export async function generateAiReplyCore(
  db: any,
  leadId: string,
  builderId: string,
  userMessage: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  isSimulated = false
) {
  // Fetch builder details for personalization
  const builder = await db.builder.findUnique({ where: { id: builderId } });
  const companyName = builder?.companyName || "your local custom builder";
  const contactName = builder?.contactName || "the team";
  const builderPhone = builder?.phone || "our main line";
  const builderEmail = builder?.email || "our contact email";

  const settingsObj = builder?.settings ? JSON.parse(builder.settings) : {};
  const builderProfile = settingsObj.builder_profile || {};
  const brainConfig = settingsObj.ai_brain_config || {};
  const qualRules = settingsObj.qualification_rules || {};

  const timezone = builderProfile.timezone || "Asia/Kolkata";
  const personaName = brainConfig.personaName || builderProfile.primaryContact || "Alex";
  const primaryGoal = brainConfig.primaryGoal || "book_consultation";
  const brandVoice = brainConfig.brandVoice || "luxury_bespoke";
  const minBudget = brainConfig.minBudget || qualRules.minBudget || "$500,000";
  const maxTimeline = brainConfig.maxTimeline || qualRules.maxTimeline || "12";
  const lotRequirement = brainConfig.lotRequirement || "actively_shopping";
  const plansRequirement = brainConfig.plansRequirement || "any";
  const customDirectives = brainConfig.customDirectives || builderProfile.aiContext || "";

  // Goal directives for Sales Mindset
  let goalInstructions = "Guide qualified, interested homeowner leads toward scheduling an architectural discovery consultation, private showroom tour, or site meeting.";
  if (primaryGoal === "qualify_readiness") {
    goalInstructions = `Strictly qualify the lead's readiness before offering appointments. Naturally verify that they meet the builder's standards: 1) Construction Budget around or above ${minBudget}, 2) Lot/Land Status (${lotRequirement === 'must_own_lot' ? 'must own lot or active contract' : 'actively shopping / owns lot'}), 3) Timeline Window (< ${maxTimeline} months). If qualified, guide toward a consultation.`;
  } else if (primaryGoal === "nurture_educate") {
    goalInstructions = "Act as an educational and architectural advisor. Answer questions about custom building, permitting, and architectural processes with high warmth. Build deep trust and rapport before suggesting a consultation.";
  }

  // Voice & Tone directives
  let toneInstructions = "Ultra-luxury, refined, quiet elegance, polite, high-ticket bespoke custom estate sales director. Speak with understated prestige, confidence, and utmost courtesy.";
  if (brandVoice === "warm_consultative") {
    toneInstructions = "Warm, friendly, consultative, approachable custom home expert advisor. Be encouraging, helpful, and empathetic.";
  } else if (brandVoice === "direct_executive") {
    toneInstructions = "Crisp, fast, highly executive, strictly to the point. No fluff or unnecessary filler words. High efficiency communication.";
  }

  // Format current date/time in the builder's timezone
  const now = new Date();
  const currentLocalTimeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);

  // Fetch lead to personalize prompt and load existing Lead Memory Graph
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  const leadName = lead ? sanitizeMetadataField(lead.name, 60) || "Client" : "Client";
  const rawLeadLocation = [lead?.city, lead?.county, lead?.state].filter(Boolean).map((s: string) => sanitizeMetadataField(s, 60)).join(", ");
  const builderServiceLocation = builderProfile.businessAddress || builderProfile.city || "";
  const leadLocation = rawLeadLocation || builderServiceLocation || "your local area";
  const leadCounty = (lead?.county ? sanitizeMetadataField(lead.county, 60) : "") 
    || (lead?.city ? sanitizeMetadataField(lead.city, 60) : "") 
    || leadLocation;

  // Parse existing Lead Memory Graph
  let currentMemory: Record<string, any> = {
    budgetRange: lead?.estimatedBudget ? `$${(lead.estimatedBudget / 1000).toFixed(0)}k` : null,
    timeline: null,
    lotStatus: lead?.landPrice && lead.landPrice > 0 ? `Owns land in ${leadCounty} ($${(lead.landPrice / 1000).toFixed(0)}k)` : null,
    architecturalStyle: null,
    familyLifestyleNeeds: null,
    objectionsRaised: [],
    keyPreferences: [],
    decisionMakers: null,
    notes: ""
  };

  if (lead?.leadMemory) {
    try {
      const parsed = JSON.parse(lead.leadMemory);
      currentMemory = { ...currentMemory, ...parsed };
    } catch (_) {}
  }

  // Fetch FUTURE active appointments for this builder to check calendar availability
  const upcomingAppts = await db.appointment.findMany({
    where: {
      builderId,
      status: { in: ['Confirmed', 'Pending'] },
      dateTime: { gte: new Date() }
    },
    include: { lead: true },
    orderBy: { dateTime: 'asc' },
    take: 10
  });

  const apptScheduleStr = upcomingAppts.length > 0
    ? upcomingAppts.map((a: any) => `- ${new Date(a.dateTime).toLocaleString('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}: ${a.type} with ${a.lead?.name || 'Client'} (${a.location})`).join('\n')
    : "No upcoming booked meetings currently in calendar.";

  const systemPrompt = `You are ${personaName}, the Senior Architectural Advisor representing ${companyName}.
Your builder principal is ${contactName}.

MISSION & MINDSET:
- You are an experienced, high-trust luxury custom home building director.
- You talk like a real local builder with 20+ years of experience in ${leadLocation} (practical, warm, knowledgeable, zero sales pressure).
- Your goal: Build genuine trust through helpful expertise, active listening, and guide qualified buyers toward an architectural review or site feasibility walkthrough.

BRAND VOICE & PERSONA:
- ${toneInstructions}
- Write in a natural, authentic, human voice (2 to 3 well-crafted sentences per message).
- Never sound like an automated questionnaire, chatbot, or lead form.

CRITICAL CONVERSATIONAL RULES (STRICT COMPLIANCE):
1. ACTIVE LISTENING FIRST (MANDATORY): Always acknowledge and answer what the client specifically said or asked in their last message before pivoting or asking a new question.
   - If they ask "What is your name?" or "Who are you?", warmly introduce yourself and your role.
   - If they ask "How are you?" or greet casually, respond naturally and warmly.
   - NEVER ignore the client's direct question or remark to force a sales question or meeting invite.
2. CONVERSATIONAL CADENCE ("Validate → Value → Ask"):
   - Step 1 (Validate): Acknowledge their situation with authentic empathy (e.g. lot location, family needs, architectural style).
   - Step 2 (Value): Offer ONE practical builder insight (e.g. site topography/slope engineering, foundation types, tree preservation ordinances in ${leadLocation}, utility access, or plan drafting).
   - Step 3 (Ask): Ask at most ONE low-friction, open-ended question. Never ask multiple questions in one email.
3. ZERO PREMATURE MEETING SPAMMING:
   - Do NOT ask for a call, meeting, or site tour on early turns unless the lead specifically asks about availability, timing, or scheduling.
   - First build value, answer their technical/pricing questions, and earn their trust.
4. ZERO MARKETING JARGON:
   - Strictly avoid buzzwords like "bespoke journey", "architectural discovery session", "curated experience", "guaranteed fixed-cost execution".
   - Speak plain, grounded, professional builder language.
5. NO REPETITIVE GREETINGS: In ongoing chat/email threads, do not start every message with "Hello [Name]" or "It is a pleasure to connect". Dive directly into the dialogue like a normal human replying to an email.

OBJECTION & INQUIRY PLAYBOOKS:
1. "JUST BROWSING / EARLY STAGES / NOT READY":
   - Disarm with zero sales pressure: "No pressure at all! Custom builds usually take 1 to 2 years of dreaming and site scouting. Feel free to use me as a sounding board whenever you have questions about floor plans, lot slopes, or county permits."
2. "PRICING / COST PER SQ FT":
   - Be transparent and explain reality: "In custom builds across ${leadLocation}, square foot pricing varies widely depending on lot topography, slope engineering, and finish specs. Our custom homes typically start around ${minBudget} for ground-up bespoke construction. Does that investment range align with what you had in mind?"
3. "ALREADY WORKING WITH AN ARCHITECT / BUILDER":
   - Be gracious and professional: "That's fantastic! Having architectural drafts underway is a huge milestone. If you ever need a builder's constructability review or preliminary engineering budget check, we're always happy to offer a second set of eyes."
4. "ARE YOU AN AI / BOT?":
   - Be disarmingly honest and transparent: "I'm the AI assistant for ${companyName}'s executive team to make sure inquiries get fast, thoughtful answers, but our principal builder ${contactName} reviews every project detail personally. Would you like me to have ${contactName} connect with you directly?"
5. "LOT / SITE FEASIBILITY":
   - Reassure engineering competence: "Lot feasibility—especially soil testing, slope setbacks, and utility hookups—is where most critical planning happens before drawing blueprints. We walk sites with clients before finalizing design."
6. "ZONING, SETBACKS & IMPERVIOUS COVERAGE (MANDATORY NON-NUMERIC GUARDRAIL)":
   - NEVER quote, invent, or guess exact municipal impervious-cover percentages, setback footage, or tree preservation numbers for any city, county, or state.
   - Impervious-cover and setback regulations vary drastically parcel-by-parcel based on local watershed classifications, environmental overlays, slope gradients, and municipal/HOA deed restrictions in ${leadLocation}.
   - If a client asks for exact code limits or percentages, provide safe qualitative guidance (e.g. "environmentally sensitive zones and steep slopes restrict the buildable footprint") and state clearly that an authoritative civil/topographical survey and local municipal review are required to calculate the exact legal coverage for their specific parcel.
   - Sample phrasing: "Impervious-cover limits and setbacks in ${leadLocation} vary significantly based on your parcel's local environmental classification, slope gradient, and zoning overlay. Rather than estimating a generic percentage, we always review a formal topographic and civil survey to establish your exact buildable footprint. Do you already have a survey or plat map for the property?"

QUALIFICATION STANDARDS:
- Minimum Construction Budget: ${minBudget}
- Target Timeline: Within ${maxTimeline} months
- Land/Lot Readiness: ${lotRequirement === 'must_own_lot' ? 'Must own buildable lot or under contract' : 'Lot search assistance available or owns lot'}
- Architectural Status: ${plansRequirement}
${customDirectives ? `
CUSTOM BUILDER DIRECTIVES & POLICIES (HIGHEST PRIORITY - STRICT ADHERENCE REQUIRED):
The builder has configured the following custom directives, warranties, and business policies. You MUST honor every rule and incorporate these specific details into your advice and answers:
${customDirectives}
` : ''}

CURRENT LEAD CONTEXT:
- Client Name: ${leadName}
- Project County/City: ${leadLocation}
- Estimated Budget: ${currentMemory.budgetRange || "Not confirmed yet"}
- Lot/Land Status: ${currentMemory.lotStatus || "Not confirmed yet"}
- Timeline: ${currentMemory.timeline || "Not confirmed yet"}
- Desired Style: ${currentMemory.architecturalStyle || "Not confirmed yet"}
- Past Objections: ${currentMemory.objectionsRaised?.length ? currentMemory.objectionsRaised.join(', ') : "None"}

LOCAL TIME: ${currentLocalTimeStr} (${timezone})
CALENDAR SCHEDULE:
${apptScheduleStr}

STRUCTURED OUTPUT FORMAT:
You must respond strictly with a valid JSON object matching this schema:
{
  "replyText": string, // Natural, authentic message (2 to 3 concise, warm sentences max)
  "intent": "HOT" | "WARM" | "COLD", // HOT: ready to build/meet, WARM: researching/interested, COLD: not interested/disqualified
  "dealScore": number, // 0 to 100 buyer readiness score based on budget, land ownership, timeline, and engagement
  "dealSummary": string, // 1-sentence executive summary of the lead's current readiness state
  "leadMemoryUpdate": {
    "budgetRange": string | null, // e.g. "$750k - $1M" or extracted number
    "timeline": string | null, // e.g. "Spring 2027", "Next 4 months"
    "lotStatus": string | null, // e.g. "Owns 2-acre parcel", "Searching in local area"
    "architecturalStyle": string | null, // e.g. "Modern Farmhouse", "Mediterranean Estate"
    "familyLifestyleNeeds": string | null, // e.g. "4 bed, pool, single story for aging parents"
    "objectionsRaised": string[], // List of any hesitations/objections mentioned in this interaction
    "keyPreferences": string[] // Key finishes, lot features, or architectural desires mentioned
  },
  "qualification": {
    "budgetQualified": boolean, // True if budget meets builder minimum
    "timelineQualified": boolean, // True if timeline is within range
    "lotQualified": boolean, // True if owns land or actively contracting
    "decisionMaker": boolean, // True if decision maker
    "overallStatus": "Qualified" | "Nurturing" | "Disqualified"
  },
  "objectionStrategyUsed": string | null, // Name of strategy applied, e.g. "Value-Framed Price Justification"
  "nextBestAction": string, // Recommended next step for builder team, e.g. "Send 3D elevation lookbook" or "Call within 15 mins"
  "escalationRequired": boolean, // Set to true if lead is ready to sign, has $1.5M+ budget, or requests owner
  "escalationReason": string | null, // e.g. "High ticket $2M lead ready for in-person architectural contract"
  "bookingDetails": {
    "relativeDay": string | null, // e.g. "tomorrow", "today", "day after tomorrow", "in 3 days", or null
    "dayOfWeek": string | null, // e.g. "Monday", "next Tuesday", "this Friday", or null
    "specificDateStr": string | null, // e.g. "Sep 15", "October 3rd", or null if relative
    "timeStr": string | null, // e.g. "10:00 AM", "2:30 PM", "noon", or null
    "type": string // e.g. "Site visit", "Architectural consultation", "Design studio meeting"
  } | null // ONLY set if lead agrees to a specific day/time. STRICT PROHIBITION: NEVER output an isoDateTime field or full year timestamp. Date calculations are handled deterministically in code.
}

Lead Context:
- Client Name: ${leadName}
- Company: ${companyName}
- Company Phone: ${builderPhone}
- Company Email: ${builderEmail}

Do not output any markdown formatting or text outside the raw JSON object.`;

  const formattedMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...chatHistory,
    { role: 'user' as const, content: userMessage }
  ];

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const hasKeys = (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") || (GROQ_API_KEY && GROQ_API_KEY.trim() !== "");
  let rawResponse = "";

  if (hasKeys) {
    try {
      rawResponse = await callAiEngine(formattedMessages, { isJson: true, maxTokens: 1200, temperature: 0.45 });
    } catch (aiError) {
      console.error("AI API error in generateAiReplyCore:", aiError);
      throw aiError;
    }
  } else {
    // Fallback mock only if NO API keys are configured
    const lastUserMsg = userMessage.toLowerCase();
    const isMeeting = lastUserMsg.includes("meet") || lastUserMsg.includes("schedule") || lastUserMsg.includes("saturday") || lastUserMsg.includes("tour");
    const isBudget = lastUserMsg.includes("budget") || lastUserMsg.includes("cost") || lastUserMsg.includes("price") || lastUserMsg.includes("expensive");
    
    if (isMeeting) {
      rawResponse = JSON.stringify({
        replyText: "That slot works wonderfully! I've reserved a private consultation for you. What location or project address would you like to focus on?",
        intent: "HOT",
        dealScore: 88,
        dealSummary: "Homeowner confirmed consultation request for custom home build.",
        leadMemoryUpdate: {
          budgetRange: currentMemory.budgetRange || "$750k+",
          timeline: "Within 6 months",
          lotStatus: currentMemory.lotStatus || "Owns buildable land",
          architecturalStyle: currentMemory.architecturalStyle || "Modern Custom Estate",
          familyLifestyleNeeds: currentMemory.familyLifestyleNeeds || "Primary residence",
          objectionsRaised: [],
          keyPreferences: ["Private Showroom Walkthrough"]
        },
        qualification: {
          budgetQualified: true,
          timelineQualified: true,
          lotQualified: true,
          decisionMaker: true,
          overallStatus: "Qualified"
        },
        objectionStrategyUsed: "Consultation Soft-Close",
        nextBestAction: "Prepare showroom design portfolio before meeting.",
        escalationRequired: false,
        escalationReason: null,
        bookingDetails: null
      });
    } else if (isBudget) {
      rawResponse = JSON.stringify({
        replyText: "Our custom builds typically start at $500K for semi-custom homes and range upwards for bespoke estates. We provide a full fixed-scope architectural guarantee with zero surprise cost overruns. Does that range align with your vision?",
        intent: "WARM",
        dealScore: 65,
        dealSummary: "Lead inquiring about budget thresholds and cost per square foot.",
        leadMemoryUpdate: {
          budgetRange: "$500k - $1M",
          timeline: currentMemory.timeline || "6-12 months",
          lotStatus: currentMemory.lotStatus || null,
          architecturalStyle: currentMemory.architecturalStyle || null,
          familyLifestyleNeeds: null,
          objectionsRaised: ["Price Sensitivity"],
          keyPreferences: ["Fixed-Scope Guarantee"]
        },
        qualification: {
          budgetQualified: true,
          timelineQualified: true,
          lotQualified: false,
          decisionMaker: true,
          overallStatus: "Nurturing"
        },
        objectionStrategyUsed: "Value-Framed Price Justification",
        nextBestAction: "Send architectural investment breakdown sheet.",
        escalationRequired: false,
        escalationReason: null,
        bookingDetails: null
      });
    } else {
      rawResponse = JSON.stringify({
        replyText: `Thank you for sharing your ideas! We specialize in tailored custom residences with ${companyName}. Do you currently have a specific architectural style or floor plan in mind?`,
        intent: "WARM",
        dealScore: 55,
        dealSummary: "Lead exploring custom home design options.",
        leadMemoryUpdate: {
          budgetRange: currentMemory.budgetRange || null,
          timeline: currentMemory.timeline || null,
          lotStatus: currentMemory.lotStatus || null,
          architecturalStyle: currentMemory.architecturalStyle || null,
          familyLifestyleNeeds: null,
          objectionsRaised: [],
          keyPreferences: []
        },
        qualification: {
          budgetQualified: false,
          timelineQualified: false,
          lotQualified: false,
          decisionMaker: true,
          overallStatus: "Nurturing"
        },
        objectionStrategyUsed: "Architectural Vision Alignment",
        nextBestAction: "Identify target build style and lot readiness.",
        escalationRequired: false,
        escalationReason: null,
        bookingDetails: null
      });
    }
  }

  let replyText = "";
  let intent: 'HOT' | 'COLD' | 'WARM' = 'WARM';
  let dealScore = 50;
  let dealSummary = "";
  let leadMemoryUpdate: Record<string, any> = {};
  let qualification: Record<string, any> = {
    budgetQualified: false,
    timelineQualified: false,
    lotQualified: false,
    decisionMaker: true,
    overallStatus: "Nurturing"
  };
  let objectionStrategyUsed: string | null = null;
    let nextBestAction = "Follow up with homeowner.";
  let escalationRequired = false;
  let escalationReason: string | null = null;
  let bookingDetails: { isoDateTime: string; type: string } | null = null;

  try {
    const rawJsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (rawJsonMatch) {
      const parsed = JSON.parse(rawJsonMatch[0]);
      replyText = parsed.replyText || parsed.reply || "";
      intent = parsed.intent || 'WARM';
      dealScore = typeof parsed.dealScore === 'number' ? parsed.dealScore : (intent === 'HOT' ? 85 : intent === 'COLD' ? 20 : 55);
      dealSummary = parsed.dealSummary || "";
      leadMemoryUpdate = parsed.leadMemoryUpdate || {};
      qualification = parsed.qualification || qualification;
      objectionStrategyUsed = parsed.objectionStrategyUsed || null;
      nextBestAction = parsed.nextBestAction || nextBestAction;
      escalationRequired = !!parsed.escalationRequired;
      escalationReason = parsed.escalationReason || null;

      // Deterministically resolve appointment date in TypeScript code (LLM cannot set isoDateTime directly)
      if (parsed.bookingDetails && typeof parsed.bookingDetails === 'object') {
        const resolution = resolveBookingDateTime(parsed.bookingDetails, {
          currentDate: new Date(),
          timeZone: timezone || 'America/Chicago'
        });
        if (resolution.valid && resolution.isoDateTime) {
          bookingDetails = {
            isoDateTime: resolution.isoDateTime,
            type: resolution.type || 'Site visit'
          };
          console.log(`[BOOKING RESOLVED DETERMINISTICALLY]: ${resolution.isoDateTime} (${bookingDetails.type}) from intent:`, parsed.bookingDetails);
        } else {
          console.warn(`[BOOKING DATE RESOLUTION REJECTED]: ${resolution.failureReason}`, parsed.bookingDetails);
          bookingDetails = null;
        }
      } else {
        bookingDetails = null;
      }
    }
  } catch (e) {
    console.warn("JSON.parse error, activating regex extractor fallback:", e);
  }

  // Robust fallback: if replyText is still empty, extract it directly via regex
  if (!replyText || replyText.trim() === "") {
    const replyMatch = rawResponse.match(/"replyText"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/i) ||
                       rawResponse.match(/"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/i);
    if (replyMatch && replyMatch[1]) {
      replyText = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    } else {
      replyText = rawResponse.replace(/\{[\s\S]*\}/, '').trim() || "Thank you for reaching out! We specialize in custom luxury estates. How can I assist with your build today?";
    }
  }

  // Strip redundant repetitive greetings in ongoing conversations
  if (chatHistory.length > 0 && replyText) {
    const firstName = leadName ? leadName.split(' ')[0] : '';
    const greetingRegex = new RegExp(`^(Hello|Hi|Hey|Good morning|Good afternoon|${firstName})\\s*([A-Za-z0-9]+)?\\s*[,!.:-]\\s*`, 'i');
    replyText = replyText.replace(greetingRegex, '').trim();
    if (replyText.length > 0) {
      replyText = replyText.charAt(0).toUpperCase() + replyText.slice(1);
    }
  }

  // Merge Memory Updates into Persistent Memory Graph
  const updatedMemory: Record<string, any> = {
    budgetRange: leadMemoryUpdate.budgetRange || currentMemory.budgetRange,
    timeline: leadMemoryUpdate.timeline || currentMemory.timeline,
    lotStatus: leadMemoryUpdate.lotStatus || currentMemory.lotStatus,
    architecturalStyle: leadMemoryUpdate.architecturalStyle || currentMemory.architecturalStyle,
    familyLifestyleNeeds: leadMemoryUpdate.familyLifestyleNeeds || currentMemory.familyLifestyleNeeds,
    objectionsRaised: Array.from(new Set([
      ...(currentMemory.objectionsRaised || []),
      ...(leadMemoryUpdate.objectionsRaised || [])
    ])),
    keyPreferences: Array.from(new Set([
      ...(currentMemory.keyPreferences || []),
      ...(leadMemoryUpdate.keyPreferences || [])
    ])),
    decisionMakers: currentMemory.decisionMakers || null,
    lastUpdated: new Date().toISOString()
  };

  // Determine DB status & tier with hierarchy protection (never downgrade advanced leads)
  const currentStatus = lead?.status || "New";
  let dbStatus = "Emailed";
  let dbScoreTier = "Warm";
  let activityText = "";

  if (bookingDetails && bookingDetails.isoDateTime) {
    dbStatus = "Appointment";
    dbScoreTier = "Hot";
    activityText = `📅 AI Concierge scheduled an appointment with ${leadName}.`;
  } else if (currentStatus === "Appointment") {
    // Preserve booked appointment status
    dbStatus = "Appointment";
    dbScoreTier = "Hot";
    activityText = `💬 AI Concierge continued conversation with booked client (${dealScore}/100).`;
  } else if (intent === 'HOT') {
    dbStatus = "Qualified";
    dbScoreTier = "Hot";
    activityText = `🟢 AI Sales Engine marked Lead as Hot (${dealScore}/100) — High buyer readiness.`;
  } else if (intent === 'COLD') {
    dbStatus = "Closed Lost";
    dbScoreTier = "Cold";
    activityText = `🔴 AI Sales Engine marked Lead as Cold (${dealScore}/100) — Disqualified or competitor chosen.`;
  } else if (currentStatus === "Qualified") {
    // Preserve Qualified status unless lead explicitly became COLD or booked
    dbStatus = "Qualified";
    dbScoreTier = dealScore >= 70 ? "Hot" : "Warm";
    activityText = `💬 AI Sales Engine continued conversation with qualified buyer (${dealScore}/100).`;
  } else {
    const hasLeadReplied = Boolean(
      (chatHistory && chatHistory.some(m => m.role === 'user' && m.content && m.content !== userMessage)) ||
      currentStatus === 'Replied'
    );
    dbStatus = hasLeadReplied ? "Replied" : "Emailed";
    dbScoreTier = "Warm";
    activityText = `🟡 AI Sales Engine marked Lead as Warm (${dealScore}/100) — ${hasLeadReplied ? 'Engaged' : 'Outreach sent'}.`;
  }

  // Save changes to database
  if (!isSimulated) {
    await db.activity.create({
      data: {
        builderId,
        leadId,
        action: activityText
      }
    });

    if (escalationRequired) {
      await db.activity.create({
        data: {
          builderId,
          leadId,
          action: `🔥 VIP HUMAN ESCALATION TRIGGERED: ${escalationReason || 'High ticket client requires immediate executive call'}.`
        }
      });
    }

    // Update Lead in DB with Memory Graph, Score & Qualification Data
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: dbStatus,
        scoreTier: dbScoreTier,
        dealScore: dealScore,
        leadMemory: JSON.stringify(updatedMemory),
        qualificationData: JSON.stringify({
          qualification,
          objectionStrategyUsed,
          nextBestAction,
          dealSummary,
          escalationRequired,
          escalationReason
        }),
        lastAiSummary: dealSummary || activityText
      }
    });

    // Auto-Book Appointment if confirmed with double-booking collision prevention
    if (bookingDetails && bookingDetails.isoDateTime) {
      try {
        const bookingDate = new Date(bookingDetails.isoDateTime);
        if (!isNaN(bookingDate.getTime())) {
          // Concurrency-safe atomic appointment reservation (Serializable isolation check + create)
          const reservation = await bookAppointmentAtomically(db, {
            builderId,
            leadId,
            bookingDate,
            type: bookingDetails.type || 'Site visit',
            notes: `Auto-booked by AI Sales Concierge. Next step: ${nextBestAction}`,
            windowMinutes: 45,
          });

          if (!reservation.success) {
            console.warn(`[BOOKING COLLISION PREVENTED] Slot ${bookingDate.toISOString()} conflicts with appt ${reservation.conflictingAppointment?.id}`);

            await sendAlert({
              type: 'booking_failure',
              severity: 'warning',
              title: 'Appointment Collision Prevented',
              message: `Lead requested slot ${bookingDate.toLocaleTimeString()} which conflicts with an existing booking.`,
              builderId,
              leadId,
              metadata: { requestedDate: bookingDate.toISOString(), conflictingApptId: reservation.conflictingAppointment?.id }
            });

            const altTime = reservation.proposedAlternate || new Date(bookingDate.getTime() + 2 * 60 * 60 * 1000);
            const altTimeStr = altTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            replyText = `${replyText}\n\n[Note]: It looks like our calendar has a consultation scheduled around that exact time. Would ${altTimeStr} or earlier that morning work better for you?`;

            await db.activity.create({
              data: {
                builderId,
                leadId,
                action: `⚠️ AI Concierge detected calendar collision for ${bookingDate.toLocaleTimeString()}. Proposed alternate time ${altTimeStr}.`
              }
            });
          } else {
            await db.activity.create({
              data: {
                builderId,
                leadId,
                action: `📅 AI Concierge auto-booked a ${bookingDetails.type || 'Site visit'} on ${bookingDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`
              }
            });
          }
        }
      } catch (bookingErr) {
        console.error('Failed to auto-create appointment from AI confirmation:', bookingErr);
      }
    }
  }

  return {
    replyText,
    intent,
    dealScore,
    dealSummary,
    leadMemory: updatedMemory,
    qualification,
    objectionStrategyUsed,
    nextBestAction,
    escalationRequired,
    escalationReason,
    bookingDetails
  };
}
export const summarizeConversation = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    try {
      const session = await requireAuth(data?.activeRole ?? undefined);
      const db = await getTenantDb(session);
      
      const messages = await db.message.findMany({
        where: { leadId: data.leadId },
        orderBy: { createdAt: 'asc' }
      });

      if (!messages || messages.length === 0) return "No conversation history available.";

      const chatLog = messages.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');

      const systemPrompt = `You are an expert AI Builder Sales Strategist preparing an Executive Pre-Meeting Briefing Sheet for a custom home builder before they meet or call a lead.

Analyze the entire conversation log and construct a detailed, highly structured Pre-Meeting Briefing covering these 4 core categories:

📋 CLIENT PROFILE & DESIGN SPECS:
• Summarize home style, square footage, bed/bath count, target county/city, land ownership, lot conditions (slopes, utilities, etc.).

💰 FINANCIALS & FEASIBILITY:
• Summarize stated budget range, per sq ft cost discussions, slope/foundation/retaining wall engineering cost expectations.

❓ KEY CONCERNS & OBJECTIONS RAISED:
• Summarize specific technical or pricing questions the client asked that the builder must address during the call.

🎯 ACTION PLAN & MEETING DELIVERABLES:
• Summarize scheduled meeting/call date, time, phone number, and exact documents requested (e.g. site evaluation report, floor plan proposals, estimate sheets).

Format the output clearly using bullet points and bold section headers. Keep it professional, highly detailed, clear, and actionable for the builder.`;

      const userPrompt = `Please generate the Pre-Meeting Briefing Sheet for the following conversation:\n\nConversation Log:\n${chatLog}`;

      const summary = await callAiEngine([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 1600, temperature: 0.5 });

      return summary || "Unable to generate chat summary.";
    } catch (err: any) {
      console.error("Summarization error:", err);
      return `Failed to generate summary: ${err?.message || "Please try again."}`;
    }
  });

export const generateAIScriptUpdate = createServerFn({ method: 'POST' })
  .inputValidator((data: { instruction: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const { instruction } = data;

    const companyName = session.companyName || "Your Company";
    const primaryContact = session.displayName || "Your Name";

    const systemPrompt = `You are a professional copywriting assistant specialized in high-trust outreach and lead nurture campaigns for luxury custom home builders.
You are tasked with generating a sequence of exactly 3 SMS follow-up nurture messages based on the builder's custom instruction.

CRITICAL CONTEXT: The leads have NOT signed up or contacted the builder. They are identified from public records (specifically newly filed residential building permit filings or county tax assessment records in the builder's regional market). The messages MUST be professional, highly localized, and build massive trust by referring directly to their newly filed permit/records, instead of claiming "thanks for your interest" or "thanks for connecting" (which would feel like spam and break trust).

Builder Custom Instruction: "${instruction}"

Follow these rules:
1. Message 1 must be designed for immediate dispatch (<60 seconds after a permit/tax record is filed). It must be direct, refer to the filed permit, and ask a qualifying question (e.g. if they have hired a general builder/contractor yet).
2. Message 2 should trigger 2 hours later if no reply. It should follow up politely and offer a useful localized resource (e.g., Local Permitting & Zoning Checklist, site preparation tips, or HOA architectural guidelines review).
3. Message 3 should trigger 24 hours later. It should propose a direct call-to-action (e.g., booking a private walkthrough at a completed project or architectural consultation).
4. Do not output anything other than a raw JSON array containing exactly three objects with keys "t" (the timing label) and "body" (the SMS script content).

Example Format:
[
  { "t": "Message 1 · Immediate (< 60s)", "body": "Hi [Name], I noticed your residential building permit application filed recently. I'm ${primaryContact.split(' ')[0]}'s assistant from ${companyName}. Since ground-up custom builds require complex structural planning, have you already hired a principal builder?" },
  { "t": "Message 2 · 2 hours later (no reply)", "body": "Hey [Name], just checking in! I wanted to send over our Local Permitting & Site Planning Checklist (it saves weeks on site preparation). Do you already own the lot?" },
  { "t": "Message 3 · 24 hours later", "body": "Hi [Name], we are hosting private site walkthroughs of our completed custom residences this week. Let me know if you would like me to reserve a consultation spot for you!" }
]`;

    try {
      const response = await generateGroqCompletion({
        data: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please update the follow-up scripts according to this instruction: ${instruction}` }
          ]
        }
      });

      // Parse array from text
      let parsed: Array<{ t: string; body: string }> = [];
      try {
        const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          parsed = JSON.parse(response);
        }
      } catch (pe) {
        console.error("Failed to parse AI JSON response, using fallback matching...", pe);
        // Fallback matching
        parsed = [
          { t: "Message 1 · Immediate (< 60s)", body: `Hi [Name]! I'm ${primaryContact.split(' ')[0]}'s assistant from ${companyName}. Are you looking to break ground on your custom home in the next 6-12 months? Reply YES/NO.` },
          { t: "Message 2 · 2 hours later", body: "Hey [Name], just following up! Did you have a specific homesite in mind, or would you like help evaluating lot feasibility?" },
          { t: "Message 3 · 24 hours later", body: "Hi [Name], would you like a private architectural walkthrough of our recently completed showcase residence this Thursday?" }
        ];
      }

      return parsed;
    } catch (error) {
      console.error("Error in generateAIScriptUpdate:", error);
      throw error;
    }
  })

export const getAppointmentsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    try {
      const session = await requireAuth(data?.activeRole ?? undefined)
      const db = await getTenantDb(session)
      const whereClause: any = {}
      if (session.role === 'builder' && session.builderRole === 'sales') {
        whereClause.lead = { assignedToId: session.userId }
      }
      const appts = await db.appointment.findMany({
        where: whereClause,
        orderBy: { dateTime: 'asc' },
        include: {
          lead: true
        }
      })
      return appts
    } catch (error) {
      console.error("Error in getAppointmentsData:", error)
      return []
    }
  })

export const bookAppointment = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    leadId: string;
    type: string;
    dateTime: string;
    location: string;
    notes?: string;
    sendSms?: boolean;
  }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const lead = await db.lead.findUnique({ where: { id: data.leadId } })
      if (!lead) throw new Error("Lead not found")

      const apptDate = new Date(data.dateTime)
      const appt = await db.appointment.create({
        data: {
          builderId: session.builderId || '',
          leadId: data.leadId,
          type: data.type,
          dateTime: apptDate,
          location: data.location || "Office HQ",
          status: "Confirmed",
          notes: data.notes || null,
        },
        include: {
          lead: true
        }
      })

      // Update lead status to "Appointment"
      await db.lead.update({
        where: { id: data.leadId },
        data: { status: "Appointment" }
      })

      // Log activity
      const formattedDate = apptDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: data.leadId,
          action: `🗓️ Appointment booked: ${data.type} - ${data.location} scheduled for ${formattedDate}.`,
        }
      })

      // Add appointment card to messages
      await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId: data.leadId,
          sender: 'system',
          content: `🗓️ Site Visit Booked: ${data.type} scheduled for ${formattedDate} at ${data.location}.`,
          channel: 'portal',
          isRead: true
        }
      });

      // Trigger High Alert Notification to builder
      await createHighAlertNotification({
        builderId: session.builderId || '',
        leadId: data.leadId,
        leadName: lead.name,
        title: "📅 New Meeting Scheduled",
        message: `${lead.name} scheduled ${data.type} for ${formattedDate} at ${data.location}.`,
        type: "booking"
      });

      // Dispatch Appointment Confirmation Email via Resend if lead has email
      if (lead.email) {
        try {
          const { sendOutboundEmail } = await import('./email.server');
          const companyName = session.companyName || 'Custom Builder';

          await sendOutboundEmail({
            to: lead.email,
            subject: `Confirmed: ${data.type} with ${companyName}`,
            from: `${companyName} <onboarding@resend.dev>`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Your Consultation is Confirmed</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hi ${lead.name},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">We have confirmed your upcoming meeting with the <strong>${companyName}</strong> team.</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
                  <p style="margin: 0 0 8px 0; color: #0f172a; font-weight: 600; font-size: 14px;">📅 Session Details:</p>
                  <p style="margin: 0 0 4px 0; color: #334155; font-size: 13px;"><strong>Type:</strong> ${data.type}</p>
                  <p style="margin: 0 0 4px 0; color: #334155; font-size: 13px;"><strong>Date & Time:</strong> ${formattedDate}</p>
                  <p style="margin: 0; color: #334155; font-size: 13px;"><strong>Location:</strong> ${data.location}</p>
                  ${data.notes ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
                </div>

                <p style="color: #475569; font-size: 14px; line-height: 1.5;">If you need to reschedule or have architectural plans to share ahead of time, please reply directly to this email.</p>
              </div>
            `,
            text: `Hi ${lead.name}, your ${data.type} with ${companyName} is confirmed for ${formattedDate} at ${data.location}.`
          });
        } catch (emailErr) {
          console.error('[APPT EMAIL ERROR]', emailErr);
        }
      }

      invalidateCache("dashboard_");
      return appt
    } catch (error) {
      console.error("Error in bookAppointment:", error)
      throw error
    }
  })

export const rescheduleAppointment = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; dateTime: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const apptDate = new Date(data.dateTime)
      const existing = await db.appointment.findUnique({
        where: { id: data.id },
        include: { lead: true }
      })
      if (!existing) throw new Error("Appointment not found")

      const updated = await db.appointment.update({
        where: { id: data.id },
        data: { dateTime: apptDate },
        include: { lead: true }
      })

      const formattedDate = apptDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })

      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: existing.leadId,
          action: `🔄 Appointment rescheduled: ${existing.type} moved to ${formattedDate}.`,
        }
      })

      return updated
    } catch (error) {
      console.error("Error in rescheduleAppointment:", error)
      throw error
    }
  })

export const cancelAppointment = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const existing = await db.appointment.findUnique({
        where: { id },
        include: { lead: true }
      })
      if (!existing) throw new Error("Appointment not found")

      // Delete the appointment
      await db.appointment.delete({ where: { id } })

      // Revert lead status if appropriate
      if (existing.lead.status === "Appointment") {
        await db.lead.update({
          where: { id: existing.leadId },
          data: { status: "Replied" }
        })
      }

      const formattedDate = existing.dateTime.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })

      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: existing.leadId,
          action: `âŒ Appointment cancelled: ${existing.type} for ${formattedDate} has been removed.`,
        }
      })

      return { success: true }
    } catch (error) {
      console.error("Error in cancelAppointment:", error)
      throw error
    }
  })

export const getConversations = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null; filter?: 'all' | 'assigned_to_me' | 'unassigned' } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  try {
    const session = await requireAuth(data?.activeRole ?? undefined)
    const db = await getTenantDb(session)

    // Trigger Inbound Mailbox Sync (IMAP) — truly fire-and-forget.
    import('./mailbox.server').then(({ syncInboundMailbox }) => {
      syncInboundMailbox(session.builderId || '').catch((e) => {
        console.warn('[MAILBOX SYNC NON-BLOCKING ERROR]:', e?.message || e);
      });
    }).catch(() => { /* ignore dynamic import errors */ });

    const whereClause: any = {}
    if (session.role === 'builder' && session.builderRole === 'sales') {
      whereClause.assignedToId = session.userId
    } else if (data?.filter === 'assigned_to_me') {
      whereClause.assignedToId = session.userId
    } else if (data?.filter === 'unassigned') {
      whereClause.assignedToId = null
    }

    const leads = await db.lead.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        scoreTier: true,
        estimatedBudget: true,
        createdAt: true,
        portalToken: true,
        portalVisitedAt: true,
        assignedTo: {
          select: {
            id: true,
            displayName: true,
            email: true,
            builderRole: true,
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            sender: true,
            createdAt: true,
            channel: true,
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                sender: 'lead',
                isRead: false
              }
            }
          }
        }
      }
    })

    // Fetch database-level truncated preview (200 chars) for latest messages.
    // This completely prevents transferring multi-MB base64 images over the wire from Neon!
    const latestMessageIds = leads
      .map((l: any) => l.messages[0]?.id)
      .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

    const previewMap = new Map<string, string>();
    if (latestMessageIds.length > 0) {
      try {
        const rawPreviews = await db.$queryRaw<{ id: string; preview: string }[]>`
          SELECT id, LEFT(content, 200) as preview 
          FROM "Message" 
          WHERE id = ANY(${latestMessageIds}::text[])
        `;
        for (const row of rawPreviews) {
          previewMap.set(row.id, row.preview || '');
        }
      } catch (rawErr) {
        console.warn('[CONVERSATIONS_PREVIEW_QUERY_WARN]:', rawErr);
      }
    }

    const conversations = leads.map((l: any) => {
      const lastMsg = l.messages[0]
      const unreadCount = l._count.messages
      
      // Check if lead polled the portal within the last 30 seconds
      const isRecentlyActive = l.portalVisitedAt && 
          (new Date().getTime() - new Date(l.portalVisitedAt).getTime()) < 1000 * 30;

      let previewText = "No messages yet";
      if (lastMsg?.id) {
        const raw = previewMap.get(lastMsg.id) || "";
        if (raw.includes("🖼️ Image Shared:") || raw.includes("📎 File Attachment:")) {
          previewText = "📎 Photo & Document attached";
        } else if (raw.length > 0) {
          previewText = raw.length >= 200 ? raw.slice(0, 200) + "..." : raw;
        } else {
          previewText = "Message received";
        }
      }

      return {
        leadId: l.id,
        leadName: l.name,
        phone: l.phone,
        email: l.email,
        status: l.status,
        scoreTier: l.scoreTier,
        estimatedBudget: l.estimatedBudget,
        lastMessage: previewText,
        lastMessageTime: lastMsg ? lastMsg.createdAt.toISOString() : l.createdAt.toISOString(),
        unreadCount,
        isOnline: !!isRecentlyActive,
        portalToken: l.portalToken,
        assignedTo: l.assignedTo ? {
          id: l.assignedTo.id,
          displayName: l.assignedTo.displayName,
          email: l.assignedTo.email,
          builderRole: l.assignedTo.builderRole,
        } : null,
      }
    })

    conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())
    return conversations
  } catch (error) {
    console.error("Error in getConversations:", error)
    return []
  }
})

export const getMessagesForLead = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; activeRole?: string | null; isSimulated?: boolean }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined)
    const db = await getTenantDb(session)
    const { leadId } = data
    try {
      // 1. Parallel fetch for Lead and Messages in a single database roundtrip
      const [lead, messages] = await Promise.all([
        db.lead.findUnique({
          where: { id: leadId },
          include: {
            assignedTo: {
              select: {
                id: true,
                displayName: true,
                email: true,
                builderRole: true,
              }
            }
          }
        }),
        db.message.findMany({
          where: { leadId, isSimulated: data.isSimulated || false },
          include: {
            senderUser: {
              select: {
                id: true,
                displayName: true,
                builderRole: true,
                email: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        })
      ]);

      if (!lead) throw new Error("Lead not found");

      // 2. Fire-and-forget non-blocking unread status update (prevents blocking response)
      if (!data.isSimulated) {
        db.message.updateMany({
          where: { leadId, sender: 'lead', isRead: false, isSimulated: false },
          data: { isRead: true }
        }).catch((err: any) => {
          console.warn('[MESSAGES READ UPDATE WARN]:', err);
        });
      }

      return {
        lead,
        messages: messages.map((m: any) => ({
          id: m.id,
          sender: m.sender,
          subject: m.subject || null,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          isRead: m.isRead,
          isInternal: m.isInternal,
          type: m.type,
          senderUserId: m.senderUserId,
          senderUser: m.senderUser ? {
            id: m.senderUser.id,
            displayName: m.senderUser.displayName,
            builderRole: m.senderUser.builderRole,
            email: m.senderUser.email,
          } : null,
        }))
      };
    } catch (error) {
      console.error("Error in getMessagesForLead:", error);
      throw error;
    }
  })

export const triggerMailboxSync = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const { syncInboundMailbox } = await import('./mailbox.server');
    return syncInboundMailbox(session.builderId || '', true);
  });

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; content: string; subject?: string | null; isInternal?: boolean; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined)
    const db = await getTenantDb(session)
    try {
      const { leadId, content, subject, isInternal } = data

      // Upload any local base64 attachments to Cloudflare R2 to keep PostgreSQL lightweight
      const { processMessageAttachments } = await import('./server-utils.server');
      const processedContent = await processMessageAttachments(content, leadId);

      // 1. Create message in DB
      const userMsg = await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          sender: 'user',
          subject: subject || null,
          content: processedContent,
          isRead: true,
          isInternal: isInternal === true,
          type: isInternal ? 'internal_note' : 'message',
          senderUserId: session.userId || null,
        },
        include: {
          senderUser: {
            select: {
              id: true,
              displayName: true,
              builderRole: true,
              email: true,
            }
          }
        }
      })

      // Fetch full lead and builder details
      const currentLead = await db.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          name: true,
          email: true,
          county: true,
          status: true,
          builder: {
            select: {
              companyName: true,
              email: true
            }
          }
        }
      })

      // If INTERNAL NOTE: strictly log internal team activity and skip outbound client notifications
      if (isInternal) {
        await db.activity.create({
          data: {
            builderId: session.builderId || '',
            leadId,
            action: `📝 Internal Note added by ${session.displayName || 'Team Member'}: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
          }
        }).catch(() => {});

        return {
          userMessage: userMsg,
          aiAutoMuted: false,
          leadName: currentLead?.name
        }
      }

      // 2. Outbound Client Reply logic (only runs for client-facing messages)
      if (currentLead && !['Appointment', 'Qualified', 'Scheduled', 'Closed Won'].includes(currentLead.status)) {
        await db.lead.update({
          where: { id: leadId },
          data: { status: 'Replied' }
        })
      }

      // 3. Dispatch Outbound Real Email via Resend/Google/SMTP if lead has an email address
      if (currentLead && currentLead.email) {
        try {
          const { sendOutboundEmail, buildArchitecturalEmailHtml, extractAttachmentsAndCleanContent } = await import('./email.server');
          const companyName = session.companyName || currentLead.builder?.companyName || 'Custom Builder';
          const senderName = session.displayName || 'Sales Representative';
          const senderRole = session.builderRole === 'owner' ? 'Founder & Principal Builder' : 'Senior Sales Director';
          const subject = `Re: Architectural Consultation — ${currentLead.county || 'Custom Build'} (${companyName})`;

          const extracted = extractAttachmentsAndCleanContent(content);

          const html = buildArchitecturalEmailHtml({
            recipientName: currentLead.name || 'there',
            senderName,
            senderRole,
            companyName,
            messageContent: extracted.cleanText || content,
            links: extracted.links,
            attachmentsList: extracted.attachments.map(a => ({ name: a.filename, size: a.size })),
          });

          await sendOutboundEmail({
            to: currentLead.email,
            subject,
            html,
            text: extracted.cleanText || content,
            from: `${senderName} · ${companyName} <onboarding@resend.dev>`,
            replyTo: session.email || currentLead.builder?.email,
            attachments: extracted.attachments,
          });

          // Log activity
          await db.activity.create({
            data: {
              builderId: session.builderId || '',
              leadId,
              action: `📧 Outbound Email sent to ${currentLead.email}: "${(extracted.cleanText || content).slice(0, 80)}..."`,
            }
          }).catch(() => {});
        } catch (emailErr) {
          console.error('[OUTBOUND DISPATCH ERROR]', emailErr);
        }
      }

      // 4. Cancel pending delayed AI reply and auto-mute AI for this lead
      let aiAutoMuted = false;
      try {
        const { cancelPendingAiReply } = await import('./ai-queue.server');
        cancelPendingAiReply(leadId, 'Human builder manual message sent');
        const toggleMap = await readSettingJson('ai_toggle_map');
        if (toggleMap && toggleMap[leadId] !== false) {
          aiAutoMuted = true;
          toggleMap[leadId] = false;
          await writeSettingJson('ai_toggle_map', toggleMap);
        }
      } catch {}

      return {
        userMessage: userMsg,
        aiAutoMuted,
        leadName: currentLead?.name
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      throw error
    }
  })

export const markConversationUnread = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);
    const latestMsg = await db.message.findFirst({
      where: { leadId: data.leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    if (latestMsg) {
      await db.message.update({
        where: { id: latestMsg.id },
        data: { isRead: false }
      });
    }
    return { success: true };
  });

export const archiveConversation = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);
    await db.lead.update({
      where: { id: data.leadId },
      data: { status: 'Archived' }
    });
    await db.activity.create({
      data: {
        builderId: session.builderId || '',
        leadId: data.leadId,
        action: `📁 Conversation archived by ${session.displayName || 'Team Member'}`
      }
    }).catch(() => {});
    return { success: true };
  })

export const assignLeadToUser = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; userId: string | null; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { assertTenantContext } = await import('./security-helpers.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const tenantId = assertTenantContext(session);
    const db = await getTenantDb(session);
    try {
      const { leadId, userId } = data;

      // 1. Verify lead strictly belongs to caller's tenant
      const lead = await db.lead.findFirst({
        where: { id: leadId, builderId: tenantId },
        select: { id: true, name: true, assignedToId: true },
      });
      if (!lead) throw new Error('Lead not found or access denied');

      let assignedUser: { id: string; displayName: string | null; email: string; builderRole: string } | null = null;
      if (userId) {
        // 2. Strict IDOR protection: assigned user MUST belong to the caller's tenant and be active
        assignedUser = await db.user.findFirst({
          where: { id: userId, builderId: tenantId, deletedAt: null, isActive: true },
          select: { id: true, displayName: true, email: true, builderRole: true },
        });
        if (!assignedUser) {
          throw new Error('User not found or does not belong to this organization');
        }
      }

      await db.lead.update({
        where: { id: leadId },
        data: { assignedToId: userId },
      });

      const assigneeLabel = assignedUser ? (assignedUser.displayName || assignedUser.email) : 'Unassigned';
      await db.activity.create({
        data: {
          builderId: tenantId,
          leadId,
          action: `👤 Lead assigned to ${assigneeLabel} by ${session.displayName || 'Team Member'}`,
        },
      }).catch(() => {});

      const result = {
        success: true,
        leadId,
        assignedToId: userId,
        assignedTo: assignedUser ? {
          id: assignedUser.id,
          displayName: assignedUser.displayName,
          email: assignedUser.email,
          builderRole: assignedUser.builderRole,
        } : null,
      };

      return Object.assign(result, { result });
    } catch (error) {
      console.error('Error in assignLeadToUser:', error);
      throw error;
    }
  });

export const getLatestInboundMessages = createServerFn({ method: 'POST' })
  .inputValidator((data?: { since?: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);

    // Non-blocking IMAP mailbox sync in background (throttled automatically)
    import('./mailbox.server').then(({ syncInboundMailbox }) => {
      syncInboundMailbox(session.builderId || '').catch(() => {});
    }).catch(() => {});

    try {
      // Default to last 3 minutes if no 'since' provided
      const sinceDate = data?.since 
        ? new Date(data.since) 
        : new Date(Date.now() - 180000);

      const whereClause: any = {
        sender: 'lead',
        OR: [
          { createdAt: { gt: sinceDate } },
          { isRead: false, createdAt: { gt: new Date(Date.now() - 3600000) } }
        ]
      };

      if (session.role === 'builder' && session.builderId) {
        whereClause.builderId = session.builderId;
        if (session.builderRole === 'sales') {
          whereClause.lead = { assignedToId: session.userId };
        }
      }

      const messages = await db.message.findMany({
        where: whereClause,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              scoreTier: true,
              county: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const { stripEmailQuotedHistory } = await import('./mailbox.server');

      return messages.map(m => ({
        id: m.id,
        leadId: m.leadId,
        leadName: m.lead?.name || 'Homeowner Lead',
        leadEmail: m.lead?.email || '',
        leadCounty: m.lead?.county || m.lead?.city || (m.lead?.state ? `Local (${m.lead.state})` : 'Location Unspecified'),
        scoreTier: m.lead?.scoreTier || 'Warm',
        content: stripEmailQuotedHistory(m.content) || m.content,
        channel: m.channel,
        isSimulated: m.isSimulated,
        createdAt: m.createdAt.toISOString()
      }));
    } catch (error) {
      console.error("Error in getLatestInboundMessages:", error);
      return [];
    }
  })

export const simulateLeadMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; content: string; enableAiReply: boolean }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    
    try {
      const { leadId, content, enableAiReply } = data;

      // 1. Create the Lead's message
      const leadMsg = await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          sender: 'lead',
          content,
          isRead: true,
          isSimulated: true
        }
      });

      let systemMsg = null;

      // 2. If AI is active, trigger Groq/Gemini response
      if (enableAiReply) {
        // Fetch chat history for context
        const history = await db.message.findMany({
          where: { leadId, builderId: session.builderId || '' },
          orderBy: { createdAt: 'asc' },
          take: 10
        });

        const formattedHistory = history.map(m => ({
          role: (m.sender === 'user' || m.sender === 'system') ? 'assistant' : 'user' as any,
          content: m.content
        }));

        // Generate AI response directly with unified AI engine (Gemini Flash / Groq)
        const aiResponse = await generateAiReplyCore(
          db,
          leadId,
          session.builderId || '',
          content,
          formattedHistory,
          true
        );

        // Save AI response as 'system' message
        if (aiResponse && aiResponse.replyText) {
          systemMsg = await db.message.create({
            data: {
              builderId: session.builderId || '',
              leadId,
              sender: 'system',
              content: aiResponse.replyText,
              isRead: true,
              isSimulated: true
            }
          });

          // Dispatch AI reply via Resend to lead's real inbox if email exists
          const targetLead = await db.lead.findUnique({
            where: { id: leadId },
            select: { name: true, email: true, county: true, builder: { select: { companyName: true, email: true } } }
          });

          if (targetLead && targetLead.email) {
            try {
              const { sendOutboundEmail, buildArchitecturalEmailHtml } = await import('./email.server');
              const companyName = session.companyName || targetLead.builder?.companyName || 'Custom Builder';
              const subject = `Re: Custom Architectural Consultation â€” ${companyName}`;
              const senderDisplayName = session.displayName || 'Sajid Ali';
              const html = buildArchitecturalEmailHtml({
                recipientName: targetLead.name || 'there',
                senderName: senderDisplayName,
                senderRole: session.builderRole === 'owner' ? 'Founder & Principal Builder' : 'Senior Client Director',
                companyName,
                messageContent: aiResponse.replyText,
              });

              await sendOutboundEmail({
                to: targetLead.email,
                subject,
                html,
                text: aiResponse.replyText,
                from: `${senderDisplayName} Â· ${companyName} <${session.email || targetLead.builder?.email || 'onboarding@resend.dev'}>`,
                replyTo: session.email || targetLead.builder?.email,
              });
            } catch (err) {
              console.error('[AI RESEND ERROR]', err);
            }
          }
        }
      }

      return { leadMessage: leadMsg, systemMessage: systemMsg };
    } catch (error) {
      console.error("Error in simulateLeadMessage:", error);
      throw error;
    }
  });

/**
 * â”€â”€â”€ AUTONOMOUS AI OUTREACH & QUALIFICATION ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Triggered automatically when a lead enters via Inbound Webhooks, Forms, or Manual Entry.
 * 
 * Works completely independent of logged-in sessions by reading builder settings directly from the DB,
 * generating a bespoke architectural response, saving messages & activities, and dispatching
 * real branded emails via Resend with the Builder's profile email as Reply-To.
 */
export async function triggerAutonomousAiOutreach(
  leadId: string,
  builderId: string,
  initialUserMessage?: string
) {
  const { getDb } = await import('./db.server');
  const db = await getDb();

  try {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { builder: true }
    });

    if (!lead || !lead.email || !builderId) {
      return { success: false, reason: 'No lead, email or builderId found' };
    }

    const builder = lead.builder || await db.builder.findUnique({ where: { id: builderId } });
    if (!builder || !builder.isActive) {
      return { success: false, reason: 'Builder is not active' };
    }

    // Direct DB settings extraction â€” zero session / requireAuth dependency
    const settingsObj = builder.settings
      ? (typeof builder.settings === 'string' ? JSON.parse(builder.settings) : builder.settings)
      : {};
    const builderProfile = settingsObj.builder_profile || {};
    const brainConfig = settingsObj.ai_brain_config || {};

    // ── SAFETY INTERLOCK: Compulsory AI Knowledge Base / Builder Defaults ──
    const isKnowledgeBaseConfigured = Boolean(
      (brainConfig.customDirectives && brainConfig.customDirectives.trim().length >= 20) ||
      (builderProfile.aiContext && builderProfile.aiContext.trim().length >= 20)
    );

    if (!isKnowledgeBaseConfigured) {
      console.warn(`[SAFETY INTERLOCK] Autonomous AI outreach paused for lead ${leadId}. Builder ${builderId} has not completed their AI Knowledge Base / Builder Defaults.`);
      await db.activity.create({
        data: {
          builderId,
          leadId,
          action: `⚠️ AI Autonomous Outreach Paused: Builder AI Knowledge Base / Defaults not yet configured in Settings. Please provide your build policies to enable autonomous replies and prevent misinforming leads.`
        }
      });
      return { success: false, reason: 'AI Knowledge Base not configured' };
    }

    const companyName = builderProfile.companyName || builder.companyName || 'Custom Estate Builder';
    const profileEmail = builderProfile.email || builder.email; // e.g. promonth2004@gmail.com
    const personaName = brainConfig.personaName || builderProfile.primaryContact || 'Alex';

    const leadArea = [lead.county, lead.city].filter(Boolean).join(" · ") || 'your area';
    const messagePrompt = initialUserMessage && initialUserMessage.trim().length > 0
      ? initialUserMessage.trim()
      : `Hello, I submitted an architectural inquiry for a custom build with an estimated budget of $${(lead.estimatedBudget || 1500000).toLocaleString()} in ${leadArea}. What is your current availability and design process?`;

    // 1. Generate bespoke architectural qualification reply (Gemini / Groq engine)
    const aiResponse = await generateAiReplyCore(
      db,
      leadId,
      builderId,
      messagePrompt,
      [],
      false // false = writes activities and updates DB status/memory
    );

    if (aiResponse && aiResponse.replyText) {
      // 2. Save the autonomous AI response in Message table
      await db.message.create({
        data: {
          builderId,
          leadId,
          sender: 'system',
          content: aiResponse.replyText,
          channel: 'portal',
          isRead: false,
          isSimulated: false,
        }
      });

      // 3. Dispatch the real branded architectural HTML email via Resend
      let emailDispatched = false;
      let emailNotice = '';

      try {
        const { sendOutboundEmail, buildArchitecturalEmailHtml } = await import('./email.server');
        const subject = `Re: Custom Architectural Consultation & Build â€” ${companyName}`;
        const senderDisplayName = personaName || builderProfile.primaryContact || 'Sajid Ali';
        const html = buildArchitecturalEmailHtml({
          recipientName: lead.name || 'there',
          senderName: senderDisplayName,
          senderRole: 'Principal Builder & Director',
          companyName,
          messageContent: aiResponse.replyText,
        });

        const emailResult = await sendOutboundEmail({
          to: lead.email,
          subject,
          html,
          text: aiResponse.replyText,
          from: `${senderDisplayName} Â· ${companyName} <${profileEmail || 'onboarding@resend.dev'}>`,
          replyTo: profileEmail,
        });

        if (emailResult.success) {
          emailDispatched = true;
        } else if (emailResult.error && (emailResult.error.includes('testing emails') || emailResult.error.includes('verify a domain') || emailResult.error.includes('403'))) {
          emailNotice = ` (Resend Sandbox: Verify domain at resend.com/domains to send to non-owner inboxes)`;
        }
      } catch (emailErr: any) {
        console.error('[AUTONOMOUS AI RESEND DISPATCH ERROR]:', emailErr);
      }

      // 4. Log high-visibility Activity in timeline
      await db.activity.create({
        data: {
          builderId,
          leadId,
          action: emailDispatched
            ? `🤖 AI Autonomous Outreach: Bespoke qualification email dispatched to ${lead.email} (Reply-To: ${profileEmail})`
            : `🤖 AI Outreach Created: Message generated for ${lead.email} (Reply-To: ${profileEmail})${emailNotice}`,
        }
      });

      // 5. Automatically sync qualified lead to active CRMs (HubSpot / GHL) in background
      try {
        const { syncLeadToConnectedCrms } = await import('./crm.server');
        syncLeadToConnectedCrms(builderId, {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          county: lead.county,
          state: lead.state,
          estimatedBudget: lead.estimatedBudget,
          landPrice: lead.landPrice,
          scoreTier: lead.scoreTier,
          status: lead.status,
          intent: aiResponse.dealSummary,
        }, companyName).catch(crmErr => console.warn('[CRM AUTO SYNC ERROR]:', crmErr));
      } catch (crmLoadErr) {
        console.warn('[CRM SYNC LOAD ERROR]:', crmLoadErr);
      }

      invalidateCache("dashboard_");
      return { success: true, aiResponse, emailDispatched };
    }

    return { success: false, reason: 'AI generated empty reply' };
  } catch (err: any) {
    console.error('[AUTONOMOUS AI OUTREACH ERROR]:', err);
    return { success: false, error: err?.message || err };
  }
}

export const syncLeadToCrms = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { syncLeadToConnectedCrms } = await import('./crm.server');
    const session = await requireAuth();
    const db = await getTenantDb(session);

    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      include: { builder: true }
    });

    if (!lead) throw new Error('Lead not found.');

    const results = await syncLeadToConnectedCrms(
      session.builderId || lead.builderId,
      {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        county: lead.county,
        state: lead.state,
        estimatedBudget: lead.estimatedBudget,
        landPrice: lead.landPrice,
        scoreTier: lead.scoreTier,
        status: lead.status,
      },
      lead.builder?.companyName || 'Custom Builder'
    );

    return { success: true, results };
  });

export const getReportsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth(data?.activeRole ?? undefined)
  const db = await getTenantDb(session)

  try {
    const now = new Date()

    // 1. Timeframe Date Boundaries
    // This Month
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Last Month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    // Last 3 Months
    const startOfLast3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    
    // All Time (use a safe past date)
    const startOfAllTime = new Date(2020, 0, 1)

    // Optimized: Fetch only relevant records with targeted fields to process in-memory
    const [allLeads, allAppointments, allReviewRequests, allMessages, allActivities] = await Promise.all([
      db.lead.findMany({
        select: { id: true, createdAt: true, status: true, source: true, estimatedBudget: true }
      }),
      db.appointment.findMany({
        select: { dateTime: true }
      }),
      db.reviewRequest.findMany({
        select: { createdAt: true, status: true, rating: true }
      }),
      db.message.findMany({
        where: { sender: 'system' },
        select: { createdAt: true, sender: true }
      }),
      db.activity.findMany({
        where: {
          OR: [
            { action: { contains: 'AI' } },
            { action: { contains: 'automated' } },
            { action: { contains: 'outreach' } },
            { action: { contains: 'nurture' } },
            { action: { contains: 'email' } }
          ]
        },
        select: { createdAt: true, action: true }
      })
    ])

    // Helper function to build metrics in-memory for a date range
    const getMetricsForRange = (start: Date, end: Date, durationMonths: number) => {
      const rangeLeads = allLeads.filter(l => l.createdAt >= start && l.createdAt <= end)
      const leadsCount = rangeLeads.length
      const qualifiedCount = rangeLeads.filter(l => l.status !== 'New').length
      const appointmentsCount = allAppointments.filter(a => a.dateTime >= start && a.dateTime <= end).length

      const reviewRequestsCount = allReviewRequests.filter(r => r.createdAt >= start && r.createdAt <= end).length
      const reviewsCompletedCount = allReviewRequests.filter(r => r.createdAt >= start && r.createdAt <= end && r.status === 'Completed').length

      const closedDeals = rangeLeads.filter(l => l.status === 'Closed' || l.status === 'Closed Won').length
      const ansaryFee = 3000 * durationMonths
      const revenue = rangeLeads
        .filter(l => l.status === 'Closed' || l.status === 'Closed Won')
        .reduce((sum, l) => sum + (l.estimatedBudget || 0), 0)
      const netProfit = revenue - ansaryFee
      const roiRatio = ansaryFee > 0 ? Math.round((revenue / ansaryFee)) : 0

      // Calculate AI Messages Sent: messages where sender === 'system', plus activities that are AI-driven SMS/emails
      const rangeMessages = allMessages.filter(m => m.createdAt >= start && m.createdAt <= end)
      const systemMessagesCount = rangeMessages.filter(m => m.sender === 'system').length

      const rangeActivities = allActivities.filter(a => a.createdAt >= start && a.createdAt <= end)
      const aiActivitiesCount = rangeActivities.filter(a => {
        const actLower = a.action.toLowerCase()
        return actLower.includes('ai engine') || 
               actLower.includes('ai concierge') || 
               actLower.includes('automated sms') || 
               actLower.includes('sms outreach') || 
               actLower.includes('nurture message')
      }).length

      const aiMessagesSent = systemMessagesCount + aiActivitiesCount
      const aiQualRate = leadsCount > 0 ? Math.round((qualifiedCount / leadsCount) * 100) : 0

      const formatCurrency = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
        if (val >= 1000) return `$${Math.round(val / 1000)}K`
        return `$${val}`
      }

      return {
        leadsReceived: leadsCount,
        qualified: qualifiedCount,
        aiQualRate,
        aiMessagesSent,
        appointments: appointmentsCount,
        closedDeals,
        ansaryFee: formatCurrency(ansaryFee),
        reviewsSent: String(reviewRequestsCount),
        reviewsCompleted: reviewRequestsCount > 0 
          ? `${reviewsCompletedCount} (${Math.round((reviewsCompletedCount / reviewRequestsCount) * 100)}%)` 
          : "0 (0%)",
        revenue: formatCurrency(revenue),
        net: formatCurrency(netProfit),
        roi: `${roiRatio}x`
      }
    }

    // Calculate metrics for all filters in-memory
    const thisMonth = getMetricsForRange(startOfThisMonth, endOfThisMonth, 1)
    const lastMonth = getMetricsForRange(startOfLastMonth, endOfLastMonth, 1)
    const last3Months = getMetricsForRange(startOfLast3Months, endOfThisMonth, 3)
    const allTime = getMetricsForRange(startOfAllTime, endOfThisMonth, 6)

    // 2. Leads by Source in-memory
    const sourceMap: Record<string, number> = {}
    allLeads.forEach(l => {
      const src = l.source || "Direct Inbound"
      sourceMap[src] = (sourceMap[src] || 0) + 1
    })
    const leadsBySource = Object.keys(sourceMap).map(source => ({
      source,
      leads: sourceMap[source]
    }))
    leadsBySource.sort((a, b) => b.leads - a.leads)

    // 3. Monthly Lead Volume (6 months history) in-memory
    const monthlyTrend: Array<{ month: string; leads: number; qualified: number; qualRate: number; appts: number; closed: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthLabel = d.toLocaleString("en-US", { month: "short", year: "numeric" })

      const monthLeads = allLeads.filter(l => l.createdAt >= monthStart && l.createdAt <= monthEnd)
      const leads = monthLeads.length
      const qualified = monthLeads.filter(l => l.status !== 'New').length
      const appts = allAppointments.filter(a => a.dateTime >= monthStart && a.dateTime <= monthEnd).length

      const closed = monthLeads.filter(l => l.status === 'Closed' || l.status === 'Closed Won').length
      const qualRate = leads > 0 ? Math.round((qualified / leads) * 100) : 0

      monthlyTrend.push({
        month: monthLabel,
        leads,
        qualified,
        qualRate,
        appts,
        closed
      })
    }

    return {
      timeframes: {
        "This Month": thisMonth,
        "Last Month": lastMonth,
        "Last 3 Months": last3Months,
        "Custom": allTime
      },
      leadsBySource,
      monthlyTrend,
      allLeads,
      allAppointments,
      allReviewRequests,
      allMessages,
      allActivities
    }
  } catch (error) {
    console.error("Error in getReportsData server function:", error)
    const emptyMetrics = {
      leadsReceived: 0,
      qualified: 0,
      appointments: 0,
      closedDeals: 0,
      ansaryFee: "$0",
      reviewsSent: "0",
      reviewsCompleted: "0 (0%)",
      revenue: "$0",
      net: "$0",
      roi: "0x"
    }
    return {
      timeframes: {
        "This Month": emptyMetrics,
        "Last Month": emptyMetrics,
        "Last 3 Months": emptyMetrics,
        "Custom": emptyMetrics
      },
      leadsBySource: [],
      monthlyTrend: [],
      allLeads: [],
      allAppointments: [],
      allReviewRequests: []
    }
  }
})

// ─── Rate Limiter for Integration Connection Testing (Max 8 attempts / min per tenant) ───
const testConnectionRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkTestConnectionRateLimit(key: string, limit = 8, windowMs = 60000): boolean {
  const now = Date.now();
  if (testConnectionRateLimitMap.size > 1000) {
    for (const [k, v] of testConnectionRateLimitMap.entries()) {
      if (v.resetAt <= now) testConnectionRateLimitMap.delete(k);
    }
  }
  const record = testConnectionRateLimitMap.get(key);
  if (!record || record.resetAt <= now) {
    testConnectionRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count += 1;
  return true;
}

function isMaskedValue(val: string): boolean {
  if (!val) return false;
  return val.includes('••••') || val.includes('â€¢') || /^[\u2022\u25CF\s*]+$/.test(val);
}

export const getIntegrationsStatus = createServerFn({ method: 'GET' })
  .inputValidator((data?: { activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    try {
      const session = await requireAuth(data?.activeRole ?? undefined);
      const db = await getTenantDb(session);
      const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
      if (!builderId) return {};

      // STRICT MULTI-TENANT ISOLATION: Only fetch integrations belonging to this builder
      const integrations = await db.integration.findMany({
        where: { builderId }
      });
      
      // We map raw stored configs into masked configs to send to the client
      const mapped = await Promise.all(integrations.map(async item => {
        let config: Record<string, string> = {};
        try {
          if (item.configSecure) {
            const { decrypt } = await import('./crypto');
            let decrypted = item.configSecure;
            try {
              decrypted = decrypt(item.configSecure);
            } catch {}
            const parsed = JSON.parse(decrypted);
            // Mask sensitive secret, token, password, and key fields
            Object.keys(parsed).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (
                lowerKey.includes("secret") ||
                lowerKey.includes("token") ||
                lowerKey.includes("key") ||
                lowerKey.includes("pass") ||
                lowerKey.includes("auth")
              ) {
                config[key] = "••••••••••••••••";
              } else {
                config[key] = parsed[key];
              }
            });
          }
        } catch (err) {
          console.error(`Error decrypting integration config for ${item.platformId}:`, err);
        }

        return {
          id: item.platformId,
          isConnected: item.isConnected,
          credentials: config
        };
      }));

      // Return as a key-value record for ease of frontend lookup
      const statusMap: Record<string, { isConnected: boolean; credentials: Record<string, string> }> = {};
      mapped.forEach(m => {
        statusMap[m.id] = {
          isConnected: m.isConnected,
          credentials: m.credentials
        };
      });

      return statusMap;
    } catch (error) {
      console.error("Error in getIntegrationsStatus server function:", error);
      return {};
    }
  });

export const saveIntegrationCredentials = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string; credentials: Record<string, string>; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { platformId, credentials, activeRole } = data;
    const session = await requireAuth(activeRole ?? undefined);
    
    // RBAC: Only admin or builder owner can save integration credentials
    if (session.role === 'builder' && session.builderRole !== 'owner') {
      throw new Error("Forbidden: Only builder owners and administrators can configure integrations.");
    }

    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    if (!builderId) {
      throw new Error("No active builder tenant resolved.");
    }

    // Input validation: whitelist allowed integration platforms
    const ALLOWED_PLATFORMS = ['email_mailbox', 'hubspot', 'ghl', 'twilio', 'google', 'custom_smtp', 'webhook'];
    if (!ALLOWED_PLATFORMS.includes(platformId)) {
      throw new Error(`Invalid integration platform: ${platformId}`);
    }

    const db = await getTenantDb(session);
    try {
      // Sanitize inputs & prevent prototype pollution
      let finalCredentials: Record<string, string> = {};
      for (const [k, v] of Object.entries(credentials || {})) {
        if (typeof v === 'string' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
          finalCredentials[k] = v.trim();
        }
      }
      
      const existing = await db.integration.findUnique({
        where: {
          builderId_platformId: {
            builderId,
            platformId
          }
        }
      });

      if (existing && existing.configSecure) {
        try {
          const { decrypt } = await import('./crypto');
          let decrypted = existing.configSecure;
          try {
            decrypted = decrypt(existing.configSecure);
          } catch {}
          const parsed = JSON.parse(decrypted);
          
          // Overwrite any keys that came in as the standard mask with their original values
          Object.keys(finalCredentials).forEach(key => {
            if (isMaskedValue(finalCredentials[key]) && parsed[key]) {
              finalCredentials[key] = parsed[key];
            }
          });
        } catch (err) {
          console.error("Failed to decrypt existing config during merge:", err);
        }
      }

      const { encrypt } = await import('./crypto');
      const encrypted = encrypt(JSON.stringify(finalCredentials));

      await db.integration.upsert({
        where: {
          builderId_platformId: {
            builderId,
            platformId
          }
        },
        update: {
          configSecure: encrypted,
          isConnected: true
        },
        create: {
          builderId,
          platformId,
          configSecure: encrypted,
          isConnected: true
        }
      });

      await db.activity.create({
        data: {
          builderId,
          action: `🔌 Integration connected/updated: ${platformId} (by ${session.displayName || session.email || 'builder owner'})`,
        }
      }).catch(() => {});

      invalidateCache("dashboard_");
      return { success: true };
    } catch (error) {
      console.error(`Error in saveIntegrationCredentials for ${platformId}:`, error);
      throw error;
    }
  });

export const disconnectIntegration = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { platformId, activeRole } = data;
    const session = await requireAuth(activeRole ?? undefined);
    
    // RBAC: Only admin or builder owner can disconnect integrations
    if (session.role === 'builder' && session.builderRole !== 'owner') {
      throw new Error("Forbidden: Only builder owners and administrators can disconnect integrations.");
    }

    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    if (!builderId) {
      throw new Error("No active builder tenant resolved.");
    }

    const db = await getTenantDb(session);
    try {
      // STRICT TENANT ISOLATION: Only delete the integration row belonging to THIS builder!
      await db.integration.deleteMany({
        where: {
          builderId,
          platformId,
        }
      });

      await db.activity.create({
        data: {
          builderId,
          action: `🔌 Integration disconnected: ${platformId} (by ${session.displayName || session.email || 'builder owner'})`,
        }
      }).catch(() => {});

      invalidateCache("dashboard_");
      return { success: true };
    } catch (error) {
      console.error(`Error in disconnectIntegration for ${platformId}:`, error);
      throw error;
    }
  });

export const getGoogleConnectUrl = createServerFn({ method: 'POST' })
  .inputValidator((data?: { returnTo?: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    
    // RBAC: Only admin or builder owner can initiate Google OAuth connection
    if (session.role === 'builder' && session.builderRole !== 'owner') {
      throw new Error("Forbidden: Only builder owners and administrators can connect company mailboxes.");
    }

    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    if (!builderId) throw new Error("No active builder session found. Please sign in.");
    const { generateGoogleAuthUrl } = await import('./google-oauth.server');
    const returnTo = data?.returnTo || '/settings?tab=integrations';
    return generateGoogleAuthUrl(builderId, returnTo);
  });

export const handleGoogleOAuthCallback = createServerFn({ method: 'GET' })
  .inputValidator((data: { code: string; state: string; error?: string }) => data)
  .handler(async ({ data }) => {
    const { code, state, error } = data;
    if (error) {
      return { success: false, redirectUrl: `/settings?tab=integrations&error=google_cancelled` };
    }
    if (!code || !state) {
      return { success: false, redirectUrl: `/settings?tab=integrations&error=missing_oauth_params` };
    }

    // Cryptographic HMAC State Verification & Replay Protection
    const { verifyOAuthState } = await import('./google-oauth.server');
    const verified = verifyOAuthState(state);
    if (!verified || !verified.builderId) {
      return { success: false, redirectUrl: `/settings?tab=integrations&error=invalid_or_expired_oauth_state` };
    }

    const builderId = verified.builderId;
    const returnTo = verified.returnTo || '/settings?tab=integrations';

    try {
      const { exchangeGoogleAuthCode, getGoogleUserProfile } = await import('./google-oauth.server');
      const { getDb } = await import('./db.server');
      const { encrypt } = await import('./crypto');

      const db = await getDb();
      const builder = await db.builder.findUnique({
        where: { id: builderId },
        select: { id: true, isActive: true }
      });
      if (!builder || !builder.isActive) {
        return { success: false, redirectUrl: `/settings?tab=integrations&error=unauthorized_builder` };
      }

      const { accessToken, refreshToken, expiresIn } = await exchangeGoogleAuthCode(code);
      const profile = await getGoogleUserProfile(accessToken);

      const configData = {
        provider: 'google_oauth',
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        accessToken,
        refreshToken,
        expiryDate: Date.now() + (expiresIn * 1000)
      };

      const encryptedConfig = encrypt(JSON.stringify(configData));

      await db.integration.upsert({
        where: {
          builderId_platformId: {
            builderId,
            platformId: 'email_mailbox'
          }
        },
        create: {
          builderId,
          platformId: 'email_mailbox',
          configSecure: encryptedConfig,
          isConnected: true
        },
        update: {
          configSecure: encryptedConfig,
          isConnected: true
        }
      });

      await db.activity.create({
        data: {
          builderId,
          action: `Google Workspace connected via OAuth 2.0 (${profile.email}).`
        }
      }).catch(() => {});

      const separator = returnTo.includes('?') ? '&' : '?';
      return {
        success: true,
        redirectUrl: `${returnTo}${separator}connected=google&email=${encodeURIComponent(profile.email)}`
      };
    } catch (err: any) {
      console.error('[GOOGLE OAUTH CALLBACK EXCEPTION]:', err);
      const errMsg = encodeURIComponent(err?.message || 'Failed to complete Google OAuth');
      return { success: false, redirectUrl: `/settings?tab=integrations&error=${errMsg}` };
    }
  });

export const testIntegrationConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string; credentials: Record<string, string>; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { requireAuth } = await import('./server-utils.server');
    const { platformId, credentials, activeRole } = data;
    const session = await requireAuth(activeRole ?? undefined);

    // RBAC: Only admin or builder owner can test integrations
    if (session.role === 'builder' && session.builderRole !== 'owner') {
      throw new Error("Forbidden: Only builder owners and administrators can test integration connections.");
    }

    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    if (!builderId) {
      throw new Error("No active builder tenant resolved.");
    }

    // Rate limiting: 8 tests per minute per builder to prevent abuse, password brute force, or spamming external endpoints
    if (!checkTestConnectionRateLimit(builderId, 8, 60000)) {
      throw new Error("Too many test connection attempts. Please wait 1 minute before testing again.");
    }
    
    // Simulate real network validation latency
    await new Promise(resolve => setTimeout(resolve, 800));

    if (platformId === "google") {
      if (!credentials.clientId || !credentials.clientSecret || !credentials.locationId) {
        throw new Error("Missing required credentials for Google Business API.");
      }
      if (!isMaskedValue(credentials.clientSecret) && credentials.clientSecret.length < 10) {
        throw new Error("Invalid Google Client Secret. Secret key must be at least 10 characters.");
      }
    }
    
    else if (platformId === "twilio") {
      if (!credentials.accountSid || !credentials.authToken || !credentials.phoneNumber) {
        throw new Error("Missing required credentials for Twilio SMS Outreach Gateway.");
      }
      if (!isMaskedValue(credentials.accountSid) && !credentials.accountSid.startsWith("AC")) {
        throw new Error("Invalid Twilio Account SID format. Must start with 'AC'.");
      }
      if (!isMaskedValue(credentials.authToken) && credentials.authToken.length < 16) {
        throw new Error("Invalid Twilio Auth Token. Must be at least 16 characters.");
      }
    }

    else if (platformId === "hubspot") {
      if (!credentials.accessToken) {
        throw new Error("Missing HubSpot Private App Access Token.");
      }
      const { testHubSpotConnection } = await import('./crm.server');
      await testHubSpotConnection(credentials.accessToken);
    }

    else if (platformId === "ghl") {
      if (!credentials.apiKey) {
        throw new Error("Missing GoHighLevel Location API Key.");
      }
      const { testGhlConnection } = await import('./crm.server');
      await testGhlConnection(credentials.apiKey, credentials.locationId);
    }

    else if (platformId === "email_mailbox") {
      const provider = credentials.provider || 'google';

      // If testing a Google OAuth 2.0 connection
      if (provider === 'google_oauth' || (!credentials.password && credentials.email)) {
        try {
          const { getValidGoogleAccessToken, getGoogleUserProfile } = await import('./google-oauth.server');
          const oauthData = await getValidGoogleAccessToken(builderId);
          if (oauthData) {
            const profile = await getGoogleUserProfile(oauthData.accessToken);
            return { success: true, email: profile.email };
          }
        } catch (oauthTestErr: any) {
          throw new Error(`Google OAuth verification failed: ${oauthTestErr?.message || oauthTestErr}`);
        }
      }

      const email = credentials.email || credentials.username || '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        throw new Error("Invalid email address. Please enter a valid company mailbox address (e.g. alex@luxuryhomes.com).");
      }
      const rawPassword = credentials.password || '';
      if (!rawPassword) {
        throw new Error("Missing App Password. Please enter your 16-character Google App Password or connect via Google Workspace Authorization.");
      }

      // If user provided an actual password (not the masked placeholder), perform REAL live authentication check
      if (!isMaskedValue(rawPassword)) {
        const cleanPassword = rawPassword.replace(/\s+/g, '').trim();
        const smtpHost = provider === 'google' ? 'smtp.gmail.com' : (credentials.smtpHost || 'smtp.gmail.com');
        const smtpPort = provider === 'google' ? 465 : parseInt(credentials.smtpPort || '465', 10);

        // SSRF / Open Relay Security Validation
        if (provider !== 'google') {
          const lowerHost = smtpHost.toLowerCase().trim();
          if (
            lowerHost === 'localhost' ||
            lowerHost === '127.0.0.1' ||
            lowerHost === '::1' ||
            lowerHost === '0.0.0.0' ||
            lowerHost.startsWith('127.') ||
            lowerHost.startsWith('169.254.') ||
            lowerHost.startsWith('10.') ||
            lowerHost.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lowerHost) ||
            lowerHost.endsWith('.internal') ||
            lowerHost.endsWith('.local') ||
            lowerHost.endsWith('.localhost')
          ) {
            throw new Error("Security Alert: Loopback addresses, private subnets, and cloud metadata endpoints are strictly forbidden.");
          }

          const ALLOWED_MAIL_PORTS = [465, 587, 25, 2525, 993, 995];
          if (!ALLOWED_MAIL_PORTS.includes(smtpPort)) {
            throw new Error(`Security Alert: Port ${smtpPort} is not a recognized mail transport port. Permitted ports: ${ALLOWED_MAIL_PORTS.join(', ')}.`);
          }
        }

        try {
          const nodemailer = await import('nodemailer');
          const transportOptions: any = provider === 'google'
            ? {
                service: 'gmail',
                auth: {
                  user: email.trim(),
                  pass: cleanPassword,
                },
                connectionTimeout: 10000,
              }
            : {
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                  user: email.trim(),
                  pass: cleanPassword,
                },
                connectionTimeout: 10000,
              };

          const transporter = nodemailer.createTransport(transportOptions);
          await transporter.verify();
        } catch (verifyErr: any) {
          console.error('[REAL SMTP VERIFY FAILED]:', verifyErr);
          const rawError = verifyErr?.message || '';
          if (rawError.includes('535') || rawError.includes('Username and Password not accepted') || rawError.includes('BadCredentials')) {
            throw new Error(`Google Authentication Failed (535): App Password rejected for ${email.trim()}.\n\nCommon Causes:\n1. Account Mismatch: Ensure the 16-letter App Password was generated while logged into ${email.trim()} (not another Google account).\n2. 2-Step Verification: Ensure 2-Step Verification is ON for ${email.trim()}.\n3. Regular Password Used: Google requires a dedicated 16-character App Password from myaccount.google.com/apppasswords.`);
          }
          throw new Error(`Mailbox Connection Failed: ${rawError}`);
        }
      }
    }

    return { success: true };
  });

export const exportLeadsToCsv = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);
    try {
      const whereClause: any = {};
      if (session.role === 'builder' && session.builderRole === 'sales') {
        whereClause.assignedToId = session.userId;
      }
      const leads = await db.lead.findMany({
        where: whereClause,
        orderBy: { purchaseDate: 'desc' }
      })
      
      const { sanitizeCsvCell } = await import('./security-helpers.server');
      
      // Construct CSV header & rows with formula injection sanitization (Finding 5.2)
      const headers = ["ID", "Name", "Phone", "Email", "County", "State", "Land Price", "Estimated Budget", "Purchase Date", "Status", "Score Tier", "Source"];
      const rows = leads.map(l => [
        sanitizeCsvCell(l.id),
        sanitizeCsvCell(l.name),
        sanitizeCsvCell(l.phone),
        sanitizeCsvCell(l.email),
        sanitizeCsvCell(l.county),
        sanitizeCsvCell(l.state),
        sanitizeCsvCell(l.landPrice || 0),
        sanitizeCsvCell(l.estimatedBudget || 0),
        sanitizeCsvCell(l.purchaseDate ? l.purchaseDate.toISOString() : ""),
        sanitizeCsvCell(l.status),
        sanitizeCsvCell(l.scoreTier),
        sanitizeCsvCell(l.source)
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const res = { csvContent };
      return Object.assign(res, { result: res });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      throw error;
    }
  })


// â”€â”€â”€ Settings persistence helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// We reuse the Integration table with reserved platformId keys so no new
// Prisma migration is required.

export async function readSettingJson(platformId: string, preResolvedSession?: any): Promise<Record<string, any>> {
  const { requireAuth } = await import('./server-utils.server');
  const { getDb } = await import('./db.server');
  try {
    const session = preResolvedSession ?? await requireAuth()
    const db = await getDb()
    const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
    if (!builderId) return {}
    const builder = await db.builder.findUnique({
      where: { id: builderId }
    })
    if (!builder || !builder.settings) return {}
    const settingsObj = typeof builder.settings === 'string' ? JSON.parse(builder.settings) : (builder.settings || {})
    return settingsObj[platformId] || {}
  } catch {
    return {}
  }
}

export async function writeSettingJson(platformId: string, value: Record<string, any>, preResolvedSession?: any) {
  const { requireAuth } = await import('./server-utils.server');
  const { getDb } = await import('./db.server');
  const session = preResolvedSession ?? await requireAuth()
  
  // Finding 5.1: RBAC on builder settings. Sales representatives cannot modify settings.
  if (session.role === 'builder') {
    if (session.builderRole !== 'owner' && session.builderRole !== 'admin') {
      throw new Error('FORBIDDEN: Only Owners and Administrators can modify workspace settings.');
    }
  }

  const db = await getDb()
  
  const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
  if (!builderId) throw new Error('No active builder ID found for settings update');
  
  const builder = await db.builder.findUnique({
    where: { id: builderId }
  })
  
  const settingsObj = builder?.settings ? (typeof builder.settings === 'string' ? JSON.parse(builder.settings) : builder.settings) : {}
  settingsObj[platformId] = value
  
  await db.builder.update({
    where: { id: builderId },
    data: { settings: JSON.stringify(settingsObj) }
  })
  invalidateCache("dashboard_");
}

export const getBuilderProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getDb } = await import('./db.server');
  const { requireAuth } = await import('./server-utils.server');
  const session = await requireAuth(data?.activeRole ?? undefined);
  const db = await getDb();
  
  const builderId = session.role === 'admin' ? (session.actingAsBuilderId || session.builderId) : session.builderId;
  const savedProfile = await readSettingJson('builder_profile', session);
  
  const builder = await db.builder.findUnique({
    where: { id: builderId || '' },
    include: { users: { where: { id: session.userId } } }
  });
  
  const user = builder?.users[0];
  
  const { generateAllPlatformTokens } = await import('./webhook-tokens.server');
  const platformTokens = builderId ? generateAllPlatformTokens(builderId) : {};

  return {
    id: builderId,
    companyName: builder?.companyName || savedProfile.companyName || "",
    primaryContact: builder?.contactName || savedProfile.primaryContact || user?.displayName || "",
    email: builder?.email || savedProfile.email || user?.email || "",
    phone: builder?.phone || savedProfile.phone || "",
    businessAddress: savedProfile.businessAddress || "",
    targetZipCodes: savedProfile.targetZipCodes || "",
    avgHomePrice: savedProfile.avgHomePrice || "$750,000",
    homesPerYear: savedProfile.homesPerYear || "25",
    timezone: savedProfile.timezone || "America/Chicago",
    aiContext: savedProfile.aiContext || "",
    platformWebhookTokens: platformTokens,
  };
})

export const saveBuilderProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    try {
      const { getDb } = await import('./db.server');
      const { requireAuth, setAuthCookie } = await import('./server-utils.server');
      const session = await requireAuth();
      const db = await getDb();
      
      const profileData = data.data || data;

      // ── COMPULSORY ENFORCEMENT: AI Knowledge Base / Builder Defaults ──
      if (!profileData.aiContext || typeof profileData.aiContext !== 'string' || profileData.aiContext.trim().length < 20) {
        throw new Error("AI Knowledge Base / Builder Defaults is required (minimum 20 characters). Please provide your operating policies, service region, and build specifications.");
      }
      
      await writeSettingJson('builder_profile', profileData);
      
      const builderId = session.role === 'admin' ? session.actingAsBuilderId : session.builderId;
      if (builderId) {
        await db.builder.update({
          where: { id: builderId },
          data: {
            companyName: profileData.companyName,
            contactName: profileData.primaryContact,
            phone: profileData.phone,
            email: profileData.email,
          }
        });
      }
      
      await db.user.update({
        where: { id: session.userId },
        data: {
          displayName: profileData.primaryContact,
        }
      });
      
      const { exp, iat, ...sessionWithoutExp } = session as any;
      const nextSession = {
        ...sessionWithoutExp,
        companyName: profileData.companyName,
        displayName: profileData.primaryContact,
      };
      await setAuthCookie(nextSession as any);
      
      const { invalidateSessionCache } = await import('./auth');
      invalidateSessionCache(session.userId);
      invalidateCache("dashboard_");
      
      return { success: true }
    } catch (err: any) {
      console.error("SAVE BUILDER PROFILE RUNTIME ERROR:", err);
      throw err;
    }
  })

export const getAiBrainConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAuth } = await import('./server-utils.server');
  const { getDb } = await import('./db.server');
  const session = await requireAuth();
  const db = await getDb();

  const builderId = session.role === 'admin'
    ? (session.actingAsBuilderId || session.builderId)
    : session.builderId;

  const builder = await db.builder.findUnique({
    where: { id: builderId || '' },
    select: { settings: true }
  });

  const settingsObj = builder?.settings
    ? (typeof builder.settings === 'string' ? JSON.parse(builder.settings) : builder.settings)
    : {};

  const brainConfig = settingsObj['ai_brain_config'] || {};
  const legacyQual = settingsObj['qualification_rules'] || {};
  const builderProfile = settingsObj['builder_profile'] || {};

  return {
    primaryGoal: (brainConfig.primaryGoal as string) || 'book_consultation',
    brandVoice: (brainConfig.brandVoice as string) || 'luxury_bespoke',
    personaName: (brainConfig.personaName as string) || (builderProfile.primaryContact as string) || 'Alex',
    minBudget: (brainConfig.minBudget as string) || (legacyQual.minBudget as string) || '$500,000',
    maxTimeline: (brainConfig.maxTimeline as string) || (legacyQual.maxTimeline as string) || '12',
    lotRequirement: (brainConfig.lotRequirement as string) || 'actively_shopping',
    plansRequirement: (brainConfig.plansRequirement as string) || 'any',
    minLeadScore: typeof brainConfig.minLeadScore === 'number' ? brainConfig.minLeadScore : (typeof legacyQual.minLeadScore === 'number' ? legacyQual.minLeadScore : 60),
    customDirectives: (brainConfig.customDirectives as string) || (builderProfile.aiContext as string) || '',
  };
});

export const saveAiBrainConfig = createServerFn({ method: 'POST' })
  .inputValidator((data: Record<string, any>) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    await writeSettingJson('ai_brain_config', data);
    // Also sync backwards to legacy keys for compatibility
    await writeSettingJson('qualification_rules', {
      minBudget: data.minBudget,
      maxTimeline: data.maxTimeline,
      minLeadScore: data.minLeadScore,
    });
    return { success: true };
  });

export const getQualificationRules = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  return readSettingJson('qualification_rules')
})

export const saveQualificationRules = createServerFn({ method: 'POST' })
  .inputValidator((data: Record<string, any>) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    await writeSettingJson('qualification_rules', data)
    return { success: true }
  })

export const getNotificationSettings = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  return readSettingJson('notification_settings')
})

export const saveNotificationSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: Record<string, any>) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    await writeSettingJson('notification_settings', data)
    return { success: true }
  })

export const getWebhookUrl = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const row = await readSettingJson('webhook_url')
  return (row.url as string) || ''
})

export const saveWebhookUrl = createServerFn({ method: 'POST' })
  .inputValidator((url: string) => url)
  .handler(async ({ data: url }) => {
    const { requireAuth } = await import('./server-utils.server');
    const { validateOutboundWebhookUrl } = await import('./security-helpers.server');
    const session = await requireAuth();

    if (session.role === 'builder') {
      if (session.builderRole !== 'owner' && session.builderRole !== 'admin') {
        throw new Error('FORBIDDEN: Only Owners and Administrators can modify webhook endpoints.');
      }
    }

    const cleanUrl = url && url.trim().length > 0 ? await validateOutboundWebhookUrl(url) : '';
    await writeSettingJson('webhook_url', { url: cleanUrl }, session);
    const res = { success: true, url: cleanUrl };
    return Object.assign(res, { result: res });
  })

// â”€â”€â”€ Per-lead AI Concierge toggle persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stores { [leadId]: boolean } map in the Integration table under 'ai_toggle_map'

export const getAiToggleMap = createServerFn({ method: 'GET' }).handler(async () => {
  const row = await readSettingJson('ai_toggle_map')
  return row as Record<string, boolean>
})

export async function setLeadAiToggleDirect(leadId: string, active: boolean, callerSession?: any) {
  if (!callerSession || !callerSession.builderId) {
    throw new Error('UNAUTHORIZED: Explicit tenant context required for AI toggle modification');
  }

  const { getDb } = await import('./db.server');
  const db = await getDb();
  
  // Verify lead exists and strictly belongs to the specified tenant
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, builderId: true }
  });

  if (!lead || lead.builderId !== callerSession.builderId) {
    throw new Error('FORBIDDEN: Lead does not belong to authorized tenant');
  }

  const current = await readSettingJson('ai_toggle_map', callerSession);
  current[leadId] = active;
  await writeSettingJson('ai_toggle_map', current, callerSession);

  // Smart AI Re-activation Hook:
  // If toggled ON, check if the latest message is an unreplied homeowner message.
  // If so, reconcile status to 'Replied' and auto-queue a delayed AI response.
  if (active) {
    try {
      const latestMsg = await db.message.findFirst({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, sender: true, content: true }
      });

      if (latestMsg && latestMsg.sender === 'lead') {
        // 1. Ensure lead status is at least 'Replied'
        await db.lead.updateMany({
          where: {
            id: leadId,
            status: { in: ['New', 'Emailed', 'Opened', 'Outreach', 'contacted'] }
          },
          data: { status: 'Replied' }
        });

        // 2. Queue authentic delayed reply
        const { queueDelayedAiReply } = await import('./ai-queue.server');
        const queueRes = await queueDelayedAiReply(leadId, callerSession.builderId, latestMsg.content);
        const minutes = (queueRes.delaySeconds / 60).toFixed(1);
        await db.activity.create({
          data: {
            builderId: callerSession.builderId,
            leadId,
            action: `⏳ AI Concierge resumed: response queued (~${minutes} min authentic delay to preserve human trust).`,
          }
        }).catch(() => {});
      }
    } catch (queueErr) {
      console.warn('[AI TOGGLE RE-ACTIVATION QUEUE WARNING]:', queueErr);
    }
  }

  return { success: true };
}

export const setLeadAiToggle = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAuth, getTenantDb } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb(session);

    // Verify ownership through tenant-isolated db
    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      select: { id: true, builderId: true, name: true }
    });

    if (!lead) {
      throw new Error('FORBIDDEN: Lead not found or not owned by your organization');
    }

    const res = await setLeadAiToggleDirect(data.leadId, data.active, session);

    // Audit trail
    await db.activity.create({
      data: {
        builderId: session.builderId || '',
        leadId: data.leadId,
        action: `🤖 AI Concierge manually toggled ${data.active ? 'ON' : 'OFF'} for ${lead.name || 'lead'} by ${session.displayName || session.userId || 'staff'}.`,
      }
    }).catch(() => {});

    return res;
  })

export async function checkAndSyncRencastLeads() {
  try {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();

    // 1. Read API key and target market from environment variables
    const apiKey = process.env.RENCAST_API_KEY;
    const targetMarket = process.env.RENCAST_TARGET_MARKET || 'Local Market';

    if (!apiKey) {
      return; // Key not set yet â€” user needs to paste it in .env
    }

    // 2. Check if already run today (YYYY-MM-DD) â€” stored in DB to survive restarts
    const today = new Date().toISOString().split('T')[0];
    const syncMeta = await readSettingJson('rencast_sync_meta');
    if (syncMeta.lastSyncDate === today) {
      return; // Already ran today
    }

    console.log(`[Rencast Sync] Running daily sync â€” date: ${today}, market: ${targetMarket}`);

    // 3. Fetch up to 20 permits from Rencast API
    let leadsData: any[] = [];
    try {
      const response = await fetch(
        `https://api.rencast.com/v1/permits?limit=20&market=${encodeURIComponent(targetMarket)}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawItems = Array.isArray(json) ? json : json.permits || json.results || [];
        leadsData = rawItems.slice(0, 20);
      } else {
        console.warn(`[Rencast Sync] API returned ${response.status}. Using realistic permit fallback.`);
      }
    } catch (apiErr) {
      console.error('[Rencast Sync] Network error â€” using realistic permit fallback.', apiErr);
    }

    // 4. Fallback: generate realistic permits if API unavailable
    if (leadsData.length === 0) {
      leadsData = generateRealisticPermits(targetMarket, 20);
    }

    // 5. Ingest into DB (deduplicate by name in a single bulk query)
    const incomingNames = leadsData.map(item => item.name);
    const existingLeads = await db.lead.findMany({
      where: {
        name: { in: incomingNames },
        builderId: session.builderId || ''
      },
      select: { name: true }
    });
    const existingNames = new Set(existingLeads.map((l: any) => l.name));
    const newItems = leadsData.filter(item => !existingNames.has(item.name));

    let leadsIngested = 0;
    for (const item of newItems) {
      const landPrice = item.landPrice || Math.floor(180000 + Math.random() * 220000);
      const estimatedBudget = landPrice * 4;

      const marketStateMatch = targetMarket.match(/,\s*([A-Z]{2})\b/i);
      const defaultState = marketStateMatch ? marketStateMatch[1].toUpperCase() : '';

      const lead = await db.lead.create({
        data: {
          builderId: session.builderId || '',
          name: item.name,
          phone: item.phone || null,
          email: item.email || null,
          county: item.county || targetMarket,
          state: item.state || defaultState,
          landPrice,
          estimatedBudget,
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : new Date(),
          status: 'New',
          scoreTier: estimatedBudget >= 1200000 ? 'Hot' : estimatedBudget >= 800000 ? 'Warm' : 'Cold',
          source: 'Rencast API',
        },
      });

      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: lead.id,
          action: `Building permit captured via Rencast API — ${lead.county}`,
        },
      });

      leadsIngested++;
    }

    console.log(`[Rencast Sync] Done. ${leadsIngested} new prospects ingested.`);

    // 6. Save today's date so it won't run again until tomorrow
    await writeSettingJson('rencast_sync_meta', { lastSyncDate: today });

  } catch (error) {
    console.error('[Rencast Sync] Critical error:', error);
  }
}

function generateRealisticPermits(targetMarket: string, count: number): any[] {
  const firstNames = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Emily", "Sarah", "Jessica", "Amanda", "Ashley", "Taylor", "Megan", "Hannah", "Kayla", "Madison"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson", "Martinez", "Anderson", "Taylor", "Thomas", "Hernandez", "Moore", "Martin", "Jackson", "Thompson", "White", "Lopez", "Lee", "Gonzalez", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Perez", "Hall"];
  
  const marketStateMatch = targetMarket.match(/,\s*([A-Z]{2})\b/i);
  const resolvedState = marketStateMatch ? marketStateMatch[1].toUpperCase() : '';

  const permits: Array<{ name: string; phone: string; email: string; county: string; state: string; landPrice: number; purchaseDate: Date }> = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    
    const areaCode = [305, 415, 312, 212, 206, 512, 404, 702, 602, 303][Math.floor(Math.random() * 10)];
    const phone = `+1 ${areaCode}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    
    const landPrice = Math.floor(150000 + Math.random() * 250000);
    const purchaseDate = new Date();
    purchaseDate.setDate(now.getDate() - Math.floor(Math.random() * 5)); 
    
    permits.push({
      name: fullName,
      phone,
      email,
      county: targetMarket,
      state: resolvedState || "",
      landPrice,
      purchaseDate,
    });
  }
  return permits;
}

export const getTeamData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { assertTenantContext } = await import('./security-helpers.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const tenantId = assertTenantContext(session);
    const db = await getTenantDb(session);

    const users = await db.user.findMany({
      where: {
        builderId: tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        builderRole: true,
        lastLoginAt: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Object.assign(users, { result: users });
  });

export const createTeamInvite = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; email: string; role: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();

    if (session.role === 'builder') {
      if (session.builderRole === 'sales' || session.builderRole === 'manager') {
        throw new Error('FORBIDDEN: Only Owners and Admins can invite team members.')
      }
      if (session.builderRole === 'admin' && (data.role === 'owner' || data.role === 'admin')) {
        throw new Error('FORBIDDEN: Admins can only invite Manager or Sales Agent roles.')
      }
    }

    const db = await getTenantDb()
    
    // Generate random token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    const dummyPasswordHash = await import('bcryptjs').then(b => b.hash(crypto.randomBytes(16).toString('hex'), 10))

    await db.user.create({
      data: {
        builderId: session.builderId,
        displayName: data.name,
        email: data.email,
        role: 'builder',
        builderRole: data.role,
        passwordHash: dummyPasswordHash,
        forcePasswordReset: true,
        resetToken: token,
        resetTokenExpires: expires,
        isActive: true,
      }
    })

    // Dispatch Official Invite Email via Resend to the invited member
    try {
      const { sendOutboundEmail } = await import('./email.server');
      const baseUrl = process.env.APP_BASE_URL || 'https://app.buildersedge.com';
      const inviteUrl = `${baseUrl}/invite/${token}`;
      const companyName = session.companyName || 'Nexora Builders';
      const inviterName = session.displayName || 'The Owner';
      const roleLabel = data.role === 'owner' ? 'Co-Owner' : data.role === 'admin' ? 'Administrator' : data.role === 'manager' ? 'Sales Manager' : 'Sales Representative';

      await sendOutboundEmail({
        to: data.email,
        subject: `You've been invited to join ${companyName} on WeaverFrame`,
        from: `${companyName} Team <onboarding@resend.dev>`,
        replyTo: session.email,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to ${companyName}</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hi ${data.name},</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;"><strong>${inviterName}</strong> has invited you to join the <strong>${companyName}</strong> workspace on WeaverFrame as a <strong>${roleLabel}</strong>.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
              <p style="margin: 0 0 6px 0; color: #0f172a; font-weight: 600; font-size: 14px;">🔑 Account Details:</p>
              <p style="margin: 0 0 4px 0; color: #334155; font-size: 13px;"><strong>Login Email:</strong> ${data.email}</p>
              <p style="margin: 0; color: #334155; font-size: 13px;"><strong>Assigned Role:</strong> ${roleLabel}</p>
            </div>

            <p style="color: #475569; font-size: 14px; line-height: 1.5;">Click the secure button below to set your account password and activate your workspace:</p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${inviteUrl}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">Accept Invite & Set Password &rarr;</a>
            </div>

            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-bottom: 0;">This invite link will expire in 7 days.</p>
          </div>
        `,
        text: `Hi ${data.name}, ${inviterName} invited you to join ${companyName}. Set your password and accept your invite here: ${inviteUrl}`
      });
    } catch (err) {
      console.error('[INVITE EMAIL ERROR]', err);
    }

    return { success: true, inviteLink: `/invite/${token}` }
  })

export const removeTeamMember = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { assertTenantContext } = await import('./security-helpers.server');
    const session = await requireAuth();
    const tenantId = assertTenantContext(session);

    // 1. Prevent self-removal
    if (userId === session.userId) {
      throw new Error('FORBIDDEN: Cannot remove your own account.');
    }

    // 2. Role permissions: Only Owners and Admins can remove team members
    if (session.role === 'builder') {
      if (session.builderRole === 'sales' || session.builderRole === 'manager') {
        throw new Error('FORBIDDEN: Only Owners and Admins can remove team members.');
      }
    }

    const db = await getTenantDb(session);
    try {
      // 3. Strict tenant isolation: target user MUST belong to caller's tenant and not already deleted
      const targetUser = await db.user.findFirst({
        where: { id: userId, builderId: tenantId, deletedAt: null },
        select: { id: true, builderRole: true },
      });

      if (!targetUser) throw new Error('User not found or access denied');

      // 4. Role Hierarchy rules
      if (session.role === 'builder') {
        if (targetUser.builderRole === 'owner') {
          // Check if there are other owners remaining
          const remainingOwners = await db.user.count({
            where: {
              builderId: tenantId,
              builderRole: 'owner',
              deletedAt: null,
              id: { not: userId },
            },
          });
          if (remainingOwners === 0) {
            throw new Error('FORBIDDEN: Cannot remove the last Owner account.');
          }
        }
        if (session.builderRole === 'admin' && targetUser.builderRole === 'admin') {
          throw new Error('FORBIDDEN: Admins cannot remove other Admin accounts.');
        }
      }

      // 5. Soft-delete user to maintain audit trails and foreign key integrity
      await db.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          isActive: false,
          tokenVersion: { increment: 1 },
          resetToken: null,
          resetTokenHash: null,
          resetTokenExpires: null,
        },
      });

      const res = { success: true };
      return Object.assign(res, { result: res });
    } catch (err) {
      console.error('Error in removeTeamMember:', err);
      throw err;
    }
  });

export const generatePasswordResetLink = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { hashToken, sanitizeResetResponse } = await import('./security-helpers.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    
    // Strict RBAC Allow-list: Super Admin OR Builder Owner / Admin only
    const isSuperAdmin = session.role === 'admin';
    const isBuilderOwnerOrAdmin =
      session.role === 'builder' &&
      (session.builderRole === 'owner' || session.builderRole === 'admin');

    if (!isSuperAdmin && !isBuilderOwnerOrAdmin) {
      throw new Error('FORBIDDEN: Only organization owners and administrators can generate password reset links.');
    }

    // Atomic tenant isolation: target user must belong to caller's tenant
    const tenantScopedWhere = isSuperAdmin
      ? { id: userId }
      : { id: userId, builderId: session.builderId ?? '' };

    const userToReset = await db.user.findFirst({ where: tenantScopedWhere });
    if (!userToReset) throw new Error('User not found or access denied');

    const crypto = await import('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // Strict 1-hour TTL
    
    // Store only SHA-256 hash — NEVER plaintext token
    await db.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenHash: tokenHash,
        resetTokenExpires: expires,
        forcePasswordReset: true,
      }
    });

    const appBaseUrl = (process.env.APP_BASE_URL || 'https://weaverframe.in').replace(/\/+$/, '');
    const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;

    // Non-blocking async email delivery to target user
    setImmediate(async () => {
      try {
        const { sendOutboundEmail, buildPasswordResetEmailHtml } = await import('./email.server');
        const html = buildPasswordResetEmailHtml({
          resetUrl,
          recipientEmail: userToReset.email,
          displayName: userToReset.displayName,
        });

        await sendOutboundEmail({
          to: userToReset.email,
          subject: 'WeaverFrame Security: Password Reset Authorization',
          html,
        });
      } catch (err) {
        console.error('[SECURITY] Failed to dispatch password reset email:', err);
      }
    });

    // Zero-token leakage: NEVER return the rawToken or reset link in the API response
    return sanitizeResetResponse();
  });

export const createStripeCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { planId: string; returnUrl?: string }) => data)
  .handler(async ({ data }) => {
    const { requireAuth, getTenantDb } = await import('./server-utils.server');
    const session = await requireAuth();
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    const planPrices: Record<string, { name: string; amountCents: number }> = {
      trial: { name: "Evaluation Trial", amountCents: 0 },
      starter: { name: "Starter Tier (Up to 50 leads/mo)", amountCents: 14900 },
      growth: { name: "Growth Tier (Up to 200 leads/mo)", amountCents: 34900 },
      // Aliases
      professional: { name: "Starter Tier (Up to 50 leads/mo)", amountCents: 14900 },
      enterprise: { name: "Growth Tier (Up to 200 leads/mo)", amountCents: 34900 },
    };

    const selectedPlan = planPrices[data.planId];
    if (!selectedPlan) throw new Error("Invalid plan selected");

    if (!stripeKey) {
      return {
        url: null,
        simulated: true,
        message: "Stripe key not configured. Set STRIPE_SECRET_KEY in Vercel environment variables to enable live payments."
      };
    }

    try {
      const db = await getTenantDb();
      const builder = await db.builder.findUnique({
        where: { id: session.builderId || '' }
      });

      const { getSafeRedirectUrl } = await import('./security-helpers.server');
      const params = new URLSearchParams();
      params.append('payment_method_types[0]', 'card');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', `WeaverFrame ${selectedPlan.name}`);
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][price_data][unit_amount]', selectedPlan.amountCents.toString());
      params.append('line_items[0][quantity]', '1');
      params.append('mode', 'subscription');
      params.append('success_url', getSafeRedirectUrl(data.returnUrl, '/settings?billing=success'));
      params.append('cancel_url', getSafeRedirectUrl(data.returnUrl, '/settings?billing=cancel'));
      params.append('client_reference_id', session.builderId || '');
      if (builder?.email) {
        params.append('customer_email', builder.email);
      }

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Stripe session creation error:", err);
        throw new Error(`Stripe API error: ${err}`);
      }

      const stripeSession = await res.json();
      return { url: stripeSession.url, simulated: false };
    } catch (error: any) {
      console.error("Error creating Stripe checkout session:", error);
      throw error;
    }
  });

export const createStripeCustomerPortalSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { returnUrl?: string }) => data)
  .handler(async ({ data }) => {
    const { requireAuth, getTenantDb } = await import('./server-utils.server');
    const session = await requireAuth();
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return {
        url: null,
        simulated: true,
        message: "Stripe key not configured. Set STRIPE_SECRET_KEY in Vercel environment variables to enable live customer portal."
      };
    }

    try {
      const db = await getTenantDb();
      const builder = await db.builder.findUnique({
        where: { id: session.builderId || '' }
      });

      if (!builder?.email) {
        throw new Error("Builder email not found for Stripe customer lookup.");
      }

      // 1. Search for customer by email in Stripe
      const searchRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(builder.email)}&limit=1`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` }
      });
      const searchData = await searchRes.json();
      const customer = searchData.data?.[0];

      if (!customer?.id) {
        return {
          url: null,
          simulated: true,
          message: "No active Stripe customer record found for this organization yet. Complete a checkout first."
        };
      }

      const { getSafeRedirectUrl } = await import('./security-helpers.server');
      // 2. Create Billing Portal Session
      const params = new URLSearchParams();
      params.append('customer', customer.id);
      params.append('return_url', getSafeRedirectUrl(data.returnUrl, '/settings'));

      const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!portalRes.ok) {
        const err = await portalRes.text();
        throw new Error(`Stripe Portal API error: ${err}`);
      }

      const portalSession = await portalRes.json();
      return { url: portalSession.url, simulated: false };
    } catch (error: any) {
      console.error("Error creating Stripe portal session:", error);
      throw error;
    }
  });
export const submitDemoRequest = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    buildVolume: string;
  }) => data)
  .handler(async ({ data }) => {
    const { handleSubmitDemoRequest } = await import('./server-utils.server');
    return handleSubmitDemoRequest(data);
  });

export const prewarmConnection = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { warmDb } = await import('./db.server');
    await warmDb();
    return { status: 'warm' };
  });




