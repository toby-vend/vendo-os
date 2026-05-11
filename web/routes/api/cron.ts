import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runAllMonitors } from '../../lib/monitors/run-all.js';
import { syncActionsToAsana } from '../../lib/jobs/sync-actions-to-asana.js';
import { runClientHealthScoring } from '../../lib/jobs/client-health.js';
import { runTrafficLightAlerts } from '../../lib/jobs/traffic-light.js';
import { runOrangeDigest } from '../../lib/jobs/orange-digest.js';
import { syncXero } from '../../lib/jobs/sync-xero.js';
import { syncGoogleAds } from '../../lib/jobs/sync-google-ads.js';
import { syncMetaAds } from '../../lib/jobs/sync-meta-ads.js';
import { syncGhl } from '../../lib/jobs/sync-ghl.js';
import { purgeSuggestionDrafts } from '../../lib/jobs/purge-suggestion-drafts.js';
import { processFrameioEvents } from '../../lib/frameio/processor.js';
import { syncFrameioLibrary } from '../../lib/frameio/sync-library.js';
import { pushClientsToPortal } from '../../lib/jobs/push-clients-to-portal.js';
import { pullOnboardingFromPortal } from '../../lib/jobs/pull-onboarding-from-portal.js';
import { syncAsana } from '../../lib/jobs/sync-asana.js';
import { recomputeClientProfitability } from '../../lib/jobs/client-profitability.js';
import { recordHeartbeat } from '../../lib/jobs/heartbeat.js';
import { runLeadScoring } from '../../lib/jobs/lead-scoring.js';
import { runUpsellDetection } from '../../lib/jobs/upsell-detection.js';
import { runNpsTrigger } from '../../lib/jobs/nps-trigger.js';
import { runOnboardingStallDetection } from '../../lib/jobs/onboarding-stall.js';
import { runPerformanceReviewGaps } from '../../lib/jobs/performance-review-gaps.js';
import {
  runSpecialistDigest,
  selectClientsWithRecentGoogleAdsSpend,
  selectClientsWithRecentMetaSpend,
  selectClientsWithRecentOrganic,
  selectClientsWithRecentCreative,
  selectAllActiveClients,
} from '../../lib/jobs/specialist-digest.js';
import {
  atlasPaidSocialAgent,
  atlasPaidSearchAgent,
  atlasSeoAgent,
  atlasCreativeAgent,
  atlasAmAgent,
} from '../../lib/agents/agents/index.js';
import { runMonthlyClientReports } from '../../lib/jobs/monthly-client-reports.js';
import { runCapacityDigest } from '../../lib/jobs/capacity-digest.js';
import { runSalesPipelineDigest } from '../../lib/jobs/sales-pipeline-digest.js';
import { runCaseStudyDetection } from '../../lib/jobs/case-study-detection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');

/**
 * Run a script and return a promise with stdout/stderr.
 *
 * NOTE: this pattern only works for scripts we haven't yet ported to Turso.
 * On Vercel serverless, `npx tsx` is unavailable and the local sql.js file
 * doesn't exist — any script that depends on those will silently fail. The
 * /monitors route now runs in-process; health-score, traffic-light, and
 * sync-actions-to-asana remain on this shim as a known follow-up (they
 * mostly hit external APIs + Turso, similar port needed). The old static
 * daily-brief webhook route was retired 2026-05-11 in favour of the
 * per-user `api/cron/atlas-brief.ts` Slack-DM brief.
 */
function runScript(scriptPath: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(`npx tsx ${scriptPath}`, { cwd: PROJECT_ROOT, timeout: 300_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export const cronRoutes: FastifyPluginAsync = async (app) => {
  // -- Cron heartbeats (Wave R / R4) ------------------------------------------
  // Every handler in this plugin auto-records to cron_heartbeats on the way
  // out. Status < 400 → success; >= 400 → error. Job name is the route path
  // (e.g. '/sync-asana' → 'sync-asana'). New handlers added below are
  // instrumented for free. Failures here are swallowed by recordHeartbeat
  // itself so we never break a cron response with observability writes.
  app.addHook('onResponse', async (request, reply) => {
    const routeUrl = (request as { routeOptions?: { url?: string } }).routeOptions?.url
      ?? request.url.split('?')[0];
    const jobName = routeUrl.replace(/^\//, '') || 'unknown';
    const durationMs = Math.round(reply.elapsedTime ?? 0);
    const ok = reply.statusCode < 400;
    const errorMsg = ok ? undefined : `HTTP ${reply.statusCode}`;
    await recordHeartbeat(jobName, ok, durationMs, errorMsg);
  });

  /**
   * GET /monitors — Run all monitors (Vercel Cron)
   * Auth handled by the server.ts onRequest hook for /api/cron/* paths.
   */
  app.get('/monitors', async (_request, reply) => {
    try {
      const { results, totalFlagged, durationMs } = await runAllMonitors();
      return reply.send({
        ok: true,
        message: 'All monitors completed',
        durationMs,
        totalFlagged,
        results,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/monitors] Failed:', msg);
      return reply.code(500).send({
        ok: false,
        message: 'Monitor run failed',
        error: msg,
      });
    }
  });

  /**
   * GET /sync-actions-to-asana — Create Asana tasks from meeting actions, escalations, NPS (Vercel Cron)
   */
  app.get('/sync-actions-to-asana', async (_request, reply) => {
    try {
      const result = await syncActionsToAsana();
      return reply.send({
        ok: true,
        message: 'Action-to-Asana sync completed',
        ...result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-actions-to-asana] Failed:', msg);
      return reply.code(500).send({
        ok: false,
        message: 'Action-to-Asana sync failed',
        error: msg,
      });
    }
  });

  /**
   * GET /health-score — Run client health scoring (Vercel Cron — 1st of month)
   */
  app.get('/health-score', async (_request, reply) => {
    try {
      const result = await runClientHealthScoring();
      return reply.send({ ok: true, message: 'Health scoring completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/health-score] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Health scoring failed', error: msg });
    }
  });

  /**
   * GET /traffic-light — Run traffic light alerts (Vercel Cron — nightly,
   * post-scoring). Catches Red/Orange absolute + trajectory triggers.
   */
  app.get('/traffic-light', async (_request, reply) => {
    try {
      const result = await runTrafficLightAlerts();
      return reply.send({ ok: true, message: 'Traffic light alerts completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/traffic-light] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Traffic light alerts failed', error: msg });
    }
  });

  /**
   * GET /traffic-light-digest — Weekly Monday digest of Orange clients
   * grouped by AM. Cron: '0 8 * * 1'. Skips already-acknowledged alerts.
   */
  app.get('/traffic-light-digest', async (_request, reply) => {
    try {
      const result = await runOrangeDigest();
      return reply.send({ ok: true, message: 'Orange digest completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/traffic-light-digest] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Orange digest failed', error: msg });
    }
  });

  /**
   * GET /sync-xero — Pull Xero invoices/contacts/P&L/bank and refresh clients (Vercel Cron)
   */
  app.get('/sync-xero', async (_request, reply) => {
    try {
      const result = await syncXero();
      return reply.send({ ok: true, message: 'Xero sync completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-xero] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Xero sync failed', error: msg });
    }
  });

  /**
   * GET /sync-google-ads — Pull Google Ads campaign + keyword spend (Vercel Cron)
   */
  app.get('/sync-google-ads', async (_request, reply) => {
    try {
      const result = await syncGoogleAds();
      return reply.send({ ok: true, message: 'Google Ads sync completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-google-ads] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Google Ads sync failed', error: msg });
    }
  });

  /**
   * GET /sync-meta-ads — Pull Meta Ads account-level insights (Vercel Cron)
   */
  app.get('/sync-meta-ads', async (_request, reply) => {
    try {
      const result = await syncMetaAds();
      return reply.send({ ok: true, message: 'Meta Ads sync completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-meta-ads] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Meta Ads sync failed', error: msg });
    }
  });

  /**
   * GET /push-clients-to-portal — Sync VendoOS clients into the
   * ClientDashboard portal's `organisations` table (Vercel Cron, every 6h).
   * One-way bridge keyed on organisations.external_vendo_id. Idempotent.
   */
  app.get('/push-clients-to-portal', async (_request, reply) => {
    try {
      const result = await pushClientsToPortal();
      return reply.send({
        ok: true,
        message: 'Portal client sync completed',
        loaded: result.loaded,
        prepared: result.prepared,
        written: result.written,
        collisions: result.collisions,
        warnings: result.warnings.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/push-clients-to-portal] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Portal client sync failed', error: msg });
    }
  });

  /**
   * GET /sync-asana — Pull Asana tasks (hourly Vercel Cron).
   * Turso-native in-process job (Wave R / R1). Replaces the
   * fragile exec('npx tsx ...') shim that silently failed on Vercel.
   */
  app.get('/sync-asana', async (_request, reply) => {
    try {
      const result = await syncAsana();
      return reply.send({
        ok: true,
        message: 'Asana sync completed',
        projectsScanned: result.projectsScanned,
        tasksFetched: result.tasksFetched,
        tasksUpserted: result.tasksUpserted,
        resolvedClients: result.resolvedClients,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-asana] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Asana sync failed', error: msg });
    }
  });

  /**
   * GET /pull-onboarding-from-portal — Mirror CD's questionnaire_submissions
   * into Turso cd_onboarding_snapshots (Vercel Cron, every 6h).
   * Lets the client-knowledge briefing surface CD onboarding state without
   * cross-cloud reads on every page load.
   */
  app.get('/pull-onboarding-from-portal', async (_request, reply) => {
    try {
      const result = await pullOnboardingFromPortal();
      return reply.send({
        ok: true,
        message: 'CD onboarding mirror updated',
        loaded: result.loaded,
        upserted: result.upserted,
        skipped: result.skipped,
        warnings: result.warnings.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/pull-onboarding-from-portal] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'CD onboarding sync failed', error: msg });
    }
  });

  /**
   * GET /client-profitability — Recompute client_profitability table
   * (daily Vercel Cron, after health-score at 04:00 UTC).
   * Turso-native in-process job (Wave R / R1).
   */
  app.get('/client-profitability', async (_request, reply) => {
    try {
      const result = await recomputeClientProfitability();
      return reply.send({
        ok: true,
        message: 'Profitability recompute completed',
        period: result.period,
        clientsProcessed: result.clientsProcessed,
        healthy: result.healthy,
        warning: result.warning,
        critical: result.critical,
        upserted: result.upserted,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/client-profitability] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Profitability recompute failed', error: msg });
    }
  });

  /**
   * GET /lead-scoring — Re-score all open GHL opportunities (weekly Fri 09:00).
   * Wave V / V1. Writes lead_score, score_breakdown, scored_at on
   * ghl_opportunities. Idempotent. ~3-5s for ~100 open opps.
   */
  app.get('/lead-scoring', async (_request, reply) => {
    try {
      const result = await runLeadScoring();
      return reply.send({
        ok: true,
        message: 'Lead scoring completed',
        scored: result.scored,
        topCount: result.top.length,
        topScore: result.top[0]?.score ?? null,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/lead-scoring] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Lead scoring failed', error: msg });
    }
  });

  /**
   * GET /upsell-detection — Weekly Wed 10:00 UTC scan for expansion signals.
   * Wave V / V2. Three signal paths: high_performance (Google Ads),
   * meeting_signal (recent meeting keywords), high_margin (profitability).
   * Idempotent within each signal's window; never duplicates an open row.
   */
  app.get('/upsell-detection', async (_request, reply) => {
    try {
      const result = await runUpsellDetection();
      return reply.send({
        ok: true,
        message: 'Upsell detection completed',
        candidates: result.candidates,
        inserted: result.inserted,
        skipped: result.skipped,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/upsell-detection] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Upsell detection failed', error: msg });
    }
  });

  /**
   * GET /nps-trigger — Daily 09:00 UTC. Pings AM on Slack for any client
   * hitting the 90-day anniversary of their first invoice. Logs to
   * nps_surveys_sent so each client is prompted once. Wave V / V3.
   * Auto-send via Resend/GHL form is deferred until that infra lands.
   */
  app.get('/nps-trigger', async (_request, reply) => {
    try {
      const result = await runNpsTrigger();
      return reply.send({
        ok: true,
        message: 'NPS trigger completed',
        candidates: result.candidates,
        prompted: result.prompted,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/nps-trigger] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'NPS trigger failed', error: msg });
    }
  });

  /**
   * GET /onboarding-stall — Weekly Tue 09:00 UTC. Flag onboardings stalled
   * >5 days with completion <100%. Creates an Asana task for each, assigned
   * to the client's AM. Wave V / V4. Idempotent within a 7-day window.
   */
  app.get('/onboarding-stall', async (_request, reply) => {
    try {
      const result = await runOnboardingStallDetection();
      return reply.send({
        ok: true,
        message: 'Onboarding stall detection completed',
        candidates: result.candidates,
        tasksCreated: result.tasksCreated,
        skipped: result.skipped,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/onboarding-stall] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Onboarding stall failed', error: msg });
    }
  });

  /**
   * GET /performance-review-gaps — Weekly Mon 09:00 UTC. Slack digest of
   * everyone whose last review is >90 days old (or never reviewed). Wave V / V5.
   * Suppressed for 6 days after each post so re-runs don't double-prompt.
   */
  app.get('/performance-review-gaps', async (_request, reply) => {
    try {
      const result = await runPerformanceReviewGaps();
      return reply.send({
        ok: true,
        message: 'Performance review gaps scan completed',
        totalActive: result.totalActive,
        gaps: result.gaps,
        posted: result.posted,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/performance-review-gaps] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Performance review gaps failed', error: msg });
    }
  });

  // -- Wave C / C1 — Specialist digests ---------------------------------------
  // Five specialists auto-fire daily (Mon-Fri) on their natural triggers.
  // Pilot routes everything to one Slack channel
  // (SLACK_CHANNEL_SPECIALIST_DIGESTS) so Toby can validate the format
  // before broadening to per-AM DMs. Each handler caps at 8 clients/run
  // to keep daily token cost predictable.

  app.get('/specialist-paid-social', async (_request, reply) => {
    try {
      const result = await runSpecialistDigest({
        agent: atlasPaidSocialAgent,
        digestKey: 'paid-social',
        slackHeader: 'Paid Social — daily snapshot',
        selectClients: () => selectClientsWithRecentMetaSpend(30),
        buildPrompt: (clientName) =>
          `You are running the morning Meta Ads check for **${clientName}**. ` +
          `Using the pre-loaded briefing below, write 4-7 lines: top-line spend & ` +
          `performance vs last 7 days, anything unusual (CPL/CTR/CPA drift, paused ad ` +
          `sets, pacing concerns), and one concrete action the AM should take today. ` +
          `Be specific. If nothing material has changed, say "no notable change" in one line.`,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/specialist-paid-social] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Specialist paid-social failed', error: msg });
    }
  });

  app.get('/specialist-paid-search', async (_request, reply) => {
    try {
      const result = await runSpecialistDigest({
        agent: atlasPaidSearchAgent,
        digestKey: 'paid-search',
        slackHeader: 'Paid Search — daily snapshot',
        selectClients: () => selectClientsWithRecentGoogleAdsSpend(30),
        buildPrompt: (clientName) =>
          `Morning Google Ads check for **${clientName}**. Using the pre-loaded briefing, ` +
          `produce 4-7 lines: spend & conversions vs last 7 days, any campaigns drifting ` +
          `(CPA, conversion rate, impression share), and one specific action. If everything ` +
          `is stable, say "no notable change" in one line.`,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/specialist-paid-search] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Specialist paid-search failed', error: msg });
    }
  });

  app.get('/specialist-seo', async (_request, reply) => {
    try {
      const result = await runSpecialistDigest({
        agent: atlasSeoAgent,
        digestKey: 'seo',
        slackHeader: 'SEO — daily snapshot',
        selectClients: () => selectClientsWithRecentOrganic(30),
        buildPrompt: (clientName) =>
          `Morning organic-search check for **${clientName}**. Using the pre-loaded ` +
          `briefing, write 4-7 lines: traffic & impressions vs last 7 days, biggest ` +
          `query/page movers, any positions dropping, and one specific action. ` +
          `Note that organic moves slowly — if nothing material has changed, say so.`,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/specialist-seo] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Specialist SEO failed', error: msg });
    }
  });

  app.get('/specialist-creative', async (_request, reply) => {
    try {
      const result = await runSpecialistDigest({
        agent: atlasCreativeAgent,
        digestKey: 'creative',
        slackHeader: 'Creative — daily snapshot',
        selectClients: () => selectClientsWithRecentCreative(14),
        buildPrompt: (clientName) =>
          `Daily creative-review status for **${clientName}**. Using the pre-loaded ` +
          `briefing, write 4-7 lines: assets awaiting client review, any stale assets ` +
          `(no feedback >5 days), upcoming launches that need creative, and one ` +
          `specific action. If the queue is healthy, say so.`,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/specialist-creative] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Specialist creative failed', error: msg });
    }
  });

  app.get('/specialist-am', async (_request, reply) => {
    try {
      const result = await runSpecialistDigest({
        agent: atlasAmAgent,
        digestKey: 'am',
        slackHeader: 'Account Management — daily focus',
        selectClients: () => selectAllActiveClients(),
        buildPrompt: (clientName) =>
          `Daily AM focus for **${clientName}**. Using the pre-loaded briefing, ` +
          `write 4-7 lines: anything on this account the AM needs to touch today ` +
          `(open concerns, stalled deliverables, upcoming meetings without prep, ` +
          `pending decisions), and one specific action. If nothing pressing, say so.`,
        perRunLimit: 6,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/specialist-am] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Specialist AM failed', error: msg });
    }
  });

  /**
   * GET /monthly-client-reports — Runs on the 1st of every month at 06:00.
   * Creates a draft client_reports row per active client for the previous
   * month. AMs review + fill the narrative in CD. Wave C / C2. Idempotent.
   */
  app.get('/monthly-client-reports', async (_request, reply) => {
    try {
      const result = await runMonthlyClientReports();
      return reply.send({
        ok: true,
        message: 'Monthly client reports completed',
        period: result.periodLabel,
        totalClients: result.totalClients,
        created: result.created,
        alreadyExisted: result.alreadyExisted,
        failed: result.failed,
        gadsSummaryAttached: result.gadsSummaryAttached,
        narrativeAttached: result.narrativeAttached,
        aiGenerated: result.aiGenerated,
        aiFailed: result.aiFailed,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/monthly-client-reports] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Monthly client reports failed', error: msg });
    }
  });

  /**
   * GET /capacity-digest — Weekly Mon 08:30 UTC. Team utilisation snapshot
   * posted to SLACK_CHANNEL_OPS. Wave C / C3. Idempotent within 6 days.
   */
  app.get('/capacity-digest', async (_request, reply) => {
    try {
      const result = await runCapacityDigest();
      return reply.send({
        ok: true,
        message: 'Capacity digest completed',
        posted: result.posted,
        total: result.total,
        over: result.over,
        under: result.under,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/capacity-digest] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Capacity digest failed', error: msg });
    }
  });

  /**
   * GET /sales-pipeline-digest — Weekly Fri 17:00 UTC. Top 10 scored leads
   * + pipeline value delta + wins/losses for the past 7 days. Wave C / C3.
   * Idempotent within 5 days.
   */
  app.get('/sales-pipeline-digest', async (_request, reply) => {
    try {
      const result = await runSalesPipelineDigest();
      return reply.send({
        ok: true,
        message: 'Sales pipeline digest completed',
        posted: result.posted,
        topCount: result.topCount,
        openValue: result.openValue,
        wonLast7: result.wonLast7,
        lostLast7: result.lostLast7,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sales-pipeline-digest] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Sales pipeline digest failed', error: msg });
    }
  });

  /**
   * GET /case-study-detection — Weekly Wed 07:00 UTC. Detects clients
   * hitting milestone wins (tenure 12+ months, no recent critical
   * concerns, ad-performance signal) and inserts into case_studies
   * with status='identified' for AM review. Wave C / C4.
   */
  app.get('/case-study-detection', async (_request, reply) => {
    try {
      const result = await runCaseStudyDetection();
      return reply.send({
        ok: true,
        message: 'Case study detection completed',
        scanned: result.scanned,
        inserted: result.inserted,
        skippedTenure: result.skippedTenure,
        skippedHealth: result.skippedHealth,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/case-study-detection] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Case study detection failed', error: msg });
    }
  });

  /**
   * GET /sync-ghl — Pull GHL pipelines + opportunities per location (Vercel Cron)
   */
  app.get('/sync-ghl', async (_request, reply) => {
    try {
      const result = await syncGhl();
      return reply.send({ ok: true, message: 'GHL sync completed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-ghl] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'GHL sync failed', error: msg });
    }
  });

  /**
   * GET /purge-suggestion-drafts — Delete stale suggestion_drafts and orphan blob attachments (Vercel Cron)
   */
  app.get('/purge-suggestion-drafts', async (_request, reply) => {
    try {
      const result = await purgeSuggestionDrafts();
      return reply.send({ ok: true, message: 'Suggestion drafts purged', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/purge-suggestion-drafts] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Purge failed', error: msg });
    }
  });

  /**
   * GET /frameio-process — Drain pending frameio_events and fan out
   *   into creative_reviews. Phase 2 of the Frame.io integration.
   *   Schedule: every minute (vercel.json `*​/1 * * * *`).
   */
  app.get('/frameio-process', async (_request, reply) => {
    try {
      const result = await processFrameioEvents();
      return reply.send({ ok: true, message: 'Frame.io events processed', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/frameio-process] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Frame.io processing failed', error: msg });
    }
  });

  /**
   * GET /sync-frameio — Nightly Frame.io library backfill (Phase 6).
   * Walks every workspace → project → folder → video, mirrors into
   * frameio_assets, soft-deletes anything missing.
   * Schedule: 03:30 UTC daily (vercel.json).
   */
  app.get('/sync-frameio', async (_request, reply) => {
    try {
      const result = await syncFrameioLibrary({ logger: (m) => console.log('[cron/sync-frameio]', m) });
      return reply.send({ ok: true, message: 'Frame.io library synced', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/sync-frameio] Failed:', msg);
      return reply.code(500).send({ ok: false, message: 'Frame.io library sync failed', error: msg });
    }
  });
};
