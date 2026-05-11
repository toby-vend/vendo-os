/**
 * Query helpers for the `client_report_deliveries` audit log.
 *
 * Table is created by A1's foundation migration
 * (scripts/migrations/2026-05-11-gads-autonomous-reports.ts) — see
 * plans/2026-05-11-google-ads-autonomous-reporting.md.
 *
 * Each row is one push attempt for one report on one channel. Channel is
 * 'portal' today; the column is open for future channels (email, slack…).
 */
import { db, rows } from './base.js';

export type DeliveryChannel = 'portal';
export type DeliveryStatus = 'queued' | 'sent' | 'failed';

export interface ReportDeliveryRow {
  id: number;
  report_id: number;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  payload_json: string | null;
  error_msg: string | null;
  sent_at: string | null;
  created_at: string;
}

/**
 * Insert a delivery row. Used by the portal push job to record both
 * successful sends and failures. Returns the new row's id.
 */
export async function recordDelivery(params: {
  reportId: number;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  payloadJson?: string | null;
  errorMsg?: string | null;
  sentAt?: string | null;
}): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO client_report_deliveries
            (report_id, channel, status, payload_json, error_msg, sent_at)
          VALUES (?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      params.reportId,
      params.channel,
      params.status,
      params.payloadJson ?? null,
      params.errorMsg ?? null,
      params.sentAt ?? null,
    ],
  });
  return Number(result.rows[0].id);
}

/**
 * List delivery rows for a given report (most recent first). Used by the
 * editor UI later — exported here so the queries module is the single
 * source of truth for delivery reads.
 */
export async function listDeliveriesForReport(reportId: number): Promise<ReportDeliveryRow[]> {
  return rows<ReportDeliveryRow>(
    `SELECT id, report_id, channel, status, payload_json, error_msg, sent_at, created_at
     FROM client_report_deliveries
     WHERE report_id = ?
     ORDER BY created_at DESC`,
    [reportId],
  );
}

/**
 * Return the IDs of `final` reports that have NOT yet been successfully
 * delivered on the given channel. The push job consumes this list.
 *
 * Idempotency: a report stays in the pending set until at least one
 * `status = 'sent'` row exists in client_report_deliveries for it on
 * this channel. Failed pushes don't block re-attempts.
 */
export async function listReportsPendingDelivery(channel: DeliveryChannel): Promise<number[]> {
  const result = await rows<{ id: number }>(
    `SELECT r.id
     FROM client_reports r
     WHERE r.status = 'final'
       AND NOT EXISTS (
         SELECT 1 FROM client_report_deliveries d
         WHERE d.report_id = r.id
           AND d.channel = ?
           AND d.status = 'sent'
       )
     ORDER BY r.period_start ASC, r.id ASC`,
    [channel],
  );
  return result.map((r) => Number(r.id));
}
