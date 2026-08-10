import { createServerFn } from '@tanstack/react-start';
import { getDb } from './db';

// Fetch the portal data: Lead details, builder details, and message history
export const getPortalData = createServerFn({ method: 'GET' })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    // Find lead and include builder details
    const lead = await db.lead.findUnique({
      where: { id: data.leadId },
      include: {
        builder: true, // Assuming lead belongs to a builder
      }
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    // Fetch messages for this lead, ordered chronologically
    const messages = await db.message.findMany({
      where: { leadId: data.leadId },
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
  .inputValidator((data: { leadId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    // Create the message
    const newMessage = await db.message.create({
      data: {
        leadId: data.leadId,
        content: data.content,
        sender: 'lead',
        channel: 'portal',
        status: 'delivered', // Delivered to builder
      }
    });

    // Update lead's last contact timestamp & unread count for the dashboard
    await db.lead.update({
      where: { id: data.leadId },
      data: {
        lastContact: new Date(),
        // We could also increment an unreadCount field here if it exists in the schema.
        // The dashboard might compute unread by checking messages where sender === 'lead' and isRead === false.
      }
    });

    return newMessage;
  });
