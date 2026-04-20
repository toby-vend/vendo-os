import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runAllMonitors } from '../../lib/monitors/run-all.js';
import { syncActionsToAsana } from '../../lib/jobs/sync-actions-to-asana.js';
import { runClientHealthScoring } from '../../lib/jobs/client-health.js';
import { runTrafficLightAlerts } from '../../lib/jobs/traffic-light.js';
import { syncXero } from '../../lib/jobs/sync-xero.js';
import { syncGoogleAds } from '../../lib/jobs/sync-google-ads.js';
import { syncMetaAds } from '../../lib/jobs/sync-meta-ads.js';
import { syncGhl } from '../../lib/jobs/sync-ghl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');

/**
 * Run a script and return a promise with stdout/stderr.
 *
 * NOTE: this pattern only works for scripts we haven't yet ported to Turso.
 * On Vercel serverless, `npx tsx` is unavailable and the local sql.js file
 * doesn't exist — any script that depends on those will silently fail. The
 * /monitors route now runs in-process; daily-brief, health-score,
 * traffic-light, and sync-actions-to-asana remain on this shim as a known
 * follow-up (they mostly hit external APIs + Turso, similar port needed).
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
   * GET /daily-brief — Run the daily Slack brief (Vercel Cron)
   * Auth handled by the server.ts onRequest hook for /api/cron/* paths.
   */
  app.get('/daily-brief', async (_request, reply) => {
    const scriptPath = resolve(PROJECT_ROOT, 'scripts/automation/daily-slack-brief.ts');

    try {
      const { stdout } = await runScript(scriptPath);
      return reply.send({
        ok: true,
        message: 'Daily brief completed',
        output: stdout.slice(-2000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/daily-brief] Failed:', msg);
      return reply.code(500).send({
        ok: false,
        message: 'Daily brief failed',
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
   * GET /traffic-light — Run traffic light alerts (Vercel Cron — 1st of month, after scoring)
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
};
