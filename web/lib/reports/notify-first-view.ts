/**
 * First-view Slack notification.
 *
 * When a client opens a finalised report's dashboard for the first time,
 * fire a Slack message to the configured channel (env
 * SLACK_REPORT_ALERTS_CHANNEL_ID). Subsequent opens by the same or
 * other client users are silent.
 *
 * Atomicity: the SQL UPDATE only sets `first_client_view_at` when it's
 * still NULL. We rely on the resulting rows-affected count to decide
 * whether to fire. Two concurrent first views can't both win — only one
 * UPDATE will hit `WHERE first_client_view_at IS NULL`.
 *
 * Slack channel target: env var `SLACK_REPORT_ALERTS_CHANNEL_ID`. If
 * unset, the helper logs and no-ops — the dashboard view still works.
 *
 * Schema: see scripts/migrations/2026-05-12-client-report-first-view.ts.
 */
import { db } from '../queries/base.js';
import { postSlackMessage } from '../agents/channels/slack.js';

const SLACK_CHANNEL = process.env.SLACK_REPORT_ALERTS_CHANNEL_ID || '';

export interface MarkFirstViewInput {
  reportId: number;
  /** Optional — id/email of the client user who opened it. */
  viewerId?: string;
}

interface ReportContextRow {
  client_name: string | null;
  period_label: string;
}

/**
 * Mark a first view + fire the Slack ping if appropriate. Idempotent —
 * the second call returns immediately.
 */
export async function markFirstClientView(input: MarkFirstViewInput): Promise<void> {
  const { reportId, viewerId = 'unknown' } = input;
  // Atomic conditional update. rowsAffected > 0 means we just set it.
  const result = await db.execute({
    sql: `UPDATE client_reports
             SET first_client_view_at = datetime('now'),
                 first_client_view_by = ?
           WHERE id = ?
             AND first_client_view_at IS NULL`,
    args: [viewerId, reportId],
  });

  if (result.rowsAffected === 0) {
    return; // Already viewed before — silent.
  }

  // Fire the Slack ping. Failures are non-fatal — we don't roll back
  // the first-view marker; the dashboard view still rendered fine.
  if (!SLACK_CHANNEL) {
    console.log('[report-first-view] SLACK_REPORT_ALERTS_CHANNEL_ID not set — skipping ping');
    return;
  }

  // Pull just enough context for a useful message.
  const found = await db.execute({
    sql: `SELECT c.display_name AS client_name, r.period_label
            FROM client_reports r
            JOIN clients c ON c.id = r.client_id
           WHERE r.id = ?`,
    args: [reportId],
  });
  const ctx = (found.rows[0] ?? null) as unknown as ReportContextRow | null;
  if (!ctx) return;

  const text = `📊 *${ctx.client_name ?? 'A client'}* opened their *${ctx.period_label}* report for the first time.`;
  try {
    await postSlackMessage({ channel: SLACK_CHANNEL, text });
  } catch (err) {
    console.error('[report-first-view] Slack post failed:', err);
  }
}
