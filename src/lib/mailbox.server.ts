import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Strips quoted history and signature noise from reply emails
 * (e.g. "On Tue, 25 Aug 2026 at 5:21 PM wrote: ...", lines starting with ">", etc.)
 */
export function stripEmailQuotedHistory(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Stop at common reply headers
    if (/^On\s+.+wrote:$/i.test(trimmed)) break;
    if (/^On\s+.+<.+>\s*wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(trimmed)) break;
    if (/^_{2,}/.test(trimmed)) break;
    if (trimmed.startsWith('>')) continue; // skip blockquotes
    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

// In-memory throttle map: prevents the 2.5s UI poller from hammering IMAP.
// Minimum 120 seconds (2 min) between real IMAP connections per builder.
// `force=true` bypasses this (used by the manual "Sync" button only).
const lastSyncTimeMap = new Map<string, number>();
const IMAP_THROTTLE_MS = 120_000; // 2 minutes

/**
 * Syncs incoming emails from the Builder's linked Gmail / Google Workspace inbox
 * via IMAP (`imap.gmail.com:993`). Matches sender emails against existing leads in DB.
 */
export async function syncInboundMailbox(builderId?: string, force = false): Promise<{ success: boolean; synced: number; error?: string }> {
  const { getDb } = await import('./db');
  const db = await getDb();

  try {
    // 1. Resolve Target Builder (if not passed, find builder with linked mailbox or active builder)
    let targetBuilderId = builderId;
    if (!targetBuilderId) {
      const mailboxIntegration = await db.integration.findFirst({
        where: { platformId: 'email_mailbox', isConnected: true },
        select: { builderId: true }
      });
      targetBuilderId = mailboxIntegration?.builderId;
    }

    if (!targetBuilderId) {
      return { success: false, synced: 0, error: 'No active builder ID found for mailbox sync.' };
    }

    // 2. Throttle: at most once per IMAP_THROTTLE_MS per builder, unless forced
    const now = Date.now();
    const lastSync = lastSyncTimeMap.get(targetBuilderId) || 0;
    if (!force && now - lastSync < IMAP_THROTTLE_MS) {
      return { success: true, synced: 0 };
    }
    lastSyncTimeMap.set(targetBuilderId, now);

    // 3. Resolve Mailbox Credentials (from Settings Integration or Environment Variables)
    let emailUser = '';
    let emailPass = '';
    let emailHost = 'imap.gmail.com';
    let emailPort = 993;

    // Check Integration table
    const integration = await db.integration.findFirst({
      where: {
        builderId: targetBuilderId,
        platformId: 'email_mailbox',
        isConnected: true,
      }
    });

    if (integration && integration.configSecure) {
      try {
        const { decrypt } = await import('./crypto');
        const creds = JSON.parse(decrypt(integration.configSecure));
        emailUser = creds.email || creds.username || '';
        emailPass = creds.password || '';
        if (creds.provider === 'custom_smtp' && creds.smtpHost) {
          emailHost = creds.smtpHost.replace(/^smtp\./i, 'imap.');
        }
      } catch (e) {
        console.warn('[IMAP SYNC] Could not decrypt integration credentials, trying fallback:', e);
      }
    }

    // Fallback to Environment Variables (SMTP_USER & SMTP_PASS)
    if (!emailUser || !emailPass || emailPass === '••••••••••••••••') {
      emailUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
      emailPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';
    }

    if (!emailUser || !emailPass) {
      return { success: false, synced: 0, error: 'No email credentials configured for mailbox sync.' };
    }

    const cleanPass = emailPass.replace(/\s+/g, '').trim();

    // 4. Fetch all active Leads for this builder with emails
    const leads = await db.lead.findMany({
      where: {
        builderId: targetBuilderId,
        email: { not: null }
      },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    if (leads.length === 0) {
      return { success: true, synced: 0 };
    }

    const leadEmailMap = new Map<string, typeof leads[0]>();
    for (const l of leads) {
      if (l.email) {
        leadEmailMap.set(l.email.trim().toLowerCase(), l);
      }
    }

    // 5. Connect to IMAP Server
    const client = new ImapFlow({
      host: emailHost,
      port: emailPort,
      secure: true,
      auth: {
        user: emailUser.trim(),
        pass: cleanPass,
      },
      logger: false,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    await client.connect();

    let newSyncedCount = 0;
    const lock = await client.getMailboxLock('INBOX');

    try {
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        // Inspect the latest 25 messages in INBOX
        const startSeq = Math.max(1, totalMessages - 25);
        const range = `${startSeq}:*`;

        for await (const message of client.fetch(range, { envelope: true, source: true })) {
          const fromAddress = message.envelope?.from?.[0]?.address?.toLowerCase();
          if (!fromAddress || !leadEmailMap.has(fromAddress)) {
            continue;
          }

          const matchedLead = leadEmailMap.get(fromAddress)!;
          const parsed = await simpleParser(message.source);
          const rawBody = parsed.text || '';
          const cleanBody = stripEmailQuotedHistory(rawBody);

          if (!cleanBody || cleanBody.length === 0) {
            continue;
          }

          const mailDate = message.envelope?.date || new Date();

          // Deduplication: Check if message content already exists in DB for this lead
          const existing = await db.message.findFirst({
            where: {
              leadId: matchedLead.id,
              sender: 'lead',
              content: cleanBody,
            }
          });

          if (!existing) {
            // A. Insert Inbound Message from Lead into DB
            await db.message.create({
              data: {
                builderId: targetBuilderId,
                leadId: matchedLead.id,
                sender: 'lead',
                content: cleanBody,
                channel: 'portal',
                isRead: false,
                createdAt: mailDate,
              }
            });

            // B. Log Timeline Activity
            await db.activity.create({
              data: {
                builderId: targetBuilderId,
                leadId: matchedLead.id,
                action: `📬 Inbound Email Reply received from ${matchedLead.name || fromAddress}: "${cleanBody.slice(0, 80)}..."`,
                createdAt: mailDate,
              }
            });

            // C. Trigger Autonomous AI Reply
            const { getAiToggleMap, triggerAutonomousAiOutreach } = await import('./dashboard');
            const { invalidateCache } = await import('./cache');
            const aiToggleMap = await getAiToggleMap().catch(() => ({}));
            const isAiActive = aiToggleMap[matchedLead.id] !== false; // Default active

            if (isAiActive) {
              triggerAutonomousAiOutreach(matchedLead.id, targetBuilderId, cleanBody).catch((err) => {
                console.error('[IMAP SYNC AI AUTO-REPLY ERROR]:', err);
              });
            }

            invalidateCache("dashboard_");
            newSyncedCount++;
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return { success: true, synced: newSyncedCount };
  } catch (err: any) {
    console.error('[INBOUND MAILBOX SYNC ERROR]:', err?.message || err);
    return { success: false, synced: 0, error: err?.message || 'Failed to sync mailbox' };
  }
}
