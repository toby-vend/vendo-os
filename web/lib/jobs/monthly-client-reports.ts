/**
 * Monthly client reports — runs on the 1st of every month at 06:00 UTC.
 * Wave C / C2.
 *
 * For each active client, creates a `client_reports` draft row for the
 * previous calendar month if one doesn't already exist. AMs then open
 * the report in CD, fill in the narrative, and approve.
 *
 * Idempotent: re-running on the same day is a no-op because findReport
 * blocks duplicate (client_id, period_start, period_end) inserts.
 *
 * We intentionally don't generate the AI narrative here — the existing
 * /admin/clients/[id]/reports flow in CD has a "generate narrative" action
 * that lets the AM kick off Sonnet on demand. That keeps the daily-cron
 * cost predictable (this run is pure DB writes) and avoids stale AI text
 * if data changes between the 1st and when the AM reviews.
 */
import { db } from '../queries/base.js';
import { createReport, findReport } from '../queries/reports.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'monthly-client-reports';

export interface MonthlyClientReportRow {
  clientId: number;
  clientName: string;
  reportId: number | null;
  skipped: boolean;
  error?: string;
}

export interface MonthlyClientReportsResult {
  totalClients: number;
  created: number;
  alreadyExisted: number;
  failed: number;
  periodLabel: string;
  durationMs: number;
  rows: MonthlyClientReportRow[];
}

function lastMonthBounds(now = new Date()): { label: string; start: string; end: string } {
  // Period = previous calendar month relative to `now`. On 1st-of-month
  // runs that's the month just ended.
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  ref.setUTCMonth(ref.getUTCMonth() - 1);
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth(); // 0-indexed
  const monthName = ref.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0)); // last day of the month
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    label: `${monthName} ${year}`,
    start: fmt(start),
    end: fmt(end),
  };
}

export async function runMonthlyClientReports(): Promise<MonthlyClientReportsResult> {
  const start = Date.now();
  const period = lastMonthBounds();

  const clientsRes = await db.execute(`
    SELECT id, name FROM clients
    WHERE COALESCE(status, 'active') = 'active'
    ORDER BY name
  `);

  const rows: MonthlyClientReportRow[] = [];
  let created = 0;
  let alreadyExisted = 0;
  let failed = 0;

  for (const c of clientsRes.rows) {
    const clientId = Number(c.id);
    const clientName = String(c.name);
    try {
      const existing = await findReport(clientId, period.start, period.end);
      if (existing) {
        alreadyExisted++;
        rows.push({ clientId, clientName, reportId: existing, skipped: true });
        continue;
      }
      const reportId = await createReport({
        clientId,
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        createdBy: 'cron:monthly-client-reports',
      });
      created++;
      rows.push({ clientId, clientName, reportId, skipped: false });
    } catch (err) {
      failed++;
      const error = err instanceof Error ? err.message : String(err);
      consoleLog(LOG_SOURCE, `Failed for ${clientName}: ${error}`);
      rows.push({ clientId, clientName, reportId: null, skipped: false, error });
    }
  }

  return {
    totalClients: clientsRes.rows.length,
    created,
    alreadyExisted,
    failed,
    periodLabel: period.label,
    durationMs: Date.now() - start,
    rows,
  };
}
