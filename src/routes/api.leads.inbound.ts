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

export async function handleInboundLeadDirect(inputData: any = {}, request?: Request) {
  let data = { ...inputData };
  if (request) {
    try {
      const contentType = request.headers?.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.clone().json();
        data = { ...data, ...body };
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.clone().formData();
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

  const { getDb } = await import('@/lib/db.server');
  const db = await getDb();
  const { invalidateCache } = await import('@/lib/cache');
  const { triggerAutonomousAiOutreach } = await import('@/lib/dashboard');
  const { sanitizeInboundEmail, sanitizeMetadataField } = await import('@/lib/sanitizer');

    try {
      // 1. Resolve Auth Token from headers, query, or body
      let authToken = (data.token || data.apiKey || '').trim();
      if (request) {
        const authHeader = request.headers?.get('authorization') || '';
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          authToken = authHeader.slice(7).trim();
        } else if (request.headers?.get('x-api-key')) {
          authToken = request.headers.get('x-api-key')?.trim() || '';
        } else if (request.headers?.get('x-integration-token')) {
          authToken = request.headers.get('x-integration-token')?.trim() || '';
        }
      }

      // Mandatory Integration Authentication: Reject unauthenticated callers immediately
      if (!authToken) {
        return {
          isResponse: true,
          status: 401,
          json: { success: false, error: "Unauthorized: Missing integration token or API key." }
        };
      }

      // 2. Validate token against DB integrations, users, or builder settings
      let authenticatedBuilderId: string | undefined;

      const webhookIntegration = await db.integration.findFirst({
        where: {
          isConnected: true,
          configSecure: authToken,
        },
        select: { builderId: true }
      });

      if (webhookIntegration) {
        authenticatedBuilderId = webhookIntegration.builderId;
      } else {
        const apiKeyUser = await db.user.findFirst({
          where: { id: authToken, isActive: true },
          select: { builderId: true }
        });
        if (apiKeyUser?.builderId) {
          authenticatedBuilderId = apiKeyUser.builderId;
        } else {
          const buildersWithSettings = await db.builder.findMany({
            where: { isActive: true },
            select: { id: true, settings: true }
          });
          for (const b of buildersWithSettings) {
            if (b.settings) {
              try {
                const s = typeof b.settings === 'string' ? JSON.parse(b.settings) : b.settings;
                if (s.webhook_token === authToken || s.api_key === authToken || s.integration_token === authToken) {
                  authenticatedBuilderId = b.id;
                  break;
                }
              } catch {}
            }
          }
        }
      }

      if (!authenticatedBuilderId) {
        return {
          isResponse: true,
          status: 401,
          json: { success: false, error: "Unauthorized: Invalid integration token or API key." }
        };
      }

      // If builderId is also supplied in body/query, enforce strict tenant match
      if (data.builderId && data.builderId !== authenticatedBuilderId) {
        return {
          isResponse: true,
          status: 403,
          json: { success: false, error: "Forbidden: Provided builderId does not match authenticated integration credentials." }
        };
      }

      const targetBuilderId = authenticatedBuilderId;

      // 3. Normalize & sanitize multi-platform fields
      const rawName = data.name || data.fullName || data.full_name || data.clientName || 
        (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null) || "Inbound Prospective Buyer";
      const name = sanitizeMetadataField(rawName, 80);

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
      const source = sanitizeMetadataField(data.source || "Website Inbound Webhook", 60);
      const county = sanitizeMetadataField(data.county || data.city || data.location || data.projectType || "Travis County", 60);
      const state = sanitizeMetadataField(data.state || "TX", 10);
      const rawMessage = data.message || data.notes || data.comment || data.comments || data.inquiry || "";
      const message = sanitizeInboundEmail(rawMessage).trim();

      const isHot = estimatedBudget >= 1500000 || message.toLowerCase().includes("ready") || message.toLowerCase().includes("lot");
      const scoreTier = isHot ? "Hot" : "Warm";
      const dealScore = isHot ? 88 : 65;

      // 4. Check duplicate lead for this builder (Idempotency protection)
      const existing = await db.lead.findFirst({
        where: {
          builderId: targetBuilderId,
          email
        }
      });

      if (existing) {
        // Replay Protection: If the exact message was received within the last 60 seconds, skip duplicate processing
        if (message) {
          const recentDuplicateMsg = await db.message.findFirst({
            where: {
              leadId: existing.id,
              content: message,
              createdAt: { gte: new Date(Date.now() - 60000) }
            }
          });

          if (recentDuplicateMsg) {
            return {
              isResponse: true,
              status: 200,
              json: {
                success: true,
                leadId: existing.id,
                isDuplicate: true,
                message: "Duplicate submission ignored (idempotent replay)."
              }
            };
          }

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
          triggerAutonomousAiOutreach(existing.id, targetBuilderId, message).catch((aiErr: any) => {
            console.error('[EXISTING LEAD AI OUTREACH ERROR]:', aiErr?.message || aiErr);
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

      // 5. Create new Lead
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
      console.error("Inbound lead error:", err?.message || err);
      return {
        isResponse: true,
        status: 500,
        json: { success: false, error: "Internal server error occurred while processing inbound lead." }
      };
    }
}

export const handleInboundLead = createServerFn({ method: 'POST' })
  .handler(async (ctx) => {
    const request = (ctx as any)?.request as Request | undefined;
    const data: any = (ctx as any)?.data || {};
    return handleInboundLeadDirect(data, request);
  });

export const Route = createFileRoute('/api/leads/inbound')({
  loader: async (ctx) => {
    const request = (ctx as any)?.request as Request | undefined;
    if (request?.method === 'POST') {
      const result = await handleInboundLeadDirect({}, request);
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

