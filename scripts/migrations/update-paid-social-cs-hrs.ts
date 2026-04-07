/**
 * Re-import paid_social configs with proper CS hours split.
 * Previously cm_hrs stored CM+CS+CP combined. Now cm_hrs = CM+CP, cs_hrs = CS.
 *
 * Usage: npx tsx scripts/migrations/update-paid-social-cs-hrs.ts
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
  const csvPath = resolve(process.env.HOME || '', 'Downloads/Vendo Paid Social Clients _ Creative Team - Paid Social Clients.csv');
  console.log(`Reading CSV from: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const db = await getDb();
  await initSchema();

  // Add cs_hrs column if missing
  try { db.run('ALTER TABLE client_service_configs ADD COLUMN cs_hrs REAL DEFAULT 0'); } catch { /* exists */ }

  let updated = 0;

  for (const line of lines) {
    const parts = parseCsvLine(line);
    const first = (parts[0] || '').trim().toLowerCase();
    if (!first || first === 'account name' || first.startsWith('vendo') || first.startsWith('am') || first.startsWith('cs') || first.startsWith('cp') || first.startsWith('cm')) continue;

    const clientName = parts[0].trim();
    // Columns: 0=name, 1=AM, 2=CM, 3=CS, 4=CP, 5=Calls, 6=AM Hrs, 7=CM Hrs, 8=CS Hrs, 9=CP Hrs
    const cmHrs = parseFloat(parts[7] || '1') || 1;
    const csHrs = parseFloat(parts[8] || '0') || 0;
    const cpHrs = parseFloat(parts[9] || '0') || 0;
    const totalCmHrs = cmHrs + cpHrs; // CM + CP (not CS)

    db.run(
      `UPDATE client_service_configs SET cm_hrs = ?, cs_hrs = ?, updated_at = datetime('now')
       WHERE client_name = ? AND service_type = 'paid_social'`,
      [totalCmHrs, csHrs, clientName]
    );

    console.log(`  ✓ ${clientName} — CM+CP: ${totalCmHrs}h, CS: ${csHrs}h`);
    updated++;
  }

  saveDb();
  console.log(`\nDone: ${updated} updated`);
}

main().catch(console.error);
