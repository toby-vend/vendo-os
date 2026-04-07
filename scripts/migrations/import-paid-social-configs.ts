/**
 * One-time import: populate client_service_configs for paid_social
 * from the exported Paid Social Clients CSV.
 *
 * CSV columns: Account name, AM, CM, CS, CP, Calls, AM Hrs, CM Hrs, CS Hrs, CP Hrs, Tier, Budget, ...
 *
 * Usage: npx tsx scripts/migrations/import-paid-social-configs.ts
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
  const csvPath = resolve(process.env.HOME || '', 'Downloads/Vendo Paid Social Clients _ Creative Team - Paid Social Clients.csv');

  console.log(`Reading CSV from: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const db = await getDb();
  await initSchema();

  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const parts = parseCsvLine(line);

    const first = (parts[0] || '').trim().toLowerCase();
    // Skip header/legend rows
    if (!first || first === 'account name' || first.startsWith('vendo paid') || first.startsWith('am hrs') || first.startsWith('cs') || first.startsWith('cp') || first.startsWith('cm')) {
      skipped++;
      continue;
    }

    const clientName = parts[0].trim();
    if (!clientName) { skipped++; continue; }

    // Columns: 0=name, 1=AM, 2=CM, 3=CS, 4=CP, 5=Calls, 6=AM Hrs, 7=CM Hrs, 8=CS Hrs, 9=CP Hrs, 10=Tier, 11=Budget
    const am = (parts[1] || '').trim() || null;
    const cm = (parts[2] || '').trim() || null;
    const calls = parseInt(parts[5] || '2', 10) || 2;
    const amHrs = parseFloat(parts[6] || '2') || 2;
    const cmHrs = parseFloat(parts[7] || '1') || 1;
    const csHrs = parseFloat(parts[8] || '0') || 0;
    const cpHrs = parseFloat(parts[9] || '0') || 0;
    // Store total non-AM hours as cm_hrs (CM + CS + CP)
    const totalCmHrs = cmHrs + csHrs + cpHrs;
    const tier = parseInt(parts[10] || '2', 10) || 2;

    const budgetRaw = (parts[11] || '0').replace(/[£€$,\s"]/g, '');
    const budget = parseFloat(budgetRaw) || 0;
    const currency = (parts[11] || '').includes('€') ? 'EUR' : 'GBP';

    // Level: derive from tier
    const level = tier === 1 ? 'Pro' : tier === 2 ? 'Semi Pro' : 'Auto';

    db.run(
      `INSERT INTO client_service_configs (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, budget, currency, status, created_at, updated_at)
       VALUES (?, 'paid_social', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
       ON CONFLICT(client_name, service_type) DO UPDATE SET
         am = excluded.am, cm = excluded.cm, level = excluded.level, tier = excluded.tier,
         calls = excluded.calls, am_hrs = excluded.am_hrs, cm_hrs = excluded.cm_hrs,
         budget = excluded.budget, currency = excluded.currency, updated_at = datetime('now')`,
      [clientName, am, cm, level, tier, calls, amHrs, totalCmHrs, budget, currency]
    );

    console.log(`  ✓ ${clientName} — AM:${am} CM:${cm} T${tier} ${calls}calls AM:${amHrs}h CM+CS+CP:${totalCmHrs}h £${budget}`);
    imported++;
  }

  saveDb();
  console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
}

main().catch(console.error);
