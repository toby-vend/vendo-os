/**
 * Standalone runner for the codebase-health scan — preview, debug, and
 * fire manually without waiting for the 06:30 cron.
 *
 * Flags:
 *   --dry          run the full scan but skip DB writes and Slack DM
 *   --no-slack     run + persist, skip Slack DM only
 *   --static-only  skip the LLM review layer (cheap; tsc/audit/etc only)
 *   --since=N      override the changed-files window (default 7 days)
 *   --cap=N        override the LLM file cap (default 50)
 *   --concurrency=N override LLM concurrency (default 5)
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/agents/codebase-health-preview.ts --dry
 *   npm run scan:codehealth -- --dry
 */
import { runScan } from '../../web/lib/code-health/scan.js';

function arg(name: string, fallback?: string): string | undefined {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? '' : fallback;
}

function num(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const dryRun = process.argv.includes('--dry');
const staticOnly = process.argv.includes('--static-only');
const sinceDays = num(arg('since'), 7);
const fileCap = num(arg('cap'), 50);
const concurrency = num(arg('concurrency'), 5);

console.log(`[code-health/preview] dry=${dryRun} staticOnly=${staticOnly} since=${sinceDays}d cap=${fileCap} concurrency=${concurrency}`);

const t0 = Date.now();
const summary = await runScan({
  trigger: 'manual',
  dryRun,
  staticOnly,
  sinceDays,
  fileCap,
  concurrency,
});

console.log('');
console.log(`Scan complete in ${(Date.now() - t0) / 1000}s`);
console.log(`  status:       ${summary.status}`);
console.log(`  files:        ${summary.filesScanned}`);
console.log(`  new:          ${summary.findingsNew}`);
console.log(`  persisting:   ${summary.findingsPersisting}`);
console.log(`  resolved:     ${summary.findingsResolved}`);
console.log(`  duration:     ${summary.durationMs}ms`);
console.log(`  cost:         ${summary.costUsd !== null ? `$${summary.costUsd.toFixed(4)}` : '—'}`);
if (summary.error) console.log(`  error:        ${summary.error}`);

if (summary.topFindings.length > 0) {
  console.log('');
  console.log('Top open findings:');
  for (const f of summary.topFindings) {
    const loc = f.line_start ? `${f.file_path}:${f.line_start}` : f.file_path;
    console.log(`  [${f.severity}] (${f.finding_type}, ${f.source}) ${loc} — ${f.title}`);
  }
}
