/**
 * Sync paid_social client_service_configs to match the canonical sheet
 * (screenshot dated 2026-04-20). Targets Turso directly.
 *
 * Notes:
 *   - `Dentistry.ie` is renamed to `Ravensdale Dental Group` (drop-and-insert).
 *   - `Pearl Dental` is removed.
 *   - `Woodberry Down` is added.
 *   - Tier 1 = Pro, Tier 2 = Semi Pro, Tier 3 = Auto.
 *
 * Usage: npx tsx scripts/migrations/sync-paid-social-2026-04-20.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';

type Row = {
  name: string;
  am: string;
  cm: string;
  calls: number;
  amHrs: number;
  cmHrs: number;
  csHrs: number;
  tier: 1 | 2 | 3;
  budget: number;
  currency: 'GBP' | 'EUR';
};

const TARGET: Row[] = [
  { name: 'Ravensdale Dental Group', am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 4, cmHrs: 8,  csHrs: 6, tier: 1, budget: 16000, currency: 'EUR' },
  { name: 'MR Mouldings',            am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 4, cmHrs: 10, csHrs: 4, tier: 1, budget: 7500,  currency: 'GBP' },
  { name: 'The Sword Stall',         am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 4, cmHrs: 8,  csHrs: 4, tier: 1, budget: 7500,  currency: 'GBP' },
  { name: 'Veltuff',                 am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 4, cmHrs: 6,  csHrs: 4, tier: 1, budget: 4000,  currency: 'GBP' },
  { name: 'Kana Health',             am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 3, cmHrs: 6,  csHrs: 4, tier: 1, budget: 3000,  currency: 'GBP' },
  { name: 'Avenue Dental',           am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 2, cmHrs: 4,  csHrs: 2, tier: 1, budget: 2000,  currency: 'GBP' },
  { name: 'Lakewood Dental',         am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 2, cmHrs: 4,  csHrs: 2, tier: 1, budget: 2000,  currency: 'GBP' },
  { name: 'St Clears Dental Studio', am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 2,  csHrs: 2, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Thornley Park Dental',    am: 'SS', cm: 'SS',      calls: 2, amHrs: 2, cmHrs: 4,  csHrs: 2, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Zen House Dental',        am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 2,  csHrs: 2, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Billericay Dental Care',  am: 'SS', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 2, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Bright Orthodontics',     am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 2, cmHrs: 1,  csHrs: 3, tier: 1, budget: 2000,  currency: 'GBP' },
  { name: 'Iconic Dent',             am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Just Smile Dental',       am: 'SS', cm: 'SS',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Smile For Life',          am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Lateral Dental Clinic',   am: 'SS', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Peak Dental',             am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'R-Dental',                am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 2,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Rothley Lodge',           am: 'SS', cm: 'SS',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Signature Smiles',        am: 'SS', cm: 'SS',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Swinnow Dental',          am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Thornbury Dental Wellness', am: 'AC', cm: 'AC',    calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Sone Marketing',          am: 'SS', cm: 'SS',      calls: 2, amHrs: 2, cmHrs: 2,  csHrs: 3, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Woodberry Down',          am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Stamford Dental Care',    am: 'AC', cm: 'AC',      calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 1, tier: 2, budget: 2000,  currency: 'GBP' },
  { name: 'Access Platform Sales',   am: 'SS', cm: 'SS / AC', calls: 2, amHrs: 2, cmHrs: 3,  csHrs: 2, tier: 3, budget: 1000,  currency: 'GBP' },
  { name: 'Colbrans Home Solutions', am: 'AC', cm: 'AC',      calls: 1, amHrs: 2, cmHrs: 2,  csHrs: 1, tier: 3, budget: 1000,  currency: 'GBP' },
  { name: 'DK Dental Clinic',        am: 'SS', cm: 'SS',      calls: 1, amHrs: 2, cmHrs: 2,  csHrs: 1, tier: 3, budget: 1000,  currency: 'GBP' },
  { name: 'Studio Glide',            am: 'AC', cm: 'AC',      calls: 1, amHrs: 2, cmHrs: 2,  csHrs: 1, tier: 3, budget: 1000,  currency: 'GBP' },
];

// Clients that must be removed from paid_social entirely.
const REMOVE: string[] = ['Pearl Dental', 'Dentistry.ie'];

function levelFor(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'Pro' : tier === 2 ? 'Semi Pro' : 'Auto';
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL missing');

  const db = createClient({ url, authToken: token });

  // Snapshot before
  const before = await db.execute(
    `SELECT client_name, am, cm, tier, calls, am_hrs, cm_hrs, cs_hrs, budget, currency
     FROM client_service_configs WHERE service_type = 'paid_social' ORDER BY budget DESC, client_name`
  );
  console.log(`\nBefore: ${before.rows.length} paid_social rows on Turso\n`);

  // 1. Remove rows that should no longer exist
  for (const name of REMOVE) {
    const res = await db.execute({
      sql: `DELETE FROM client_service_configs WHERE client_name = ? AND service_type = 'paid_social'`,
      args: [name],
    });
    console.log(`  – removed ${name} (${res.rowsAffected} row${res.rowsAffected === 1 ? '' : 's'})`);
  }

  // 2. Upsert target rows
  for (const row of TARGET) {
    await db.execute({
      sql: `INSERT INTO client_service_configs
              (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, cs_hrs, budget, currency, status, created_at, updated_at)
            VALUES (?, 'paid_social', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
            ON CONFLICT(client_name, service_type) DO UPDATE SET
              am = excluded.am,
              cm = excluded.cm,
              level = excluded.level,
              tier = excluded.tier,
              calls = excluded.calls,
              am_hrs = excluded.am_hrs,
              cm_hrs = excluded.cm_hrs,
              cs_hrs = excluded.cs_hrs,
              budget = excluded.budget,
              currency = excluded.currency,
              status = 'active',
              updated_at = datetime('now')`,
      args: [
        row.name, row.am, row.cm, levelFor(row.tier), row.tier,
        row.calls, row.amHrs, row.cmHrs, row.csHrs,
        row.budget, row.currency,
      ],
    });
    const sym = row.currency === 'EUR' ? '€' : '£';
    console.log(`  ✓ ${row.name.padEnd(30)} ${row.am.padEnd(3)}/${row.cm.padEnd(8)} T${row.tier} ${row.calls}c ${row.amHrs}/${row.cmHrs}/${row.csHrs}h ${sym}${row.budget.toLocaleString('en-GB')}`);
  }

  // Snapshot after
  const after = await db.execute(
    `SELECT client_name, am, cm, tier, calls, am_hrs, cm_hrs, cs_hrs, budget, currency
     FROM client_service_configs WHERE service_type = 'paid_social' ORDER BY budget DESC, client_name`
  );
  console.log(`\nAfter: ${after.rows.length} paid_social rows on Turso`);

  // Sanity check: every TARGET row is present with the exact expected values.
  const byName = new Map(after.rows.map(r => [r.client_name as string, r]));
  let mismatches = 0;
  for (const row of TARGET) {
    const got = byName.get(row.name);
    if (!got) { console.error(`  ✗ MISSING: ${row.name}`); mismatches++; continue; }
    const checks: Array<[string, unknown, unknown]> = [
      ['am', got.am, row.am], ['cm', got.cm, row.cm],
      ['tier', Number(got.tier), row.tier], ['calls', Number(got.calls), row.calls],
      ['am_hrs', Number(got.am_hrs), row.amHrs],
      ['cm_hrs', Number(got.cm_hrs), row.cmHrs],
      ['cs_hrs', Number(got.cs_hrs), row.csHrs],
      ['budget', Number(got.budget), row.budget],
      ['currency', got.currency, row.currency],
    ];
    for (const [k, a, b] of checks) {
      if (a !== b) { console.error(`  ✗ ${row.name}.${k}: got ${a} expected ${b}`); mismatches++; }
    }
  }
  for (const name of REMOVE) {
    if (byName.has(name)) { console.error(`  ✗ ${name} still present`); mismatches++; }
  }

  if (mismatches) {
    console.error(`\n${mismatches} mismatch(es) detected`);
    process.exit(1);
  }
  console.log('\nAll rows verified against target.');
}

main().catch(err => { console.error(err); process.exit(1); });
