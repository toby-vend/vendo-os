import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runAllMonitors } from '../../lib/monitors/run-all.js';

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
    const scriptPath = resolve(PROJECT_ROOT, 'scripts/automation/fathom-to-asana.ts');

    try {
      const { stdout } = await runScript(scriptPath);
      return reply.send({
        ok: true,
        message: 'Action-to-Asana sync completed',
        output: stdout.slice(-2000),
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
    const scriptPath = resolve(PROJECT_ROOT, 'scripts/functions/client-health.ts');

    try {
      const { stdout } = await runScript(scriptPath);
      return reply.send({
        ok: true,
        message: 'Health scoring completed',
        output: stdout.slice(-2000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/health-score] Failed:', msg);
      return reply.code(500).send({
        ok: false,
        message: 'Health scoring failed',
        error: msg,
      });
    }
  });

  /**
   * GET /traffic-light — Run traffic light alerts (Vercel Cron — 1st of month, after scoring)
   */
  app.get('/traffic-light', async (_request, reply) => {
    const scriptPath = resolve(PROJECT_ROOT, 'scripts/automation/traffic-light-alerts.ts');

    try {
      const { stdout } = await runScript(scriptPath);
      return reply.send({
        ok: true,
        message: 'Traffic light alerts completed',
        output: stdout.slice(-2000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron/traffic-light] Failed:', msg);
      return reply.code(500).send({
        ok: false,
        message: 'Traffic light alerts failed',
        error: msg,
      });
    }
  });
};
