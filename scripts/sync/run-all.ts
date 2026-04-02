#!/usr/bin/env tsx
/**
 * Unified sync orchestrator — runs all data syncs in sequence.
 *
 * Usage:
 *   npx tsx scripts/sync/run-all.ts              # Run all syncs
 *   npx tsx scripts/sync/run-all.ts --no-push    # Skip Turso push
 *   npx tsx scripts/sync/run-all.ts --only meetings,xero  # Run specific syncs only
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

interface SyncStep {
  name: string;
  command: string;
  optional?: boolean; // if true, missing env vars won't count as failure
}

const SYNC_STEPS: SyncStep[] = [
  { name: 'meetings', command: 'npx tsx scripts/sync/sync-meetings.ts' },
  { name: 'xero', command: 'npx tsx scripts/sync/sync-xero.ts' },
  { name: 'ghl', command: 'npx tsx scripts/sync/sync-ghl.ts' },
  { name: 'lead-attribution', command: 'npx tsx scripts/functions/lead-attribution.ts', optional: true },
  { name: 'meta-ads', command: 'npx tsx scripts/sync/sync-meta-ads.ts' },
  { name: 'google-ads', command: 'npx tsx scripts/sync/sync-google-ads.ts' },
  { name: 'ga4', command: 'npx tsx scripts/sync/sync-ga4.ts' },
  { name: 'asana', command: 'npx tsx scripts/sync/sync-asana.ts' },
  { name: 'drive', command: 'npx tsx scripts/sync/sync-drive.ts', optional: true },
  { name: 'brands', command: 'npx tsx scripts/sync/sync-brands.ts', optional: true },
];

interface StepResult {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// Parse args
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');
const onlyIdx = args.indexOf('--only');
const onlyNames = onlyIdx !== -1 ? args[onlyIdx + 1]?.split(',') : null;

function runStep(step: SyncStep): StepResult {
  const start = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${step.name.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    execSync(step.command, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      timeout: 5 * 60 * 1000, // 5-minute timeout per sync
      env: { ...process.env },
    });
    const durationMs = Date.now() - start;
    return { name: step.name, success: true, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { name: step.name, success: false, durationMs, error: message };
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`\nVendo OS — Sync All`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Filter steps if --only specified
  const steps = onlyNames
    ? SYNC_STEPS.filter(s => onlyNames.includes(s.name))
    : SYNC_STEPS;

  const results: StepResult[] = [];

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);
  }

  // Push to Turso unless --no-push
  if (!noPush) {
    const pushResult = runStep({
      name: 'push-to-turso',
      command: 'npx tsx scripts/sync/push-to-turso.ts',
    });
    results.push(pushResult);
  }

  // Summary
  const totalMs = Date.now() - startTime;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('  SYNC SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  const nameWidth = Math.max(...results.map(r => r.name.length), 6);
  console.log(`  ${'Name'.padEnd(nameWidth)}  Status    Duration`);
  console.log(`  ${'-'.repeat(nameWidth)}  --------  --------`);

  for (const r of results) {
    const status = r.success ? 'OK' : 'FAILED';
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
    const icon = r.success ? '  ' : '! ';
    console.log(`${icon}${r.name.padEnd(nameWidth)}  ${status.padEnd(10)}${duration}`);
  }

  console.log('');
  console.log(`  Total: ${passed} passed, ${failed} failed in ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Completed: ${new Date().toISOString()}`);
  console.log('');

  // Exit with failure code if any non-optional sync failed
  const criticalFailures = results.filter(r => {
    if (r.success) return false;
    const step = SYNC_STEPS.find(s => s.name === r.name);
    return !step?.optional;
  });

  if (criticalFailures.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Orchestrator failed:', err);
  process.exit(1);
});
