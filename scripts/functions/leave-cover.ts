/**
 * Leave and Absence Cover — request, approve, assign cover, notify, handback.
 *
 * Full leave lifecycle per the Vendo flow:
 *   Pre-leave: request → approval (Sarah) → cover assigned → tasks handed over → clients notified (if >5 days)
 *   During: cover handles per SOP → unresolvable → founder contacted
 *   Return: handback meeting → tasks reassigned → brief reconfigured
 *
 * Usage:
 *   npx tsx scripts/functions/leave-cover.ts --request "Name" "2026-04-10" "2026-04-14" "Cover Person"
 *   npx tsx scripts/functions/leave-cover.ts --status      # show active leave
 *   npx tsx scripts/functions/leave-cover.ts --approve 1   # approve request by ID
 *   npx tsx scripts/functions/leave-cover.ts --handback 1  # mark handback complete
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Leave duration calc ---

function businessDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let days = 0;
  const current = new Date(s);
  while (current <= e) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days++;
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// --- Request leave ---

async function requestLeave(
  personName: string,
  leaveStart: string,
  leaveEnd: string,
  coverPerson: string | null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const days = businessDays(leaveStart, leaveEnd);

  db.run(`
    INSERT INTO leave_requests
      (person_name, leave_start, leave_end, cover_person, approval_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `, [personName, leaveStart, leaveEnd, coverPerson, now, now]);

  saveDb();

  log('LEAVE', `Request created: ${personName} — ${leaveStart} to ${leaveEnd} (${days} business days)`);
  if (coverPerson) log('LEAVE', `  Cover: ${coverPerson}`);
  if (days > 5) log('LEAVE', `  Note: >5 days — clients should be notified once approved`);
  log('LEAVE', '  Awaiting approval from Sarah');
}

// --- Approve ---

async function approveLeave(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const result = db.exec('SELECT person_name, leave_start, leave_end, cover_person FROM leave_requests WHERE id = ?', [id]);
  if (!result.length || !result[0].values.length) {
    logError('LEAVE', `Request #${id} not found`);
    return;
  }

  const [name, start, end, cover] = result[0].values[0] as [string, string, string, string | null];
  const days = businessDays(start, end);

  db.run(
    'UPDATE leave_requests SET approval_status = \'approved\', approved_by = \'Sarah\', updated_at = ? WHERE id = ?',
    [now, id],
  );

  saveDb();

  log('LEAVE', `Approved: ${name} — ${start} to ${end}`);

  // Generate action items
  console.log('\n  Action items:');
  console.log(`  [ ] Confirm cover with ${cover ?? 'TBD'}`);
  console.log(`  [ ] Share client list and context with cover person`);
  console.log('  [ ] Review and hand over Asana tasks');
  console.log('  [ ] Reconfigure daily brief for cover period');
  if (days > 5) {
    console.log('  [ ] Notify affected clients of absence');
  }
  console.log('');
}

// --- Handback ---

async function handbackLeave(id: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    'UPDATE leave_requests SET handback_complete = 1, approval_status = \'completed\', updated_at = ? WHERE id = ?',
    [now, id],
  );

  saveDb();
  log('LEAVE', `Handback complete for request #${id}`);

  console.log('\n  Return actions:');
  console.log('  [x] Handback meeting done');
  console.log('  [ ] Asana tasks reassigned back');
  console.log('  [ ] Daily brief reconfigured to normal');
  console.log('  [ ] Confirm return with team');
  console.log('');
}

// --- Status ---

async function showStatus(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT id, person_name, leave_start, leave_end, cover_person, approval_status,
      clients_notified, tasks_reassigned, handback_complete
    FROM leave_requests
    WHERE approval_status NOT IN ('completed', 'cancelled')
    ORDER BY leave_start ASC
  `);

  // Also show recent completed
  const recent = db.exec(`
    SELECT id, person_name, leave_start, leave_end, cover_person, approval_status
    FROM leave_requests
    WHERE approval_status = 'completed' AND leave_end >= date('now', '-30 days')
    ORDER BY leave_end DESC
  `);

  console.log('\n=== Leave and Absence ===\n');

  if (result.length && result[0].values.length) {
    console.log('  Active / Pending:\n');
    console.log('  ID  Name                 Dates                    Cover          Status     Tasks  Clients  Handback');
    console.log('  ' + '-'.repeat(100));

    for (const row of result[0].values) {
      const [id, name, start, end, cover, status, clientsNotified, tasksReassigned, handback] =
        row as [number, string, string, string, string | null, string, number, number, number];
      const days = businessDays(start, end);
      const dateRange = `${start.split('T')[0]}–${end.split('T')[0]} (${days}d)`;

      console.log(
        `  ${String(id).padEnd(3)} ` +
        `${(name ?? '').slice(0, 20).padEnd(20)} ` +
        `${dateRange.padEnd(24)} ` +
        `${(cover ?? 'TBD').padEnd(14)} ` +
        `${(status ?? '').padEnd(10)} ` +
        `${(tasksReassigned ? 'Yes' : 'No').padEnd(6)} ` +
        `${(clientsNotified ? 'Yes' : 'No').padEnd(8)} ` +
        `${handback ? 'Yes' : 'No'}`,
      );
    }
  } else {
    console.log('  No active leave requests.\n');
  }

  if (recent.length && recent[0].values.length) {
    console.log('\n  Recently completed:\n');
    for (const row of recent[0].values) {
      const [id, name, start, end, cover] = row as [number, string, string, string, string | null];
      console.log(`    #${id} ${name} — ${start.split('T')[0]} to ${end.split('T')[0]} (cover: ${cover ?? 'N/A'})`);
    }
  }

  // Flag upcoming leave (next 14 days)
  const upcoming = db.exec(`
    SELECT person_name, leave_start, leave_end, cover_person, approval_status
    FROM leave_requests
    WHERE leave_start BETWEEN date('now') AND date('now', '+14 days')
      AND approval_status != 'cancelled'
  `);

  if (upcoming.length && upcoming[0].values.length) {
    console.log('\n  Upcoming (next 14 days):');
    for (const row of upcoming[0].values) {
      const [name, start, end, cover, status] = row as string[];
      const approved = status === 'approved' ? '' : ' [PENDING APPROVAL]';
      console.log(`    ${name} — ${start.split('T')[0]} to ${end.split('T')[0]} (cover: ${cover ?? 'TBD'})${approved}`);
    }
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--request')) {
    const idx = process.argv.indexOf('--request');
    const name = process.argv[idx + 1];
    const start = process.argv[idx + 2];
    const end = process.argv[idx + 3];
    const cover = process.argv[idx + 4] ?? null;
    if (!name || !start || !end) {
      logError('LEAVE', 'Usage: --request "Name" "YYYY-MM-DD" "YYYY-MM-DD" "Cover Person"');
      process.exit(1);
    }
    await requestLeave(name, start, end, cover);
  } else if (process.argv.includes('--approve')) {
    const id = parseInt(process.argv[process.argv.indexOf('--approve') + 1], 10);
    if (isNaN(id)) { logError('LEAVE', 'Usage: --approve <id>'); process.exit(1); }
    await approveLeave(id);
  } else if (process.argv.includes('--handback')) {
    const id = parseInt(process.argv[process.argv.indexOf('--handback') + 1], 10);
    if (isNaN(id)) { logError('LEAVE', 'Usage: --handback <id>'); process.exit(1); }
    await handbackLeave(id);
  } else {
    await showStatus();
  }

  closeDb();
}

main().catch((err) => {
  logError('LEAVE', 'Leave cover failed', err);
  process.exit(1);
});
