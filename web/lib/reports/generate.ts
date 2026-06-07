/**
 * Shared client-report generation pipeline.
 *
 * One code path used by:
 *   - the manual "Generate" button   (web/routes/reports.ts)
 *   - the monthly cron               (web/lib/jobs/monthly-client-reports.ts)
 *   - the single-client test script  (scripts/functions/generate-one-report.ts)
 *
 * For a given existing `client_reports` row it:
 *   1. Rebuilds the canonical Google Ads period summary (freshest sync data)
 *      and persists it on the report.
 *   2. Runs the Google Ads reconciliation guardrail (non-blocking; logs drift).
 *   3. Builds narrative context — Asana completions, gated meeting actions, and
 *      meeting discussion summaries (what was talked about this period).
 *   4. Optionally pre-fills `worked_on_md` from the suggested narrative so the
 *      report is genuinely auto-written (only when it's currently empty, unless
 *      `forceNarrative` is set). Always saves the draft to `narrative_draft_md`.
 *   5. Generates the five AI markdown blocks (Sonnet, via report-ai) with the
 *      Google Ads block, screenshots, narrative, and meeting context, and
 *      persists them.
 *
 * Every external step is wrapped so a single failure (e.g. Google Ads API)
 * degrades gracefully rather than aborting the whole report.
 */
import {
  getReport,
  listScreenshots,
  setGadsSummary,
  updateAiBlocks,
  updateNarrative,
  CHANNEL_PLATFORMS,
} from '../queries/reports.js';
import { generateReportInsights } from '../report-ai.js';
import { reconcileClientGads } from './gads-reconcile.js';
import { buildChannelSummary } from './channel-summary.js';
import { buildNarrativeContext, saveNarrativeDraft } from './narrative-context.js';

export interface GenerateReportOptions {
  /** For usage attribution. null in cron/script contexts. */
  userId?: string | null;
  /**
   * When true, pre-fill `worked_on_md` from the auto-pulled narrative draft so
   * the report writes itself. Only overwrites when the field is empty unless
   * `forceNarrative` is also set. Default false (manual flow keeps human copy).
   */
  applyNarrativeDraft?: boolean;
  /** Overwrite `worked_on_md` from the draft even if it already has content. */
  forceNarrative?: boolean;
  /** Feed meeting discussion summaries to the AI. Default true. */
  includeMeetingContext?: boolean;
  /** Optional logger; defaults to console. */
  log?: (msg: string) => void;
}

export interface GenerateReportResult {
  reportId: number;
  /** Whether the report's channel had any data for the period. */
  channelHasData: boolean;
  narrativeApplied: boolean;
  meetingsUsed: number;
  asanaTasksUsed: number;
  meetingActionsUsed: number;
  aiGenerated: boolean;
  aiError?: string;
}

/**
 * Run the full generation pipeline against an existing report row.
 * Throws only if the report doesn't exist; all other failures are captured
 * in the returned result (aiError) or logged and skipped.
 */
export async function generateReportForId(
  reportId: number,
  opts: GenerateReportOptions = {},
): Promise<GenerateReportResult> {
  const log = opts.log ?? ((m: string) => console.log(`[report-generate] ${m}`));
  const includeMeetingContext = opts.includeMeetingContext !== false;

  const report = await getReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const result: GenerateReportResult = {
    reportId,
    channelHasData: false,
    narrativeApplied: false,
    meetingsUsed: 0,
    asanaTasksUsed: 0,
    meetingActionsUsed: 0,
    aiGenerated: false,
  };

  const channel = report.channel;

  // 1) Channel-pure canonical summary (Google Ads / Meta / SEO). For Google Ads
  // the structured summary is also persisted (gads_summary_json) for the
  // dashboard, and the live-spend reconciliation guardrail runs.
  let channelData = '';
  try {
    const summary = await buildChannelSummary(channel, report.client_id, report.period_start, report.period_end);
    channelData = summary.canonicalText;
    result.channelHasData = summary.hasData;
    if (channel === 'google_ads' && summary.gadsSummary?.has_data) {
      await setGadsSummary(reportId, JSON.stringify(summary.gadsSummary));
    }
  } catch (err) {
    log(`${channel} summary failed for ${report.client_name}: ${errMsg(err)}`);
  }

  // 2) Reconciliation guardrail — Google Ads only; non-blocking, logs drift.
  if (channel === 'google_ads') {
    try {
      const recon = await reconcileClientGads(report.client_id, report.period_start, report.period_end);
      if (recon && !recon.withinTolerance) {
        log(
          `⚠ Google Ads spend variance for ${report.client_name}: ${recon.variancePct.toFixed(1)}% ` +
            `(DB £${recon.dbActiveSpend.toFixed(2)} vs API £${recon.apiActiveSpend.toFixed(2)}) — report may be stale`,
        );
      }
    } catch (err) {
      log(`Google Ads reconciliation skipped for ${report.client_name}: ${errMsg(err)}`);
    }
  }

  // 3) Narrative context — completions + meeting actions + call discussions.
  let meetingDiscussions: Array<{ title: string; date: string; summary: string }> = [];
  let completedWork: Array<{ label: string; date: string; source: 'asana' | 'meeting' }> = [];
  try {
    const ctx = await buildNarrativeContext(report.client_id, report.period_start, report.period_end);
    result.asanaTasksUsed = ctx.asana_tasks_completed.length;
    result.meetingActionsUsed = ctx.meeting_actions.length;
    meetingDiscussions = ctx.meeting_discussions;
    result.meetingsUsed = meetingDiscussions.length;

    completedWork = [
      ...ctx.asana_tasks_completed.map(t => ({
        label: t.name,
        date: (t.completed_at || '').slice(0, 10),
        source: 'asana' as const,
      })),
      ...ctx.meeting_actions.map(a => ({
        label: a.assignee ? `${a.summary} (${a.assignee})` : a.summary,
        date: a.meeting_date,
        source: 'meeting' as const,
      })),
    ];

    // Keep the raw assembled draft for the editor's "use suggestion" button —
    // but it is NEVER pushed straight into the client-facing worked_on_md (it
    // contains raw internal task names). The AI synthesises a clean narrative.
    const draft = ctx.suggested_worked_on_md?.trim() ?? '';
    if (draft) await saveNarrativeDraft(reportId, draft);
  } catch (err) {
    log(`Narrative context failed for ${report.client_name}: ${errMsg(err)}`);
  }

  // 4) Should the AI also draft the client-facing "What we worked on"? Only in
  // the automated flow, only when the team hasn't already written one (unless
  // forced), and only when we actually have completed-work signal to draw on.
  const currentWorkedOnEmpty = !report.worked_on_md || !report.worked_on_md.trim();
  const draftWorkedOn =
    !!opts.applyNarrativeDraft &&
    (currentWorkedOnEmpty || !!opts.forceNarrative) &&
    completedWork.length > 0;

  // 5) AI insights. Screenshots are filtered to this channel's platforms so a
  // Google Ads report never sees a Meta screenshot, etc.
  const allowedPlatforms = new Set(CHANNEL_PLATFORMS[channel]);
  const screenshots = (await listScreenshots(reportId))
    .filter(s => allowedPlatforms.has(s.platform));
  try {
    const out = await generateReportInsights(
      {
        clientName: report.client_display_name || report.client_name,
        vertical: report.client_vertical,
        channel,
        periodLabel: report.period_label,
        workedOnMd: report.worked_on_md,
        focusNextMd: report.focus_next_md,
        screenshots: screenshots.map(s => ({ platform: s.platform, caption: s.caption, url: s.blob_url })),
        draftWorkedOn,
        ...(channelData.trim() ? { channelData } : {}),
        ...(includeMeetingContext && meetingDiscussions.length ? { meetingDiscussions } : {}),
        ...(completedWork.length ? { completedWork } : {}),
      },
      opts.userId ?? null,
    );
    await updateAiBlocks(reportId, {
      execSummaryMd: out.exec_summary,
      performanceSummaryMd: out.performance_summary,
      winsMd: out.wins,
      risksMd: out.risks,
      recommendationsMd: out.recommendations,
    });
    // Persist the AI-drafted, client-ready worked-on narrative.
    if (draftWorkedOn && out.worked_on && out.worked_on.trim()) {
      await updateNarrative(reportId, { workedOnMd: out.worked_on.trim() });
      result.narrativeApplied = true;
    }
    result.aiGenerated = true;
  } catch (err) {
    result.aiError = errMsg(err);
    log(`AI generation failed for ${report.client_name} (report ${reportId}): ${result.aiError}`);
  }

  return result;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
