/**
 * Client Offboarding — access revocation, final invoice, data archive, learnings.
 *
 * Usage:
 *   npx tsx scripts/functions/client-offboarding.ts --start "Client Name" "reason"
 *   npx tsx scripts/functions/client-offboarding.ts --status
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

interface ChecklistItem { task: string; owner: string; status: 'pending' | 'done' }

function generateChecklist(): ChecklistItem[] {
  return [
    { task: 'Notify client of contract end and timeline', owner: 'AM', status: 'pending' },
    { task: 'Generate and send final invoice', owner: 'Sarah', status: 'pending' },
    { task: 'Revoke ad platform access (Google/Meta)', owner: 'Specialist', status: 'pending' },
    { task: 'Remove from Slack channel', owner: 'AM', status: 'pending' },
    { task: 'Archive Google Drive folder', owner: 'AM', status: 'pending' },
    { task: 'Close Asana project', owner: 'AM', status: 'pending' },
    { task: 'Update GHL contact status to churned', owner: 'AM', status: 'pending' },
    { task: 'Transfer any remaining assets to client', owner: 'Specialist', status: 'pending' },
    { task: 'Conduct exit interview / feedback call', owner: 'Founder', status: 'pending' },
    { task: 'Log learnings to decision journal', owner: 'Founder', status: 'pending' },
    { task: 'Remove from monthly reporting cycle', owner: 'AM', status: 'pending' },
    { task: 'Remove from daily brief', owner: 'System', status: 'pending' },
    { task: 'Archive client data (do not delete)', owner: 'System', status: 'pending' },
  ];
}

async function startOffboarding(clientName: string, reason: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const checklist = generateChecklist();

  db.run(`
    INSERT INTO client_offboarding (client_name, reason, checklist, status, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `, [clientName, reason, JSON.stringify(checklist), now, now]);

  saveDb();
  log('CLIENT-OFFBOARD', `Offboarding started: ${clientName} — ${reason}`);
  log('CLIENT-OFFBOARD', `  ${checklist.length} checklist items`);

  console.log('\n  Immediate actions:');
  for (const item of checklist.slice(0, 3)) {
    console.log(`    [ ] ${item.task} (${item.owner})`);
  }
  console.log('');
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT client_name, reason, checklist, status, created_at
    FROM client_offboarding ORDER BY created_at DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('CLIENT-OFFBOARD', 'No client offboardings');
    return;
  }

  console.log('\n=== Client Offboarding ===\n');
  for (const row of result[0].values) {
    const [name, reason, clJson, status, created] = row as string[];
    const checklist: ChecklistItem[] = JSON.parse(clJson);
    const done = checklist.filter((i) => i.status === 'done').length;
    console.log(`  ${name} — ${reason}`);
    console.log(`    Status: ${status} | Progress: ${done}/${checklist.length} | Started: ${created.split('T')[0]}`);
    console.log('');
  }
}

async function main() {
  await initSchema();
  if (process.argv.includes('--start')) {
    const idx = process.argv.indexOf('--start');
    const name = process.argv[idx + 1];
    const reason = process.argv[idx + 2] ?? 'contract end';
    if (!name) { logError('CLIENT-OFFBOARD', 'Usage: --start "Client" "reason"'); process.exit(1); }
    await startOffboarding(name, reason);
  } else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('CLIENT-OFFBOARD', 'Failed', err); process.exit(1); });
