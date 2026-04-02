/**
 * Staff Offboarding / IT Revocation — access removal, client handover, exit admin.
 *
 * Per the Vendo flow:
 *   Exit trigger → exit date confirmed (Sarah) →
 *   Immediate: Slack, Asana, Drive, GHL, admin access revoked → verify →
 *   AM reassigned → clients notified → final payroll → exit interview → audit logged
 *
 * Usage:
 *   npx tsx scripts/functions/staff-offboarding.ts --start "Name" "Role" "2026-04-15" "resignation"
 *   npx tsx scripts/functions/staff-offboarding.ts --status     # show active offboardings
 *   npx tsx scripts/functions/staff-offboarding.ts --verify 1   # verify access revoked for ID
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

// --- Offboarding checklist ---

interface ChecklistItem {
  task: string;
  category: 'access_revocation' | 'client_handover' | 'admin' | 'verification';
  owner: string;
  critical: boolean;
  status: 'pending' | 'done';
}

function generateOffboardingChecklist(): ChecklistItem[] {
  return [
    // Access revocation (same day)
    { task: 'Remove from Slack workspace', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Remove from Asana workspace', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Remove Google Drive access (all shared folders)', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Remove from GHL', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Remove Google Ads account access', category: 'access_revocation', owner: 'AM', critical: true, status: 'pending' },
    { task: 'Remove Meta Business Manager access', category: 'access_revocation', owner: 'AM', critical: true, status: 'pending' },
    { task: 'Remove from Vendo admin/database access', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Disable company email account', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Revoke any API keys or credentials', category: 'access_revocation', owner: 'Sarah', critical: true, status: 'pending' },

    // Verification
    { task: 'Verify all access has been revoked', category: 'verification', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Flag to founder if any access cannot be removed', category: 'verification', owner: 'Sarah', critical: true, status: 'pending' },

    // Client handover
    { task: 'Reassign all client accounts to new AM', category: 'client_handover', owner: 'Founder', critical: true, status: 'pending' },
    { task: 'Notify affected clients of new point of contact', category: 'client_handover', owner: 'AM', critical: true, status: 'pending' },
    { task: 'Transfer any in-progress work and context', category: 'client_handover', owner: 'AM', critical: false, status: 'pending' },
    { task: 'Update client records in GHL', category: 'client_handover', owner: 'AM', critical: false, status: 'pending' },

    // Admin
    { task: 'Process final payroll', category: 'admin', owner: 'Sarah', critical: true, status: 'pending' },
    { task: 'Conduct exit interview', category: 'admin', owner: 'Founder', critical: false, status: 'pending' },
    { task: 'Collect any company equipment', category: 'admin', owner: 'Sarah', critical: false, status: 'pending' },
    { task: 'Update team directory and role registry', category: 'admin', owner: 'Sarah', critical: false, status: 'pending' },
    { task: 'Access audit log completed and filed', category: 'admin', owner: 'Sarah', critical: true, status: 'pending' },
  ];
}

// --- Start offboarding ---

async function startOffboarding(
  personName: string,
  roleTitle: string,
  exitDate: string,
  exitType: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const checklist = generateOffboardingChecklist();

  db.run(`
    INSERT INTO staff_offboarding
      (person_name, role_title, exit_date, exit_type, checklist, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `, [personName, roleTitle, exitDate, exitType, JSON.stringify(checklist), now, now]);

  saveDb();

  log('OFFBOARD', `Offboarding started: ${personName} (${roleTitle})`);
  log('OFFBOARD', `  Exit type: ${exitType} | Exit date: ${exitDate}`);
  log('OFFBOARD', `  ${checklist.length} checklist items (${checklist.filter((i) => i.critical).length} critical)`);

  // Alert
  await sendSlackAlert(
    'staff-offboarding',
    `Offboarding initiated for ${personName} (${roleTitle}) — exit date ${exitDate}. ${checklist.filter((i) => i.critical).length} critical items require same-day action.`,
    'warning',
  ).catch(() => {});

  // Show critical items
  console.log('\n  CRITICAL — same day actions:');
  for (const item of checklist.filter((i) => i.critical && i.category === 'access_revocation')) {
    console.log(`    [ ] ${item.task} (${item.owner})`);
  }
  console.log('');
}

// --- Verify access revoked ---

async function verifyAccess(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const result = db.exec('SELECT person_name, checklist FROM staff_offboarding WHERE id = ?', [id]);
  if (!result.length || !result[0].values.length) {
    logError('OFFBOARD', `Offboarding #${id} not found`);
    return;
  }

  const [name, checklistJson] = result[0].values[0] as [string, string];
  const checklist: ChecklistItem[] = JSON.parse(checklistJson);

  const accessItems = checklist.filter((i) => i.category === 'access_revocation');
  const pending = accessItems.filter((i) => i.status === 'pending');

  if (pending.length === 0) {
    log('OFFBOARD', `All access revoked for ${name}`);
    db.run(
      'UPDATE staff_offboarding SET access_revoked = 1, updated_at = ? WHERE id = ?',
      [now, id],
    );
    saveDb();
  } else {
    log('OFFBOARD', `${pending.length} access revocation item(s) still pending for ${name}:`);
    for (const item of pending) {
      log('OFFBOARD', `  [ ] ${item.task} (${item.owner})`);
    }

    // Alert founder if critical items pending past exit date
    const exitResult = db.exec('SELECT exit_date FROM staff_offboarding WHERE id = ?', [id]);
    if (exitResult.length && exitResult[0].values.length) {
      const exitDate = exitResult[0].values[0][0] as string;
      if (new Date(exitDate) <= new Date()) {
        await sendSlackAlert(
          'staff-offboarding',
          `URGENT: ${pending.length} access revocation items still pending for ${name} past exit date!`,
        ).catch(() => {});
      }
    }
  }
}

// --- Status ---

async function showStatus(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT id, person_name, role_title, exit_date, exit_type, checklist, status,
      clients_reassigned, access_revoked, exit_interview_done, final_payroll_done
    FROM staff_offboarding
    ORDER BY
      CASE WHEN status = 'pending' THEN 0 WHEN status = 'in_progress' THEN 1 ELSE 2 END,
      exit_date DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('OFFBOARD', 'No offboarding records');
    return;
  }

  console.log('\n=== Staff Offboarding ===\n');

  for (const row of result[0].values) {
    const [id, name, role, exitDate, exitType, checklistJson, status,
      clientsReassigned, accessRevoked, exitInterview, payroll] =
      row as [number, string, string, string, string, string, string, number, number, number, number];

    const checklist: ChecklistItem[] = JSON.parse(checklistJson);
    const done = checklist.filter((i) => i.status === 'done').length;
    const total = checklist.length;
    const critPending = checklist.filter((i) => i.critical && i.status === 'pending').length;

    console.log(`  #${id} ${name} — ${role} (${exitType})`);
    console.log(`    Exit date: ${exitDate.split('T')[0]} | Status: ${status} | Progress: ${done}/${total}`);
    console.log(
      `    Access: ${accessRevoked ? 'Revoked' : 'PENDING'} | ` +
      `Clients: ${clientsReassigned ? 'Reassigned' : 'PENDING'} | ` +
      `Payroll: ${payroll ? 'Done' : 'PENDING'} | ` +
      `Exit interview: ${exitInterview ? 'Done' : 'PENDING'}`,
    );

    if (critPending > 0) {
      console.log(`    WARNING: ${critPending} critical item(s) still pending`);
    }
    console.log('');
  }
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--start')) {
    const idx = process.argv.indexOf('--start');
    const name = process.argv[idx + 1];
    const role = process.argv[idx + 2];
    const exitDate = process.argv[idx + 3];
    const exitType = process.argv[idx + 4] ?? 'resignation';
    if (!name || !role || !exitDate) {
      logError('OFFBOARD', 'Usage: --start "Name" "Role" "YYYY-MM-DD" "resignation|termination"');
      process.exit(1);
    }
    await startOffboarding(name, role, exitDate, exitType);
  } else if (process.argv.includes('--verify')) {
    const id = parseInt(process.argv[process.argv.indexOf('--verify') + 1], 10);
    if (isNaN(id)) { logError('OFFBOARD', 'Usage: --verify <id>'); process.exit(1); }
    await verifyAccess(id);
  } else {
    await showStatus();
  }

  closeDb();
}

main().catch((err) => {
  logError('OFFBOARD', 'Staff offboarding failed', err);
  process.exit(1);
});
