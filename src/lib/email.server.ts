import nodemailer from 'nodemailer';

// ─── DUAL-ENGINE OUTBOUND EMAIL DISPATCHER (SERVER-ONLY) ─────────────────────
// Priority 1: Gmail / Custom SMTP (via nodemailer with SMTP_USER & SMTP_PASS)
// Priority 2: Resend API (via RESEND_API_KEY)
// Priority 3: Informative Simulation fallback in local dev

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
  engine?: 'smtp' | 'resend' | 'simulated';
}

/**
 * Dispatches an outbound email.
 * Prioritizes SMTP (Gmail App Password) so emails deliver to ANY recipient without domain restrictions.
 * Falls back to Resend API, and then to simulated mode if no credentials exist.
 */
export async function sendOutboundEmail(options: SendEmailOptions): Promise<EmailResult> {
  const recipient = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to].filter(Boolean);
  if (recipient.length === 0) {
    return { success: false, error: 'No valid recipient email provided.' };
  }

  let smtpUser = (typeof process !== 'undefined' ? (process.env.SMTP_USER || process.env.GMAIL_USER) : undefined) || '';
  let smtpPass = (typeof process !== 'undefined' ? (process.env.SMTP_PASS || process.env.GMAIL_PASS) : undefined) || '';
  let smtpHost = (typeof process !== 'undefined' ? process.env.SMTP_HOST : undefined) || 'smtp.gmail.com';
  let smtpPort = parseInt((typeof process !== 'undefined' ? process.env.SMTP_PORT : undefined) || '465', 10);

  // If not in env, check database Integration table
  if (!smtpUser || !smtpPass) {
    try {
      const { getDb } = await import('./db');
      const db = await getDb();
      const integration = await db.integration.findFirst({
        where: { platformId: 'email_mailbox', isConnected: true }
      });
      if (integration && integration.configSecure) {
        const { decrypt } = await import('./crypto');
        const creds = JSON.parse(decrypt(integration.configSecure));
        if (creds.email && creds.password && creds.password !== '••••••••••••••••') {
          smtpUser = creds.email;
          smtpPass = creds.password;
          if (creds.provider === 'custom_smtp' && creds.smtpHost) {
            smtpHost = creds.smtpHost;
            smtpPort = parseInt(creds.smtpPort || '465', 10);
          }
        }
      }
    } catch {}
  }

  const cleanSmtpPass = smtpPass.replace(/\s+/g, '').trim();

  // ── 1. GMAIL / CUSTOM SMTP ENGINE (NODEMAILER) ─────────────────────────────
  if (smtpUser && smtpUser.trim().length > 0 && cleanSmtpPass && cleanSmtpPass.length > 0) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for 587
        auth: {
          user: smtpUser.trim(),
          pass: cleanSmtpPass,
        },
        connectionTimeout: 10000,
      });

      // Extract sender display name if present
      let senderDisplayName = 'AI Concierge';
      if (options.from) {
        const match = options.from.match(/^([^<]+)/);
        if (match && match[1]) {
          senderDisplayName = match[1].trim();
        }
      }

      const mailOptions = {
        from: `"${senderDisplayName}" <${smtpUser.trim()}>`,
        to: recipient.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || smtpUser.trim(),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP EMAIL SUCCESS] Dispatched to ${recipient.join(', ')} via SMTP (${smtpUser}) | MessageId: ${info.messageId}`);
      return {
        success: true,
        id: info.messageId,
        engine: 'smtp',
      };
    } catch (smtpErr: any) {
      console.error(`[SMTP ENGINE ERROR] Failed to send via SMTP (${smtpUser}):`, smtpErr?.message || smtpErr);
      // Fall through to Resend fallback
    }
  }

  // ── 2. RESEND API ENGINE ───────────────────────────────────────────────────
  const resendApiKey = (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : undefined) || '';

  if (resendApiKey && resendApiKey.trim().length > 0 && !resendApiKey.startsWith('YOUR_')) {
    try {
      const verifiedFrom = options.from && options.from.includes('<') && !options.from.includes('@localhost')
        ? options.from
        : options.from && options.from.includes('@') && !options.from.includes('@localhost')
          ? options.from
          : 'WeaverFrame Concierge <onboarding@resend.dev>';

      const payload: Record<string, any> = {
        from: verifiedFrom,
        to: recipient,
        subject: options.subject,
      };

      if (options.html) payload.html = options.html;
      if (options.text) payload.text = options.text;
      if (options.replyTo) payload.reply_to = options.replyTo;
      if (options.tags && options.tags.length > 0) payload.tags = options.tags;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Resend HTTP ${response.status}: ${response.statusText}`;
        console.error(`[RESEND ENGINE ERROR] Failed to send to ${recipient.join(', ')}:`, errorMsg);
        return {
          success: false,
          error: errorMsg,
          engine: 'resend',
        };
      }

      console.log(`[RESEND ENGINE SUCCESS] Dispatched to ${recipient.join(', ')} | Resend ID: ${data?.id}`);
      return {
        success: true,
        id: data?.id,
        engine: 'resend',
      };
    } catch (err: any) {
      console.error(`[RESEND ENGINE EXCEPTION]:`, err?.message || err);
      return {
        success: false,
        error: err?.message || 'Network error contacting Resend API',
        engine: 'resend',
      };
    }
  }

  // ── 3. LOCAL SIMULATION (WHEN NO CREDENTIALS CONFIGURED) ───────────────────
  console.warn(`[EMAIL ENGINE] Neither SMTP nor RESEND_API_KEY configured. Simulated email to: ${recipient.join(', ')} | Subject: "${options.subject}"`);
  return {
    success: true,
    simulated: true,
    id: `sim_${Date.now()}`,
    engine: 'simulated',
  };
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
    .map(p => `<p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.65;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Architectural Consultation — ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 26px 32px; background-color: #0f172a; border-bottom: 2px solid #c9a84c;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 19px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">${companyName}</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-transform: uppercase; letter-spacing: 1.2px;">Architectural Consultation & Custom Builds</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="margin: 0 0 18px 0; color: #0f172a; font-size: 15px; font-weight: 600;">
                Hello ${recipientName || 'there'},
              </p>
              
              ${formattedParagraphs}

              ${ctaText && ctaUrl ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 12px 0;">
                <tr>
                  <td align="left">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; border: 1px solid #334155;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Signature -->
              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700;">${senderName}</p>
                <p style="margin: 3px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">${senderRole || 'Principal Builder & Director'} · ${companyName}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                You are receiving this communication regarding your architectural consultation & custom home inquiry with ${companyName}.
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
