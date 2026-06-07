/**
 * Monthly client reports — runs on the 1st of every month at 06:00 UTC.
 * Wave C / C2.
 *
 * For each active client:
 *   1. Create a `client_reports` draft row for the previous calendar month
 *      (idempotent via findReport).
 *   2. Build a structured Google Ads period summary (A2) and persist it on
 *      the draft so the AI prompt prefers structured data over OCR.
 *   3. Build a suggested "What we worked on" narrative (A3) from Asana
 *      completions + meeting actions and persist it as a draft the team
 *      can one-click apply.
 *   4. Auto-generate the five AI markdown blocks (Sonnet, via report-ai).
 *
 * Each per-client step is independently wrapped — a failed AI generation
 * does not block the next client, and missing Google Ads data falls back
 * to screenshot-only generation cleanly.
 *
 * Idempotent: re-running on the same day is a no-op because findReport
 * blocks duplicate (client_id, period_start, period_end) inserts. The AI
 * + summary steps are skipped when the draft already exists, so this
 * cron stays cheap on re-runs.
 */
import { db } from '../queries/base.js';
import { createReport, findReport, getClientActiveChannels, channelLabel, type ReportChannel } from '../queries/reports.js';
import { consoleLog } from '../monitors/base.js';
import { generateReportForId } from '../reports/generate.js';

const LOG_SOURCE = 'monthly-client-reports';

export interface MonthlyClientReportRow {
  clientId: number;
  clientName: string;
  channel: ReportChannel;
  reportId: number | null;
  skipped: boolean;
  error?: string;
}

export interface MonthlyClientReportsResult {
  totalClients: number;
  created: number;
  alreadyExisted: number;
  failed: number;
  /** Reports whose channel had data for the period. */
  channelsWithData: number;
  /** Reports that had an auto-generated suggested narrative attached. */
  narrativeAttached: number;
  /** Reports for which AI insights were generated successfully. */
  aiGenerated: number;
  /** Reports where AI generation was attempted and failed (non-fatal). */
  aiFailed: number;
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
  let channelsWithData = 0;
  let narrativeAttached = 0;
  let aiGenerated = 0;
  let aiFailed = 0;

  for (const c of clientsRes.rows) {
    const clientId = Number(c.id);
    const clientName = String(c.name);

    // One report per channel the client is set up on — channel-pure.
    const channels = await getClientActiveChannels(clientId);
    for (const channel of channels) {
      try {
        const existing = await findReport(clientId, period.start, period.end, channel);
        if (existing) {
          alreadyExisted++;
          rows.push({ clientId, clientName, channel, reportId: existing, skipped: true });
          continue;
        }
        const reportId = await createReport({
          clientId,
          channel,
          periodLabel: period.label,
          periodStart: period.start,
          periodEnd: period.end,
          createdBy: 'cron:monthly-client-reports',
        });
        created++;
        rows.push({ clientId, clientName, channel, reportId, skipped: false });

        // Full pipeline for this channel: channel-pure canonical summary,
        // narrative context (Asana + meetings, filtered to this channel by the
        // AI), auto-written "what we worked on", then the five AI blocks.
        const gen = await generateReportForId(reportId, {
          userId: null,
          applyNarrativeDraft: true,
          log: (m) => consoleLog(LOG_SOURCE, `[${channelLabel(channel)}] ${m}`),
        });
        if (gen.channelHasData) channelsWithData++;
        if (gen.narrativeApplied) narrativeAttached++;
        if (gen.aiGenerated) aiGenerated++;
        else aiFailed++;
      } catch (err) {
        failed++;
        const error = err instanceof Error ? err.message : String(err);
        consoleLog(LOG_SOURCE, `Failed for ${clientName} (${channel}): ${error}`);
        rows.push({ clientId, clientName, channel, reportId: null, skipped: false, error });
      }
    }
  }

  return {
    totalClients: clientsRes.rows.length,
    created,
    alreadyExisted,
    failed,
    channelsWithData,
    narrativeAttached,
    aiGenerated,
    aiFailed,
    periodLabel: period.label,
    durationMs: Date.now() - start,
    rows,
  };
}
