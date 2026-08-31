import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db'

export const getBuildersData = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdmin } = await import('./server-utils.server');
  await requireAdmin()
  const db = await getDb()

  const builders = await db.builder.findMany({
    where: { deletedAt: null },
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
  const session = await requireAdmin();
  const db = await getDb();

  const adminUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { builderId: true }
  });

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
    previousLeadsCount,
    demoRequests,
    demoRequestsCount
  ] = await Promise.all([
    db.builder.count({ where: { isActive: true, deletedAt: null } }),
    db.lead.count(),
    db.builder.findMany({ where: { deletedAt: null }, select: { plan: true, createdAt: true } }),
    db.builder.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
    db.builder.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, deletedAt: null } }),
    db.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.lead.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        buildVolume: true,
        status: true,
        notes: true,
        createdAt: true,
      }
    }),
    db.demoRequest.count()
  ])

  let unreadInboxCount = 0;
  if (adminUser?.builderId) {
    unreadInboxCount = await db.message.count({
      where: {
        isRead: false,
        sender: 'lead',
        lead: { builderId: adminUser.builderId }
      }
    });
  }

  // Calculate MRR (Starter: $149, Growth: $349)
  const getPlanPrice = (plan?: string | null) => {
    const p = (plan || '').toLowerCase();
    if (p === 'growth' || p === 'enterprise') return 349;
    if (p === 'starter' || p === 'professional') return 149;
    return 0; // trial
  };

  const totalMRR = builders.reduce((acc, b) => acc + getPlanPrice(b.plan), 0);

  // Calculate previous MRR based on builders created before 30 days ago
  const previousBuilders = builders.filter(b => b.createdAt < thirtyDaysAgo);
  const previousMRR = previousBuilders.reduce((acc, b) => acc + getPlanPrice(b.plan), 0);

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

  return { 
    activeBuilders, 
    totalLeads, 
    totalMRR, 
    trends,
    demoRequests: demoRequests || [],
    demoRequestsCount: demoRequestsCount || 0,
    unreadInboxCount
  }
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
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { 
      builder: { 
        select: { 
          id: true, 
          companyName: true, 
          plan: true, 
          isActive: true, 
          email: true 
        } 
      } 
    }
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
    const session = await requireAdmin()
    const db = await getDb()

    if (session.userId === userId) {
      throw new Error("Cannot modify your own admin account")
    }

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

    await db.builder.update({ 
      where: { id: builderId },
      data: { deletedAt: new Date() }
    })
    return { success: true }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { requireAdmin } = await import('./server-utils.server');
    const session = await requireAdmin()
    const db = await getDb()

    if (session.userId === userId) {
      throw new Error("Cannot delete your own admin account")
    }

    await db.user.update({ 
      where: { id: userId },
      data: { deletedAt: new Date() }
    })
    return { success: true }
  })

export const getBlockedUsers = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin()
    const db = await getDb()

    const users = await db.user.findMany({
      where: { 
        OR: [
          { isActive: false },
          { builder: { isActive: false } }
        ],
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      include: { builder: { select: { companyName: true } } }
    })
    return users
  })

export const startBuilderPreview = createServerFn({ method: 'POST' })
  .inputValidator((builderId: string) => builderId)
  .handler(async ({ data: builderId }) => {
    const { requireAdmin, setAuthCookie } = await import('./server-utils.server');
    const session = await requireAdmin()
    const db = await getDb()

    const builder = await db.builder.findFirst({
      where: { id: builderId, deletedAt: null },
      select: { 
        id: true, 
        companyName: true,
        users: {
          where: { builderRole: 'owner' },
          select: { displayName: true },
          take: 1
        }
      }
    })
    if (!builder) throw new Error('Builder not found')
    
    const ownerName = builder.users[0]?.displayName || 'Builder Owner';

    const { exp, iat, ...sessionWithoutExp } = session as any;
    await setAuthCookie({
      ...sessionWithoutExp,
      actingAsBuilderId: builder.id,
      companyName: builder.companyName,
      displayName: ownerName,
    } as any)
    return { success: true }
  })

export const stopBuilderPreview = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { requireAdmin, setAuthCookie } = await import('./server-utils.server');
    const session = await requireAdmin()
    const db = await getDb()

    const adminUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true, builder: { select: { companyName: true } } }
    })

    const { exp, iat, ...sessionWithoutExp } = session as any;
    await setAuthCookie({
      ...sessionWithoutExp,
      actingAsBuilderId: null,
      displayName: adminUser?.displayName || 'SajidAli Ansari',
      companyName: adminUser?.builder?.companyName || null,
    } as any)
    return { success: true }
  })
export const getAdminDemoRequests = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin();
    const db = await getDb();

    const requests = await db.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return requests.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      buildVolume: r.buildVolume,
      status: r.status,
      notes: r.notes,
      portalToken: r.portalToken,
      portalVisitedAt: r.portalVisitedAt ? r.portalVisitedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  });

export const updateDemoRequestStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; status: string; notes?: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin();
    const db = await getDb();

    const updated = await db.demoRequest.update({
      where: { id: data.id },
      data: {
        status: data.status,
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    return updated;
  });

export const deleteDemoRequest = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin();
    const db = await getDb();

    await db.demoRequest.delete({
      where: { id: data.id },
    });

    return { success: true };
  });

export const sendAdminDemoDirectEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: { demoRequestId: string; recipientEmail: string; recipientName: string; subject: string; message: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    await requireAdmin();
    const db = await getDb();

    const demo = await db.demoRequest.findUnique({
      where: { id: data.demoRequestId },
    });
    if (!demo) throw new Error("Demo request not found");

    // Pure human email dispatch via Resend / SMTP - ZERO AI
    const { sendOutboundEmail } = await import('./email.server');
    await sendOutboundEmail({
      to: data.recipientEmail,
      subject: data.subject || "WeaverFrame — Executive Demonstration Follow-up",
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 8px; border: 1px solid #eaeaea;">
        <p style="font-size: 15px; color: #222; margin-bottom: 20px;">${data.message.replace(/\n/g, '<br/>')}</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0 20px 0;" />
        <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">WeaverFrame Executive Advisory · Private AI Infrastructure</p>
      </div>`,
      text: data.message,
      from: 'WeaverFrame Executive Advisory <advisory@weaverframe.com>',
      replyTo: 'admin@weaverframe.com',
    });

    // Update status to contacted and record notes
    const updatedNotes = (demo.notes ? demo.notes + '\n\n' : '') + `[${new Date().toLocaleString()} ADMIN EMAIL DISPATCHED]:\n${data.message}`;
    await db.demoRequest.update({
      where: { id: demo.id },
      data: { status: 'contacted', notes: updatedNotes }
    });

    return { success: true };
  });

async function getOrEnsureAdminBuilderId(db: any, session: any) {
  const adminUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, builderId: true, email: true, displayName: true }
  });

  if (adminUser?.builderId) {
    return adminUser.builderId;
  }

  // Find or create WeaverFrame HQ builder
  let hqBuilder = await db.builder.findFirst({
    where: {
      OR: [
        { companyName: 'WeaverFrame HQ' },
        { companyName: 'WeaverFrame' }
      ],
      deletedAt: null
    }
  });

  if (!hqBuilder) {
    hqBuilder = await db.builder.create({
      data: {
        companyName: 'WeaverFrame HQ',
        contactName: 'Executive Team',
        email: 'admin@weaverframe.com',
        plan: 'enterprise',
        isActive: true,
      }
    });
  }

  if (adminUser) {
    await db.user.update({
      where: { id: adminUser.id },
      data: { builderId: hqBuilder.id }
    });
  }

  // Seed test clients if empty
  const leadCount = await db.lead.count({ where: { builderId: hqBuilder.id } });
  if (leadCount === 0) {
    const lead1 = await db.lead.create({
      data: {
        builderId: hqBuilder.id,
        name: "Alexander Wright",
        email: "alexander.wright@luxuryestates.com",
        phone: "(512) 890-4421",
        status: "engaged",
        source: "WeaverFrame Private Concierge",
        scoreTier: "Hot",
        estimatedBudget: 3500000,
        county: "Austin Custom Homes",
      }
    });

    await db.message.create({
      data: {
        builderId: hqBuilder.id,
        leadId: lead1.id,
        sender: "lead",
        content: "Hello WeaverFrame HQ, we are interested in architectural AI infrastructure for our custom home operations. Could we discuss deployment options?",
        channel: "portal",
        isRead: false,
      }
    });

    const lead2 = await db.lead.create({
      data: {
        builderId: hqBuilder.id,
        name: "Elena Rostova",
        email: "elena@rostovadesign.com",
        phone: "(415) 620-7734",
        status: "contacted",
        source: "Executive Inbound",
        scoreTier: "Warm",
        estimatedBudget: 2200000,
        county: "Rostova Design Group",
      }
    });

    await db.message.create({
      data: {
        builderId: hqBuilder.id,
        leadId: lead2.id,
        sender: "lead",
        content: "Hi, following up on our private demonstration discussion. We would like to review the security architecture and custom model training specifications.",
        channel: "portal",
        isRead: true,
      }
    });
  }

  return hqBuilder.id;
}

export const getAdminConversations = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { requireAdmin } = await import('./server-utils.server');
    const session = await requireAdmin();
    const db = await getDb();

    const builderId = await getOrEnsureAdminBuilderId(db, session);

    const leads = await db.lead.findMany({
      where: {
        builderId
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                sender: 'lead',
                isRead: false,
              }
            }
          }
        },
        builder: {
          select: { companyName: true }
        }
      }
    });

    const conversations = leads.map((l) => {
      const lastMsg = l.messages[0];
      const unreadCount = l._count.messages;
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
        county: l.county || "Architectural Client",
        isDemoRequest: false,
        source: l.source,
        createdAt: l.createdAt.toISOString(),
      };
    });

    conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    return conversations;
  });

export const getAdminMessagesForLead = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    const session = await requireAdmin();
    const db = await getDb();
    const { leadId } = data;

    const builderId = await getOrEnsureAdminBuilderId(db, session);

    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: {
        builder: {
          select: { companyName: true }
        }
      }
    });

    if (!lead) throw new Error("Lead not found");

    if (lead.builderId !== builderId) {
      throw new Error('FORBIDDEN: Access denied to this lead.');
    }

    const messages = await db.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    await db.message.updateMany({
      where: { leadId, sender: 'lead', isRead: false },
      data: { isRead: true }
    });

    return {
      lead: {
        ...lead,
        county: lead.county || "Architectural Client",
        isDemoRequest: false,
      },
      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isRead: m.isRead,
      }))
    };
  });

export const sendAdminMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { leadId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    const session = await requireAdmin();
    const db = await getDb();

    const builderId = await getOrEnsureAdminBuilderId(db, session);

    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      select: { id: true, email: true, name: true, builderId: true, source: true }
    });

    if (!lead) throw new Error("Lead not found");

    if (lead.builderId !== builderId) {
      throw new Error('FORBIDDEN: Access denied to this lead.');
    }

    const userMsg = await db.message.create({
      data: {
        builderId: lead.builderId,
        leadId: lead.id,
        sender: "user",
        content: data.content.trim(),
        channel: "portal",
        isRead: true,
      }
    });

    if (lead.email) {
      try {
        const { sendOutboundEmail } = await import('./email.server');
        await sendOutboundEmail({
          to: lead.email,
          subject: "WeaverFrame — Executive Communications",
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <p>${data.content.replace(/\n/g, '<br/>')}</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
            <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">WeaverFrame Executive Advisory · Private AI Infrastructure</p>
          </div>`,
          text: data.content,
          from: 'WeaverFrame Executive Advisory <advisory@weaverframe.com>',
          replyTo: 'admin@weaverframe.com',
        });
      } catch (err) {
        console.warn("Could not dispatch lead email:", err);
      }
    }

    return { success: true, userMessage: userMsg };
  });

export const createAdminConversation = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; email?: string; phone?: string; company?: string; initialMessage?: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('./server-utils.server');
    const session = await requireAdmin();
    const db = await getDb();

    const builderId = await getOrEnsureAdminBuilderId(db, session);

    const lead = await db.lead.create({
      data: {
        builderId,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        status: 'contacted',
        source: 'WeaverFrame HQ Direct Message',
        scoreTier: 'Hot',
        estimatedBudget: 2500000,
        county: data.company?.trim() || 'Architectural Client',
      }
    });

    if (data.initialMessage && data.initialMessage.trim()) {
      await db.message.create({
        data: {
          builderId,
          leadId: lead.id,
          sender: 'user',
          content: data.initialMessage.trim(),
          channel: 'portal',
          isRead: true,
        }
      });

      if (lead.email) {
        try {
          const { sendOutboundEmail } = await import('./email.server');
          await sendOutboundEmail({
            to: lead.email,
            subject: "WeaverFrame — Executive Communications",
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
              <p>${data.initialMessage.trim().replace(/\n/g, '<br/>')}</p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
              <p style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">WeaverFrame Executive Advisory · Private AI Infrastructure</p>
            </div>`,
            text: data.initialMessage.trim(),
            from: 'WeaverFrame Executive Advisory <advisory@weaverframe.com>',
            replyTo: 'admin@weaverframe.com',
          });
        } catch (err) {
          console.warn("Could not dispatch email:", err);
        }
      }
    }

    return { success: true, leadId: lead.id };
  });
