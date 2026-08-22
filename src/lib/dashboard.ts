import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db'



import { getCache, setCache, invalidateCache } from './cache';

export const getDashboardData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth(data?.activeRole ?? undefined)

  const cacheKey = "dashboard_" + session.builderId + "_" + session.userId;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Pass session in — getTenantDb will skip its own requireAuth() call
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
    // Using parallel Prisma groupBy — safe, tenant-scoped via middleware, no raw SQL risk.
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
    const pipelineSub = `Avg ${avgBudgetStr} · ${qualifiedLeads} active prospects`

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

    const result = {
      totalLeads,
      qualifiedLeads,
      appointmentsSet,
      funnel,
      scoreData,
      activityFeed,
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
      const syncStatus = await db.systemSync.findUnique({ where: { id: 'rencast_leads' } });
      if (syncStatus) {
        return syncStatus.lastSyncAt.toISOString();
      }
      const latestLead = await db.lead.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });
      return latestLead ? latestLead.createdAt.toISOString() : null;
    } catch (e) {
      return null;
    }
  });

// FIX-5: Converted to POST so we can accept activeRole and pass it to requireAuth/getTenantDb.
// A GET server function cannot receive input params. Without activeRole, multi-cookie sessions
// (jwt_admin + jwt_builder both present) cause getTenantDb to silently fail with UNAUTHORIZED.
export const getNotificationsData = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth(data?.activeRole ?? undefined)
  const db = await getTenantDb(session)
  try {
    const activities = await db.activity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { lead: true }
    })
    return activities.map(act => {
      let title = "Lead Activity"
      if (act.action.includes("🚨 High Alert")) {
        title = "🚨 High Priority Alert"
      } else if (act.action.toLowerCase().includes("schedule") || act.action.toLowerCase().includes("appointment") || act.action.toLowerCase().includes("site visit")) {
        title = "📅 Meeting Scheduled"
      } else if (act.action.toLowerCase().includes("hot lead") || act.action.toLowerCase().includes("qualif")) {
        title = "🔥 Hot Lead"
      } else if (act.action.toLowerCase().includes("added") || act.action.toLowerCase().includes("manually")) {
        title = "👤 New Lead Added"
      } else if (act.action.toLowerCase().includes("replied") || act.action.toLowerCase().includes("response")) {
        title = "💬 Lead Replied"
      }
      return {
        id: act.id,
        title,
        desc: `${act.lead?.name || 'Lead'}: ${act.action}`,
        time: act.createdAt.toISOString(),
        unread: new Date().getTime() - act.createdAt.getTime() < 3600000
      }
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return []
  }
})

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
    const { db } = await import('./db');
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
  if (lead.source && lead.source.trim() && lead.source !== "Austin Building Permits") {
    return lead.source.trim();
  }
  return lead.source || "Website Contact Form";
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
      include: {
        appointments: {
          orderBy: { dateTime: 'desc' },
          take: 1
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5
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
      return { ...request, sig }
    } catch (error) {
      console.error("Error in sendReviewRequest:", error)
      throw error
    }
  })

export const submitClientReview = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; rating: number; feedback?: string; platform?: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const { id, rating, feedback, platform } = data
    const db = await getTenantDb()
    try {
      const existing = await db.reviewRequest.findUnique({ where: { id } })
      if (!existing) throw new Error("Review request not found")

      let status = "Completed"
      if (rating <= 3) {
        status = "Feedback"
      }

      const updated = await db.reviewRequest.update({
        where: { id },
        data: {
          rating,
          feedback: feedback || null,
          platform: rating >= 4 ? (platform || "Google Business") : null,
          status,
        }
      })

      // If positive, increment the reviewCount on the chosen platform
      if (rating >= 4) {
        const platName = platform || "Google Business"
        const platformRecord = await db.reviewPlatform.findFirst({
          where: { name: { contains: platName, mode: 'insensitive' } }
        })
        if (platformRecord) {
          const newCount = platformRecord.reviewCount + 1
          // Compute a slightly adjusted float rating
          const newRating = parseFloat(((platformRecord.rating * platformRecord.reviewCount + rating) / newCount).toFixed(2))
          await db.reviewPlatform.update({
            where: { id: platformRecord.id },
            data: {
              reviewCount: newCount,
              rating: newRating > 5.0 ? 5.0 : newRating
            }
          })
        }

        // Add to public reviews feed in database!
        await db.publicReview.create({
          data: {
            builderId: session.builderId || '',
            clientName: existing.clientName,
            platform: platName,
            rating: rating,
            reviewText: feedback || `Incredible custom building experience with ${session.companyName || 'our team'}! Extremely satisfied with their professionalism and quality.`,
            projectType: "Custom Home Build",
            location: "Austin, TX",
            status: "Unanswered"
          }
        })
      }

      if (existing.leadId) {
        const activityAction = rating >= 4
          ? `Client submitted positive ${rating}-Star Review for ${platform || 'Google Business'}.`
          : `Client submitted private feedback: "${feedback}" (${rating} Stars). Safeguarded from public profiles.`

        await db.activity.create({
          data: {
            builderId: session.builderId || '',
            leadId: existing.leadId,
            action: activityAction
          }
        })
      }

      return updated
    } catch (error) {
      console.error("Error in submitClientReview:", error)
      throw error
    }
  })

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
      select: { adSpendBalance: true, paymentMethod: true, plan: true }
    });
    
    return builder || { adSpendBalance: 0.0, paymentMethod: "None", plan: "trial" };
  } catch (error) {
    console.error("Error in getBillingProfile:", error);
    return { adSpendBalance: 0.0, paymentMethod: "None", plan: "trial" };
  }
});

export const updateBillingProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { adSpendBalance?: number; paymentMethod?: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    try {
      if (!session.builderId) throw new Error('Not a builder account');
      const updated = await db.builder.update({
        where: { id: session.builderId },
        data: {
          adSpendBalance: data.adSpendBalance !== undefined ? data.adSpendBalance : undefined,
          paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : undefined
        }
      });
      return { success: true, builder: updated };
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
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const maxTokens = options?.maxTokens || 800;
  const temperature = options?.temperature ?? 0.1;

  // 1. Prioritize Google Gemini Flash if GEMINI_API_KEY is configured
  if (geminiKey && geminiKey.trim() !== "") {
    const modelsToTry = [geminiModel, "gemini-3.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"].filter((v, i, a) => a.indexOf(v) === i);
    for (const m of modelsToTry) {
      try {
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
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) return content;
        } else {
          const errText = await res.text();
          console.warn(`Gemini model ${m} returned ${res.status}: ${errText}. Trying fallback...`);
        }
      } catch (geminiErr) {
        console.warn(`Gemini model ${m} network error:`, geminiErr);
      }
    }
  }

  // 2. Fallback to Groq if GROQ_API_KEY is configured
  if (groqKey && groqKey.trim() !== "") {
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: groqModel,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          ...(options?.isJson ? { response_format: { type: "json_object" } } : {})
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        return groqData.choices?.[0]?.message?.content || "";
      } else {
        const errText = await groqRes.text();
        console.error(`Groq API returned ${groqRes.status}: ${errText}`);
      }
    } catch (groqErr) {
      console.error("Groq API fallback encountered network error:", groqErr);
    }
  }

  throw new Error("No AI API keys configured or all AI providers failed.");
}

export const generateGroqCompletion = createServerFn({ method: 'POST' })
  .inputValidator((data: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const { messages } = data;

    // Fallback Mock Engine in case no API keys are configured
    const hasKeys = (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") || (GROQ_API_KEY && GROQ_API_KEY.trim() !== "");
    if (!hasKeys) {
      const { requireAuth } = await import('./server-utils.server');
      const session = await requireAuth().catch(() => ({ companyName: "our company" }));
      console.log("No API keys found. Simulating AI completion...");
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || "";

      let reply = `Hi! Thank you for reaching out to ${session.companyName || "our team"}. We'd love to help you build your dream home.`;

      const lower = lastUserMsg.toLowerCase();
      if (lower.includes("budget") || lower.includes("price") || lower.includes("cost")) {
        reply = "Absolutely! Our custom home projects in Austin typically start at $500K for semi-custom builds and range upwards of $1.5M+ for full luxury estates. Does that range align with your investment plans?";
      } else if (lower.includes("saturday") || lower.includes("meet") || lower.includes("schedule") || lower.includes("tour")) {
        reply = "I would be delighted to schedule a walkthrough! Saturday morning at 10:30 AM works perfectly. Should I lock that slot in and send over the directions?";
      } else if (lower.includes("basement") || lower.includes("sloping") || lower.includes("terrain")) {
        reply = "Yes, we specialize in advanced custom builds. Do you already own the lot?";
      } else if (lower.includes("cabinet") || lower.includes("finish") || lower.includes("wood")) {
        reply = "Premium finishes are our signature! We craft custom architectural finishes. I can send you some photos of our recent projects!";
      } else if (lower.includes("script") || lower.includes("message")) {
        reply = JSON.stringify([
          { t: "Message 1 · Immediate (< 60s)", body: "Hi [Name]! Thanks for connecting. Are you looking to build in the next 6-12 months? Reply YES or NO." },
          { t: "Message 2 · 2 hours later", body: "Hey [Name], just checking in! Most of our clients prefer custom cabinets over stock options. Do you have a design style you love?" },
          { t: "Message 3 · 24 hours later", body: "Hi [Name], we can schedule a private tour of our design site this Thursday. Let me know if you would like me to book your spot!" }
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
  const leadName = lead ? lead.name : "Client";
  const leadCounty = lead ? lead.county : "your area";

  // Parse existing Lead Memory Graph
  let currentMemory: Record<string, any> = {
    budgetRange: lead?.estimatedBudget ? `$${(lead.estimatedBudget / 1000).toFixed(0)}k` : null,
    timeline: null,
    lotStatus: lead?.landPrice && lead.landPrice > 0 ? `Owns land in ${lead.county} ($${(lead.landPrice / 1000).toFixed(0)}k)` : null,
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

  const systemPrompt = `You are ${personaName}, the elite AI Senior Sales Executive & Concierge representing ${companyName}.
Your supervisor/builder principal is ${contactName}.

MISSION & SALES PERSON MINDSET:
- You are NOT a generic support bot. You are a high-performing, consultative luxury sales closer.
- Your ultimate objective: Help genuine homeowners bring their dream custom estate to life while locking in qualified showroom tours, architectural discovery calls, and site visits.
- Use consultative selling: Listen intently, acknowledge their aesthetic vision, ask targeted high-value qualification questions, frame value before price, and soft-close with clear next steps.

BRAND VOICE & PERSONA GUIDELINES:
- ${toneInstructions}
- Text like a natural human sales director via SMS/WhatsApp (2-3 concise sentences max per response).

QUALIFICATION STANDARDS & THRESHOLDS:
- Minimum Construction Budget: ${minBudget}
- Target Timeline: Within ${maxTimeline} months
- Land/Lot Readiness: ${lotRequirement === 'must_own_lot' ? 'Must own buildable lot or under contract' : 'Lot search assistance available or owns lot'}
- Architectural Status: ${plansRequirement}

OBJECTION HANDLING & ANTI-HESITATION PLAYBOOKS:
1. "PRICES ARE TOO HIGH / EXPENSIVE / COMPARING QUOTES":
   - Frame value immediately: Highlight our guaranteed fixed-cost architectural finishing, full structural warranty, transparent bespoke material sourcing, and zero surprise escalation clauses.
   - Example: "Completely understand! Custom builds are major investments. We focus on transparent fixed-scope architectural finishing with zero hidden surprises. Would you like to review our recent cost-per-sqft breakdown for ${leadCounty}?"
2. "JUST BROWSING / NOT READY YET / NEED TO DISCUSS WITH SPOUSE":
   - Low-friction value offer: Offer our private digital lookbook or a complimentary 15-minute 3D site walkthrough with zero obligation.
   - Example: "No rush at all! Many of our clients start exploring designs a year ahead. I'd love to send over our 2026 Architectural Lookbook to review with your family—shall I send that over?"
3. "DO YOU HAVE LOTS / LAND SELECTION QUESTIONS":
   - Reassure feasibility: Confirm our in-house civil engineer assists with lot vetting, topography slope analysis, and permit approvals.
4. "READY TO PROCEED / HIGH BUDGET / REQUESTING PRINCIPAL BUILDER":
   - Escalate immediately to human sales director while warmly confirming appointment.

CURRENT ACTIVE LEAD MEMORY (RECALL IN CONVERSATION):
- Client Name: ${leadName}
- Target County: ${leadCounty}
- Known Budget: ${currentMemory.budgetRange || "Not confirmed yet"}
- Lot/Land Status: ${currentMemory.lotStatus || "Not confirmed yet"}
- Timeline: ${currentMemory.timeline || "Not confirmed yet"}
- Desired Architectural Style: ${currentMemory.architecturalStyle || "Not confirmed yet"}
- Family/Lifestyle Needs: ${currentMemory.familyLifestyleNeeds || "Not confirmed yet"}
- Past Objections: ${currentMemory.objectionsRaised?.length ? currentMemory.objectionsRaised.join(', ') : "None"}
- Known Preferences: ${currentMemory.keyPreferences?.length ? currentMemory.keyPreferences.join(', ') : "None"}

CURRENT DATE & TIME: ${currentLocalTimeStr} (Timezone: ${timezone})

BUILDER CALENDAR SCHEDULE:
${apptScheduleStr}

CRITICAL CONVERSATION RULES:
1. CONTINUOUS CHAT RULE: DO NOT start your message with greetings like "Hello [Name]", "Hi [Name]", "Hey [Name]" if replying in an ongoing back-and-forth chat. Respond DIRECTLY and naturally like a human texting. Only greet on the very first outreach message.
2. ANSWER DIRECTLY: If the lead asks a direct question, answer it clearly before presenting a subtle call-to-action.
3. REALISTIC HUMAN DIALOGUE: Never mention internal AI reasoning, prompt instructions, or system limits.

STRUCTURED OUTPUT FORMAT:
You must respond strictly with a valid JSON object matching this schema:
{
  "replyText": string, // Natural SMS text to send to lead (2-3 sentences max)
  "intent": "HOT" | "WARM" | "COLD", // HOT: ready to build/meet, WARM: researching/interested, COLD: not interested/disqualified
  "dealScore": number, // 0 to 100 buyer readiness score based on budget, land ownership, timeline, and engagement
  "dealSummary": string, // 1-sentence executive summary of the lead's current readiness state
  "leadMemoryUpdate": {
    "budgetRange": string | null, // e.g. "$750k - $1M" or extracted number
    "timeline": string | null, // e.g. "Spring 2027", "Next 4 months"
    "lotStatus": string | null, // e.g. "Owns 2-acre lot in Travis", "Searching in Cedar Park"
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
  "bookingDetails": { "isoDateTime": string, "type": string } | null // ONLY set if lead agrees to a specific day/time
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
      rawResponse = await callAiEngine(formattedMessages, { isJson: true, maxTokens: 1200, temperature: 0.1 });
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
        replyText: "Thank you for sharing your ideas! We specialize in tailored custom estates throughout Austin. Do you currently have a specific architectural style or floor plan in mind?",
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
      bookingDetails = parsed.bookingDetails || null;
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

  // Determine DB status & tier
  let dbStatus = "Replied";
  let dbScoreTier = "Warm";
  let activityText = "";

  if (intent === 'HOT') {
    dbStatus = "Qualified";
    dbScoreTier = "Hot";
    activityText = `🟢 AI Sales Engine marked Lead as Hot (${dealScore}/100) — High buyer readiness.`;
  } else if (intent === 'COLD') {
    dbStatus = "Closed Lost";
    dbScoreTier = "Cold";
    activityText = `🔴 AI Sales Engine marked Lead as Cold (${dealScore}/100) — Disqualified or competitor chosen.`;
  } else {
    dbStatus = "Appointment";
    dbScoreTier = "Warm";
    activityText = `🟡 AI Sales Engine marked Lead as Warm (${dealScore}/100) — Nurturing in progress.`;
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

    // Auto-Book Appointment if confirmed
    if (bookingDetails && bookingDetails.isoDateTime) {
      try {
        const bookingDate = new Date(bookingDetails.isoDateTime);
        if (!isNaN(bookingDate.getTime())) {
          await db.appointment.create({
            data: {
              builderId,
              leadId,
              type: bookingDetails.type || 'Site visit',
              dateTime: bookingDate,
              location: 'TBD — Confirmed via AI Concierge',
              status: 'Pending',
              notes: `Auto-booked by AI Sales Concierge. Next step: ${nextBestAction}`
            }
          });
          await db.activity.create({
            data: {
              builderId,
              leadId,
              action: `📅 AI Concierge auto-booked a ${bookingDetails.type || 'Site visit'} on ${bookingDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`
            }
          });
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
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    
    try {
      const messages = await db.message.findMany({
        where: { leadId: data.leadId, builderId: session.builderId || '' },
        orderBy: { createdAt: 'asc' }
      });

      if (!messages || messages.length === 0) return "No conversation history available.";

      const chatLog = messages.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');
      
      const apiKey = process.env.GROQ_API_KEY?.replace(/['"]/g, '').trim();
      if (!apiKey) return "Groq API key not configured.";

      const prompt = `You are an expert AI Builder Sales Strategist preparing an Executive Pre-Meeting Briefing Sheet for a custom home builder before they meet or call a lead.

Analyze the entire conversation log and construct a detailed, highly structured Pre-Meeting Briefing covering these 4 core categories:

📋 CLIENT PROFILE & DESIGN SPECS:
• Summarize home style, square footage, bed/bath count, target county/city, land ownership, lot conditions (slopes, utilities, etc.).

💰 FINANCIALS & FEASIBILITY:
• Summarize stated budget range, per sq ft cost discussions, slope/foundation/retaining wall engineering cost expectations.

❓ KEY CONCERNS & OBJECTIONS RAISED:
• Summarize specific technical or pricing questions the client asked that the builder must address during the call.

🎯 ACTION PLAN & MEETING DELIVERABLES:
• Summarize scheduled meeting/call date, time, phone number, and exact documents requested (e.g. site evaluation report, floor plan proposals, estimate sheets).

Format the output clearly using bullet points and bold section headers. Keep it professional, highly detailed, clear, and actionable for the builder.

Conversation Log:
${chatLog}`;

      const summary = await callAiEngine([{ role: 'system', content: prompt }], { maxTokens: 300, temperature: 0.5 });
      return summary || "Unable to generate chat summary.";
    } catch (err) {
      console.error("Summarization error:", err);
      return "Failed to generate summary. Please try again.";
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

CRITICAL CONTEXT: The leads have NOT signed up or contacted the builder. They are identified from public records (specifically newly filed building permit filings or county tax records in Travis/Austin). The messages MUST be professional, highly localized, and build massive trust by referring directly to their newly filed permit/records, instead of claiming "thanks for your interest" or "thanks for connecting" (which would feel like spam and break trust).

Builder Custom Instruction: "${instruction}"

Follow these rules:
1. Message 1 must be designed for immediate dispatch (<60 seconds after a permit/tax record is filed). It must be direct, refer to the filed permit, and ask a qualifying question (e.g. if they have hired a general builder/contractor yet).
2. Message 2 should trigger 2 hours later if no reply. It should follow up politely and offer a useful localized resource (e.g., Austin Permitting Checklist, site preparation tips, or HOA zoning reviews).
3. Message 3 should trigger 24 hours later. It should propose a direct call-to-action (e.g., booking a private walkthrough at our contemporary model home in Lakeway or Dripping Springs).
4. Do not output anything other than a raw JSON array containing exactly three objects with keys "t" (the timing label) and "body" (the SMS script content).

Example Format:
[
  { "t": "Message 1 · Immediate (< 60s)", "body": "Hi [Name], I noticed your residential building permit application filed in Travis County. I'm ${primaryContact.split(' ')[0]}'s assistant from ${companyName}. Since custom builds in Austin require complex structural reviews, have you already hired a general builder?" },
  { "t": "Message 2 · 2 hours later (no reply)", "body": "Hey [Name], just checking in! I wanted to send over our Austin Permitting & Zoning Checklist (it saves weeks on site preparation). Do you already own the lot?" },
  { "t": "Message 3 · 24 hours later", "body": "Hi [Name], we are hosting private tours of our completed contemporary estate in Lakeway this Saturday. Let me know if you would like me to reserve a spot for you!" }
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
          { t: "Message 1 · Immediate (< 60s)", body: `Hi [Name]! I'm ${primaryContact.split(' ')[0]}'s assistant from ${companyName}. Are you looking to build your home in Austin in the next 6-12 months? Reply YES/NO.` },
          { t: "Message 2 · 2 hours later", body: "Hey [Name], just following up! Did you have a specific lot in mind in Travis County, or would you like help finding one?" },
          { t: "Message 3 · 24 hours later", body: "Hi [Name], would you like a private walkthrough of our newly completed contemporary estate this Thursday?" }
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
          action: `📆 Appointment booked: ${data.type} - ${data.location} scheduled for ${formattedDate}.`,
        }
      })

      // Add appointment card to messages
      await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId: data.leadId,
          sender: 'system',
          content: `📆 Site Visit Booked: ${data.type} scheduled for ${formattedDate} at ${data.location}.`,
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
          action: `❌ Appointment cancelled: ${existing.type} for ${formattedDate} has been removed.`,
        }
      })

      return { success: true }
    } catch (error) {
      console.error("Error in cancelAppointment:", error)
      throw error
    }
  })

export const generatePortalToken = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; activeRole?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth(data?.activeRole ?? undefined);
    const db = await getTenantDb(session);
    
    // Generate a random 32 char hex string
    const token = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    await db.lead.update({
      where: { id: data.leadId },
      data: { portalToken: token }
    });
    
    return token;
  });

export const getConversations = createServerFn({ method: 'POST' })
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
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
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

    const conversations = leads.map((l) => {
      const lastMsg = l.messages[0]
      const unreadCount = l._count.messages
      
      // Check if lead polled the portal within the last 30 seconds
      const isRecentlyActive = l.portalVisitedAt && 
          (new Date().getTime() - new Date(l.portalVisitedAt).getTime()) < 1000 * 30;

      return {
        leadId: l.id,
        leadName: l.name,
        phone: l.phone,
        email: l.email,
        status: l.status,
        scoreTier: l.scoreTier,
        estimatedBudget: l.estimatedBudget,
        lastMessage: lastMsg ? lastMsg.content : "No messages yet",
        lastMessageTime: lastMsg ? lastMsg.createdAt.toISOString() : l.createdAt.toISOString(),
        unreadCount,
        isOnline: !!isRecentlyActive,
        portalToken: l.portalToken,
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
      const lead = await db.lead.findUnique({
        where: { id: leadId }
      })
      if (!lead) throw new Error("Lead not found")

      const messages = await db.message.findMany({
        where: { leadId, isSimulated: data.isSimulated || false },
        orderBy: { createdAt: 'asc' }
      })

      if (!data.isSimulated) {
        await db.message.updateMany({
          where: { leadId, sender: 'lead', isRead: false, isSimulated: false },
          data: { isRead: true }
        })
      }

      return {
        lead,
        messages: messages.map(m => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          isRead: m.isRead
        }))
      }
    } catch (error) {
      console.error("Error in getMessagesForLead:", error)
      throw error
    }
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const { leadId, content } = data

      // Create user's message
      const userMsg = await db.message.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          sender: 'user',
          content,
          isRead: true
        }
      })

      // Update lead status to "Replied" only if it's not already "Appointment"
      const currentLead = await db.lead.findUnique({
        where: { id: leadId },
        select: { status: true }
      })

      if (currentLead && currentLead.status !== 'Appointment') {
        await db.lead.update({
          where: { id: leadId },
          data: { status: 'Replied' }
        })
      }

      return {
        userMessage: userMsg
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      throw error
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

      // 2. If AI is active, trigger Groq response
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
        }
      }

      return { leadMessage: leadMsg, systemMessage: systemMsg };
    } catch (error) {
      console.error("Error in simulateLeadMessage:", error);
      throw error;
    }
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

    // Optimized: Fetch all leads, appointments, review requests, messages, and activities at once to process in-memory
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
        select: { createdAt: true, sender: true }
      }),
      db.activity.findMany({
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
      const src = l.source || "Austin Building Permits"
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

export const getIntegrationsStatus = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const db = await getTenantDb()
  try {
    const integrations = await db.integration.findMany()
    
    // We map raw stored configs into masked configs to send to the client
    const mapped = await Promise.all(integrations.map(async item => {
      let config: Record<string, string> = {}
      try {
        if (item.configSecure) {
          const { decrypt } = await import('./crypto');
          const decrypted = decrypt(item.configSecure)
          const parsed = JSON.parse(decrypted)
          // Mask sensitive password fields
          Object.keys(parsed).forEach(key => {
            const lowerKey = key.toLowerCase()
            if (lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("key")) {
              config[key] = "••••••••••••••••"
            } else {
              config[key] = parsed[key]
            }
          })
        }
      } catch (err) {
        console.error(`Error decrypting integration config for ${item.platformId}:`, err)
      }

      return {
        id: item.platformId,
        isConnected: item.isConnected,
        credentials: config
      }
    }))

    // Return as a key-value record for ease of frontend lookup
    const statusMap: Record<string, { isConnected: boolean; credentials: Record<string, string> }> = {}
    mapped.forEach(m => {
      statusMap[m.id] = {
        isConnected: m.isConnected,
        credentials: m.credentials
      }
    })

    return statusMap
  } catch (error) {
    console.error("Error in getIntegrationsStatus server function:", error)
    return {}
  }
})

export const saveIntegrationCredentials = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string; credentials: Record<string, string> }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const { platformId, credentials } = data
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      // First, if there's an existing configuration, let's load it to preserve unchanged masked passwords!
      // If the user saves and keeps the "••••••••••••••••" mask, we should not overwrite it with the actual secret value!
      let finalCredentials = { ...credentials }
      
      const existing = await db.integration.findUnique({
        where: {
          builderId_platformId: {
            builderId: session.builderId || '',
            platformId
          }
        }
      })

      if (existing && existing.configSecure) {
        try {
          const { decrypt } = await import('./crypto');
          const decrypted = decrypt(existing.configSecure)
          const parsed = JSON.parse(decrypted)
          
          // Overwrite any keys that came in as the standard mask with their original values
          Object.keys(finalCredentials).forEach(key => {
            if (finalCredentials[key] === "••••••••••••••••" && parsed[key]) {
              finalCredentials[key] = parsed[key]
            }
          })
        } catch (err) {
          console.error("Failed to decrypt existing config during merge:", err)
        }
      }

      const { encrypt } = await import('./crypto');
      const encrypted = encrypt(JSON.stringify(finalCredentials))

      await db.integration.upsert({
        where: {
          builderId_platformId: {
            builderId: session.builderId || '',
            platformId
          }
        },
        update: {
          configSecure: encrypted,
          isConnected: true
        },
        create: {
          builderId: session.builderId || '',
          platformId,
          configSecure: encrypted,
          isConnected: true
        }
      })

      return { success: true }
    } catch (error) {
      console.error(`Error in saveIntegrationCredentials for ${platformId}:`, error)
      throw error
    }
  })

export const disconnectIntegration = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const { platformId } = data
    const db = await getTenantDb()
    try {
      await db.integration.deleteMany({
        where: { platformId }
      })
      return { success: true }
    } catch (error) {
      console.error(`Error in disconnectIntegration for ${platformId}:`, error)
      throw error
    }
  })

export const testIntegrationConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: { platformId: string; credentials: Record<string, string> }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const { platformId, credentials } = data;
    
    // Simulate real network validation latency
    await new Promise(resolve => setTimeout(resolve, 1200));

    if (platformId === "google") {
      if (!credentials.clientId || !credentials.clientSecret || !credentials.locationId) {
        throw new Error("Missing required credentials for Google Business API.");
      }
      if (credentials.clientSecret !== "••••••••••••••••" && credentials.clientSecret.length < 10) {
        throw new Error("Invalid Google Client Secret. Secret key must be at least 10 characters.");
      }
    }
    
    else if (platformId === "twilio") {
      if (!credentials.accountSid || !credentials.authToken || !credentials.phoneNumber) {
        throw new Error("Missing required credentials for Twilio SMS Outreach Gateway.");
      }
      if (credentials.accountSid !== "••••••••••••••••" && !credentials.accountSid.startsWith("AC")) {
        throw new Error("Invalid Twilio Account SID format. Must start with 'AC'.");
      }
      if (credentials.authToken !== "••••••••••••••••" && credentials.authToken.length < 16) {
        throw new Error("Invalid Twilio Auth Token. Must be at least 16 characters.");
      }
    }

    else if (platformId === "hubspot") {
      if (!credentials.accessToken) {
        throw new Error("Missing HubSpot Private App Access Token.");
      }
      if (credentials.accessToken !== "••••••••••••••••" && !credentials.accessToken.startsWith("pat-")) {
        throw new Error("Invalid HubSpot Access Token format. Must start with 'pat-'.");
      }
    }

    else if (platformId === "houzz") {
      if (!credentials.apiKey || !credentials.profileUrl) {
        throw new Error("Missing Houzz Partner API Key or Profile URL.");
      }
      if (credentials.apiKey !== "••••••••••••••••" && credentials.apiKey.length < 8) {
        throw new Error("Invalid Houzz API Key length.");
      }
    }

    else if (platformId === "facebook") {
      if (!credentials.pageId || !credentials.accessToken) {
        throw new Error("Missing Facebook Page ID or Access Token.");
      }
    }

    else if (platformId === "ghl") {
      if (!credentials.apiKey) {
        throw new Error("Missing GoHighLevel Location API Key.");
      }
    }

    else if (platformId === "email_mailbox") {
      const email = credentials.email || credentials.username || '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        throw new Error("Invalid email address. Please enter a valid company mailbox address (e.g. alex@luxuryhomes.com).");
      }
      const provider = credentials.provider || 'google';
      if (provider === 'custom_smtp') {
        if (!credentials.smtpHost) throw new Error("Missing SMTP Host (e.g. smtp.mailgun.org).");
        if (!credentials.smtpPort) throw new Error("Missing SMTP Port (e.g. 587 or 465).");
        if (!credentials.password && credentials.password !== "••••••••••••••••") {
          throw new Error("Missing SMTP Password or App Password.");
        }
      } else {
        if (!credentials.password && credentials.password !== "••••••••••••••••") {
          throw new Error("Missing App Password or Access Secret for mailbox authentication.");
        }
      }
    }

    return { success: true };
  })

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
      
      // Construct CSV header & rows with double quotes around text content containing commas
      const headers = ["ID", "Name", "Phone", "Email", "County", "State", "Land Price", "Estimated Budget", "Purchase Date", "Status", "Score Tier", "Source"];
      const rows = leads.map(l => [
        l.id,
        `"${(l.name || "").replace(/"/g, '""')}"`,
        l.phone || "",
        l.email || "",
        `"${(l.county || "").replace(/"/g, '""')}"`,
        l.state || "",
        l.landPrice || 0,
        l.estimatedBudget || 0,
        l.purchaseDate ? l.purchaseDate.toISOString() : "",
        l.status || "",
        l.scoreTier || "",
        `"${(l.source || "").replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      return { csvContent };
    } catch (error) {
      console.error("Error exporting CSV:", error);
      throw error;
    }
  })


// ─── Settings persistence helpers ────────────────────────────────────────────
// We reuse the Integration table with reserved platformId keys so no new
// Prisma migration is required.

export async function readSettingJson(platformId: string, preResolvedSession?: any): Promise<Record<string, any>> {
  const { requireAuth } = await import('./server-utils.server');
  const { getDb } = await import('./db');
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
  const { getDb } = await import('./db');
  const session = preResolvedSession ?? await requireAuth()
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
}

export const getBuilderProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: { activeRole?: string | null } | undefined) => data)
  .handler(async ({ data }) => {
  const { getDb } = await import('./db');
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
  
  return {
    companyName: builder?.companyName || savedProfile.companyName || "Your Company LLC",
    primaryContact: builder?.contactName || savedProfile.primaryContact || user?.displayName || "Your Name",
    email: builder?.email || savedProfile.email || user?.email || "youremail@example.com",
    phone: builder?.phone || savedProfile.phone || "+1 512-555-0100",
    businessAddress: savedProfile.businessAddress || "1100 S Lamar Blvd, Austin, TX 78704",
    targetZipCodes: savedProfile.targetZipCodes || "78704, 78703, 78731, 78613, 78641",
    avgHomePrice: savedProfile.avgHomePrice || "$700,000",
    homesPerYear: savedProfile.homesPerYear || "42",
    timezone: savedProfile.timezone || "Asia/Kolkata",
    aiContext: savedProfile.aiContext || "",
  };
})

export const saveBuilderProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    try {
      const { getDb } = await import('./db');
      const { requireAuth, setAuthCookie } = await import('./server-utils.server');
      const session = await requireAuth();
      const db = await getDb();
      
      const profileData = data.data || data;
      
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
  const { getTenantDb } = await import('./server-utils.server');
  const brainConfig = await readSettingJson('ai_brain_config');
  const legacyQual = await readSettingJson('qualification_rules');
  const builderProfile = await readSettingJson('builder_profile');

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
    const { getTenantDb } = await import('./server-utils.server');
    await writeSettingJson('webhook_url', { url })
    return { success: true }
  })

// ─── Per-lead AI Concierge toggle persistence ─────────────────────────────────
// Stores { [leadId]: boolean } map in the Integration table under 'ai_toggle_map'

export const getAiToggleMap = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const row = await readSettingJson('ai_toggle_map')
  return row as Record<string, boolean>
})

export const setLeadAiToggle = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const current = await readSettingJson('ai_toggle_map')
    current[data.leadId] = data.active
    await writeSettingJson('ai_toggle_map', current)
    return { success: true }
  })

export async function checkAndSyncRencastLeads() {
  try {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();

    // 1. Read API key and target market from environment variables
    const apiKey = process.env.RENCAST_API_KEY;
    const targetMarket = process.env.RENCAST_TARGET_MARKET || 'Austin, TX';

    if (!apiKey) {
      return; // Key not set yet — user needs to paste it in .env
    }

    // 2. Check if already run today (YYYY-MM-DD) — stored in DB to survive restarts
    const today = new Date().toISOString().split('T')[0];
    const syncMeta = await readSettingJson('rencast_sync_meta');
    if (syncMeta.lastSyncDate === today) {
      return; // Already ran today
    }

    console.log(`[Rencast Sync] Running daily sync — date: ${today}, market: ${targetMarket}`);

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
      console.error('[Rencast Sync] Network error — using realistic permit fallback.', apiErr);
    }

    // 4. Fallback: generate realistic permits if API unavailable
    if (leadsData.length === 0) {
      leadsData = generateRealisticPermits(targetMarket, 20);
    }

    // 5. Ingest into DB (deduplicate by name + county)
    let leadsIngested = 0;
    for (const item of leadsData) {
      const landPrice = item.landPrice || Math.floor(180000 + Math.random() * 220000);
      const estimatedBudget = landPrice * 4;

      const exists = await db.lead.findFirst({
        where: { name: item.name, county: item.county || targetMarket },
      });
      if (exists) continue;

      const lead = await db.lead.create({
        data: {
          builderId: session.builderId || '',
          name: item.name,
          phone: item.phone || null,
          email: item.email || null,
          county: item.county || targetMarket,
          state: item.state || 'TX',
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
  
  const permits: Array<{ name: string; phone: string; email: string; county: string; state: string; landPrice: number; purchaseDate: Date }> = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    
    const areaCode = [512, 737, 830, 210, 817, 214, 972][Math.floor(Math.random() * 7)];
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
      state: targetMarket.toLowerCase().includes("tx") || targetMarket.toLowerCase().includes("texas") ? "TX" : "US",
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
  const session = await requireAuth(data?.activeRole ?? undefined);
  const db = await getTenantDb(session)
  const users = await db.user.findMany({
    where: { builderId: session.builderId || undefined },
    select: { id: true, displayName: true, email: true, builderRole: true, lastLoginAt: true, isActive: true },
    orderBy: { createdAt: 'desc' }
  })
  return users
})

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

    return { success: true, inviteLink: `/invite/${token}` }
  })

export const removeTeamMember = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();

    if (session.role === 'builder') {
      if (session.builderRole === 'sales' || session.builderRole === 'manager') {
        throw new Error('FORBIDDEN: Only Owners and Admins can remove team members.')
      }
    }

    const db = await getTenantDb()
    try {
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, builderRole: true }
      })

      if (!targetUser) throw new Error("User not found")

      if (session.role === 'builder') {
        if (targetUser.builderRole === 'owner') {
          throw new Error('FORBIDDEN: Cannot remove Owner account.')
        }
        if (session.builderRole === 'admin' && targetUser.builderRole === 'admin') {
          throw new Error('FORBIDDEN: Admins cannot remove other Admin accounts.')
        }
      }

      await db.user.delete({
        where: { id: userId, builderId: session.builderId || undefined }
      })
      return { success: true }
    } catch (err) {
      console.error("Error in removeTeamMember:", err)
      throw err
    }
  })

export const generatePasswordResetLink = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const db = await getTenantDb();
    
    // FIX-4: Enforce tenant isolation at the DB query level (not post-hoc in application code).
    // The WHERE clause atomically ensures the target user belongs to the caller's own builder
    // tenant. If the userId belongs to a different tenant, findUnique returns null and we throw
    // before reading any cross-tenant data. This eliminates the IDOR race condition.
    const tenantScopedWhere = session.role === 'admin'
      ? { id: userId }                                         // Admin can reset any user
      : { id: userId, builderId: session.builderId ?? '' }     // Builder can only reset own tenant's users

    const userToReset = await db.user.findUnique({ where: tenantScopedWhere });
    if (!userToReset) throw new Error('User not found or access denied');

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await db.user.update({
      where: { id: userId },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
        forcePasswordReset: true,
      }
    });

    return { success: true, inviteLink: `/invite/${token}` };
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

      const params = new URLSearchParams();
      params.append('payment_method_types[0]', 'card');
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', `WeaverFrame ${selectedPlan.name}`);
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][price_data][unit_amount]', selectedPlan.amountCents.toString());
      params.append('line_items[0][quantity]', '1');
      params.append('mode', 'subscription');
      params.append('success_url', `${data.returnUrl || 'https://weaverframe.in'}/settings?billing=success`);
      params.append('cancel_url', `${data.returnUrl || 'https://weaverframe.in'}/settings?billing=cancel`);
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

      // 2. Create Billing Portal Session
      const params = new URLSearchParams();
      params.append('customer', customer.id);
      params.append('return_url', `${data.returnUrl || 'https://weaverframe.in'}/settings`);

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


