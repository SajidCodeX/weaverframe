/**
 * Centralized Operational Alerting System
 *
 * Captures, buffers, and dispatches critical operational events (provider failures,
 * queue dropouts, booking collision errors, and takeover tracking).
 */

export type AlertType =
  | 'provider_failure'
  | 'queue_failure'
  | 'booking_failure'
  | 'takeover_failure'
  | 'database_failure';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertEvent {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  error?: string | Error;
  builderId?: string;
  leadId?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

// In-memory ring buffer of the last 100 alerts for observability & health diagnostics
const RECENT_ALERTS: AlertEvent[] = [];
const MAX_ALERT_BUFFER = 100;

export function getRecentAlerts(): AlertEvent[] {
  return [...RECENT_ALERTS];
}

export function clearAlertBufferForTesting(): void {
  RECENT_ALERTS.length = 0;
}

/**
 * Dispatch an operational alert.
 */
export async function sendAlert(event: AlertEvent): Promise<void> {
  const alert: AlertEvent = {
    ...event,
    timestamp: event.timestamp || new Date(),
    error: event.error instanceof Error ? event.error.message : event.error,
  };

  // 1. Buffer alert in memory
  RECENT_ALERTS.unshift(alert);
  if (RECENT_ALERTS.length > MAX_ALERT_BUFFER) {
    RECENT_ALERTS.pop();
  }

  // 2. Structured console log
  const prefix = `[${alert.severity.toUpperCase()} ALERT] [${alert.type.toUpperCase()}]`;
  if (alert.severity === 'critical') {
    console.error(`🚨 ${prefix} ${alert.title}: ${alert.message}`, alert.error || '', alert.metadata || '');
  } else if (alert.severity === 'warning') {
    console.warn(`⚠️ ${prefix} ${alert.title}: ${alert.message}`, alert.error || '');
  } else {
    console.log(`ℹ️ ${prefix} ${alert.title}: ${alert.message}`);
  }

  // 3. Optional external webhook dispatch (Slack / Discord / Datadog)
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*${prefix}*: ${alert.title}\n> ${alert.message}\n${alert.error ? '`' + alert.error + '`' : ''}`,
          alert,
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (webhookErr) {
      console.warn('[ALERTING] Failed to forward alert to external webhook:', webhookErr);
    }
  }

  // 4. Record to Database Activity if DB and builderId are present
  if (alert.builderId) {
    try {
      const { getDb } = await import('./db.server');
      const db = await getDb();
      await db.activity.create({
        data: {
          builderId: alert.builderId,
          leadId: alert.leadId || null,
          action: `🚨 [SYSTEM ALERT]: ${alert.title} — ${alert.message.slice(0, 120)}`,
        },
      });
    } catch {
      // Avoid recursive failure if DB is down
    }
  }
}
