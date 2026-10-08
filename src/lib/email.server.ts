import nodemailer from 'nodemailer';

// ─── DUAL-ENGINE OUTBOUND EMAIL DISPATCHER (SERVER-ONLY) ─────────────────────
// Priority 1: Gmail / Custom SMTP (via nodemailer with SMTP_USER & SMTP_PASS)
// Priority 2: Resend API (via RESEND_API_KEY)
// Priority 3: Informative Simulation fallback in local dev

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  contentType?: string;
  path?: string;
  cid?: string;
  size?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  attachments?: EmailAttachment[];
  builderId?: string;
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
  let googleOAuthToken: { accessToken: string; email: string; name?: string } | null = null;

  // ── 0. CHECK GOOGLE OAUTH 2.0 (PRIORITY 1 - 1-CLICK CONNECT) ──────────────
  try {
    const { getDb } = await import('./db.server');
    const db = await getDb();
    const targetBuilderId = (options as any).builderId;

    if (targetBuilderId) {
      const integration = await db.integration.findFirst({
        where: {
          builderId: targetBuilderId,
          platformId: 'email_mailbox',
          isConnected: true
        }
      });
    if (integration && integration.configSecure) {
      const { decrypt } = await import('./crypto');
      const creds = JSON.parse(decrypt(integration.configSecure));

      if (creds.provider === 'google_oauth' && creds.accessToken) {
        const { getValidGoogleAccessToken, sendGmailViaRestApi } = await import('./google-oauth.server');
        googleOAuthToken = await getValidGoogleAccessToken(integration.builderId);
        if (googleOAuthToken) {
          let senderHeader = googleOAuthToken.email;
          if (options.from) {
            const match = options.from.match(/^([^<]+)/);
            if (match && match[1]) {
              senderHeader = `"${match[1].trim()}" <${googleOAuthToken.email}>`;
            }
          }

          const oauthResult = await sendGmailViaRestApi(googleOAuthToken.accessToken, {
            to: recipient,
            subject: options.subject,
            html: options.html,
            text: options.text,
            from: senderHeader,
            replyTo: options.replyTo || googleOAuthToken.email,
            attachments: options.attachments?.map(a => ({
              filename: a.filename,
              content: a.content || '',
              contentType: a.contentType,
            })),
          });

          if (oauthResult.success) {
            return {
              success: true,
              id: oauthResult.id,
              engine: 'google_oauth' as any
            };
          } else {
            console.warn('[EMAIL] Google OAuth send failed, falling back to SMTP/Resend:', oauthResult.error);
          }
        }
      } else if (creds.email && creds.password && creds.password !== '••••••••••••••••') {
        smtpUser = creds.email;
        smtpPass = creds.password;
        if (creds.provider === 'custom_smtp' && creds.smtpHost) {
          smtpHost = creds.smtpHost;
          smtpPort = parseInt(creds.smtpPort || '465', 10);
        }
      }
    }
  }
} catch (authInspectErr) {
    console.warn('[EMAIL] Failed to inspect integration for OAuth:', authInspectErr);
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
        connectionTimeout: 8000,   // TCP connection must open within 8s
        socketTimeout: 10000,       // Socket read must complete within 10s
        greetingTimeout: 8000,      // SMTP EHLO greeting must arrive within 8s
      });

      // Extract sender display name if present
      let senderDisplayName = 'AI Concierge';
      if (options.from) {
        const match = options.from.match(/^([^<]+)/);
        if (match && match[1]) {
          senderDisplayName = match[1].trim();
        }
      }

      // Automatically attach brand logo as CID inline attachment if referenced in HTML
      const attachments: any[] = [];
      if (options.html && options.html.includes('cid:weaverframe-logo')) {
        try {
          const path = await import('path');
          const fs = await import('fs');
          const logoPath = path.join(process.cwd(), 'public', 'weaverframe-mark-transparent.png');
          if (fs.existsSync(logoPath)) {
            attachments.push({
              filename: 'weaverframe-mark-transparent.png',
              path: logoPath,
              cid: 'weaverframe-logo',
            });
          }
        } catch (e) {
          console.warn('[EMAIL ATTACHMENT WARNING]:', e);
        }
      }

      // Add user attachments if present
      if (options.attachments && options.attachments.length > 0) {
        for (const att of options.attachments) {
          let contentBuf: Buffer | undefined;
          if (Buffer.isBuffer(att.content)) {
            contentBuf = att.content;
          } else if (typeof att.content === 'string') {
            const raw = att.content.startsWith('data:')
              ? att.content.replace(/^data:[^;]+;base64,/, '')
              : att.content;
            contentBuf = Buffer.from(raw, 'base64');
          }
          attachments.push({
            filename: att.filename,
            content: contentBuf,
            contentType: att.contentType,
            path: att.path,
            cid: att.cid,
          });
        }
      }

      const mailOptions: any = {
        from: `"${senderDisplayName}" <${smtpUser.trim()}>`,
        to: recipient.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || smtpUser.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      // Absolute 12s timeout — prevents indefinite hang when SMTP server is reachable but unresponsive
      const sendWithTimeout = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SMTP sendMail timeout after 12s')), 12000);
        transporter.sendMail(mailOptions).then((info) => {
          clearTimeout(timer);
          resolve(info);
        }).catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const info = await sendWithTimeout;
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
      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments.map(att => {
          let b64 = '';
          if (Buffer.isBuffer(att.content)) {
            b64 = att.content.toString('base64');
          } else if (typeof att.content === 'string') {
            b64 = att.content.startsWith('data:')
              ? att.content.replace(/^data:[^;]+;base64,/, '')
              : att.content;
          }
          return {
            filename: att.filename,
            content: b64,
          };
        });
      }

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
 * Extracts attachments, links, and brochures from raw message content and cleans the readable text.
 */
export function extractAttachmentsAndCleanContent(rawContent: string | null | undefined): {
  cleanText: string;
  attachments: EmailAttachment[];
  links: Array<{ title: string; url: string; category?: string }>;
  brochures: Array<{ name: string; size?: string }>;
  appointments: Array<{ details: string }>;
} {
  const attachments: EmailAttachment[] = [];
  const links: Array<{ title: string; url: string; category?: string }> = [];
  const brochures: Array<{ name: string; size?: string }> = [];
  const appointments: Array<{ details: string }> = [];
  const textLines: string[] = [];

  if (!rawContent) {
    return { cleanText: '', attachments, links, brochures, appointments };
  }

  const lines = rawContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('🖼️ Image Shared:')) {
      const metaStr = trimmed.replace('🖼️ Image Shared:', '').trim();
      const [nameParam, sizeParam, dataUrlParam] = metaStr.split('|');
      const filename = nameParam || 'image.jpg';
      const size = sizeParam ? sizeParam.replace('size=', '') : undefined;
      const dataUrl = dataUrlParam ? dataUrlParam.replace('data=', '') : undefined;
      let contentType = 'image/jpeg';
      if (dataUrl?.startsWith('data:image/png')) contentType = 'image/png';
      else if (dataUrl?.startsWith('data:image/webp')) contentType = 'image/webp';
      else if (dataUrl?.startsWith('data:image/gif')) contentType = 'image/gif';

      if (dataUrl) {
        attachments.push({ filename, content: dataUrl, contentType, size });
      }
      continue;
    }

    if (trimmed.startsWith('📎 File Attachment:')) {
      const metaStr = trimmed.replace('📎 File Attachment:', '').trim();
      const parts = metaStr.split('|');
      const filename = parts[0] || 'document.pdf';
      let size: string | undefined;
      let contentType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      let dataUrl: string | undefined;
      for (let p = 1; p < parts.length; p++) {
        if (parts[p].startsWith('size=')) size = parts[p].replace('size=', '');
        else if (parts[p].startsWith('type=')) contentType = parts[p].replace('type=', '');
        else if (parts[p].startsWith('data=')) dataUrl = parts[p].replace('data=', '');
      }
      if (dataUrl) {
        attachments.push({ filename, content: dataUrl, contentType, size });
      }
      continue;
    }

    if (trimmed.startsWith('🔗 Link Shared:')) {
      const metaStr = trimmed.replace('🔗 Link Shared:', '').trim();
      const parts = metaStr.split('|');
      const title = parts[0] || 'Shared Link';
      let url = '#';
      let category = '';
      for (let p = 1; p < parts.length; p++) {
        if (parts[p].startsWith('url=')) url = parts[p].replace('url=', '');
        else if (parts[p].startsWith('category=')) category = parts[p].replace('category=', '');
      }
      links.push({ title, url, category });
      continue;
    }

    if (trimmed.startsWith('📄 Document Shared:')) {
      const metaStr = trimmed.replace('📄 Document Shared:', '').trim();
      const parts = metaStr.split('|size=');
      let name = (parts[0] || 'Document').trim();
      if (!name.toLowerCase().endsWith('.pdf')) name = `${name}.pdf`;
      const size = parts[1] || '4.8 MB';
      brochures.push({ name, size });
      continue;
    }

    if (trimmed.startsWith('📆 Site Visit Booked:')) {
      const details = trimmed.replace('📆 Site Visit Booked:', '').trim();
      appointments.push({ details });
      continue;
    }

    // Filter out residual raw placeholder artifacts
    if (/^\[image:\s*[^\]]+\]$/i.test(trimmed)) {
      continue;
    }

    textLines.push(line);
  }

  return {
    cleanText: textLines.join('\n').trim(),
    attachments,
    links,
    brochures,
    appointments,
  };
}

/**
 * Escapes untrusted input to prevent HTML injection in emails (Finding 9.1).
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  links,
  attachmentsList,
}: {
  recipientName: string;
  senderName: string;
  senderRole?: string;
  companyName: string;
  messageContent: string;
  ctaText?: string;
  ctaUrl?: string;
  links?: Array<{ title: string; url: string; category?: string }>;
  attachmentsList?: Array<{ name: string; size?: string }>;
}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeSenderRole = escapeHtml(senderRole);
  const safeCompanyName = escapeHtml(companyName);

  // Convert newlines to formatted paragraphs with HTML escaping
  const formattedParagraphs = messageContent
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.65;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  // Format links callout block with HTML escaping
  const formattedLinks = links && links.length > 0 ? `
    <div style="margin: 24px 0 16px 0; padding: 16px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
      <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Shared Online Resources</p>
      ${links.map(l => `
        <div style="margin-top: 8px;">
          <a href="${escapeHtml(l.url)}" target="_blank" style="color: #0f172a; text-decoration: none; font-weight: 600; font-size: 14px;">
            🌐 ${escapeHtml(l.title)} <span style="color: #64748b; font-size: 12px; font-weight: 400; margin-left: 4px;">(${escapeHtml(l.url)})</span> &rarr;
          </a>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Format attachments callout block
  const formattedAttachments = attachmentsList && attachmentsList.length > 0 ? `
    <div style="margin: 20px 0 16px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Attached Files & Documents</p>
      ${attachmentsList.map(a => `
        <div style="margin-top: 6px; font-size: 13px; color: #1e293b; font-weight: 600;">
          📎 ${a.name} ${a.size ? `<span style="color: #64748b; font-size: 11px; font-weight: 400;">(${a.size})</span>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

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
            <td style="padding: 24px 32px; background-color: #0f172a; border-bottom: 2px solid #e5d9c5;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48" valign="middle" style="padding-right: 14px;">
                    <img src="cid:weaverframe-logo" alt="${companyName}" width="40" height="40" style="display: block; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background-color: rgba(255,255,255,0.05);" />
                  </td>
                  <td valign="middle">
                    <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">${companyName}</h1>
                    <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-transform: uppercase; letter-spacing: 1.2px;">Architectural Consultation & Custom Builds</p>
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
              ${formattedLinks}
              ${formattedAttachments}

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

/**
 * Executive Admin Notification Email for New Demo Requests
 */
export function buildAdminDemoNotificationHtml({
  name,
  company,
  email,
  phone,
  buildVolume,
  dashboardUrl = 'https://weaverframe.in/leads',
}: {
  name: string;
  company: string;
  email: string;
  phone: string;
  buildVolume: string;
  dashboardUrl?: string;
}) {
  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(company);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeBuildVolume = escapeHtml(buildVolume);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Demo Request — WeaverFrame</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060608; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060608; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0e0f14; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 26px 36px; background-color: #12131a; border-bottom: 2px solid #e5d9c5;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48" valign="middle" style="padding-right: 14px;">
                    <img src="cid:weaverframe-logo" alt="WeaverFrame" width="40" height="40" style="display: block; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background-color: rgba(255,255,255,0.05);" />
                  </td>
                  <td valign="middle">
                    <span style="display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #e5d9c5; font-family: monospace;">NEW PROSPECT INQUIRY</span>
                    <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 19px; font-weight: 700; letter-spacing: 0.5px;">🚀 Private Demo Walkthrough Requested</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Prospect Information Card -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 22px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                A custom builder just requested an executive demonstration of the <strong style="color: #ffffff;">WeaverFrame Autonomous Operating System</strong> from the landing page.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #161720; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); width: 35%; color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Contact Name</td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ffffff; font-size: 14px; font-weight: 600;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Building Company</td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #c9a84c; font-size: 14px; font-weight: 700;">${safeCompany}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Typical Home Price</td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #10b981; font-size: 14px; font-weight: 700;">${safeBuildVolume}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Work Email</td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ffffff; font-size: 14px;"><a href="mailto:${safeEmail}" style="color: #93c5fd; text-decoration: none;">${safeEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Direct Phone</td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ffffff; font-size: 14px;"><a href="tel:${safePhone.replace(/[^0-9+]/g, '')}" style="color: #93c5fd; text-decoration: none;">${safePhone}</a></td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; color: #64748b; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1px;">Requested At</td>
                  <td style="padding: 14px 20px; color: #94a3b8; font-size: 12px;">${timestamp} (CT)</td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${safeDashboardUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #c9a84c; color: #000000; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 14px rgba(201,168,76,0.3);">
                      Open Lead in WeaverFrame &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 36px; background-color: #08090c; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 11px;">
                WeaverFrame Autonomous AI Lead Engine · Automatic Inbound Notification
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

/**
 * Luxury Confirmation Email Dispatched to the Prospect
 */
export function buildUserDemoConfirmationHtml({
  recipientName,
  company,
  buildVolume,
}: {
  recipientName: string;
  company: string;
  buildVolume: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demonstration Confirmation — WeaverFrame</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060608; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060608; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0e0f14; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 36px; background-color: #12131a; border-bottom: 2px solid #e5d9c5;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="52" valign="middle" style="padding-right: 16px;">
                    <img src="cid:weaverframe-logo" alt="WeaverFrame" width="44" height="44" style="display: block; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background-color: rgba(255,255,255,0.05);" />
                  </td>
                  <td valign="middle">
                    <span style="display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #e5d9c5; font-family: monospace;">WHITE-GLOVE ONBOARDING</span>
                    <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 21px; font-weight: 600; letter-spacing: 0.5px;">WeaverFrame Demonstration Request</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 18px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                Dear ${recipientName || 'Builder'},
              </p>
              
              <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 14px; line-height: 1.7;">
                Thank you for requesting a private architectural walkthrough of the <strong style="color: #ffffff;">WeaverFrame Autonomous OS</strong> for <strong style="color: #e5d9c5;">${company}</strong>.
              </p>

              <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 14px; line-height: 1.7;">
                An executive solutions advisor has received your request and will contact you directly within <strong style="color: #ffffff;">2 business hours</strong> to coordinate a private live demonstration tailored to your portfolio (${buildVolume} build volume).
              </p>

              <!-- Session Focus Box -->
              <div style="background-color: #161720; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); padding: 22px 24px; margin-bottom: 28px;">
                <h4 style="margin: 0 0 12px 0; color: #e5d9c5; font-size: 12px; text-transform: uppercase; font-family: monospace; letter-spacing: 1.5px;">What We Will Explore During Your Walkthrough:</h4>
                <ul style="margin: 0; padding-left: 18px; color: #94a3b8; font-size: 13px; line-height: 1.8;">
                  <li><strong style="color: #ffffff;">Autonomous Buyer Qualification:</strong> Live budget, land survey & timeline scoring in under 60 seconds.</li>
                  <li><strong style="color: #ffffff;">Lead Memory Graph:</strong> Persistent architectural preference tracking across multi-turn interactions.</li>
                  <li><strong style="color: #ffffff;">Bi-Directional CRM Sync:</strong> Instant automated synchronization to HubSpot & GoHighLevel.</li>
                </ul>
              </div>

              <!-- Executive Signature -->
              <div style="margin-top: 30px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.08);">
                <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 700;">Executive Advisory Team</p>
                <p style="margin: 3px 0 0 0; color: #64748b; font-size: 12px; font-weight: 500;">WeaverFrame Custom Architecture OS</p>
                <p style="margin: 2px 0 0 0; color: #e5d9c5; font-size: 11px; font-family: monospace;">https://weaverframe.in</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 36px; background-color: #08090c; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 11px; line-height: 1.5;">
                Strict confidentiality. You are receiving this confirmation because a demonstration was requested with this email address.
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

/**
 * Builds a luxury dark-themed HTML password reset email.
 */
export function buildPasswordResetEmailHtml({
  resetUrl,
  recipientEmail,
  displayName,
}: {
  resetUrl: string;
  recipientEmail: string;
  displayName?: string;
}): string {
  const greeting = displayName ? `Hello ${displayName},` : 'Hello,';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WeaverFrame Security — Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0e0f15; border: 1px solid rgba(229, 217, 197, 0.15); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 36px 24px 36px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-family: monospace; letter-spacing: 2px; text-transform: uppercase; color: #e5d9c5; background: rgba(229, 217, 197, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(229, 217, 197, 0.15);">
                      Security Dispatch
                    </span>
                    <h1 style="margin: 14px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                      WeaverFrame Executive Authentication
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                ${greeting}
              </p>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                We received a request to reset the executive access password for your corporate account associated with <strong style="color: #ffffff;">${recipientEmail}</strong>.
              </p>

              <!-- CTA Button -->
              <div style="margin: 32px 0; text-align: center;">
                <a href="${resetUrl}" style="display: inline-block; background: #e5d9c5; color: #0a0a0c; font-size: 13px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(229, 217, 197, 0.3);">
                  Reset Your Password →
                </a>
              </div>

              <!-- Expiry Alert -->
              <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px 20px; margin: 24px 0;">
                <p style="margin: 0; color: #cbd5e1; font-size: 12px; line-height: 1.5;">
                  ⏱️ <strong style="color: #ffffff;">Security Notice:</strong> This authorization link is strictly valid for <strong style="color: #ffffff;">60 minutes</strong>. If you did not initiate this request, you may safely ignore this message — your existing password remains unchanged.
                </p>
              </div>

              <p style="margin: 20px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.5; word-break: break-all;">
                Or copy and paste this URL into your browser:<br>
                <a href="${resetUrl}" style="color: #e5d9c5; text-decoration: underline;">${resetUrl}</a>
              </p>

              <!-- Signature -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
                <p style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600;">WeaverFrame Security Protocols</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px;">Luxury Architecture Operating System</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 36px; background-color: #08090c; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Automated security notification from WeaverFrame System Security.
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

