/**
 * Client onboarding — detects new won deals and creates client records + checklists.
 *
 * For each won GHL opportunity that has not yet been onboarded:
 *   1. Creates a client record (if not already present)
 *   2. Generates a standard onboarding checklist
 *   3. Stores the checklist in client_onboarding for tracking
 *
 * Usage:
 *   npx tsx scripts/functions/client-onboarding.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

interface OnboardingChecklist {
  clientName: string;
  contactEmail: string | null;
  dealValue: number;
  items: { task: string; owner: string; status: 'pending' | 'done' }[];
  createdAt: string;
}

/** Ensure the onboarding table exists (idempotent). */
async function ensureOnboardingSchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS client_onboarding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      opportunity_id TEXT NOT NULL UNIQUE,
      contact_email TEXT,
      deal_value REAL DEFAULT 0,
      checklist TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_onboarding_status ON client_onboarding(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_onboarding_client ON client_onboarding(client_name)');
}

function generateChecklist(
  clientName: string,
  email: string | null,
  value: number,
): OnboardingChecklist {
  return {
    clientName,
    contactEmail: email,
    dealValue: value,
    items: [
      { task: 'Create Slack channel for client', owner: 'AM', status: 'pending' },
      { task: 'Create Google Drive folder', owner: 'AM', status: 'pending' },
      { task: 'Set up ad platform access (Meta/Google)', owner: 'AM', status: 'pending' },
      { task: 'Create Asana project from template', owner: 'AM', status: 'pending' },
      { task: 'Send welcome email with onboarding doc', owner: 'AM', status: 'pending' },
      { task: 'Schedule kickoff meeting', owner: 'AM', status: 'pending' },
      { task: 'Collect brand assets and guidelines', owner: 'AM', status: 'pending' },
      { task: 'Set up tracking pixels and conversion events', owner: 'Specialist', status: 'pending' },
      { task: 'Create initial campaign briefs', owner: 'Specialist', status: 'pending' },
      { task: 'Add to monthly reporting cycle', owner: 'AM', status: 'pending' },
      { task: 'Add to Xero as recurring invoice', owner: 'Sarah', status: 'pending' },
      { task: 'Configure daily brief to include this client', owner: 'System', status: 'pending' },
    ],
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  await initSchema();
  await ensureOnboardingSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  // Find won deals not yet onboarded
  const result = db.exec(`
    SELECT o.id, o.name, o.monetary_value, o.contact_name, o.contact_company, o.contact_email
    FROM ghl_opportunities o
    WHERE o.status = 'won'
      AND o.id NOT IN (SELECT opportunity_id FROM client_onboarding)
  `);

  if (!result.length || !result[0].values.length) {
    log('ONBOARDING', 'No new won deals to onboard');
    closeDb();
    return;
  }

  const cols = result[0].columns;
  const newDeals = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj;
  });

  log('ONBOARDING', `Found ${newDeals.length} new won deal(s) to onboard`);

  for (const deal of newDeals) {
    const clientName = (deal.contact_company || deal.contact_name || deal.name || 'Unknown') as string;
    const email = (deal.contact_email || null) as string | null;
    const value = (deal.monetary_value || 0) as number;

    // Create client record if it doesn't already exist
    const existing = db.exec('SELECT name FROM clients WHERE name = ?', [clientName]);
    if (!existing.length || !existing[0].values.length) {
      db.run(`
        INSERT OR IGNORE INTO clients (name, email, status, source, total_invoiced, outstanding)
        VALUES (?, ?, 'active', 'ghl', 0, 0)
      `, [clientName, email]);
      log('ONBOARDING', `  Created client: ${clientName}`);
    }

    // Generate and store onboarding checklist
    const checklist = generateChecklist(clientName, email, value);

    db.run(`
      INSERT INTO client_onboarding (client_name, opportunity_id, contact_email, deal_value, checklist, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [clientName, deal.id as string, email, value, JSON.stringify(checklist), now]);

    log('ONBOARDING', `  Onboarding created for ${clientName} (£${value}) — ${checklist.items.length} tasks`);
  }

  saveDb();
  log('ONBOARDING', `Onboarding complete — ${newDeals.length} client(s) processed`);
  closeDb();
}

main().catch(err => {
  logError('ONBOARDING', 'Failed', err);
  process.exit(1);
});
