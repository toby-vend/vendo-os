/**
 * One-time import: populate client_service_configs for seo
 * from the exported SEO Clients CSV.
 *
 * CSV columns: Account name, AM, CM, OM, Calls, AM(Hrs), CM(Hrs), OM(Hrs), Backlinks, Tier, Package, ...
 * CM Hrs stored as CM + OM combined hours.
 *
 * Usage: npx tsx scripts/migrations/import-seo-configs.ts
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
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

async function main() {
  const csvPath = resolve(process.env.HOME || '', 'Downloads/Vendo Digital SEO Clients  - SEO Clients.csv');

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
    if (!first || first === 'account name' || first.startsWith('vendo') || first.startsWith('am') || first.startsWith('cm') || first.startsWith('om')) {
      skipped++;
      continue;
    }

    const clientName = parts[0].trim();
    if (!clientName) { skipped++; continue; }

    // Columns: 0=name, 1=AM, 2=CM, 3=OM, 4=Calls, 5=AM Hrs, 6=CM Hrs, 7=OM Hrs, 8=Backlinks, 9=Tier, 10=Package
    const am = (parts[1] || '').trim() || null;
    const cm = (parts[2] || '').trim() || null;
    const calls = parseInt(parts[4] || '1', 10) || 1;
    const amHrs = parseFloat(parts[5] || '2') || 2;
    const cmHrs = parseFloat(parts[6] || '1') || 1;
    const omHrs = parseFloat(parts[7] || '0') || 0;
    const totalCmHrs = cmHrs + omHrs;
    const tier = parseInt(parts[9] || '3', 10) || 3;
    const level = (parts[10] || 'Bronze').trim();

    // No explicit budget in SEO CSV — set to 0
    const budget = 0;

    db.run(
      `INSERT INTO client_service_configs (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, budget, currency, status, created_at, updated_at)
       VALUES (?, 'seo', ?, ?, ?, ?, ?, ?, ?, ?, 'GBP', 'active', datetime('now'), datetime('now'))
       ON CONFLICT(client_name, service_type) DO UPDATE SET
         am = excluded.am, cm = excluded.cm, level = excluded.level, tier = excluded.tier,
         calls = excluded.calls, am_hrs = excluded.am_hrs, cm_hrs = excluded.cm_hrs,
         budget = excluded.budget, updated_at = datetime('now')`,
      [clientName, am, cm, level, tier, calls, amHrs, totalCmHrs, budget]
    );

    console.log(`  ✓ ${clientName} — AM:${am} CM:${cm} T${tier} ${level} ${calls}calls AM:${amHrs}h CM+OM:${totalCmHrs}h`);
    imported++;
  }

  saveDb();
  console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
}

main().catch(console.error);
