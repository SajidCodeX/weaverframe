import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Strips quoted history and signature noise from reply emails
 * (e.g. "On Tue, 25 Aug 2026 at 5:21 PM wrote: ...", lines starting with ">", etc.)
 */
export function stripEmailQuotedHistory(text: string): string {
  if (!text) return '';

  // 1. Strip embedded "On <Day>, <Date>..." reply headers anywhere in the body
  let cleaned = text.replace(/\s*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+[A-Za-z]+\s+\d+[\s\S]*/i, '');
  cleaned = cleaned.replace(/\s*On\s+[\s\S]+?wrote:[\s\S]*/i, '');
  cleaned = cleaned.replace(/\s*-{2,}\s*Original Message\s*-{2,}[\s\S]*/i, '');
  cleaned = cleaned.replace(/\s*_{2,}[\s\S]*/i, '');
  cleaned = cleaned.replace(/\s*From:\s*.+[\r\n]+Sent:\s*.+[\s\S]*/i, '');

  const lines = cleaned.split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Stop at common reply headers
    if (/^On\s+.+wrote:?/i.test(trimmed)) break;
    if (/^On\s+.+<.+>/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message/i.test(trimmed)) break;
    if (/^_{2,}/.test(trimmed)) break;
    if (trimmed.startsWith('>')) continue; // skip blockquotes
    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

// Fast IMAP sync throttle: checks every 10 seconds (down from 2 minutes)
// Gives snappy, near real-time email arrival matching Gmail.
const lastSyncTimeMap = new Map<string, number>();
const IMAP_THROTTLE_MS = 10_000; // 10 seconds

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
        let raw = integration.configSecure;
        try {
          raw = decrypt(integration.configSecure);
        } catch {
          // Already plain JSON or raw
        }
        const config = JSON.parse(raw);
        emailUser = config.email || config.username || config.user || '';
        emailPass = config.password || config.pass || '';
        if (config.provider === 'custom_smtp' && config.smtpHost) {
          emailHost = config.smtpHost.replace(/^smtp\./i, 'imap.');
        } else if (config.host) {
          emailHost = config.host;
        }
        if (config.port) emailPort = Number(config.port);
      } catch (e) {
        console.warn('[MAILBOX SYNC] Could not parse integration configSecure:', e);
      }
    }

    // Fallback to environment variables if integration table does not have credentials
    if (!emailUser || !emailPass) {
      emailUser = process.env.IMAP_USER || process.env.SMTP_USER || '';
      emailPass = process.env.IMAP_PASS || process.env.SMTP_PASS || '';
      emailHost = process.env.IMAP_HOST || 'imap.gmail.com';
      emailPort = Number(process.env.IMAP_PORT) || 993;
    }

    if (!emailUser || !emailPass) {
      return { success: false, synced: 0, error: 'No mailbox credentials configured (IMAP_USER / IMAP_PASS missing).' };
    }

    // Strip any spaces from app password (common copy-paste error with Google 16-character app passwords)
    const cleanPass = emailPass.replace(/\s+/g, '');

    // 4. Fetch all active lead emails for this builder for in-memory O(1) matching
    const leads = await db.lead.findMany({
      where: {
        builderId: targetBuilderId,
        email: { not: null },
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

    // 5. Connect to IMAP Server with fast timeouts
    const client = new ImapFlow({
      host: emailHost,
      port: emailPort,
      secure: true,
      auth: {
        user: emailUser.trim(),
        pass: cleanPass,
      },
      logger: false,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    });

    client.on('error', (err: any) => {
      console.warn('[IMAP CLIENT BACKGROUND ERROR]:', err?.message || err);
    });

    await client.connect();

    let newSyncedCount = 0;
    const lock = await client.getMailboxLock('INBOX');

    try {
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        // Inspect the latest 15 messages in INBOX
        const startSeq = Math.max(1, totalMessages - 15);
        const range = `${startSeq}:*`;

        // 1. Ultra-fast header pass: fetch ONLY envelope + uid (0 payload download)
        const matchedItems: { uid: number; fromAddress: string; matchedLead: any; envelope: any }[] = [];
        for await (const message of client.fetch(range, { envelope: true, uid: true })) {
          const fromAddress = message.envelope?.from?.[0]?.address?.toLowerCase();
          if (fromAddress && leadEmailMap.has(fromAddress)) {
            matchedItems.push({
              uid: message.uid,
              fromAddress,
              matchedLead: leadEmailMap.get(fromAddress)!,
              envelope: message.envelope,
            });
          }
        }

        // 2. Fetch full body ONLY for messages from matched leads
        for (const item of matchedItems) {
          const fullMsg = await client.fetchOne(String(item.uid), { source: true }, { uid: true });
          if (!fullMsg || !fullMsg.source) continue;

          const parsed = (await simpleParser(fullMsg.source as any)) as any;
          const rawBody = parsed?.text || '';
          const cleanBody = stripEmailQuotedHistory(rawBody);

          if (!cleanBody || cleanBody.length === 0) {
            continue;
          }

          const mailDate = item.envelope?.date || new Date();

          // Deduplication: Check if message content already exists in DB for this lead
          const existing = await db.message.findFirst({
            where: {
              leadId: item.matchedLead.id,
              sender: 'lead',
              content: cleanBody,
            }
          });

          if (!existing) {
            // A. Insert Inbound Message from Lead into DB
            await db.message.create({
              data: {
                builderId: targetBuilderId,
                leadId: item.matchedLead.id,
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
                leadId: item.matchedLead.id,
                action: `📬 Inbound Email Reply received from ${item.matchedLead.name || item.fromAddress}: "${cleanBody.slice(0, 80)}..."`,
                createdAt: mailDate,
              }
            });

            // C. Queue Autonomous AI Reply with Human Latency (~3.5 to 4.5 min)
            const { getAiToggleMap } = await import('./dashboard');
            const { queueDelayedAiReply } = await import('./ai-queue.server');
            const { invalidateCache } = await import('./cache');
            const aiToggleMap = await getAiToggleMap().catch(() => ({}));
            const isAiActive = aiToggleMap[item.matchedLead.id] !== false; // Default active

            if (isAiActive) {
              const queueRes = queueDelayedAiReply(item.matchedLead.id, targetBuilderId, cleanBody);
              const minutes = (queueRes.delaySeconds / 60).toFixed(1);
              await db.activity.create({
                data: {
                  builderId: targetBuilderId,
                  leadId: item.matchedLead.id,
                  action: `⏳ AI response queued (~${minutes} min authentic delay to preserve human trust).`,
                }
              }).catch(() => {});
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
