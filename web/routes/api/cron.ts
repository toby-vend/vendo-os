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
