import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db'

export const getBuildersData = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdmin } = await import('./server-utils.server');
  await requireAdmin()
  const db = await getDb()

  const builders = await db.builder.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        select: { id: true, displayName: true, email: true, lastLoginAt: true, builderRole: true }
      },
      _count: { select: { leads: true } }
    }
  })

  return builders
})

export const getAdminStats = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdmin } = await import('./server-utils.server');
  await requireAdmin()
  const db = await getDb()

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [
    activeBuilders, 
    totalLeads, 
    builders,
    recentBuildersCount,
    previousBuildersCount,
    recentLeadsCount,
    previousLeadsCount
  ] = await Promise.all([
    db.builder.count({ where: { isActive: true } }),
    db.lead.count(),
    db.builder.findMany({ select: { plan: true, createdAt: true } }),
    db.builder.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.builder.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.lead.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } })
  ])

  // Calculate MRR
  const totalMRR = builders.reduce((acc, b) => {
    if (b.plan === 'trial') return acc;
    if (b.plan === 'enterprise') return acc + 999;
    return acc + 299; // Default professional
  }, 0)

  // Calculate previous MRR based on builders created before 30 days ago
  const previousBuilders = builders.filter(b => b.createdAt < thirtyDaysAgo);
  const previousMRR = previousBuilders.reduce((acc, b) => {
    if (b.plan === 'trial') return acc;
    if (b.plan === 'enterprise') return acc + 999;
    return acc + 299;
  }, 0)

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
  }

  const trends = {
    mrr: calcTrend(totalMRR, previousMRR),
    builders: calcTrend(recentBuildersCount, previousBuildersCount),
    leads: calcTrend(recentLeadsCount, previousLeadsCount)
  }

  return { activeBuilders, totalLeads, totalMRR, trends }
})

export const createBuilderInvite = createServerFn({ method: 'POST' })
  .inputValidator((data: { companyName: string; email: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()
    const crypto = await import('crypto')

    try {
      // Create a new builder
      const builder = await db.builder.create({
        data: {
          companyName: data.companyName,
          contactName: 'Owner', // Default, they will change this later
          email: data.email,
          plan: 'professional',
          isActive: true,
        }
      })

      // Generate random invite token
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Store token on a new User with forcePasswordReset
      // Password hash will be a dummy until they set it
      const dummyPasswordHash = await import('bcryptjs').then(b => b.hash(crypto.randomBytes(16).toString('hex'), 10))
      
      await db.user.create({
        data: {
          email: data.email,
          displayName: 'Owner',
          role: 'builder',
          builderRole: 'owner',
          builderId: builder.id,
          passwordHash: dummyPasswordHash,
          forcePasswordReset: true,
          resetToken: token,
          resetTokenExpires: expires,
          isActive: true,
        }
      })

      // Instead of emailing in this demo, we'll return the token so the Admin can copy the link
      return { success: true, inviteLink: `/invite/${token}` }
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error('A builder or user with this email already exists.')
      }
      throw err
    }
  })

export const getGlobalUsersData = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdmin } = await import('./server-utils.server');
  await requireAdmin()
  const db = await getDb()

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { builder: { select: { companyName: true } } }
  })

  return users
})

// ─── ADMIN ACTIONS ─────────────────────────────────────────────────────────────

export const toggleBuilderStatus = createServerFn({ method: 'POST' })
  .inputValidator((builderId: string) => builderId)
  .handler(async ({ data: builderId }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    const builder = await db.builder.findUnique({ where: { id: builderId } })
    if (!builder) throw new Error('Builder not found')

    await db.builder.update({
      where: { id: builderId },
      data: { isActive: !builder.isActive }
    })
    return { success: true }
  })

export const toggleUserStatus = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User not found')

    await db.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive }
    })
    return { success: true }
  })

export const updateBuilderPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: { builderId: string, plan: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    await db.builder.update({
      where: { id: data.builderId },
      data: { plan: data.plan }
    })
    return { success: true }
  })

export const getPlatformSettings = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    let settings = await db.platformSettings.findUnique({ where: { id: 'global' } })
    if (!settings) {
      settings = await db.platformSettings.create({ data: { id: 'global' } })
    }
    return settings
  })

export const updatePlatformSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: { supportEmail: string, defaultTrialDays: number, maintenanceMode: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    await db.platformSettings.upsert({
      where: { id: 'global' },
      update: data,
      create: { id: 'global', ...data }
    })
    return { success: true }
  })

export const deleteBuilder = createServerFn({ method: 'POST' })
  .inputValidator((builderId: string) => builderId)
  .handler(async ({ data: builderId }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    await db.builder.delete({ where: { id: builderId } })
    return { success: true }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    await db.user.delete({ where: { id: userId } })
    return { success: true }
  })

export const getBlockedUsers = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    const users = await db.user.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
      include: { builder: { select: { companyName: true } } }
    })
    return users
  })
