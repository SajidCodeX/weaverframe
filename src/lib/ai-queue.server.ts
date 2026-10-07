import { getDb } from './db.server';
import { triggerAutonomousAiOutreach, getAiToggleMap } from './dashboard';
import { sendAlert } from './alerting';

/**
 * AI Delayed Reply Queue (Persistent Database-Backed Engine)
 *
 * Persists all scheduled replies to PostgreSQL (ScheduledAiReply table)
 * to guarantee zero lost replies across server restarts, redeploys, or multi-instance scaling.
 *
 * Features:
 * 1. Database Durability: Survived server restarts, redeploys, and container recycling.
 * 2. Concurrency Safety: Atomic state locking (pending -> processing) prevents duplicate dispatches.
 * 3. Human Takeover Safety: Automatically cancelled if a human message is detected.
 * 4. Debouncing: Multiple inbound messages from the same lead merge and reset the schedule window.
 * 5. Operational Alerting: Dispatches alerts on repeated processing or dispatch errors.
 */

// In-memory debounce / active timer cache for sub-second responses
const inMemoryTimers = new Map<string, NodeJS.Timeout>();

/**
 * Queue an autonomous AI reply with human-like latency (~3.5 to 4.5 minutes),
 * persisted durably to the database.
 */
export async function queueDelayedAiReply(
  leadId: string,
  builderId: string,
  userMessage: string,
  minMinutes: number = 3.5,
  maxMinutes: number = 4.5
): Promise<{ success: boolean; delaySeconds: number; scheduledFor: Date; jobId: string }> {
  const minMs = minMinutes * 60 * 1000;
  const maxMs = maxMinutes * 60 * 1000;
  const delayMs = Math.floor(minMs + Math.random() * (maxMs - minMs));
  const delaySeconds = Math.round(delayMs / 1000);
  const now = Date.now();
  const scheduledFor = new Date(now + delayMs);

  const db = await getDb();

  // Clear any existing in-memory timer
  if (inMemoryTimers.has(leadId)) {
    clearTimeout(inMemoryTimers.get(leadId)!);
    inMemoryTimers.delete(leadId);
  }

  // 1. Check if there is already a pending DB record for this lead (Debounce)
  const existingJob = await db.scheduledAiReply.findFirst({
    where: { leadId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  let jobId: string;
  let finalMessage = userMessage;

  if (existingJob) {
    let existingPayload: any = {};
    try {
      existingPayload = JSON.parse(existingJob.payload);
    } catch {}

    finalMessage = `${existingPayload.userMessage || ''}\n\n[Follow-up]: ${userMessage}`.trim();

    await db.scheduledAiReply.update({
      where: { id: existingJob.id },
      data: {
        scheduledFor,
        payload: JSON.stringify({ userMessage: finalMessage, debouncedAt: new Date().toISOString() }),
        updatedAt: new Date(),
      },
    });

    jobId = existingJob.id;
    console.log(`[AI QUEUE DB] Debounced existing job ${jobId} for lead ${leadId}. Rescheduled for ${scheduledFor.toLocaleTimeString()}.`);
  } else {
    // 2. Create new persistent DB job
    const newJob = await db.scheduledAiReply.create({
      data: {
        builderId,
        leadId,
        scheduledFor,
        status: 'pending',
        payload: JSON.stringify({ userMessage, queuedAt: new Date().toISOString() }),
      },
    });

    jobId = newJob.id;
    console.log(`[AI QUEUE DB] Persisted new scheduled reply job ${jobId} for lead ${leadId} (dispatch: ${scheduledFor.toLocaleTimeString()}).`);
  }

  // Set lightweight in-memory timer to trigger immediate processing when due
  const timer = setTimeout(async () => {
    inMemoryTimers.delete(leadId);
    await processScheduledReplyJob(jobId).catch((err) => {
      console.error(`[AI QUEUE] Error in timeout job execution for ${jobId}:`, err);
    });
  }, delayMs);

  inMemoryTimers.set(leadId, timer);

  return { success: true, delaySeconds, scheduledFor, jobId };
}

/**
 * Process a specific scheduled reply job with atomic locking and pre-dispatch validation.
 */
export async function processScheduledReplyJob(jobId: string): Promise<boolean> {
  const db = await getDb();

  // Atomic state lock: only transition if status is still 'pending'
  const lockResult = await db.scheduledAiReply.updateMany({
    where: { id: jobId, status: 'pending' },
    data: { status: 'processing', updatedAt: new Date() },
  });

  if (lockResult.count === 0) {
    // Already processed, cancelled, or handled by another instance
    return false;
  }

  const job = await db.scheduledAiReply.findUnique({ where: { id: jobId } });
  if (!job) return false;

  try {
    let payload: { userMessage: string } = { userMessage: '' };
    try {
      payload = JSON.parse(job.payload);
    } catch {}

    // Safety Check 1: AI Toggle active?
    const toggleMap = await getAiToggleMap().catch(() => ({}));
    if (toggleMap && toggleMap[job.leadId] === false) {
      console.log(`[AI QUEUE DB] AI toggle is OFF for lead ${job.leadId}. Cancelling job ${jobId}.`);
      await db.scheduledAiReply.update({
        where: { id: jobId },
        data: { status: 'cancelled', cancelledAt: new Date(), lastError: 'AI toggle disabled' },
      });
      return false;
    }

    // Safety Check 2: Human takeover? Check if human builder sent message since job creation
    const humanMessage = await db.message.findFirst({
      where: {
        leadId: job.leadId,
        sender: 'user',
        createdAt: { gte: job.createdAt },
      },
    });

    if (humanMessage) {
      console.log(`[AI QUEUE DB] Human builder takeover detected for lead ${job.leadId}. Cancelling job ${jobId}.`);
      await db.scheduledAiReply.update({
        where: { id: jobId },
        data: { status: 'cancelled', cancelledAt: new Date(), lastError: 'Human builder takeover' },
      });
      return false;
    }

    // Dispatch autonomous reply
    console.log(`[AI QUEUE DB] Dispatching autonomous AI outreach for job ${jobId} (lead: ${job.leadId})...`);
    await triggerAutonomousAiOutreach(job.leadId, job.builderId, payload.userMessage);

    // Mark as sent
    await db.scheduledAiReply.update({
      where: { id: jobId },
      data: { status: 'sent', sentAt: new Date() },
    });

    console.log(`[AI QUEUE DB] Job ${jobId} successfully sent.`);
    return true;
  } catch (err: any) {
    const nextAttempts = (job.attempts || 0) + 1;
    const isFinalFailure = nextAttempts >= 3;

    console.error(`[AI QUEUE DB ERROR] Job ${jobId} attempt ${nextAttempts} failed:`, err?.message || err);

    await db.scheduledAiReply.update({
      where: { id: jobId },
      data: {
        status: isFinalFailure ? 'failed' : 'pending',
        attempts: nextAttempts,
        lastError: err?.message || String(err),
        scheduledFor: isFinalFailure ? job.scheduledFor : new Date(Date.now() + 60 * 1000), // Retry in 60s
      },
    });

    if (isFinalFailure) {
      await sendAlert({
        type: 'queue_failure',
        severity: 'critical',
        title: 'Scheduled AI Reply Failed',
        message: `Persistent AI reply for lead ${job.leadId} failed after 3 attempts.`,
        error: err,
        builderId: job.builderId,
        leadId: job.leadId,
        metadata: { jobId },
      });
    }

    return false;
  }
}

/**
 * Worker / Poller: Process all due pending jobs from the database.
 * Recovers jobs after server restarts, redeploys, or cold boots.
 */
export async function processDueScheduledReplies(): Promise<number> {
  try {
    const db = await getDb();
    const now = new Date();

    // Fetch up to 20 due pending jobs
    const dueJobs = await db.scheduledAiReply.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: now },
      },
      take: 20,
      orderBy: { scheduledFor: 'asc' },
    });

    if (dueJobs.length === 0) return 0;

    console.log(`[AI QUEUE WORKER] Found ${dueJobs.length} due scheduled reply job(s) in DB. Processing...`);
    let processedCount = 0;

    for (const job of dueJobs) {
      const success = await processScheduledReplyJob(job.id);
      if (success) processedCount++;
    }

    return processedCount;
  } catch (err: any) {
    console.error('[AI QUEUE WORKER ERROR] Failed to query or process due replies:', err?.message || err);
    return 0;
  }
}

/**
 * Cancel any pending scheduled AI replies for a lead (e.g. human takeover or toggle off).
 */
export async function cancelPendingAiReply(leadId: string, reason: string = 'Cancelled by human takeover'): Promise<number> {
  // 1. Clear in-memory timer
  if (inMemoryTimers.has(leadId)) {
    clearTimeout(inMemoryTimers.get(leadId)!);
    inMemoryTimers.delete(leadId);
  }

  // 2. Cancel in persistent DB
  try {
    const db = await getDb();
    const result = await db.scheduledAiReply.updateMany({
      where: { leadId, status: 'pending' },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        lastError: reason,
      },
    });

    if (result.count > 0) {
      console.log(`[AI QUEUE DB] Cancelled ${result.count} pending scheduled job(s) for lead ${leadId}. Reason: ${reason}`);
    }
    return result.count;
  } catch (err: any) {
    console.error(`[AI QUEUE DB] Failed to cancel pending replies for lead ${leadId}:`, err);
    return 0;
  }
}

/**
 * Check if a reply is currently queued / pending in DB for a lead.
 */
export async function isAiReplyQueued(leadId: string): Promise<boolean> {
  if (inMemoryTimers.has(leadId)) return true;
  try {
    const db = await getDb();
    const count = await db.scheduledAiReply.count({
      where: { leadId, status: 'pending' },
    });
    return count > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Background Queue Poller (15s interval)
// ─────────────────────────────────────────────────────────────
let pollerInterval: NodeJS.Timeout | null = null;

export function startAiQueuePoller(intervalMs: number = 15000): void {
  if (pollerInterval) return;
  pollerInterval = setInterval(() => {
    processDueScheduledReplies().catch((err) => {
      console.warn('[AI QUEUE POLLER] Interval error:', err?.message || err);
    });
  }, intervalMs);
  pollerInterval.unref();
  console.log(`[AI QUEUE] Background persistent queue poller active (${intervalMs / 1000}s interval).`);
}

// Auto-start poller on module load if in server environment
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  startAiQueuePoller();
}
