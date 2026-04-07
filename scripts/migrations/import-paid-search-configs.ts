/**
 * One-time import: populate client_service_configs for paid_search
 * from the exported Google Sheets CSV.
 *
 * Usage: npx tsx scripts/migrations/import-paid-search-configs.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb } from '../utils/db.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const csvPath = resolve(process.env.HOME || '', 'Downloads/Vendo Digital Paid Search Clients (Google Ads, Microsoft & Meta).xlsx - GAds Clients.csv');

  console.log(`Reading CSV from: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const db = await getDb();
  await initSchema();

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const parts = parseCsvLine(line);

    // Skip header/legend rows
    const first = (parts[0] || '').trim().toLowerCase();
    if (!first || first === 'account name' || first.startsWith('am hrs') || first.startsWith('cm hrs') || first.startsWith('*')) {
      skipped++;
      continue;
    }

    const clientName = parts[0].trim();
    if (!clientName) { skipped++; continue; }

    const am = (parts[1] || '').trim() || null;
    const cm = (parts[2] || '').trim() || null;
    const level = (parts[3] || 'Auto').trim();
    const calls = parseInt(parts[4] || '1', 10) || 1;
    const amHrs = parseFloat(parts[5] || '2') || 2;
    const cmHrs = parseFloat(parts[6] || '2') || 2;
    const tier = parseInt(parts[7] || '3', 10) || 3;

    // Budget: strip £, €, commas
    const budgetRaw = (parts[8] || '0').replace(/[£€$,\s"]/g, '');
    const budget = parseFloat(budgetRaw) || 0;
    const currency = (parts[8] || '').includes('€') ? 'EUR' : 'GBP';

    db.run(
      `INSERT INTO client_service_configs (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, budget, currency, status, created_at, updated_at)
       VALUES (?, 'paid_search', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
       ON CONFLICT(client_name, service_type) DO UPDATE SET
         am = excluded.am, cm = excluded.cm, level = excluded.level, tier = excluded.tier,
         calls = excluded.calls, am_hrs = excluded.am_hrs, cm_hrs = excluded.cm_hrs,
         budget = excluded.budget, currency = excluded.currency, updated_at = datetime('now')`,
      [clientName, am, cm, level, tier, calls, amHrs, cmHrs, budget, currency]
    );

    console.log(`  ✓ ${clientName} — AM:${am} CM:${cm} Lvl:${level} T${tier} ${calls}calls ${amHrs}/${cmHrs}hrs £${budget}`);
    imported++;
  }

  saveDb();
  console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
}

main().catch(console.error);
