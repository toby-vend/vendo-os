/**
 * Run All Monitors — orchestrator
 *
 * Imports and runs all 7 monitors in sequence.
 * Each is wrapped in try/catch so one failure does not stop the rest.
 *
 * Usage:
 *   npx tsx scripts/monitors/run-all-monitors.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { closeDb, log, logError } from '../utils/db.js';

interface MonitorResult {
  name: string;
  checked: number;
  flagged: number;
  error?: string;
}

async function main() {
  const startTime = Date.now();
  log('MONITORS', 'Starting all monitors...');

  const results: MonitorResult[] = [];

  const monitors: Array<{ name: string; importPath: string }> = [
    { name: 'asana-overdue', importPath: './asana-overdue.js' },
    { name: 'meta-cpl', importPath: './meta-cpl-alert.js' },
    { name: 'meta-roas', importPath: './meta-roas-alert.js' },
    { name: 'gads-cpa', importPath: './gads-cpa-alert.js' },
    { name: 'fathom-failsafe', importPath: './fathom-failsafe.js' },
    { name: 'ad-spend-pacing', importPath: './ad-spend-pacing.js' },
    { name: 'contract-renewal', importPath: './contract-renewal.js' },
  ];

  for (const monitor of monitors) {
    try {
      log('MONITORS', `Running ${monitor.name}...`);
      const mod = await import(monitor.importPath);
      const result = await mod.run();
      results.push({
        name: monitor.name,
        checked: result?.checked ?? 0,
        flagged: result?.flagged ?? 0,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logError('MONITORS', `${monitor.name} failed: ${errorMsg}`);
      results.push({
        name: monitor.name,
        checked: 0,
        flagged: 0,
        error: errorMsg,
      });
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  const totalFlagged = results.reduce((sum, r) => sum + r.flagged, 0);

  log('MONITORS', `\n--- Monitor Summary (${elapsed}s) ---`);
  log('MONITORS', `  Ran: ${monitors.length} | Succeeded: ${succeeded.length} | Failed: ${failed.length} | Total flagged: ${totalFlagged}`);

  for (const r of results) {
    const status = r.error ? `FAILED: ${r.error}` : `checked ${r.checked}, flagged ${r.flagged}`;
    log('MONITORS', `  ${r.error ? '✗' : '✓'} ${r.name}: ${status}`);
  }

  closeDb();

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  logError('MONITORS', 'Orchestrator failed', err);
  process.exit(1);
});
