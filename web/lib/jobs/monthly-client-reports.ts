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
import {
  createReport,
  findReport,
  setGadsSummary,
  updateAiBlocks,
} from '../queries/reports.js';
import { consoleLog } from '../monitors/base.js';
import { generateReportInsights } from '../report-ai.js';
// AGENT-COORD: stubs for A2 + A3 — replaced at merge time.
import { buildGoogleAdsPeriodSummary } from '../reports/gads-summary.js';
import { reconcileClientGads } from '../reports/gads-reconcile.js';
import { buildNarrativeContext, saveNarrativeDraft } from '../reports/narrative-context.js';

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
  /** Reports that had a Google Ads structured summary attached. */
  gadsSummaryAttached: number;
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
  let gadsSummaryAttached = 0;
  let narrativeAttached = 0;
  let aiGenerated = 0;
  let aiFailed = 0;

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

      // 1) Google Ads structured summary — A2's stub returns has_data=false
      // until A2 lands the real aggregation. Either way the call is safe.
      let gadsSummary: Awaited<ReturnType<typeof buildGoogleAdsPeriodSummary>> | null = null;
      try {
        gadsSummary = await buildGoogleAdsPeriodSummary(clientId, period.start, period.end);
        if (gadsSummary.has_data) {
          await setGadsSummary(reportId, JSON.stringify(gadsSummary));
          gadsSummaryAttached++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consoleLog(LOG_SOURCE, `Google Ads summary failed for ${clientName}: ${msg}`);
      }

      // 1b) Reconciliation guardrail — flag if the DB's active spend has drifted
      // from the live Google Ads API for this period (non-blocking; logs only).
      try {
        const recon = await reconcileClientGads(clientId, period.start, period.end);
        if (recon && !recon.withinTolerance) {
          consoleLog(
            LOG_SOURCE,
            `⚠ Google Ads spend variance for ${clientName}: ${recon.variancePct.toFixed(1)}% ` +
              `(DB £${recon.dbActiveSpend.toFixed(2)} vs API £${recon.apiActiveSpend.toFixed(2)}) — report may be stale`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consoleLog(LOG_SOURCE, `Google Ads reconciliation skipped for ${clientName}: ${msg}`);
      }

      // 2) Suggested narrative draft — A3's stub returns empty until A3
      // lands. Skip the save when there's nothing useful to draft.
      try {
        const ctx = await buildNarrativeContext(clientId, period.start, period.end);
        if (ctx.suggested_worked_on_md && ctx.suggested_worked_on_md.trim()) {
          await saveNarrativeDraft(reportId, ctx.suggested_worked_on_md);
          narrativeAttached++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consoleLog(LOG_SOURCE, `Narrative context failed for ${clientName}: ${msg}`);
      }

      // 3) AI insights — fire Sonnet with whatever structured signal we have.
      // No screenshots at this point (the team uploads them in the editor).
      // The prompt is happy with structured data alone when has_data is true,
      // and gracefully degrades to placeholder copy otherwise.
      try {
        const out = await generateReportInsights({
          clientName,
          vertical: null,
          periodLabel: period.label,
          workedOnMd: '',
          focusNextMd: '',
          screenshots: [],
          ...(gadsSummary && gadsSummary.has_data ? { googleAdsSummary: gadsSummary } : {}),
        }, null);
        await updateAiBlocks(reportId, {
          execSummaryMd: out.exec_summary,
          performanceSummaryMd: out.performance_summary,
          winsMd: out.wins,
          risksMd: out.risks,
          recommendationsMd: out.recommendations,
        });
        aiGenerated++;
      } catch (err) {
        aiFailed++;
        const msg = err instanceof Error ? err.message : String(err);
        consoleLog(LOG_SOURCE, `AI generation failed for ${clientName} (report ${reportId}): ${msg}`);
      }
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
    gadsSummaryAttached,
    narrativeAttached,
    aiGenerated,
    aiFailed,
    periodLabel: period.label,
    durationMs: Date.now() - start,
    rows,
  };
}
