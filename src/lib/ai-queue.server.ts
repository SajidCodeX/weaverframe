import { getDb } from './db';
import { triggerAutonomousAiOutreach, getAiToggleMap } from './dashboard';

/**
 * AI Delayed Reply Queue (Human Cadence & Trust Engine)
 *
 * Implements a natural human response latency (~3.5 to 4.5 minutes, randomized around 4 min)
 * so that AI replies feel like a real architectural advisor reviewing specifications,
 * rather than an instant, impersonal auto-responder.
 *
 * Safety features:
 * 1. Debouncing: Multiple inbound messages from the same lead reset the timer and merge messages.
 * 2. Auto-Mute / Takeover: If a human builder replies in the interim, the pending AI reply is cancelled.
 * 3. Active toggle check: Verifies that AI is still enabled for that lead before dispatching.
 */

interface QueuedAiReply {
  leadId: string;
  builderId: string;
  userMessage: string;
  queuedAt: number;
  scheduledDispatchTime: number;
  timer: NodeJS.Timeout;
}

const pendingAiReplies = new Map<string, QueuedAiReply>();

/**
 * Queue an autonomous AI reply with human-like latency (~3.5 to 4.5 minutes).
 */
export function queueDelayedAiReply(
  leadId: string,
  builderId: string,
  userMessage: string,
  minMinutes: number = 3.5,
  maxMinutes: number = 4.5
): { success: boolean; delaySeconds: number; scheduledFor: Date } {
  // If a reply is already queued for this lead, cancel the previous timer and merge messages
  let combinedMessage = userMessage;
  if (pendingAiReplies.has(leadId)) {
    const existing = pendingAiReplies.get(leadId)!;
    clearTimeout(existing.timer);
    combinedMessage = `${existing.userMessage}\n\n[Follow-up]: ${userMessage}`;
    console.log(`[AI QUEUE] Debouncing multiple messages for lead ${leadId}. Timer reset.`);
  }

  // Calculate natural jittered delay (e.g. 210s - 270s ~ 3.5m - 4.5m)
  const minMs = minMinutes * 60 * 1000;
  const maxMs = maxMinutes * 60 * 1000;
  const delayMs = Math.floor(minMs + Math.random() * (maxMs - minMs));
  const delaySeconds = Math.round(delayMs / 1000);
  const now = Date.now();
  const scheduledDispatchTime = now + delayMs;
  const scheduledFor = new Date(scheduledDispatchTime);

  const timer = setTimeout(async () => {
    try {
      console.log(`[AI QUEUE] Timer expired for lead ${leadId}. Verifying safety before dispatch...`);
      pendingAiReplies.delete(leadId);

      const db = await getDb();

      // 1. Check if AI toggle is still enabled for this lead
      const toggleMap = await getAiToggleMap().catch(() => ({}));
      if (toggleMap && toggleMap[leadId] === false) {
        console.log(`[AI QUEUE] AI toggle is disabled for lead ${leadId}. Cancelling outreach.`);
        return;
      }

      // 2. Check if human builder sent any manual message since this reply was queued
      const recentHumanMessage = await db.message.findFirst({
        where: {
          leadId,
          sender: 'user',
          createdAt: { gte: new Date(now) },
        },
      });

      if (recentHumanMessage) {
        console.log(`[AI QUEUE] Human builder took over conversation for lead ${leadId}. Auto-muting AI reply.`);
        return;
      }

      // 3. Dispatch the autonomous outreach
      console.log(`[AI QUEUE] Dispatching authentic AI reply to lead ${leadId} after ${delaySeconds}s human delay.`);
      await triggerAutonomousAiOutreach(leadId, builderId, combinedMessage);
    } catch (err) {
      console.error(`[AI QUEUE DISPATCH ERROR for lead ${leadId}]:`, err);
    }
  }, delayMs);

  pendingAiReplies.set(leadId, {
    leadId,
    builderId,
    userMessage: combinedMessage,
    queuedAt: now,
    scheduledDispatchTime,
    timer,
  });

  console.log(`[AI QUEUE] Reply queued for lead ${leadId} in ${delaySeconds}s (${scheduledFor.toLocaleTimeString()}).`);
  return { success: true, delaySeconds, scheduledFor };
}

/**
 * Cancel any pending AI reply for a lead (e.g. when human sends a message).
 */
export function cancelPendingAiReply(leadId: string, reason: string = 'Cancelled'): boolean {
  if (pendingAiReplies.has(leadId)) {
    const item = pendingAiReplies.get(leadId)!;
    clearTimeout(item.timer);
    pendingAiReplies.delete(leadId);
    console.log(`[AI QUEUE] Cancelled queued reply for lead ${leadId}. Reason: ${reason}`);
    return true;
  }
  return false;
}

/**
 * Check if an AI response is currently queued for a lead.
 */
export function isAiReplyQueued(leadId: string): boolean {
  return pendingAiReplies.has(leadId);
}
