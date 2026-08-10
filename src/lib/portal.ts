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

    return newMessage;
  });
