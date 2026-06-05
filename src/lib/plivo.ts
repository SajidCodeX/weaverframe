/**
 * Plivo SMS Service
 * Handles outgoing SMS via Plivo REST API.
 * Dev mode: logs warning if credentials missing — does NOT throw.
 *
 * Required env vars (set in .env):
 *   PLIVO_AUTH_ID        — From console.plivo.com → Account → API
 *   PLIVO_AUTH_TOKEN     — From console.plivo.com → Account → API
 *   PLIVO_FROM_NUMBER    — Your Plivo phone number in E.164 (+15125550199)
 *   APP_BASE_URL         — Base URL for portal magic links
 */

const PLIVO_AUTH_ID    = process.env.PLIVO_AUTH_ID;
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
const PLIVO_FROM       = process.env.PLIVO_FROM_NUMBER;
const APP_BASE_URL     = process.env.APP_BASE_URL || 'http://localhost:8081';

const isPlivoConfigured =
  PLIVO_AUTH_ID &&
  PLIVO_AUTH_TOKEN &&
  PLIVO_FROM &&
  !PLIVO_AUTH_ID.includes('YOUR_') &&
  !PLIVO_AUTH_TOKEN.includes('YOUR_') &&
  !PLIVO_FROM.includes('YOUR_');

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmsSendResult = {
  sent: boolean;
  messageUuid?: string;
  error?: string;
};

// ─── Normalize phone to E.164 format ─────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ─── Send a single SMS ───────────────────────────────────────────────────────

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  if (!isPlivoConfigured) {
    console.warn(
      '[Plivo] ⚠️  Credentials not configured — SMS skipped (dev mode).\n' +
      `[Plivo] Would have sent to: ${to}\n[Plivo] Message: ${body}`
    );
    return { sent: false, error: 'Plivo not configured' };
  }

  const toNormalized = normalizePhone(to);
  const authHeader = `Basic ${Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64')}`;

  try {
    const res = await fetch(
      `https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Message/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          src:  PLIVO_FROM,
          dst:  toNormalized,
          text: body,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Plivo] SMS API error:', res.status, errText);
      return { sent: false, error: errText };
    }

    const data = await res.json();
    console.info(`[Plivo] ✅ SMS sent to ${toNormalized} — UUID: ${data.message_uuid}`);
    return { sent: true, messageUuid: data.message_uuid };
  } catch (err: any) {
    console.error('[Plivo] Network error:', err.message);
    return { sent: false, error: err.message };
  }
}

// ─── Build portal magic link ──────────────────────────────────────────────────

export function buildPortalLink(token: string): string {
  return `${APP_BASE_URL}/p/${token}`;
}

// ─── Drip SMS Templates ───────────────────────────────────────────────────────
// These are the 4 automated drip messages sent on Days 0, 3, 7, 14

export type DripStep = 1 | 2 | 3 | 4;

export interface DripContext {
  firstName: string;
  county:    string;
  builderContact: string; // Builder's contact person name
  companyName:    string; // Builder's company name
  portalLink:     string;
}

export function buildDripMessage(step: DripStep, ctx: DripContext): string {
  switch (step) {
    case 1:
      return (
        `Hi ${ctx.firstName}! I'm ${ctx.builderContact} from ${ctx.companyName}. ` +
        `We noticed your recent permit in ${ctx.county} county and would love to help ` +
        `with your custom home build. Chat with our team here: ${ctx.portalLink}`
      );
    case 2:
      return (
        `Hi ${ctx.firstName}, ${ctx.builderContact} from ${ctx.companyName} again. ` +
        `Just checking if you had a chance to see our message — we have floor plans ` +
        `and pricing specific to ${ctx.county}. Take a look: ${ctx.portalLink}`
      );
    case 3:
      return (
        `Hey ${ctx.firstName}! We're building custom homes in ${ctx.county} right now ` +
        `and have a few open spots this quarter. Would love to connect and share some ideas: ` +
        `${ctx.portalLink} — ${ctx.companyName}`
      );
    case 4:
      return (
        `Hi ${ctx.firstName}, this is our last follow-up. If you're still exploring ` +
        `custom home options in ${ctx.county}, we're here whenever you're ready: ` +
        `${ctx.portalLink}\n\nAll the best! — ${ctx.builderContact}, ${ctx.companyName}`
      );
  }
}

// Drip schedule: how many days after the previous SMS each step fires
export const DRIP_INTERVALS_DAYS: Record<DripStep, number> = {
  1: 0,  // Day 0: Immediately on trigger
  2: 3,  // Day 3
  3: 7,  // Day 7
  4: 14, // Day 14
};

// ─── Validate Plivo webhook signature ────────────────────────────────────────
// Used in /api/plivo/webhook to verify requests come from Plivo

export function validatePlivoSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    const crypto = require('crypto');
    // Sort params and append to URL
    const sortedKeys = Object.keys(params).sort();
    let toSign = url;
    for (const key of sortedKeys) {
      toSign += key + params[key];
    }
    const expected = crypto
      .createHmac('sha1', authToken)
      .update(toSign)
      .digest('base64');
    return expected === signature;
  } catch {
    return false;
  }
}
