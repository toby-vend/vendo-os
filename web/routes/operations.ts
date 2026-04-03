import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getMonitorAlerts, getMonitorAlertStats, logOperationRun } from '../lib/queries/operations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

interface MonitorDef {
  name: string;
  label: string;
  script: string;
  type: 'monitor' | 'automation';
}

const SCRIPTS: MonitorDef[] = [
  { name: 'asana-overdue', label: 'Asana Overdue', script: 'scripts/monitors/asana-overdue.ts', type: 'monitor' },
  { name: 'meta-cpl', label: 'Meta CPL Alert', script: 'scripts/monitors/meta-cpl-alert.ts', type: 'monitor' },
  { name: 'meta-roas', label: 'Meta ROAS Alert', script: 'scripts/monitors/meta-roas-alert.ts', type: 'monitor' },
  { name: 'gads-cpa', label: 'Google Ads CPA', script: 'scripts/monitors/gads-cpa-alert.ts', type: 'monitor' },
  { name: 'fathom-failsafe', label: 'Fathom Failsafe', script: 'scripts/monitors/fathom-failsafe.ts', type: 'monitor' },
  { name: 'ad-pacing', label: 'Ad Spend Pacing', script: 'scripts/monitors/ad-spend-pacing.ts', type: 'monitor' },
  { name: 'contract-renewal', label: 'Contract Renewal', script: 'scripts/monitors/contract-renewal.ts', type: 'monitor' },
  { name: 'monitor-all', label: 'Run All Monitors', script: 'scripts/monitors/run-all-monitors.ts', type: 'monitor' },
  { name: 'fathom-asana', label: 'Fathom → Asana', script: 'scripts/automation/fathom-to-asana.ts', type: 'automation' },
  { name: 'traffic-light', label: 'Traffic Light Alerts', script: 'scripts/automation/traffic-light-alerts.ts', type: 'automation' },
  { name: 'daily-brief', label: 'Daily Slack Brief', script: 'scripts/automation/daily-slack-brief.ts', type: 'automation' },
];

const SCRIPT_MAP = new Map(SCRIPTS.map(s => [s.name, s]));

export const operationsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Main operations hub page
  app.get('/', async (_request, reply) => {
    const [alerts, stats] = await Promise.all([
      getMonitorAlerts(50),
      getMonitorAlertStats(),
    ]);

    const monitors = SCRIPTS.filter(s => s.type === 'monitor');
    const automations = SCRIPTS.filter(s => s.type === 'automation');

    return reply.render('operations', {
      alerts,
      stats,
      monitors,
      automations,
    });
  });

  // GET /alerts — HTMX partial returning just the alerts table rows
  app.get('/alerts', async (_request, reply) => {
    const alerts = await getMonitorAlerts(50);
    return reply.render('operations-alerts', { alerts });
  });

  // POST /run/:script — Trigger a monitor or automation script
  app.post<{ Params: { script: string } }>('/run/:script', async (request, reply) => {
    const scriptName = request.params.script;
    const def = SCRIPT_MAP.get(scriptName);

    if (!def) {
      return reply.code(400).send({ ok: false, message: `Unknown script: ${scriptName}` });
    }

    const scriptPath = resolve(PROJECT_ROOT, def.script);

    // Log the run
    await logOperationRun(scriptName);

    // Spawn the script in background — don't wait for completion
    exec(`npx tsx ${scriptPath}`, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[operations] ${scriptName} failed:`, error.message);
      }
      if (stdout) console.log(`[operations] ${scriptName} stdout:`, stdout);
      if (stderr) console.error(`[operations] ${scriptName} stderr:`, stderr);
    });

    return reply.send({ ok: true, message: `Running ${def.label}...` });
  });
};
