import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const inboundLeadSchema = z.object({
  builderId: z.string().optional(),
  apiKey: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  projectType: z.string().optional(),
  estimatedBudget: z.coerce.number().optional(),
  source: z.string().optional(),
  message: z.string().optional(),
});

const handleInboundLead = createServerFn({ method: 'POST' })
  .inputValidator((data: z.infer<typeof inboundLeadSchema>) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@/lib/db');
    const { invalidateCache } = await import('@/lib/dashboard');

    try {
      // 1. Determine target builder
      let targetBuilderId = data.builderId;

      if (!targetBuilderId && data.apiKey) {
        const apiKeyUser = await db.user.findFirst({
          where: { id: data.apiKey },
          select: { builderId: true }
        });
        targetBuilderId = apiKeyUser?.builderId || undefined;
      }

      if (!targetBuilderId) {
        const firstActiveBuilder = await db.builder.findFirst({
          where: { isActive: true },
          select: { id: true }
        });
        targetBuilderId = firstActiveBuilder?.id;
      }

      if (!targetBuilderId) {
        return {
          isResponse: true,
          status: 400,
          json: { success: false, error: "Builder ID or valid API key required." }
        };
      }

      const estimatedBudget = data.estimatedBudget || 500000;
      const landPrice = Math.round(estimatedBudget * 0.25);
      const source = data.source?.trim() || "Website Contact Form";
      const projectType = data.projectType?.trim() || "Custom Home Build";
      const isHot = estimatedBudget >= 750000 || (data.message && data.message.toLowerCase().includes("ready"));
      const scoreTier = isHot ? "Hot" : "Warm";

      // 2. Check duplicate
      const existing = await db.lead.findFirst({
        where: {
          builderId: targetBuilderId,
          email: data.email
        }
      });

      if (existing) {
        // If existing, append message
        if (data.message) {
          await db.message.create({
            data: {
              builderId: targetBuilderId,
              leadId: existing.id,
              sender: 'lead',
              content: data.message.trim(),
              channel: 'portal',
              isRead: false,
            }
          });
        }
        return {
          isResponse: true,
          status: 200,
          json: { success: true, leadId: existing.id, isExisting: true }
        };
      }

      // 3. Create new Lead
      const lead = await db.lead.create({
        data: {
          builderId: targetBuilderId,
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim() || null,
          county: projectType,
          state: "US",
          landPrice,
          estimatedBudget,
          purchaseDate: new Date(),
          status: "New",
          scoreTier,
          source,
          lastAiSummary: data.message ? `Website inquiry: ${data.message}` : "Inbound inquiry from website",
          dealScore: scoreTier === "Hot" ? 85 : 60,
        }
      });

      // 4. If message is present, store as first message
      if (data.message && data.message.trim()) {
        await db.message.create({
          data: {
            builderId: targetBuilderId,
            leadId: lead.id,
            sender: 'lead',
            content: data.message.trim(),
            channel: 'portal',
            isRead: false,
          }
        });
      }

      // 5. Log activity
      await db.activity.create({
        data: {
          builderId: targetBuilderId,
          leadId: lead.id,
          action: `Inbound lead captured via ${source}`,
        }
      });

      invalidateCache("dashboard_");

      return {
        isResponse: true,
        status: 201,
        json: {
          success: true,
          leadId: lead.id,
          message: "Lead successfully ingested and queued for autonomous email outreach."
        }
      };
    } catch (err: any) {
      console.error("Inbound lead error:", err);
      return {
        isResponse: true,
        status: 500,
        json: { success: false, error: err.message || "Failed to process lead." }
      };
    }
  });

export const Route = createFileRoute('/api/leads/inbound')({
  loader: async (ctx) => {
    const request = (ctx as any).request as Request;
    if (request?.method === 'POST') {
      try {
        const body = await request.json();
        const res = await handleInboundLead({ data: body });
        return res;
      } catch (e: any) {
        return { isResponse: true, status: 400, json: { error: e.message } };
      }
    }
    return {
      isResponse: true,
      status: 200,
      json: {
        endpoint: "/api/leads/inbound",
        methods: ["POST"],
        description: "Submit new inbound website or ad leads into WeaverFrame",
        payloadExample: {
          name: "John Doe",
          email: "john@example.com",
          phone: "(512) 555-0199",
          projectType: "Custom Home Build",
          estimatedBudget: 750000,
          source: "Website Contact Form",
          message: "Looking to build a modern estate in Austin."
        }
      }
    };
  },
});
