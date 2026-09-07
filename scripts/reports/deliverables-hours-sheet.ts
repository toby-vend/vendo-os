/**
 * Manual runner for the deliverables hours sheet job.
 *
 *   npm run sheet:deliverables -- --dry-run
 *   npm run sheet:deliverables -- --month 2026-09
 *   npm run sheet:deliverables
 *
 * --dry-run computes every intended cell change and prints it without
 * touching the sheet. Always worth running first after a sheet edit.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync } from 'fs';
import { runDeliverablesHoursSheet } from '../../web/lib/jobs/deliverables-hours-sheet.js';

// Locally, fall back to the token file written by `npm run sheets:auth` so a
// dry run works straight after authorising. On Vercel the env var is the only
// source — there is no filesystem to read.
const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const monthIdx = args.indexOf('--month');
const month = monthIdx >= 0 ? args[monthIdx + 1] : undefined;

const result = await runDeliverablesHoursSheet({ dryRun, month });

console.log('');
console.log(`Tab:      ${result.tab}`);
console.log(`Month:    ${result.month}`);
console.log(`User:     ${result.userName}`);
console.log(`Entries:  ${result.entries} Harvest time entries`);
console.log(`Mode:     ${result.dryRun ? 'DRY RUN — nothing written' : 'LIVE'}`);
console.log('');

if (result.planned.length > 0) {
  const width = Math.max(...result.planned.map((p) => p.account.length), 12);
  console.log(`${'Account'.padEnd(width)}  Row   AM     CM     ← Harvest client`);
  console.log('-'.repeat(width + 40));
  for (const p of result.planned) {
    console.log(
      `${p.account.padEnd(width)}  ${String(p.row).padStart(3)}  ` +
        `${p.amHours.toFixed(2).padStart(5)}  ${p.cmHours.toFixed(2).padStart(5)}  ` +
        `${p.harvestClient === p.account ? '' : `← ${p.harvestClient}`}`,
    );
  }
  console.log('');
}

if (!result.dryRun) console.log(`Cells written: ${result.written}`);

if (result.unmatchedRows.length > 0) {
  console.log('');
  console.log('Sheet rows with no Harvest client match (left untouched):');
  for (const r of result.unmatchedRows) console.log(`  - ${r}`);
}

if (result.unmatchedClients.length > 0) {
  console.log('');
  console.log('Harvest clients with hours but no row on this tab:');
  for (const c of result.unmatchedClients) console.log(`  - ${c}`);
}

console.log('');
console.log(`Done in ${result.durationMs}ms`);
