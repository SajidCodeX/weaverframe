import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

function parseBudgetString(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (!val) return 1500000;
  const str = String(val).toLowerCase().trim();
  
  if (str.includes('m') || str.includes('mil')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return Math.round(num * 1000000);
  }
  if (str.includes('k')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) return Math.round(num * 1000);
  }
  const clean = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(clean) || clean <= 0 ? 1500000 : clean;
}

const inboundLeadSchema = z.object({
  builderId: z.string().optional(),
  apiKey: z.string().optional(),
  token: z.string().optional(),
  name: z.string().optional(),
  fullName: z.string().optional(),
  full_name: z.string().optional(),
  clientName: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().optional(),
  emailAddress: z.string().optional(),
  email_address: z.string().optional(),
  phone: z.string().optional(),
  phoneNumber: z.string().optional(),
  phone_number: z.string().optional(),
  cell: z.string().optional(),
  county: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  location: z.string().optional(),
  projectType: z.string().optional(),
  budget: z.any().optional(),
  estimatedBudget: z.any().optional(),
  source: z.string().optional(),
  message: z.string().optional(),
  notes: z.string().optional(),
  comment: z.string().optional(),
  comments: z.string().optional(),
  inquiry: z.string().optional(),
});

export const handleInboundLead = createServerFn({ method: 'POST' })
  .handler(async (ctx) => {
    const request = (ctx as any)?.request as Request | undefined;
    let data: any = (ctx as any)?.data || {};

    if (request) {
      try {
        const contentType = request.headers?.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await request.json();
          data = { ...data, ...body };
        } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          formData.forEach((value: any, key: string) => {
            data[key] = value;
          });
        }
      } catch (err) {
        // keep fallback data
      }

      if (request.url) {
        try {
          const url = new URL(request.url);
          const queryToken = url.searchParams.get('token') || url.searchParams.get('apiKey') || url.searchParams.get('builderId');
          const querySource = url.searchParams.get('source');
          if (queryToken && !data.token && !data.builderId && !data.apiKey) {
            data.token = queryToken;
          }
          if (querySource && !data.source) {
            data.source = querySource;
          }
        } catch (e) {}
      }
    }

    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const { invalidateCache } = await import('@/lib/cache');
    const { triggerAutonomousAiOutreach } = await import('@/lib/dashboard');

    try {
      // 1. Determine target builder
      let targetBuilderId = data.builderId;
      const lookupToken = data.token || data.apiKey;

      if (!targetBuilderId && lookupToken) {
        // Try finding builder by ID or user API key
        const builder = await db.builder.findFirst({
          where: {
            OR: [
              { id: lookupToken },
              { id: { startsWith: lookupToken } }
            ]
          },
          select: { id: true, companyName: true }
        });
        if (builder) {
          targetBuilderId = builder.id;
        } else {
          const apiKeyUser = await db.user.findFirst({
            where: { id: lookupToken },
            select: { builderId: true }
          });
          targetBuilderId = apiKeyUser?.builderId || undefined;
        }
      }

      if (!targetBuilderId) {
        return {
          isResponse: true,
          status: 400,
          json: { success: false, error: "Builder ID or valid integration token required." }
        };
      }

      // 2. Normalize multi-platform fields
      const rawName = data.name || data.fullName || data.full_name || data.clientName || 
        (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null) || "Inbound Prospective Buyer";
      const name = rawName.trim();

      const rawEmail = data.email || data.emailAddress || data.email_address;
      if (!rawEmail || !rawEmail.includes('@')) {
        return {
          isResponse: true,
          status: 400,
          json: { success: false, error: "Valid client email address is required." }
        };
      }
      const email = rawEmail.trim().toLowerCase();

      const phone = data.phone || data.phoneNumber || data.phone_number || data.cell || null;
      const estimatedBudget = parseBudgetString(data.estimatedBudget || data.budget);
      const landPrice = Math.round(estimatedBudget * 0.25);
      const source = data.source?.trim() || "Website Inbound Webhook";
      const county = data.county?.trim() || data.city?.trim() || data.location?.trim() || data.projectType?.trim() || "Travis County";
      const state = data.state?.trim() || "TX";
      const rawMessage = data.message || data.notes || data.comment || data.comments || data.inquiry || "";
      const message = rawMessage.trim();

      const isHot = estimatedBudget >= 1500000 || message.toLowerCase().includes("ready") || message.toLowerCase().includes("lot");
      const scoreTier = isHot ? "Hot" : "Warm";
      const dealScore = isHot ? 88 : 65;

      // 3. Check duplicate lead for this builder
      const existing = await db.lead.findFirst({
        where: {
          builderId: targetBuilderId,
          email
        }
      });

      if (existing) {
        // If existing, append inquiry to thread
        if (message) {
          await db.message.create({
            data: {
              builderId: targetBuilderId,
              leadId: existing.id,
              sender: 'lead',
              content: message,
              channel: 'portal',
              isRead: false,
            }
          });

          await db.activity.create({
            data: {
              builderId: targetBuilderId,
              leadId: existing.id,
              action: `New inquiry message received from ${source}`,
            }
          });

          // Trigger AI autonomous response to the new message
          triggerAutonomousAiOutreach(existing.id, targetBuilderId, message).catch((aiErr) => {
            console.error('[EXISTING LEAD AI OUTREACH ERROR]:', aiErr);
          });
        }

        invalidateCache("dashboard_");

        return {
          isResponse: true,
          status: 200,
          json: {
            success: true,
            leadId: existing.id,
            isExisting: true,
            message: "Existing lead updated and AI autonomous reply dispatched."
          }
        };
      }

      // 4. Create new Lead
      const lead = await db.lead.create({
        data: {
          builderId: targetBuilderId,
          name,
          email,
          phone: phone ? phone.trim() : null,
          county,
          state,
          landPrice,
          estimatedBudget,
          purchaseDate: new Date(),
          status: "New",
          scoreTier,
          dealScore,
          source,
          lastAiSummary: message ? `Website Inquiry: "${message.slice(0, 120)}..."` : `New inbound inquiry from ${source}`,
        }
      });

      // 5. If message is present, store as initial message
      if (message) {
        await db.message.create({
          data: {
            builderId: targetBuilderId,
            leadId: lead.id,
            sender: 'lead',
            content: message,
            channel: 'portal',
            isRead: false,
          }
        });
      }

      // 6. Log activity
      await db.activity.create({
        data: {
          builderId: targetBuilderId,
          leadId: lead.id,
          action: `Inbound lead captured via ${source} ($${(estimatedBudget / 1000000).toFixed(1)}M budget in ${county})`,
        }
      });

      // ── Trigger Instant AI Autonomous Outreach & Resend Email ───────────
      triggerAutonomousAiOutreach(lead.id, targetBuilderId, message).catch((aiErr) => {
        console.error('[INBOUND AI OUTREACH ERROR]:', aiErr);
      });

      invalidateCache("dashboard_");

      return {
        isResponse: true,
        status: 201,
        json: {
          success: true,
          leadId: lead.id,
          scoreTier,
          dealScore,
          message: "Lead successfully ingested and AI autonomous outreach email dispatched."
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
    const request = (ctx as any)?.request as Request | undefined;
    if (request?.method === 'POST') {
      const result = await handleInboundLead();
      return new Response(JSON.stringify(result.json || result), {
        status: result.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payloadInfo = {
      endpoint: "/api/leads/inbound",
      methods: ["POST"],
      description: "Submit new inbound website or ad leads into WeaverFrame",
      supportedPlatforms: ["WordPress / Elementor / WPForms", "Meta Lead Ads (FB/IG)", "Webflow", "Wix", "Squarespace", "Zapier", "Make.com", "Custom HTML Forms"],
      payloadExample: {
        name: "Harrison Vance",
        email: "harrison.vance@example.com",
        phone: "(512) 555-0199",
        county: "Travis County",
        state: "TX",
        estimatedBudget: 1800000,
        source: "Website Contact Form",
        message: "Looking for a 4,500 sqft modern luxury estate in Westlake."
      }
    };

    return new Response(JSON.stringify(payloadInfo, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

