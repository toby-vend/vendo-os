/**
 * Query helpers for the Client Reporting module.
 *
 * Tables: client_reports, client_report_screenshots
 * (created by scripts/migrations/2026-05-05-client-reports.ts)
 */
import { db, rows, scalar } from './base.js';

export type ReportStatus = 'draft' | 'review' | 'final';

export type ScreenshotPlatform =
  | 'google_ads'
  | 'meta'
  | 'ga4'
  | 'gsc'
  | 'ghl'
  | 'tiktok'
  | 'linkedin'
  | 'bing'
  | 'pinterest'
  | 'email'
  | 'other';

export const PLATFORM_OPTIONS: { value: ScreenshotPlatform; label: string }[] = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'ga4', label: 'GA4' },
  { value: 'gsc', label: 'Search Console' },
  { value: 'ghl', label: 'GoHighLevel' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
  { value: 'bing', label: 'Bing / Microsoft Ads' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export interface ClientReportRow {
  id: number;
  client_id: number;
  client_name: string;
  client_display_name: string | null;
  client_vertical: string | null;
  period_label: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  contact_name: string;
  contact_email: string | null;
  worked_on_md: string;
  focus_next_md: string;
  exec_summary_md: string;
  performance_summary_md: string;
  wins_md: string;
  risks_md: string;
  recommendations_md: string;
  ai_generated_at: string | null;
  gads_summary_json: string | null;
  narrative_draft_md: string | null;
  submitted_for_review_at: string | null;
  submitted_for_review_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportListRow {
  id: number;
  client_id: number;
  client_name: string;
  client_display_name: string | null;
  period_label: string;
  period_start: string;
  period_end: string;
  status: ReportStatus;
  ai_generated_at: string | null;
  submitted_for_review_at: string | null;
  submitted_for_review_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  screenshot_count: number;
  created_by: string;
  updated_at: string;
}

export interface ScreenshotRow {
  id: number;
  report_id: number;
  platform: ScreenshotPlatform;
  caption: string;
  blob_url: string;
  blob_pathname: string;
  position: number;
  source: 'manual' | 'api';
  width: number | null;
  height: number | null;
  created_at: string;
}

const REPORT_SELECT = `
  SELECT r.id, r.client_id,
         c.name AS client_name, c.display_name AS client_display_name,
         c.vertical AS client_vertical,
         r.period_label, r.period_start, r.period_end, r.status,
         r.contact_name, r.contact_email,
         r.worked_on_md, r.focus_next_md,
         r.exec_summary_md, r.performance_summary_md,
         r.wins_md, r.risks_md, r.recommendations_md,
         r.ai_generated_at,
         r.gads_summary_json, r.narrative_draft_md,
         r.submitted_for_review_at, r.submitted_for_review_by,
         r.approved_at, r.approved_by,
         r.created_by, r.created_at, r.updated_at
  FROM client_reports r
  JOIN clients c ON c.id = r.client_id
`;

// --- Reads ---

export async function listReports(opts: {
  clientId?: number;
  status?: ReportStatus;
  limit?: number;
} = {}): Promise<ReportListRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.clientId) { where.push('r.client_id = ?'); args.push(opts.clientId); }
  if (opts.status) { where.push('r.status = ?'); args.push(opts.status); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = opts.limit ?? 200;

  return rows<ReportListRow>(`
    SELECT r.id, r.client_id,
           c.name AS client_name, c.display_name AS client_display_name,
           r.period_label, r.period_start, r.period_end, r.status,
           r.ai_generated_at,
           r.submitted_for_review_at, r.submitted_for_review_by,
           r.approved_at, r.approved_by,
           (SELECT COUNT(*) FROM client_report_screenshots s WHERE s.report_id = r.id) AS screenshot_count,
           r.created_by, r.updated_at
    FROM client_reports r
    JOIN clients c ON c.id = r.client_id
    ${whereSql}
    ORDER BY r.period_start DESC, r.updated_at DESC
    LIMIT ?
  `, [...args, limit]);
}

/**
 * Reports currently awaiting AM approval (status='review'). Used by the
 * review-queue filter in the list view and the "needs review" badge.
 */
export async function listReviewQueue(): Promise<ReportListRow[]> {
  return listReports({ status: 'review' });
}

export async function getReport(id: number): Promise<ClientReportRow | null> {
  const result = await rows<ClientReportRow>(
    `${REPORT_SELECT} WHERE r.id = ? LIMIT 1`,
    [id],
  );
  return result[0] ?? null;
}

export async function listScreenshots(reportId: number): Promise<ScreenshotRow[]> {
  return rows<ScreenshotRow>(
    `SELECT id, report_id, platform, caption, blob_url, blob_pathname,
            position, source, width, height, created_at
     FROM client_report_screenshots
     WHERE report_id = ?
     ORDER BY position ASC, id ASC`,
    [reportId],
  );
}

// --- Writes ---

export async function createReport(params: {
  clientId: number;
  periodLabel: string;
  periodStart: string;   // YYYY-MM-DD
  periodEnd: string;     // YYYY-MM-DD
  createdBy: string;
}): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO client_reports
            (client_id, period_label, period_start, period_end, created_by)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id`,
    args: [params.clientId, params.periodLabel, params.periodStart, params.periodEnd, params.createdBy],
  });
  return Number(result.rows[0].id);
}

export async function findReport(clientId: number, periodStart: string, periodEnd: string): Promise<number | null> {
  const id = await scalar<number>(
    `SELECT id FROM client_reports
     WHERE client_id = ? AND period_start = ? AND period_end = ?`,
    [clientId, periodStart, periodEnd],
  );
  return id ?? null;
}

export async function updateNarrative(id: number, params: {
  workedOnMd?: string;
  focusNextMd?: string;
  contactName?: string;
}): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (params.workedOnMd !== undefined) { sets.push('worked_on_md = ?'); args.push(params.workedOnMd); }
  if (params.focusNextMd !== undefined) { sets.push('focus_next_md = ?'); args.push(params.focusNextMd); }
  if (params.contactName !== undefined) { sets.push('contact_name = ?'); args.push(params.contactName.slice(0, 100)); }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  args.push(id);
  await db.execute({
    sql: `UPDATE client_reports SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function updateAiBlocks(id: number, params: {
  execSummaryMd: string;
  performanceSummaryMd: string;
  winsMd: string;
  risksMd: string;
  recommendationsMd: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports SET
            exec_summary_md = ?,
            performance_summary_md = ?,
            wins_md = ?,
            risks_md = ?,
            recommendations_md = ?,
            ai_generated_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?`,
    args: [params.execSummaryMd, params.performanceSummaryMd, params.winsMd, params.risksMd, params.recommendationsMd, id],
  });
}

export type AiBlockField =
  | 'exec_summary_md'
  | 'performance_summary_md'
  | 'wins_md'
  | 'risks_md'
  | 'recommendations_md';

export async function updateAiBlock(id: number, field: AiBlockField, value: string): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [value, id],
  });
}

export async function setStatus(id: number, status: ReportStatus): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [status, id],
  });
}

class ReportStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportStatusError';
  }
}

async function getStatusOrThrow(id: number): Promise<ReportStatus> {
  const current = await scalar<string>(
    'SELECT status FROM client_reports WHERE id = ?',
    [id],
  );
  if (!current) throw new ReportStatusError(`Report ${id} not found`);
  return current as ReportStatus;
}

/**
 * Move a draft into the review queue. Records who submitted and when so the
 * AM inbox shows accountability.
 */
export async function submitForReview(reportId: number, submittedBy: string): Promise<void> {
  const current = await getStatusOrThrow(reportId);
  if (current !== 'draft') {
    throw new ReportStatusError(
      `Report ${reportId} is ${current}, expected 'draft' to submit for review`,
    );
  }
  await db.execute({
    sql: `UPDATE client_reports
            SET status = 'review',
                submitted_for_review_at = datetime('now'),
                submitted_for_review_by = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [submittedBy, reportId],
  });
}

/**
 * AM approval — moves a report from review to final. Records who approved
 * and when. The portal-push cron (A5) picks it up from there.
 */
export async function approveReport(reportId: number, approvedBy: string): Promise<void> {
  const current = await getStatusOrThrow(reportId);
  if (current !== 'review') {
    throw new ReportStatusError(
      `Report ${reportId} is ${current}, expected 'review' to approve`,
    );
  }
  await db.execute({
    sql: `UPDATE client_reports
            SET status = 'final',
                approved_at = datetime('now'),
                approved_by = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [approvedBy, reportId],
  });
}

/**
 * Reset a report back to draft. Clears the submission and approval
 * timestamps so the audit trail reflects that the previous review/approval
 * has been discarded. Used for "edit after submission" / "edit after send".
 */
export async function reopenReport(reportId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports
            SET status = 'draft',
                submitted_for_review_at = NULL,
                submitted_for_review_by = NULL,
                approved_at = NULL,
                approved_by = NULL,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [reportId],
  });
}

/**
 * Persist the structured Google Ads period summary on the report. Called
 * during the monthly draft job once A2's `buildGoogleAdsPeriodSummary`
 * returns a payload with data.
 */
export async function setGadsSummary(reportId: number, summaryJson: string): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports
            SET gads_summary_json = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [summaryJson, reportId],
  });
}

export async function deleteReport(id: number): Promise<void> {
  // Screenshots cascade via FK ON DELETE CASCADE.
  await db.execute({ sql: 'DELETE FROM client_reports WHERE id = ?', args: [id] });
}

// --- Screenshots ---

export async function addScreenshot(params: {
  reportId: number;
  platform: ScreenshotPlatform;
  caption: string;
  blobUrl: string;
  blobPathname: string;
  source?: 'manual' | 'api';
}): Promise<ScreenshotRow> {
  const nextPosition = (await scalar<number>(
    'SELECT COALESCE(MAX(position), -1) + 1 FROM client_report_screenshots WHERE report_id = ?',
    [params.reportId],
  )) ?? 0;

  const result = await db.execute({
    sql: `INSERT INTO client_report_screenshots
            (report_id, platform, caption, blob_url, blob_pathname, position, source)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id, report_id, platform, caption, blob_url, blob_pathname,
                    position, source, width, height, created_at`,
    args: [
      params.reportId,
      params.platform,
      params.caption,
      params.blobUrl,
      params.blobPathname,
      nextPosition,
      params.source ?? 'manual',
    ],
  });
  return result.rows[0] as unknown as ScreenshotRow;
}

export async function updateScreenshot(id: number, params: {
  platform?: ScreenshotPlatform;
  caption?: string;
}): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (params.platform) { sets.push('platform = ?'); args.push(params.platform); }
  if (params.caption !== undefined) { sets.push('caption = ?'); args.push(params.caption); }
  if (!sets.length) return;
  args.push(id);
  await db.execute({
    sql: `UPDATE client_report_screenshots SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function deleteScreenshot(id: number): Promise<{ blob_pathname: string; report_id: number } | null> {
  const result = await rows<{ blob_pathname: string; report_id: number }>(
    'SELECT blob_pathname, report_id FROM client_report_screenshots WHERE id = ?',
    [id],
  );
  if (!result.length) return null;
  await db.execute({ sql: 'DELETE FROM client_report_screenshots WHERE id = ?', args: [id] });
  return result[0];
}

export async function reorderScreenshots(reportId: number, orderedIds: number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute({
      sql: 'UPDATE client_report_screenshots SET position = ? WHERE id = ? AND report_id = ?',
      args: [i, orderedIds[i], reportId],
    });
  }
}

// --- Client picker helper (lightweight subset for the report UI) ---

export interface ClientOption {
  id: number;
  name: string;
  display_name: string | null;
  label: string;
}

export async function listActiveClientsForReports(): Promise<ClientOption[]> {
  return rows<ClientOption>(`
    SELECT id, name, display_name,
           COALESCE(display_name, name) AS label
    FROM clients
    WHERE status IS NULL OR status = 'active'
    ORDER BY label COLLATE NOCASE
  `);
}

// === A1 additions ===
// (Owned by Agent A1 — Foundation. Do not modify above this block.)

/**
 * Return every Google Ads customer ID mapped to a client.
 *
 * Reads from `gads_account_client_map` (created by
 * scripts/migrations/2026-05-11-gads-autonomous-reports.ts). Used by A2's
 * `buildGoogleAdsPeriodSummary` to know which `gads_accounts` rows to roll up
 * for a given client's monthly report. Returns the IDs as strings — Google
 * Ads customer IDs exceed JavaScript's safe integer range when formatted
 * without dashes, and downstream SQL joins compare to TEXT columns
 * (`gads_campaign_spend.account_id` etc.).
 *
 * Empty list = no mapping yet (the admin needs to set one via
 * /admin/gads-account-map).
 */
export async function getClientGadsCustomerIds(clientId: number): Promise<string[]> {
  const result = await rows<{ gads_customer_id: string }>(
    `SELECT gads_customer_id
       FROM gads_account_client_map
      WHERE client_id = ?
      ORDER BY gads_customer_id`,
    [clientId],
  );
  return result.map(r => r.gads_customer_id);
}
