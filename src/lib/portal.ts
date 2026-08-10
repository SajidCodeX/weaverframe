import { createServerFn } from '@tanstack/react-start';
import { getDb } from './db';

// Fetch the portal data: Lead details, builder details, and message history
export const getPortalData = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    // Find lead by secure portalToken and include builder details
    const lead = await db.lead.findUnique({
      where: { portalToken: data.token },
      include: {
        builder: true, 
      }
    });

    if (!lead) {
      throw new Error("Lead not found or invalid link");
    }

    // Mark as visited if first time
    if (!lead.portalVisitedAt) {
      await db.lead.update({
        where: { id: lead.id },
        data: { portalVisitedAt: new Date() }
      });
    }

    // Fetch messages for this lead, ordered chronologically
    const messages = await db.message.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'asc' }
    });

    return {
      lead,
      builder: lead.builder,
      messages
    };
  });

// Send a message from the portal (as the lead)
export const sendPortalMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; content: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    // Authenticate via token
    const lead = await db.lead.findUnique({
      where: { portalToken: data.token },
      select: { id: true, builderId: true } // Only fetch what we need
    });

    if (!lead) {
      throw new Error("Invalid token");
    }

    // Create the message safely
    const newMessage = await db.message.create({
      data: {
        builderId: lead.builderId,
        leadId: lead.id,
        content: data.content,
        sender: 'lead',
        channel: 'portal',
        // isRead defaults to false — dashboard will show unread badge
      }
    });

    // Update lead's status to Replied so dashboard shows correctly
    await db.lead.update({
      where: { id: lead.id },
      data: {
        status: 'Replied',
      }
    });

    // --- AI CONCIERGE INTEGRATION ---
    try {
      const builder = await db.builder.findUnique({
        where: { id: lead.builderId },
        select: { settings: true }
      });
      
      let aiToggleMap: Record<string, boolean> = {};
      if (builder?.settings) {
        try {
          const allSettings = JSON.parse(builder.settings);
          aiToggleMap = allSettings['ai_toggle_map'] || {};
        } catch (e) {
          console.warn("Failed to parse builder settings", e);
        }
      }

      // Check if AI is active for this lead (default true)
      const isAiActive = aiToggleMap[lead.id] !== false;

      if (isAiActive) {
        // We need to dynamically import the core AI logic to avoid circular deps or pulling in auth
        const { generateAiReplyCore } = await import('./dashboard');
        
        // Fetch chat history for context (up to 10 previous messages)
        const history = await db.message.findMany({
          where: { leadId: lead.id, builderId: lead.builderId },
          orderBy: { createdAt: 'asc' },
          take: 10
        });

        const formattedHistory = history.map((m: any) => ({
          role: (m.sender === 'user' || m.sender === 'system') ? 'assistant' : 'user' as any,
          content: m.content
        }));

        // Generate response (this also updates the lead intent/status in DB)
        const aiResponse = await generateAiReplyCore(
          db,
          lead.id,
          lead.builderId,
          data.content,
          formattedHistory,
          false // not simulated
        );

        if (aiResponse && aiResponse.replyText) {
          // Save the AI response as a 'system' message
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
    } catch (aiError) {
      console.error("AI Concierge failed to reply:", aiError);
      // We don't throw here so that the original user message is still delivered
    }

    return newMessage;
  });
