/**
 * Writes one month of Meta ad spend into the Paid Social Clients tab.
 * Driven by the /ad-spend-sheet command, which reads the spend from Ads
 * Reporting in Chrome and saves it to data/ad-spend/YYYY-MM.json.
 *
 *   npm run sheet:ad-spend -- --missing
 *   npm run sheet:ad-spend -- --input data/ad-spend/2026-09.json --dry-run
 *   npm run sheet:ad-spend -- --input data/ad-spend/2026-09.json
 *
 * --missing prints the completed months that still need a column (oldest
 * first, one per line) and exits.
 *
 * Input file shape — amounts exactly as Ads Reporting shows them:
 *   { "month": "2026-09", "accounts": [["MR Mouldings", "£9,253.78"], ...] }
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync } from 'fs';
import {
  runAdSpendSheet,
  listMissingMonths,
  parseAmount,
} from '../../web/lib/jobs/ad-spend-sheet.js';

// Same local fallback as sheet:deliverables — the token file written by
// `npm run sheets:auth`.
const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

const args = process.argv.slice(2);

if (args.includes('--missing')) {
  for (const m of await listMissingMonths()) console.log(m);
  process.exit(0);
}

const inputIdx = args.indexOf('--input');
if (inputIdx < 0 || !args[inputIdx + 1]) {
  console.error('Usage: --missing | --input <file.json> [--dry-run]');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(args[inputIdx + 1], 'utf-8')) as {
  month: string;
  accounts: Array<[string, string]>;
};

const result = await runAdSpendSheet(
  {
    month: raw.month,
    accounts: raw.accounts.map(([name, amount]) => ({ name, ...parseAmount(amount) })),
  },
  { dryRun: args.includes('--dry-run') },
);

console.log('');
console.log(`Tab:    ${result.tab}`);
console.log(`Month:  ${result.month} → column ${result.column}${result.created ? ' (new column)' : ' (restated)'}`);
console.log(`Mode:   ${result.dryRun ? 'DRY RUN — nothing written' : 'LIVE'}`);
console.log(
  `Rates:  ${Object.entries(result.rates)
    .filter(([c]) => c !== 'GBP')
    .map(([c, r]) => `1 ${c} = £${r.toFixed(4)}`)
    .join(', ') || 'GBP only'}`,
);
console.log('');

const width = Math.max(...result.rows.map((r) => r.account.length), 12);
for (const r of result.rows) {
  console.log(
    `${r.account.padEnd(width)}  ${String(r.row).padStart(3)}  £${r.gbp.toFixed(2).padStart(10)}  ← ${r.sources.join(' + ')}`,
  );
}

if (result.unmatchedRows.length > 0) {
  console.log('\nSheet rows with no ad account spend (left untouched):');
  for (const r of result.unmatchedRows) console.log(`  - ${r}`);
}
if (result.unmatchedAccounts.length > 0) {
  console.log('\nAd accounts with spend but no sheet row:');
  for (const a of result.unmatchedAccounts) console.log(`  - ${a}`);
}

if (!result.dryRun) console.log(`\nCells written: ${result.cellsWritten}`);
console.log(`Done in ${result.durationMs}ms`);
