/**
 * New Hire Onboarding — access provisioning, training schedule, check-ins.
 *
 * Creates a structured onboarding checklist for new team members with
 * IT access, training, buddy assignment, and 30/60/90 day milestones.
 *
 * Usage:
 *   npx tsx scripts/functions/hire-onboarding.ts --new "Name" "Role Title" "2026-04-15"
 *   npx tsx scripts/functions/hire-onboarding.ts --status      # show active onboardings
 *   npx tsx scripts/functions/hire-onboarding.ts --checkin      # flag overdue check-ins
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Checklist template ---

interface ChecklistItem {
  task: string;
  category: 'it_access' | 'training' | 'admin' | 'checkin';
  owner: string;
  due_day: number; // days from start date
  status: 'pending' | 'done';
}

function generateOnboardingChecklist(roleTitle: string): ChecklistItem[] {
  const items: ChecklistItem[] = [
    // IT Access (Day 1)
    { task: 'Create company email account', category: 'it_access', owner: 'Sarah', due_day: 0, status: 'pending' },
    { task: 'Add to Slack workspace + relevant channels', category: 'it_access', owner: 'Sarah', due_day: 0, status: 'pending' },
    { task: 'Add to Asana workspace', category: 'it_access', owner: 'Sarah', due_day: 0, status: 'pending' },
    { task: 'Grant Google Drive access (team + client folders)', category: 'it_access', owner: 'Sarah', due_day: 0, status: 'pending' },
    { task: 'Add to GHL as team member', category: 'it_access', owner: 'Sarah', due_day: 0, status: 'pending' },

    // Admin (Week 1)
    { task: 'Signed employment contract', category: 'admin', owner: 'Sarah', due_day: 0, status: 'pending' },
    { task: 'Bank details collected for payroll', category: 'admin', owner: 'Sarah', due_day: 2, status: 'pending' },
    { task: 'Emergency contact details collected', category: 'admin', owner: 'Sarah', due_day: 2, status: 'pending' },
    { task: 'Buddy/mentor assigned', category: 'admin', owner: 'Founder', due_day: 0, status: 'pending' },

    // Training (Week 1-2)
    { task: 'Company overview and values session', category: 'training', owner: 'Founder', due_day: 1, status: 'pending' },
    { task: 'SOP reading list assigned', category: 'training', owner: 'AM', due_day: 2, status: 'pending' },
    { task: 'Tool walkthrough (Asana, GHL, Slack workflows)', category: 'training', owner: 'AM', due_day: 3, status: 'pending' },
    { task: 'Client portfolio introduction', category: 'training', owner: 'AM', due_day: 5, status: 'pending' },
    { task: 'Shadow client calls (minimum 3)', category: 'training', owner: 'AM', due_day: 10, status: 'pending' },

    // Check-ins
    { task: '1-week check-in with buddy', category: 'checkin', owner: 'Buddy', due_day: 7, status: 'pending' },
    { task: '30-day review with manager', category: 'checkin', owner: 'Founder', due_day: 30, status: 'pending' },
    { task: '60-day review with manager', category: 'checkin', owner: 'Founder', due_day: 60, status: 'pending' },
    { task: '90-day probation review', category: 'checkin', owner: 'Founder', due_day: 90, status: 'pending' },
  ];

  // Role-specific additions
  const lower = roleTitle.toLowerCase();
  if (lower.includes('specialist') || lower.includes('paid media')) {
    items.splice(14, 0,
      { task: 'Google Ads account access granted', category: 'it_access', owner: 'AM', due_day: 1, status: 'pending' },
      { task: 'Meta Business Manager access granted', category: 'it_access', owner: 'AM', due_day: 1, status: 'pending' },
      { task: 'Platform certification check (Google/Meta)', category: 'training', owner: 'AM', due_day: 5, status: 'pending' },
      { task: 'First campaign build under supervision', category: 'training', owner: 'AM', due_day: 14, status: 'pending' },
    );
  }

  if (lower.includes('account manager') || lower.includes('am')) {
    items.splice(14, 0,
      { task: 'CRM (GHL) pipeline training', category: 'training', owner: 'AM', due_day: 3, status: 'pending' },
      { task: 'Reporting workflow training', category: 'training', owner: 'AM', due_day: 5, status: 'pending' },
      { task: 'First client meeting (supervised)', category: 'training', owner: 'Founder', due_day: 10, status: 'pending' },
    );
  }

  return items;
}

// --- Commands ---

async function createOnboarding(name: string, roleTitle: string, startDate: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const checklist = generateOnboardingChecklist(roleTitle);

  db.run(`
    INSERT INTO hire_onboarding (person_name, role_title, start_date, checklist, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `, [name, roleTitle, startDate, JSON.stringify(checklist), now, now]);

  saveDb();

  log('ONBOARD-HIRE', `Created onboarding for ${name} (${roleTitle}) starting ${startDate}`);
  log('ONBOARD-HIRE', `  ${checklist.length} checklist items generated`);

  // Show immediate actions (due day 0)
  const immediate = checklist.filter((i) => i.due_day === 0);
  if (immediate.length) {
    log('ONBOARD-HIRE', '  Day 1 actions:');
    for (const item of immediate) {
      log('ONBOARD-HIRE', `    [ ] ${item.task} (${item.owner})`);
    }
  }
}

async function showStatus(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT person_name, role_title, start_date, buddy, checklist, status, created_at
    FROM hire_onboarding
    WHERE status != 'complete'
    ORDER BY start_date DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('ONBOARD-HIRE', 'No active onboardings');
    return;
  }

  console.log('\n=== Active Hire Onboardings ===\n');

  for (const row of result[0].values) {
    const [name, role, startDate, buddy, checklistJson, status] = row as string[];
    const checklist: ChecklistItem[] = JSON.parse(checklistJson);
    const done = checklist.filter((i) => i.status === 'done').length;
    const total = checklist.length;
    const pct = Math.round((done / total) * 100);

    const startD = new Date(startDate);
    const daysSinceStart = Math.floor((Date.now() - startD.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`  ${name} — ${role}`);
    console.log(`    Start: ${startDate.split('T')[0]} (day ${daysSinceStart}) | Buddy: ${buddy ?? 'unassigned'} | Progress: ${done}/${total} (${pct}%)`);

    // Show overdue items
    const overdue = checklist.filter((i) => i.status === 'pending' && i.due_day <= daysSinceStart);
    if (overdue.length) {
      console.log(`    Overdue (${overdue.length}):`);
      for (const item of overdue.slice(0, 5)) {
        console.log(`      [ ] ${item.task} (${item.owner}) — due day ${item.due_day}`);
      }
      if (overdue.length > 5) console.log(`      ... and ${overdue.length - 5} more`);
    }

    // Show upcoming items (next 7 days)
    const upcoming = checklist.filter((i) => i.status === 'pending' && i.due_day > daysSinceStart && i.due_day <= daysSinceStart + 7);
    if (upcoming.length) {
      console.log(`    Coming up (${upcoming.length}):`);
      for (const item of upcoming) {
        console.log(`      [ ] ${item.task} (${item.owner}) — day ${item.due_day}`);
      }
    }

    console.log('');
  }
}

async function checkIns(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT person_name, start_date, checklist
    FROM hire_onboarding
    WHERE status != 'complete'
  `);

  if (!result.length || !result[0].values.length) {
    log('ONBOARD-HIRE', 'No active onboardings');
    return;
  }

  console.log('\n=== Onboarding Check-in Status ===\n');
  let anyOverdue = false;

  for (const row of result[0].values) {
    const [name, startDate, checklistJson] = row as [string, string, string];
    const checklist: ChecklistItem[] = JSON.parse(checklistJson);
    const daysSinceStart = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

    const checkIns = checklist.filter((i) => i.category === 'checkin');
    for (const ci of checkIns) {
      const overdue = ci.status === 'pending' && ci.due_day <= daysSinceStart;
      const icon = ci.status === 'done' ? 'DONE' : overdue ? 'OVERDUE' : 'UPCOMING';
      if (overdue) anyOverdue = true;
      console.log(`  [${icon}] ${name} — ${ci.task} (day ${ci.due_day}, ${ci.owner})`);
    }
    console.log('');
  }

  if (!anyOverdue) {
    console.log('  All check-ins on track.\n');
  }
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--new')) {
    const idx = process.argv.indexOf('--new');
    const name = process.argv[idx + 1];
    const role = process.argv[idx + 2];
    const startDate = process.argv[idx + 3];
    if (!name || !role || !startDate) {
      logError('ONBOARD-HIRE', 'Usage: --new "Name" "Role Title" "YYYY-MM-DD"');
      process.exit(1);
    }
    await createOnboarding(name, role, startDate);
  } else if (process.argv.includes('--checkin')) {
    await checkIns();
  } else {
    await showStatus();
  }

  closeDb();
}

main().catch((err) => {
  logError('ONBOARD-HIRE', 'Hire onboarding failed', err);
  process.exit(1);
});
