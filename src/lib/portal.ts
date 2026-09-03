import { createServerFn } from '@tanstack/react-start';
import { getDb } from './db';
import { sanitizeInboundEmail } from './sanitizer';

// ─── Rate Limiter for Portal Chat (Flood / DoS Protection) ───────────────────
interface PortalRateLimitRecord {
  timestamps: number[];
  lastMessageAt: number;
}
const portalRateLimitMap = new Map<string, PortalRateLimitRecord>();

// Clean up stale rate-limit records every 10 minutes
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of portalRateLimitMap.entries()) {
      if (now - record.lastMessageAt > 10 * 60 * 1000) {
        portalRateLimitMap.delete(key);
      }
    }
  }, 10 * 60 * 1000);
  if (timer.unref) timer.unref();
}

export function checkPortalRateLimit(token: string) {
  const now = Date.now();
  const record = portalRateLimitMap.get(token) || { timestamps: [], lastMessageAt: 0 };

  // 1. Burst protection: minimum 2.5 seconds between messages
  if (now - record.lastMessageAt < 2500) {
    throw new Error("Please wait a few seconds before sending another message.");
  }

  // 2. Sliding window: max 5 messages in 60 seconds
  record.timestamps = record.timestamps.filter(t => now - t < 60000);
  if (record.timestamps.length >= 5) {
    throw new Error("Rate limit reached. Please wait a minute before sending more messages.");
  }

  record.timestamps.push(now);
  record.lastMessageAt = now;
  portalRateLimitMap.set(token, record);
}

// Fetch the portal data: Lead details, builder details, and message history
// Strictly returns client-safe DTOs — NEVER exposes builder.settings, credentials, or internal lead memory
export async function getPortalDataDirect(token: string) {
  const db = await getDb();
  
  // Find lead by secure portalToken — strictly project only client-safe fields
  const lead = await db.lead.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      portalToken: true,
      builder: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
        }
      }
    }
  });

  if (!lead || !lead.builder) {
    throw new Error("Invalid or expired portal link");
  }

  // Update last visited timestamp to track presence
  await db.lead.update({
    where: { id: lead.id },
    data: { portalVisitedAt: new Date() }
  }).catch(() => {});

  // Fetch messages for this lead, ordered chronologically — safe projection only
  const messages = await db.message.findMany({
    where: { leadId: lead.id },
    select: {
      id: true,
      sender: true,
      content: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' }
  });

  // Explicit DTO construction — guarantees zero accidental leakage of settings/secrets
  return {
    lead: {
      id: lead.id,
      name: lead.name,
      portalToken: lead.portalToken,
    },
    builder: {
      id: lead.builder.id,
      companyName: lead.builder.companyName,
      contactName: lead.builder.contactName,
    },
    messages: messages.map((m: any) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    }))
  };
}

export const getPortalData = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    return getPortalDataDirect(data.token);
  });

// Send a message from the portal (as the lead)
export const sendPortalMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; content: string }) => data)
  .handler(async ({ data }) => {
    if (!data.token || typeof data.token !== 'string') {
      throw new Error("Invalid portal token");
    }

    // 1. Enforce Rate Limiting & Flood Protection
    checkPortalRateLimit(data.token);

    // 2. Sanitize user input before saving or processing
    const cleanContent = sanitizeInboundEmail(data.content || '').trim();
    if (!cleanContent) {
      throw new Error("Message content cannot be empty");
    }

    const db = await getDb();
    
    // Authenticate via token
    const lead = await db.lead.findUnique({
      where: { portalToken: data.token },
      select: { id: true, builderId: true }
    });

    if (!lead) {
      throw new Error("Invalid portal token");
    }

    // Create the message safely
    const newMessage = await db.message.create({
      data: {
        builderId: lead.builderId,
        leadId: lead.id,
        content: cleanContent,
        sender: 'lead',
        channel: 'portal',
      },
      select: {
        id: true,
        sender: true,
        content: true,
        createdAt: true,
      }
    });

    // Update lead's status to Replied
    await db.lead.update({
      where: { id: lead.id },
      data: {
        status: 'Replied',
      }
    }).catch(() => {});

    // --- AI CONCIERGE INTEGRATION ---
    try {
      const builder = await db.builder.findUnique({
        where: { id: lead.builderId },
        select: { settings: true }
      });
      
      let aiToggleMap: Record<string, boolean> = {};
      if (builder?.settings) {
        try {
          const allSettings = typeof builder.settings === 'string' ? JSON.parse(builder.settings) : builder.settings;
          aiToggleMap = allSettings['ai_toggle_map'] || {};
        } catch (e) {
          console.warn("Failed to parse builder settings", e);
        }
      }

      // Check if AI is active for this lead (default true)
      const isAiActive = aiToggleMap[lead.id] !== false;

      if (isAiActive) {
        const { generateAiReplyCore } = await import('./dashboard');
        
        // Fetch chat history for context (up to 15 previous messages)
        const history = await db.message.findMany({
          where: { leadId: lead.id, builderId: lead.builderId },
          orderBy: { createdAt: 'desc' },
          take: 15
        });

        const formattedHistory = history.reverse().map((m: any) => ({
          role: (m.sender === 'user' || m.sender === 'system') ? 'assistant' : 'user' as any,
          content: m.content
        }));

        // Generate response
        const aiResponse = await generateAiReplyCore(
          db,
          lead.id,
          lead.builderId,
          cleanContent,
          formattedHistory,
          false
        );

        if (aiResponse && aiResponse.replyText) {
          await db.message.create({
            data: {
              builderId: lead.builderId,
              leadId: lead.id,
              sender: 'system',
              content: aiResponse.replyText,
              isRead: false,
              channel: 'portal'
            }
          });
        }
      }
    } catch (aiError: any) {
      console.error("AI Concierge failed to reply on portal:", aiError?.message || aiError);
    }

    return {
      id: newMessage.id,
      sender: newMessage.sender,
      content: newMessage.content,
      createdAt: newMessage.createdAt.toISOString(),
    };
  });
