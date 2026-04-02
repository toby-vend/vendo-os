import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const ACCESS_TOKEN = process.env.HARVEST_ACCESS_TOKEN || '';
const ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID || '';
const BASE_URL = 'https://api.harvestapp.com/v2';

if (!ACCESS_TOKEN || !ACCOUNT_ID) {
  console.error('Missing HARVEST_ACCESS_TOKEN or HARVEST_ACCOUNT_ID in .env.local');
  process.exit(1);
}

interface HarvestUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  weekly_capacity: number; // seconds
  roles: string[];
  created_at: string;
  updated_at: string;
}

interface HarvestTimeEntry {
  id: number;
  spent_date: string;
  hours: number;
  notes: string | null;
  is_running: boolean;
  billable: boolean;
  billable_rate: number | null;
  user: { id: number; name: string };
  client: { id: number; name: string } | null;
  project: { id: number; name: string } | null;
  task: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

async function harvestFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Harvest-Account-Id': ACCOUNT_ID,
      'User-Agent': 'VendoOS',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Harvest API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(path: string, key: string, params: Record<string, string> = {}): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const data = await harvestFetch<Record<string, unknown>>(path, { ...params, page: String(page), per_page: '100' });
    const items = (data[key] || []) as T[];
    all.push(...items);

    const totalPages = (data.total_pages as number) || 1;
    if (page >= totalPages) break;
    page++;
  }

  return all;
}

async function syncUsers(): Promise<number> {
  log('Harvest', 'Fetching users...');
  const users = await fetchAllPages<HarvestUser>('/users', 'users', { is_active: 'true' });

  const db = await getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO harvest_users (id, first_name, last_name, email, is_active, weekly_capacity_hours, roles, created_at, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    stmt.run([
      u.id, u.first_name, u.last_name, u.email,
      u.is_active ? 1 : 0,
      u.weekly_capacity / 3600,
      JSON.stringify(u.roles),
      u.created_at, u.updated_at, now,
    ]);
  }
  stmt.free();

  log('Harvest', `Synced ${users.length} active users`);
  return users.length;
}

async function syncTimeEntries(from: string, to: string): Promise<number> {
  log('Harvest', `Fetching time entries ${from} → ${to}...`);
  const entries = await fetchAllPages<HarvestTimeEntry>('/time_entries', 'time_entries', { from, to });

  const db = await getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO harvest_time_entries
      (id, spent_date, hours, notes, is_running, billable, billable_rate,
       user_id, user_name, client_id, client_name, project_id, project_name,
       task_id, task_name, created_at, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const e of entries) {
    stmt.run([
      e.id, e.spent_date, e.hours, e.notes,
      e.is_running ? 1 : 0, e.billable ? 1 : 0, e.billable_rate,
      e.user.id, e.user.name,
      e.client?.id ?? null, e.client?.name ?? null,
      e.project?.id ?? null, e.project?.name ?? null,
      e.task?.id ?? null, e.task?.name ?? null,
      e.created_at, e.updated_at, now,
    ]);
  }
  stmt.free();

  log('Harvest', `Synced ${entries.length} time entries`);
  return entries.length;
}

function getWeekBounds(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  return {
    from: monday.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function parseArgs(): { from: string; to: string } {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');

  if (fromIdx !== -1 && toIdx !== -1) {
    return { from: args[fromIdx + 1], to: args[toIdx + 1] };
  }

  if (args.includes('--last-week')) {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate() + diffToMon);
    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);
    const lastFri = new Date(lastMon);
    lastFri.setDate(lastMon.getDate() + 4);
    return { from: lastMon.toISOString().slice(0, 10), to: lastFri.toISOString().slice(0, 10) };
  }

  return getWeekBounds();
}

async function main() {
  const { from, to } = parseArgs();
  log('Harvest', `Sync range: ${from} → ${to}`);

  await initSchema();
  const userCount = await syncUsers();
  const entryCount = await syncTimeEntries(from, to);

  // Summary report
  const db = await getDb();
  const result = db.exec(`
    SELECT u.first_name || ' ' || u.last_name AS name,
           u.weekly_capacity_hours,
           COALESCE(SUM(e.hours), 0) AS logged
    FROM harvest_users u
    LEFT JOIN harvest_time_entries e ON e.user_id = u.id AND e.spent_date BETWEEN '${from}' AND '${to}'
    WHERE u.is_active = 1
    GROUP BY u.id
    ORDER BY logged ASC
  `);

  if (result.length > 0) {
    log('Harvest', '--- Timesheet Summary ---');
    for (const row of result[0].values) {
      const [name, capacity, logged] = row as [string, number, number];
      const pct = capacity > 0 ? ((logged / capacity) * 100).toFixed(0) : '—';
      const status = logged === 0 ? 'MISSING' : Number(pct) < 50 ? 'BEHIND' : 'OK';
      log('Harvest', `  ${status.padEnd(8)} ${(name as string).padEnd(25)} ${(logged as number).toFixed(1)}h / ${capacity}h (${pct}%)`);
    }
  }

  saveDb();
  closeDb();
  log('Harvest', `Done. ${userCount} users, ${entryCount} time entries.`);
}

main().catch((err) => {
  logError('Harvest', 'Sync failed', err);
  closeDb();
  process.exit(1);
});
