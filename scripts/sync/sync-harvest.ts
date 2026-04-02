/**
 * Harvest sync — pulls users, clients, projects, and time entries.
 *
 * Run: npm run sync:harvest             (last 7 days)
 *      npm run sync:harvest:backfill    (all history)
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const BACKFILL = process.argv.includes('--backfill');
const DEFAULT_DAYS = 7;

const ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
const ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN;
const BASE_URL = 'https://api.harvestapp.com/v2';

if (!ACCOUNT_ID || !ACCESS_TOKEN) {
  console.error('[HARVEST] HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN must be set in .env.local');
  process.exit(1);
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function harvestGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Harvest-Account-Id': ACCOUNT_ID!,
      'User-Agent': 'VendoOS (vendo-os@vendodigital.co.uk)',
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    log('HARVEST', `Rate limited — waiting ${retryAfter}s`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return harvestGet(path, params);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Harvest API ${res.status}: ${body}`);
  }

  return res.json();
}

async function syncUsers() {
  const db = await getDb();
  const now = new Date().toISOString();

  log('HARVEST', 'Syncing users...');
  let page = 1;
  let total = 0;

  while (true) {
    const data = await harvestGet('/users', { per_page: '100', page: String(page) });

    const stmt = db.prepare(
      `INSERT INTO harvest_users (id, first_name, last_name, email, is_active, weekly_capacity_hours, default_hourly_rate, cost_rate, roles, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email,
         is_active=excluded.is_active, weekly_capacity_hours=excluded.weekly_capacity_hours,
         default_hourly_rate=excluded.default_hourly_rate, cost_rate=excluded.cost_rate,
         roles=excluded.roles, updated_at=excluded.updated_at, synced_at=excluded.synced_at`
    );

    for (const u of data.users) {
      // weekly_capacity is in seconds, convert to hours
      const capacityHours = (u.weekly_capacity || 0) / 3600;
      stmt.run([
        u.id, u.first_name, u.last_name, u.email,
        u.is_active ? 1 : 0, capacityHours,
        u.default_hourly_rate, u.cost_rate,
        u.roles ? JSON.stringify(u.roles) : null,
        u.created_at, u.updated_at, now,
      ]);
      total++;
    }
    stmt.free();

    if (!data.next_page) break;
    page = data.next_page;
  }

  saveDb();
  log('HARVEST', `Synced ${total} users`);
}

async function syncClients() {
  const db = await getDb();
  const now = new Date().toISOString();

  log('HARVEST', 'Syncing clients...');
  let page = 1;
  let total = 0;

  while (true) {
    const data = await harvestGet('/clients', { per_page: '100', page: String(page) });

    const stmt = db.prepare(
      `INSERT INTO harvest_clients (id, name, currency, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, currency=excluded.currency, is_active=excluded.is_active, synced_at=excluded.synced_at`
    );

    for (const c of data.clients) {
      stmt.run([c.id, c.name, c.currency || 'GBP', c.is_active ? 1 : 0, now]);
      total++;
    }
    stmt.free();

    if (!data.next_page) break;
    page = data.next_page;
  }

  saveDb();
  log('HARVEST', `Synced ${total} clients`);
}

async function syncProjects() {
  const db = await getDb();
  const now = new Date().toISOString();

  log('HARVEST', 'Syncing projects...');
  let page = 1;
  let total = 0;

  while (true) {
    const data = await harvestGet('/projects', { per_page: '100', page: String(page) });

    const stmt = db.prepare(
      `INSERT INTO harvest_projects (id, name, code, client_id, client_name, is_active, is_billable, budget, budget_by, hourly_rate, cost_budget, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, code=excluded.code, client_id=excluded.client_id, client_name=excluded.client_name,
         is_active=excluded.is_active, is_billable=excluded.is_billable, budget=excluded.budget,
         budget_by=excluded.budget_by, hourly_rate=excluded.hourly_rate, cost_budget=excluded.cost_budget,
         synced_at=excluded.synced_at`
    );

    for (const p of data.projects) {
      stmt.run([
        p.id, p.name, p.code,
        p.client?.id || null, p.client?.name || null,
        p.is_active ? 1 : 0, p.is_billable ? 1 : 0,
        p.budget, p.budget_by, p.hourly_rate, p.cost_budget,
        now,
      ]);
      total++;
    }
    stmt.free();

    if (!data.next_page) break;
    page = data.next_page;
  }

  saveDb();
  log('HARVEST', `Synced ${total} projects`);
}

async function syncTimeEntries() {
  const db = await getDb();
  const now = new Date().toISOString();

  const from = BACKFILL ? '2024-11-01' : dateStr(DEFAULT_DAYS);
  const to = dateStr(0);

  log('HARVEST', `Syncing time entries from ${from} to ${to}${BACKFILL ? ' (backfill)' : ''}...`);

  let page = 1;
  let total = 0;

  while (true) {
    const data = await harvestGet('/time_entries', {
      from, to,
      per_page: '100',
      page: String(page),
    });

    for (const e of data.time_entries) {
      db.run(
        `INSERT INTO harvest_time_entries (id, spent_date, hours, notes, is_running, billable, billable_rate, cost_rate, user_id, user_name, client_id, client_name, project_id, project_name, task_id, task_name, created_at, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hours=excluded.hours, notes=excluded.notes, is_running=excluded.is_running,
           billable=excluded.billable, billable_rate=excluded.billable_rate, cost_rate=excluded.cost_rate,
           updated_at=excluded.updated_at, synced_at=excluded.synced_at`,
        [
          e.id, e.spent_date, e.hours, e.notes,
          e.is_running ? 1 : 0,
          e.billable ? 1 : 0,
          e.billable_rate, e.cost_rate,
          e.user?.id, e.user?.name,
          e.client?.id, e.client?.name,
          e.project?.id, e.project?.name,
          e.task?.id, e.task?.name,
          e.created_at, e.updated_at, now,
        ]
      );
      total++;
    }

    if (page % 10 === 0) {
      saveDb();
      log('HARVEST', `  ...${total} entries so far (page ${page}/${data.total_pages})`);
    }

    if (!data.next_page) break;
    page = data.next_page;
  }

  saveDb();
  log('HARVEST', `Synced ${total} time entries`);
}

async function main() {
  try {
    await initSchema();
    await syncUsers();
    await syncClients();
    await syncProjects();
    await syncTimeEntries();

    // Quick summary
    const db = await getDb();
    const [{ total_entries }] = db.exec('SELECT COUNT(*) as total_entries FROM harvest_time_entries').map(r => ({ total_entries: r.values[0][0] }));
    const [{ total_hours }] = db.exec('SELECT ROUND(SUM(hours), 1) as total_hours FROM harvest_time_entries').map(r => ({ total_hours: r.values[0][0] }));
    const [{ total_users }] = db.exec('SELECT COUNT(*) as total_users FROM harvest_users WHERE is_active = 1').map(r => ({ total_users: r.values[0][0] }));
    const [{ total_projects }] = db.exec('SELECT COUNT(*) as total_projects FROM harvest_projects').map(r => ({ total_projects: r.values[0][0] }));
    const [{ total_clients }] = db.exec('SELECT COUNT(*) as total_clients FROM harvest_clients').map(r => ({ total_clients: r.values[0][0] }));

    log('HARVEST', '--- Summary ---');
    log('HARVEST', `Users: ${total_users} active`);
    log('HARVEST', `Clients: ${total_clients}`);
    log('HARVEST', `Projects: ${total_projects}`);
    log('HARVEST', `Time entries: ${total_entries} (${total_hours} hours total)`);

    closeDb();
  } catch (err) {
    logError('HARVEST', err instanceof Error ? err.message : String(err));
    closeDb();
    process.exit(1);
  }
}

main();
