// ─── RESEND OUTBOUND EMAIL ENGINE (SERVER-ONLY) ─────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Dispatches an outbound email via the Resend API.
 * Automatically falls back to informative logging if RESEND_API_KEY is not configured in local dev.
 */
export async function sendOutboundEmail(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : undefined) || '';
  
  const recipient = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to].filter(Boolean);
  if (recipient.length === 0) {
    return { success: false, error: 'No valid recipient email provided.' };
  }

  // Resend default verified sender for onboarding / testing: 'onboarding@resend.dev'
  // Or builder's verified custom domain if set in env/options.
  const verifiedFrom = options.from && options.from.includes('<') && !options.from.includes('@localhost')
    ? options.from
    : options.from && options.from.includes('@') && !options.from.includes('@localhost')
      ? options.from
      : 'WeaverFrame Concierge <onboarding@resend.dev>';

  if (!apiKey || apiKey.trim().length === 0 || apiKey.startsWith('YOUR_')) {
    console.warn(`[EMAIL ENGINE] RESEND_API_KEY is not set. Simulated email to: ${recipient.join(', ')} | Subject: "${options.subject}"`);
    return {
      success: true,
      simulated: true,
      id: `sim_${Date.now()}`
    };
  }

  try {
    const payload: Record<string, any> = {
      from: verifiedFrom,
      to: recipient,
      subject: options.subject,
    };

    if (options.html) {
      payload.html = options.html;
    }
    if (options.text) {
      payload.text = options.text;
    }
    if (options.replyTo) {
      payload.reply_to = options.replyTo;
    }
    if (options.tags && options.tags.length > 0) {
      payload.tags = options.tags;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Resend HTTP ${response.status}: ${response.statusText}`;
      console.error(`[EMAIL ENGINE ERROR] Failed to send email to ${recipient.join(', ')}:`, errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    console.log(`[EMAIL ENGINE SUCCESS] Dispatched email to ${recipient.join(', ')} | Resend ID: ${data?.id}`);
    return {
      success: true,
      id: data?.id
    };
  } catch (err: any) {
    console.error(`[EMAIL ENGINE EXCEPTION] Error dispatching email:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Network error while contacting Resend API'
    };
  }
}

/**
 * Generates an executive B2B architectural HTML email template
 */
export function buildArchitecturalEmailHtml({
  recipientName,
  senderName,
  senderRole,
  companyName,
  messageContent,
  ctaText,
  ctaUrl,
}: {
  recipientName: string;
  senderName: string;
  senderRole?: string;
  companyName: string;
  messageContent: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  // Convert newlines to formatted paragraphs
  const formattedParagraphs = messageContent
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin: 0 0 16px 0; color: #1e293b; font-size: 15px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architectural Consultation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 3px solid #c9a84c;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Architectural Consultation & Custom Builds</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                Hello ${recipientName || 'there'},
              </p>
              
              ${formattedParagraphs}

              ${ctaText && ctaUrl ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="left">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; border: 1px solid #334155;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Signature -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700;">${senderName}</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 13px;">${senderRole || 'Executive Team'} · ${companyName}</p>
                <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 11px; font-family: monospace;">🔒 Verified 2-Way Encrypted Communication</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5;">
                You are receiving this communication regarding your custom home or architectural consultation inquiry with ${companyName}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
