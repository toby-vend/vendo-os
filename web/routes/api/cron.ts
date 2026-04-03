import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');

/**
 * Run a script and return a promise with stdout/stderr.
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
    const scriptPath = resolve(PROJECT_ROOT, 'scripts/monitors/run-all-monitors.ts');

    try {
      const { stdout } = await runScript(scriptPath);
      return reply.send({
        ok: true,
        message: 'All monitors completed',
        output: stdout.slice(-2000), // Last 2k chars of output
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
};
