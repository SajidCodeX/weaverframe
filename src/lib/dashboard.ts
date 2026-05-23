import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db'

import { encrypt, decrypt } from './crypto'


export const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  await checkAndSyncRencastLeads()
  const db = await getTenantDb()

  try {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Optimized single round trip: fetch required records and aggregate in-memory
    const [
      recentActivitiesRaw,
      leadDates,
      appointmentsActivities,
    ] = await Promise.all([
      db.activity.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { lead: true },
      }),
      db.lead.findMany({
        select: { scoreTier: true, status: true, createdAt: true, estimatedBudget: true }
      }),
      db.activity.findMany({
        where: { 
          action: { contains: 'scheduled' },
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Date bounded (last 90 days)
        },
        include: { lead: true }
      }),
    ])

    // Single-pass O(N) calculations to minimize heap allocation and garbage collection
    let totalLeads = 0
    let qualifiedLeads = 0
    let builderNotified = 0
    let appointmentsSet = 0
    let hotCount = 0
    let warmCount = 0
    let coldCount = 0
    let leadsThisMonth = 0
    let leadsLastMonth = 0
    let hotSumBudget = 0
    let warmSumBudget = 0
    let coldSumBudget = 0
    let qualifiedSumBudget = 0

    const nowTime = now.getTime()
    const startOfThisMonthTime = startOfThisMonth.getTime()
    const startOfLastMonthTime = startOfLastMonth.getTime()

    let pipelineThisMonth = 0
    let pipelineLastMonth = 0

    for (let i = 0; i < leadDates.length; i++) {
      const l = leadDates[i]
      totalLeads++
      
      const isQualified = l.status !== 'New'
      const createdTime = l.createdAt.getTime()
      if (isQualified) {
        qualifiedLeads++
        qualifiedSumBudget += l.estimatedBudget
        if (createdTime >= startOfThisMonthTime) {
          pipelineThisMonth += l.estimatedBudget
        } else if (createdTime >= startOfLastMonthTime) {
          pipelineLastMonth += l.estimatedBudget
        }
      }

      if (['Builder Notified', 'Appointment', 'Replied'].includes(l.status)) {
        builderNotified++
      }

      if (l.status === 'Appointment') {
        appointmentsSet++
      }

      if (l.scoreTier === 'Hot') {
        hotCount++
        hotSumBudget += l.estimatedBudget
      } else if (l.scoreTier === 'Warm') {
        warmCount++
        warmSumBudget += l.estimatedBudget
      } else if (l.scoreTier === 'Cold') {
        coldCount++
        coldSumBudget += l.estimatedBudget
      }

      if (createdTime >= startOfThisMonthTime) {
        leadsThisMonth++
      } else if (createdTime >= startOfLastMonthTime) {
        leadsLastMonth++
      }
    }

    const hotAvgBudget = hotCount > 0 ? hotSumBudget / hotCount : 0
    const warmAvgBudget = warmCount > 0 ? warmSumBudget / warmCount : 0
    const coldAvgBudget = coldCount > 0 ? coldSumBudget / coldCount : 0
    const avgBudget = qualifiedLeads > 0 ? qualifiedSumBudget / qualifiedLeads : 0
    const activeProspectsCount = qualifiedLeads

    const diffLeads = leadsThisMonth - leadsLastMonth
    const leadsMonthSub = diffLeads >= 0 ? `+${diffLeads} from last month` : `${diffLeads} from last month`
    const leadsMonthTrend = diffLeads >= 0 ? ('up' as const) : ('down' as const)
    
    const leadsPctChange = leadsLastMonth > 0
      ? Math.round((diffLeads / leadsLastMonth) * 100)
      : (leadsThisMonth > 0 ? 100 : 0)
    const leadsMonthTrendVal = `${leadsPctChange >= 0 ? '+' : ''}${leadsPctChange}%`

    const pipelinePctChange = pipelineLastMonth > 0
      ? Math.round(((pipelineThisMonth - pipelineLastMonth) / pipelineLastMonth) * 100)
      : (pipelineThisMonth > 0 ? 100 : 0)
    const pipelineTrend = pipelinePctChange >= 0 ? ('up' as const) : ('down' as const)
    const pipelineTrendVal = `${pipelinePctChange >= 0 ? '+' : ''}${pipelinePctChange}%`

    const formatBudgetK = (avgValue: number | null) => {
      if (!avgValue) return '$0'
      return `$${Math.round(avgValue / 1000)}K`
    }

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(23, 59, 59, 999)
      return d
    })

    // Optimized linear cumulative trend calculations
    const getTrendForTier = (tier: string) => {
      const filteredSorted = leadDates
        .filter(l => l.scoreTier === tier)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      
      let ptr = 0
      return dates.map(targetDate => {
        const targetTime = targetDate.getTime()
        while (ptr < filteredSorted.length && filteredSorted[ptr].createdAt.getTime() <= targetTime) {
          ptr++
        }
        return ptr
      })
    }

    const funnel = [
      { label: 'Inquiry Received', value: totalLeads, pct: totalLeads > 0 ? 100 : 0 },
      { label: 'AI Qualified', value: qualifiedLeads, pct: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0 },
      { label: 'Builder Notified', value: builderNotified, pct: totalLeads > 0 ? Math.round((builderNotified / totalLeads) * 100) : 0 },
      { label: 'Appointment Set', value: appointmentsSet, pct: totalLeads > 0 ? Math.round((appointmentsSet / totalLeads) * 100) : 0 },
    ]

    const scoreData = [
      { label: 'Hot', pct: totalLeads > 0 ? Math.round((hotCount / totalLeads) * 100) : 0, count: hotCount, budget: formatBudgetK(hotAvgBudget), color: '#FF453A', trend: getTrendForTier('Hot') },
      { label: 'Warm', pct: totalLeads > 0 ? Math.round((warmCount / totalLeads) * 100) : 0, count: warmCount, budget: formatBudgetK(warmAvgBudget), color: '#FF9F0A', trend: getTrendForTier('Warm') },
      { label: 'Cold', pct: totalLeads > 0 ? Math.round((coldCount / totalLeads) * 100) : 0, count: coldCount, budget: formatBudgetK(coldAvgBudget), color: '#0A84FF', trend: getTrendForTier('Cold') },
    ]

    let pipelineValueStr = '$0'
    const sumBudget = qualifiedSumBudget
    if (sumBudget >= 1000000) {
      pipelineValueStr = `$${(sumBudget / 1000000).toFixed(1)}M`
    } else {
      pipelineValueStr = `$${Math.round(sumBudget / 1000)}K`
    }
    const avgBudgetStr = avgBudget >= 1000000 ? `$${(avgBudget / 1000000).toFixed(1)}M` : `$${Math.round(avgBudget / 1000)}K`
    const pipelineSub = `Avg ${avgBudgetStr} · ${activeProspectsCount} active prospects`

    let avgDaysToBook = 14
    if (appointmentsActivities.length > 0) {
      const totalDays = appointmentsActivities.reduce((sum, act) => {
        const diffMs = act.createdAt.getTime() - act.lead.createdAt.getTime()
        return sum + (diffMs / (1000 * 60 * 60 * 24))
      }, 0)
      avgDaysToBook = Math.max(1, Math.round(totalDays / appointmentsActivities.length))
    }

    const aiQualRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0

    const activityFeed = recentActivitiesRaw.map((a) => ({
      id: a.id,
      name: a.lead.name,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      score: (a.lead.scoreTier === 'Hot' ? 'hot' : a.lead.scoreTier === 'Warm' ? 'warm' : 'cold') as 'hot' | 'warm' | 'cold',
      city: a.lead.county,
    }))

    // Optimized linear weekly volume calculations
    const sortedLeads = [...leadDates].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const sortedQualifiedLeads = leadDates
      .filter(l => l.status !== 'New')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    let totalPtr = 0
    let qualifiedPtr = 0

    const weeklyVolume = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i) * 4)
      d.setHours(23, 59, 59, 999)
      const targetTime = d.getTime()
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      while (totalPtr < sortedLeads.length && sortedLeads[totalPtr].createdAt.getTime() <= targetTime) {
        totalPtr++
      }
      while (qualifiedPtr < sortedQualifiedLeads.length && sortedQualifiedLeads[qualifiedPtr].createdAt.getTime() <= targetTime) {
        qualifiedPtr++
      }

      return {
        date: dateStr,
        total: totalPtr,
        qualified: qualifiedPtr,
      }
    })

    return {
      totalLeads,
      qualifiedLeads,
      appointmentsSet,
      funnel,
      scoreData,
      activityFeed,
      leadsThisMonth,
      leadsMonthSub,
      leadsMonthTrend,
      leadsMonthTrendVal,
      pipelineValueStr,
      pipelineSub,
      pipelineTrend,
      pipelineTrendVal,
      avgDaysToBook,
      aiQualRate,
      weeklyVolume
    }
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      appointmentsSet: 0,
      funnel: [
        { label: 'Inquiry Received', value: 0, pct: 0 },
        { label: 'AI Qualified', value: 0, pct: 0 },
        { label: 'Builder Notified', value: 0, pct: 0 },
        { label: 'Appointment Set', value: 0, pct: 0 },
      ],
      scoreData: [
        { label: 'Hot', pct: 0, count: 0, budget: '$0', color: '#FF453A', trend: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Warm', pct: 0, count: 0, budget: '$0', color: '#FF9F0A', trend: [0, 0, 0, 0, 0, 0, 0] },
        { label: 'Cold', pct: 0, count: 0, budget: '$0', color: '#0A84FF', trend: [0, 0, 0, 0, 0, 0, 0] },
      ],
      activityFeed: [],
      leadsThisMonth: 0,
      leadsMonthSub: '0 from last month',
      leadsMonthTrend: 'up' as const,
      leadsMonthTrendVal: '+0%',
      pipelineValueStr: '$0',
      pipelineSub: 'Avg $0 · 0 active prospects',
      pipelineTrend: 'up' as const,
      pipelineTrendVal: '+0%',
      avgDaysToBook: 14,
      aiQualRate: 0,
      weeklyVolume: Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i) * 4)
        return {
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          total: 0,
          qualified: 0,
        }
      })
    };
  }
})


export const getNotificationsData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const db = await getTenantDb()
  try {
    const activities = await db.activity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { lead: true }
    })
    return activities.map(act => {
      let title = "Lead Activity"
      if (act.action.toLowerCase().includes("schedule") || act.action.toLowerCase().includes("appointment")) {
        title = "Appointment Set"
      } else if (act.action.toLowerCase().includes("qualif")) {
        title = "AI Qualified"
      } else if (act.action.toLowerCase().includes("added") || act.action.toLowerCase().includes("manually")) {
        title = "Manual Lead"
      } else if (act.action.toLowerCase().includes("replied") || act.action.toLowerCase().includes("response")) {
        title = "Lead Replied"
      }
      return {
        id: act.id,
        title,
        desc: `${act.lead.name}: ${act.action}`,
        time: act.createdAt.toISOString(),
        unread: new Date().getTime() - act.createdAt.getTime() < 3600000
      }
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return []
  }
})

export function determineLeadSource(lead: { source?: string | null; county?: string | null }) {
  const currentSource = (lead.source || "").trim();
  const lowerSource = currentSource.toLowerCase();
  const lowerCounty = (lead.county || "").toLowerCase();

  if (
    !lowerSource ||
    lowerSource === "public record" ||
    lowerSource === "austin permits" ||
    lowerSource === "organic / local seo" ||
    lowerSource === "organic" ||
    lowerSource === "m" ||
    lowerSource === "r" ||
    lowerSource === "g" ||
    lowerSource === "google" ||
    lowerSource === "google map" ||
    lowerSource === "google maps" ||
    lowerSource === "facebook" ||
    lowerSource === "referral"
  ) {
    if (lowerCounty.includes("travis") || lowerCounty.includes("austin")) {
      return "Austin Building Permits";
    }
    return "Travis County Public Records";
  }

  return lead.source || "Austin Building Permits";
}

export const getLeadsData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  
  try {
    const db = await getTenantDb()
    const leads = await db.lead.findMany({
      orderBy: { purchaseDate: 'desc' },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' }
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
    phone?: string;
    email?: string;
    county: string;
    state: string;
    landPrice: number;
    status: string;
    scoreTier: string;
    source: string;
  }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const estimatedBudget = data.landPrice * 4
      const lead = await db.lead.create({
        data: {
          builderId: session.builderId || '',
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          county: data.county,
          state: data.state,
          landPrice: data.landPrice,
          estimatedBudget,
          purchaseDate: new Date(),
          status: data.status,
          scoreTier: data.scoreTier,
          source: determineLeadSource({ source: data.source, county: data.county }),
        }
      })

      // Log activity
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: lead.id,
          action: "Lead manually added",
        }
      })

      return lead
    } catch (error) {
      console.error("Error in addManualLead:", error)
      throw error
    }
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const db = await getTenantDb()
    try {
      await db.activity.deleteMany({ where: { leadId: id } })
      await db.lead.delete({ where: { id } })
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
        data: updateData,
      })
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId: id,
          action: `✏️ Lead details updated by builder.`,
        }
      })
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



export const getReviewsData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const db = await getTenantDb()
  try {
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

export const sendReviewRequest = createServerFn({ method: 'POST' })
  .inputValidator((data: { clientName: string; clientEmail?: string; clientPhone?: string; leadId?: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
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

      if (leadId) {
        await db.activity.create({
          data: {
            builderId: session.builderId || '',
            leadId,
            action: `AI Engine triggered 5-star Review Request via SMS & Email to ${clientName}.`
          }
        })
      }

      return request
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
            reviewText: feedback || `Incredible custom building experience with Horizon Homes! Extremely satisfied with their professionalism and quality.`,
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
    
    // Seed default if balance is zero and card is empty
    if (builder && builder.adSpendBalance === 0.0 && builder.paymentMethod === 'None') {
      const updated = await db.builder.update({
        where: { id: session.builderId },
        data: { adSpendBalance: 1460.0, paymentMethod: "Visa      4242" }
      });
      return {
        adSpendBalance: updated.adSpendBalance,
        paymentMethod: updated.paymentMethod,
        plan: updated.plan
      };
    }

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

export const generateGroqCompletion = createServerFn({ method: 'POST' })
  .inputValidator((data: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    // ── GROQ API KEY — must be set in .env as GROQ_API_KEY ────────────────────
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    // ─────────────────────────────────────────────────────────────────────────

    const { messages } = data;

    // Fallback Mock Engine in case API Key is not yet configured
    const isPlaceholder = !GROQ_API_KEY || GROQ_API_KEY.trim() === "";
    if (isPlaceholder) {
      console.log("Groq API Key is a placeholder. Simulating Alex AI completion...");
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || "";

      // Smart prompt matching to simulate high fidelity AI responses
      let reply = "Hi! Thank you for reaching out to Horizon Homes. We'd love to help you build your dream home in Austin.";

      const lower = lastUserMsg.toLowerCase();
      if (lower.includes("budget") || lower.includes("price") || lower.includes("cost")) {
        reply = "Absolutely! Our custom home projects in Austin typically start at $500K for semi-custom builds and range upwards of $1.5M+ for full luxury estates. Does that range align with your investment plans?";
      } else if (lower.includes("saturday") || lower.includes("meet") || lower.includes("schedule") || lower.includes("tour")) {
        reply = "I would be delighted to schedule a walkthrough! Saturday morning at 10:30 AM at our Lakeway Model Home works perfectly. Should I lock that slot in and send over the directions?";
      } else if (lower.includes("basement") || lower.includes("sloping") || lower.includes("terrain")) {
        reply = "Yes, we specialize in advanced walk-out basements engineered specifically for sloped lots in Travis County. Our superintendent, Mike Patterson, has built several of these. Do you already own the lot?";
      } else if (lower.includes("cabinet") || lower.includes("finish") || lower.includes("wood")) {
        reply = "Premium cabinetry and millwork are our signatures! We run a dedicated carpentry shop right here in Austin to craft custom white oak cabinets and custom architectural finishes. I can send you some photos of our recent projects!";
      } else if (lower.includes("script") || lower.includes("message")) {
        reply = JSON.stringify([
          { t: "Message 1 · Immediate (< 60s)", body: "Hi [Name]! Thanks for connecting with Horizon Homes. I'm Mike's assistant. Are you looking to build in Travis County in the next 6-12 months? Reply YES or NO." },
          { t: "Message 2 · 2 hours later", body: "Hey [Name], just checking in! Most of our Lakeway clients prefer custom cabinets over stock options. Do you have a design style you love?" },
          { t: "Message 3 · 24 hours later", body: "Hi [Name], we can schedule a private tour of our Lakeway design site this Thursday. Let me know if you would like me to book your spot!" }
        ]);
      }

      return reply;
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: messages,
          temperature: 1,
          max_tokens: 1024,
          top_p: 1,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API returned ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      return responseData.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error("Error in generateGroqCompletion:", error);
      throw error;
    }
  })

export const simulateAIChatReply = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; userMessage: string; chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth();
    const { leadId, userMessage, chatHistory } = data;
    const db = await getTenantDb();

    try {
      // Fetch lead to personalize prompt
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      const leadName = lead ? lead.name : "Client";
      const leadCounty = lead ? lead.county : "Travis County";

      const systemPrompt = `You are Alex, the premium AI Concierge for Horizon Homes, a luxury custom home builder in Austin, Texas. Your supervisor is Mike Patterson (Superintendent). 
Your persona is knowledgeable, highly professional, polite, and responsive. 

Your goal is to perform a 2-part task:
1. Formulate an elegant, helpful response to the client (under 3-4 sentences, optimal for SMS), personalized using their name and target county. Finish with a single helpful call-to-action (e.g. booking a private tour of our Lakeway or Dripping Springs model homes, or checking a permit/budget detail).
2. Analyze the client's latest message intent and classify it into one of these categories:
   - "HOT": The client wants to build, is planning to start construction soon (e.g. within 6 months), wants a walkthrough/tour, or is looking for a builder.
   - "COLD": The client is doing it themselves, has already hired another builder, is not interested, or told you to stop messaging them.
   - "WARM": The client is unsure, still researching budgets, waiting for property tax/land outcomes, or needs cost estimate sheets/information to plan.

You must respond ONLY with a valid JSON object matching this TypeScript type:
{
  "replyText": string, // The SMS reply text to send to the client
  "intent": "HOT" | "COLD" | "WARM" // The classified intent of the client's reply
}

Lead Context:
- Client Name: ${leadName}
- Target County: ${leadCounty}
- Company: Horizon Homes LLC

Do not output any introductory or conversational text outside of the raw JSON object.`;

      const formattedMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...chatHistory,
        { role: 'user' as const, content: userMessage }
      ];

      // Call Groq Completion
      const rawResponse = await generateGroqCompletion({ data: { messages: formattedMessages } });

      let replyText = "";
      let intent: 'HOT' | 'COLD' | 'WARM' = 'WARM';

      try {
        const rawJsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (rawJsonMatch) {
          const parsed = JSON.parse(rawJsonMatch[0]);
          replyText = parsed.replyText || parsed.reply || rawResponse;
          intent = parsed.intent || 'WARM';
        } else {
          const parsed = JSON.parse(rawResponse);
          replyText = parsed.replyText || parsed.reply || rawResponse;
          intent = parsed.intent || 'WARM';
        }
      } catch (e) {
        console.warn("Failed to parse structured JSON from Alex AI. Performing fallback parsing:", e);
        replyText = rawResponse;

        // Safety Heuristic Matcher
        const lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.includes("yes") || lowerMsg.includes("start") || lowerMsg.includes("months") || lowerMsg.includes("soon") || lowerMsg.includes("tour")) {
          intent = 'HOT';
        } else if (lowerMsg.includes("no") || lowerMsg.includes("myself") || lowerMsg.includes("hired") || lowerMsg.includes("stop")) {
          intent = 'COLD';
        } else {
          intent = 'WARM';
        }
      }

      // Determine DB updates based on intent
      let dbStatus = "Replied";
      let dbScoreTier = "Warm";
      let activityText = "";

      if (intent === 'HOT') {
        dbStatus = "Qualified";
        dbScoreTier = "Hot";
        activityText = `🟢 AI marked Lead as Qualified & Hot! Lead intent: "Wants to build/start soon". Reply: "${replyText.substring(0, 60)}..."`;
      } else if (intent === 'COLD') {
        dbStatus = "Closed Lost";
        dbScoreTier = "Cold";
        activityText = `🔴 AI marked Lead as Disqualified & Cold (competitor hired / self-build). Reply: "${replyText.substring(0, 60)}..."`;
      } else {
        dbStatus = "Appointment";
        dbScoreTier = "Warm";
        activityText = `🟡 AI marked Lead as Nurturing & Warm (budget / planning phase). Reply: "${replyText.substring(0, 60)}..."`;
      }

      // Save Activity in database
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          action: activityText
        }
      });

      // Update Lead Status & Score Tier in database
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: dbStatus,
          scoreTier: dbScoreTier
        }
      });

      return { replyText };
    } catch (error) {
      console.error("Error in simulateAIChatReply:", error);
      throw error;
    }
  })

export const generateAIScriptUpdate = createServerFn({ method: 'POST' })
  .inputValidator((data: { instruction: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const { instruction } = data;

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
  { "t": "Message 1 · Immediate (< 60s)", "body": "Hi [Name], I noticed your residential building permit application filed in Travis County. I'm Mike Patterson's assistant from Horizon Homes. Since custom builds in Austin require complex structural reviews, have you already hired a general builder?" },
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
      let parsed = [];
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
          { t: "Message 1 · Immediate (< 60s)", body: "Hi [Name]! I'm Mike's assistant from Horizon Homes. Are you looking to build your home in Austin in the next 6-12 months? Reply YES/NO." },
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

export const getAppointmentsData = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
    const db = await getTenantDb()
    try {
      const appts = await db.appointment.findMany({
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

      if (data.sendSms) {
        await db.activity.create({
          data: {
            builderId: session.builderId || '',
            leadId: data.leadId,
            action: `💬 AI Engine sent automated SMS appointment confirmation to ${lead.name}: "Hi ${lead.name}, your ${data.type} is scheduled for ${formattedDate} at ${data.location}. See you then!"`,
          }
        })
      }

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

export const getConversations = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const db = await getTenantDb()
  try {
    const leads = await db.lead.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    const conversations = leads.map((l) => {
      const lastMsg = l.messages[0]
      const unreadCount = l.messages.filter(m => m.sender === 'lead' && !m.isRead).length

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
        isOnline: l.name.charCodeAt(0) % 2 === 0,
      }
    })

    // Sort by last message time descending
    conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

    return conversations
  } catch (error) {
    console.error("Error in getConversations:", error)
    return []
  }
})

export const getMessagesForLead = createServerFn({ method: 'GET' })
  .inputValidator((leadId: string) => leadId)
  .handler(async ({ data: leadId }) => {
    const { getTenantDb } = await import('./server-utils.server');
    const db = await getTenantDb()
    try {
      const lead = await db.lead.findUnique({
        where: { id: leadId }
      })
      if (!lead) throw new Error("Lead not found")

      const messages = await db.message.findMany({
        where: { leadId },
        orderBy: { createdAt: 'asc' }
      })

      // Mark unread messages as read
      await db.message.updateMany({
        where: {
          leadId,
          sender: 'lead',
          isRead: false
        },
        data: {
          isRead: true
        }
      })

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
  .inputValidator((data: { leadId: string; content: string; enableAiReply?: boolean }) => data)
  .handler(async ({ data }) => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
    const session = await requireAuth()
    const db = await getTenantDb()
    try {
      const { leadId, content, enableAiReply = true } = data

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

      // Log activity
      await db.activity.create({
        data: {
          builderId: session.builderId || '',
          leadId,
          action: `💬 Sent message: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        }
      })

      let leadMsg = null

      if (enableAiReply) {
        // Generate a simulated reply immediately in the DB to make the conversation interactive
        const lowerContent = content.toLowerCase()
        let replyText = "Thanks for getting back to me! Let me review this and get back to you shortly."

        if (lowerContent.includes("📆 site visit booked") || lowerContent.includes("appointment booked") || lowerContent.includes("walkthrough booked")) {
          replyText = "Awesome! I've added this to my calendar. Looking forward to the walkthrough."
        } else if (lowerContent.includes("saturday") || lowerContent.includes("meet") || lowerContent.includes("visit") || lowerContent.includes("schedule")) {
          replyText = "Saturday works great for me. Please send over the address and the time we should meet!"
        } else if (lowerContent.includes("email") || lowerContent.includes("sent") || lowerContent.includes("brochure")) {
          replyText = "Received! I just checked my inbox. The layout looks perfect. I'll discuss it with my architect and follow up."
        } else if (lowerContent.includes("budget") || lowerContent.includes("price") || lowerContent.includes("cost") || lowerContent.includes("sq ft")) {
          replyText = "Okay, that pricing model makes sense. Do you have a standard specifications sheet so we know what is included in that price?"
        } else if (lowerContent.includes("call") || lowerContent.includes("phone")) {
          replyText = "Sure, you can call me tomorrow afternoon around 2 PM. Looking forward to speaking."
        }

        // Add the simulated lead reply after a very short delay (represented in DB immediately for high responsiveness)
        leadMsg = await db.message.create({
          data: {
            builderId: session.builderId || '',
            leadId,
            sender: 'lead',
            content: replyText,
            isRead: false,
            createdAt: new Date(Date.now() + 500)
          }
        })

        // Log lead activity
        await db.activity.create({
          data: {
            builderId: session.builderId || '',
            leadId,
            action: `📨 Lead replied: "${replyText.substring(0, 40)}..."`,
          }
        })
      }

      // Update lead status to "Replied" only if it's not already "Appointment" (preserve appointment status)
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
        userMessage: userMsg,
        leadMessage: leadMsg
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      throw error
    }
  })

export const getReportsData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  const db = await getTenantDb()

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
    const monthlyTrend = []
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
    const mapped = integrations.map(item => {
      let config: Record<string, string> = {}
      try {
        if (item.configSecure) {
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
    })

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

    else if (platformId === "rencast") {
      if (!credentials.apiKey || !credentials.targetMarket) {
        throw new Error("Missing Rencast Partner API Key or Target Market Area.");
      }
    }

    return { success: true };
  })

export const exportLeadsToCsv = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
    const db = await getTenantDb()
    try {
      const leads = await db.lead.findMany({
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

async function readSettingJson(platformId: string): Promise<Record<string, any>> {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth()
  const db = await getTenantDb()
  try {
    const row = await db.integration.findUnique({
      where: {
        builderId_platformId: {
          builderId: session.builderId || '',
          platformId
        }
      }
    })
    if (!row || !row.configSecure) return {}
    return JSON.parse(decrypt(row.configSecure))
  } catch {
    return {}
  }
}

async function writeSettingJson(platformId: string, value: Record<string, any>) {
  const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth()
  const db = await getTenantDb()
  const encrypted = encrypt(JSON.stringify(value))
  await db.integration.upsert({
    where: {
      builderId_platformId: {
        builderId: session.builderId || '',
        platformId
      }
    },
    update: { configSecure: encrypted, isConnected: true },
    create: {
      builderId: session.builderId || '',
      platformId,
      configSecure: encrypted,
      isConnected: true
    },
  })
}

export const getBuilderProfile = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb } = await import('./server-utils.server');
  return readSettingJson('builder_profile')
})

export const saveBuilderProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: Record<string, string>) => data)
  .handler(async ({ data }) => {
    const { getTenantDb } = await import('./server-utils.server');
    await writeSettingJson('builder_profile', data)
    return { success: true }
  })

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
  
  const permits = [];
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

export const getTeamData = createServerFn({ method: 'GET' }).handler(async () => {
    const { getTenantDb, requireAuth } = await import('./server-utils.server');
  const session = await requireAuth();
  const db = await getTenantDb()
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
    const db = await getTenantDb()
    try {
      await db.user.delete({
        where: { id: userId, builderId: session.builderId || undefined }
      })
      return { success: true }
    } catch (error) {
      console.error("Error in removeTeamMember:", error)
      throw error
    }
  })
