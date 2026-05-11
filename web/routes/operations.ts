import type { FastifyPluginAsync } from 'fastify';
import { getMonitorAlerts, getMonitorAlertStats, logOperationRun } from '../lib/queries/operations.js';
import { listHeartbeats } from '../lib/jobs/heartbeat.js';

// In-process monitors (Wave R / R2) — these replace the old
// `exec('npx tsx scripts/monitors/*.ts')` shim, which silently failed
// on Vercel because tsx + the sql.js DB aren't available there.
import { run as runAsanaOverdue } from '../lib/monitors/asana-overdue.js';
import { run as runMetaCpl } from '../lib/monitors/meta-cpl.js';
import { run as runMetaRoas } from '../lib/monitors/meta-roas.js';
import { run as runGadsCpa } from '../lib/monitors/gads-cpa.js';
import { run as runAdSpendPacing } from '../lib/monitors/ad-spend-pacing.js';
import { run as runContractRenewal } from '../lib/monitors/contract-renewal.js';
import { run as runFathomFailsafe } from '../lib/monitors/fathom-failsafe.js';
import { runAllMonitors } from '../lib/monitors/run-all.js';

// In-process automations
import { syncActionsToAsana } from '../lib/jobs/sync-actions-to-asana.js';
import { runTrafficLightAlerts } from '../lib/jobs/traffic-light.js';

interface MonitorDef {
  name: string;
  label: string;
  type: 'monitor' | 'automation';
  /** In-process runner. Returning anything truthy is treated as success. */
  run: () => Promise<unknown>;
}

const SCRIPTS: MonitorDef[] = [
  { name: 'asana-overdue',   label: 'Asana Overdue',     type: 'monitor',    run: runAsanaOverdue },
  { name: 'meta-cpl',        label: 'Meta CPL Alert',    type: 'monitor',    run: runMetaCpl },
  { name: 'meta-roas',       label: 'Meta ROAS Alert',   type: 'monitor',    run: runMetaRoas },
  { name: 'gads-cpa',        label: 'Google Ads CPA',    type: 'monitor',    run: runGadsCpa },
  { name: 'fathom-failsafe', label: 'Fathom Failsafe',   type: 'monitor',    run: runFathomFailsafe },
  { name: 'ad-pacing',       label: 'Ad Spend Pacing',   type: 'monitor',    run: runAdSpendPacing },
  { name: 'contract-renewal', label: 'Contract Renewal', type: 'monitor',    run: runContractRenewal },
  { name: 'monitor-all',     label: 'Run All Monitors',  type: 'monitor',    run: runAllMonitors },
  { name: 'fathom-asana',    label: 'Fathom → Asana',    type: 'automation', run: syncActionsToAsana },
  { name: 'traffic-light',   label: 'Traffic Light Alerts', type: 'automation', run: runTrafficLightAlerts },
];

const SCRIPT_MAP = new Map(SCRIPTS.map(s => [s.name, s]));

export const operationsRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Main operations hub page
  app.get('/', async (_request, reply) => {
    const [alerts, stats, heartbeats] = await Promise.all([
      getMonitorAlerts(50),
      getMonitorAlertStats(),
      listHeartbeats().catch(() => []),
    ]);

    const monitors = SCRIPTS.filter(s => s.type === 'monitor');
    const automations = SCRIPTS.filter(s => s.type === 'automation');

    return reply.render('operations', {
      alerts,
      stats,
      monitors,
      automations,
      heartbeats,
    });
  });

  // GET /alerts — HTMX partial returning just the alerts table rows
  app.get('/alerts', async (_request, reply) => {
    const alerts = await getMonitorAlerts(50);
    return reply.render('operations-alerts', { alerts });
  });

  // POST /run/:script — Trigger a monitor or automation in-process.
  //
  // Returns 202 immediately so the HTMX button feels snappy; the
  // monitor finishes in the background. Errors are logged but never
  // bubbled to the user (the alerts feed will surface them).
  app.post<{ Params: { script: string } }>('/run/:script', async (request, reply) => {
    const scriptName = request.params.script;
    const def = SCRIPT_MAP.get(scriptName);

    if (!def) {
      return reply.code(400).send({ ok: false, message: `Unknown script: ${scriptName}` });
    }

    await logOperationRun(scriptName);

    // Fire-and-forget. Each in-process runner has its own dedup + alert
    // recording, so we don't need to track the run state here beyond the
    // logOperationRun call above (the operations_runs table).
    def.run()
      .then(() => console.log(`[operations] ${scriptName} ran`))
      .catch((err) => console.error(`[operations] ${scriptName} failed:`,
        err instanceof Error ? err.message : String(err)));

    return reply.code(202).send({ ok: true, message: `Running ${def.label}...` });
  });
};
