/**
 * Manual runner for the Meta ad spend → Paid Social Clients sheet job.
 *
 *   npm run sheet:ad-spend -- --dry-run
 *   npm run sheet:ad-spend -- --month 2026-09
 *   npm run sheet:ad-spend
 *
 * --dry-run prints every intended cell (and which ad accounts fed it)
 * without touching the sheet. Always worth running first.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync } from 'fs';
import { runAdSpendSheet } from '../../web/lib/jobs/ad-spend-sheet.js';

// Same local fallback as sheet:deliverables — the token file written by
// `npm run sheets:auth`. On Vercel the env var is the only source.
const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const monthIdx = args.indexOf('--month');
const month = monthIdx >= 0 ? args[monthIdx + 1] : undefined;

const result = await runAdSpendSheet({ dryRun, month });

console.log('');
console.log(`Tab:   ${result.tab}`);
console.log(`Mode:  ${result.dryRun ? 'DRY RUN — nothing written' : 'LIVE'}`);

if (result.skipped) console.log(`\nNothing to do: ${result.skipped}`);

for (const ms of result.months) {
  console.log('');
  console.log(`${ms.month} → column ${ms.column}${ms.created ? ' (new column)' : ' (restated)'}`);
  const width = Math.max(...ms.rows.map((r) => r.account.length), 12);
  for (const r of ms.rows) {
    console.log(
      `  ${r.account.padEnd(width)}  ${String(r.row).padStart(3)}  £${r.gbp.toFixed(2).padStart(10)}` +
        (r.sources.length ? `  ← ${r.sources.join(' + ')}` : ''),
    );
  }
  for (const u of ms.unconvertible) console.log(`  SKIPPED (currency): ${u}`);
}

if (result.unmatchedRows.length > 0) {
  console.log('\nSheet rows with no ad account (left untouched):');
  for (const r of result.unmatchedRows) console.log(`  - ${r}`);
}
if (result.unmatchedAccounts.length > 0) {
  console.log('\nAd accounts with spend but no sheet row:');
  for (const a of result.unmatchedAccounts) console.log(`  - ${a}`);
}

if (!result.dryRun) console.log(`\nCells written: ${result.cellsWritten}`);
console.log(`Done in ${result.durationMs}ms`);
