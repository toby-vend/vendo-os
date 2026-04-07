import { db, rows, scalar } from './base.js';

// ============================================================
// Schema initialisation (runs once)
// ============================================================

let _schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS client_service_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      am TEXT,
      cm TEXT,
      level TEXT DEFAULT 'Auto',
      tier INTEGER DEFAULT 3,
      calls INTEGER DEFAULT 1,
      am_hrs REAL DEFAULT 2,
      cm_hrs REAL DEFAULT 2,
      budget REAL DEFAULT 0,
      currency TEXT DEFAULT 'GBP',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_name, service_type)
    )`,
    args: [],
  });
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS deliverable_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      month TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_by TEXT,
      completed_at TEXT,
      UNIQUE(client_name, service_type, month)
    )`,
    args: [],
  });
  _schemaReady = true;
}

// ============================================================
// Types
// ============================================================

export interface ServiceConfig {
  id: number;
  client_name: string;
  service_type: string;
  am: string | null;
  cm: string | null;
  level: string;
  tier: number;
  calls: number;
  am_hrs: number;
  cm_hrs: number;
  budget: number;
  currency: string;
  status: string;
}

export interface MonthlyHours {
  client_name: string;
  month: string;
  am_hours: number;
  cm_hours: number;
  total_hours: number;
}

export interface PersonCapacity {
  initials: string;
  user_name: string;
  user_id: number;
  allocated_am_hrs: number;
  allocated_cm_hrs: number;
  actual_hours: number;
  capacity_hours: number;
  capacity_pct: number;
}

export interface DeliverableCompletion {
  client_name: string;
  service_type: string;
  month: string;
  completed: number;
  completed_by: string | null;
}

export interface DeliverableRow extends ServiceConfig {
  monthly_hours: Record<string, { am: number; cm: number; total: number }>;
  completions: Record<string, boolean>;
}

// ============================================================
// Person initials mapping
// ============================================================

// Map full Harvest names to initials used in the spreadsheet.
// This is populated from harvest_users and client_service_configs.
let _initialsCache: Record<string, string> | null = null;

export async function getInitialsMap(): Promise<Record<string, string>> {
  if (_initialsCache) return _initialsCache;
  const users = await rows<{ first_name: string; last_name: string }>(`
    SELECT first_name, last_name FROM harvest_users WHERE is_active = 1
  `);
  const map: Record<string, string> = {};
  for (const u of users) {
    const full = `${u.first_name} ${u.last_name}`;
    const initials = `${u.first_name[0] || ''}${u.last_name[0] || ''}`.toUpperCase();
    map[full] = initials;
    map[initials] = initials;
  }
  _initialsCache = map;
  return map;
}

export function clearInitialsCache(): void {
  _initialsCache = null;
}

// ============================================================
// Service configs CRUD
// ============================================================

export async function getServiceConfigs(filters?: {
  serviceType?: string;
  am?: string;
  cm?: string;
  status?: string;
}): Promise<ServiceConfig[]> {
  await ensureSchema();
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (filters?.serviceType) { where.push('service_type = ?'); args.push(filters.serviceType); }
  if (filters?.am) { where.push('am = ?'); args.push(filters.am); }
  if (filters?.cm) { where.push('cm = ?'); args.push(filters.cm); }
  if (filters?.status) { where.push('status = ?'); args.push(filters.status); }
  else { where.push("status = 'active'"); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return rows<ServiceConfig>(`
    SELECT * FROM client_service_configs ${clause}
    ORDER BY client_name, service_type
  `, args);
}

export async function upsertServiceConfig(config: Omit<ServiceConfig, 'id'>): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO client_service_configs (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, budget, currency, status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(client_name, service_type) DO UPDATE SET
            am = excluded.am, cm = excluded.cm, level = excluded.level, tier = excluded.tier,
            calls = excluded.calls, am_hrs = excluded.am_hrs, cm_hrs = excluded.cm_hrs,
            budget = excluded.budget, currency = excluded.currency, status = excluded.status,
            updated_at = datetime('now')`,
    args: [config.client_name, config.service_type, config.am, config.cm, config.level,
           config.tier, config.calls, config.am_hrs, config.cm_hrs, config.budget, config.currency, config.status],
  });
}

export async function deleteServiceConfig(id: number): Promise<void> {
  await db.execute({ sql: 'DELETE FROM client_service_configs WHERE id = ?', args: [id] });
}

// ============================================================
// Harvest hours aggregation
// ============================================================

/**
 * Get actual hours from Harvest aggregated by client + month,
 * split by whether the person is the AM or CM for that client/service.
 */
export async function getMonthlyHoursForService(
  serviceType: string,
  months: string[],
): Promise<MonthlyHours[]> {
  if (!months.length) return [];

  // Get all configs for this service type to know AM/CM assignments
  const configs = await getServiceConfigs({ serviceType });
  if (!configs.length) return [];

  const initialsMap = await getInitialsMap();

  // Build reverse map: initials -> full names
  const initialsToNames: Record<string, string[]> = {};
  for (const [fullName, initials] of Object.entries(initialsMap)) {
    if (fullName === initials) continue; // skip self-referencing
    if (!initialsToNames[initials]) initialsToNames[initials] = [];
    initialsToNames[initials].push(fullName);
  }

  // Get all time entries for the date range
  const minMonth = months[0];
  const maxMonth = months[months.length - 1];
  const startDate = `${minMonth}-01`;
  const endDate = `${maxMonth}-31`;

  const entries = await rows<{
    client_name: string;
    user_name: string;
    month: string;
    hours: number;
  }>(`
    SELECT client_name,
           user_name,
           strftime('%Y-%m', spent_date) as month,
           ROUND(SUM(hours), 2) as hours
    FROM harvest_time_entries
    WHERE spent_date >= ? AND spent_date <= ?
      AND client_name IS NOT NULL
    GROUP BY client_name, user_name, month
  `, [startDate, endDate]);

  // Map entries to AM/CM based on configs
  const result: Record<string, MonthlyHours> = {};

  for (const config of configs) {
    for (const month of months) {
      const key = `${config.client_name}::${month}`;
      result[key] = {
        client_name: config.client_name,
        month,
        am_hours: 0,
        cm_hours: 0,
        total_hours: 0,
      };
    }
  }

  for (const entry of entries) {
    // Find matching config
    const config = configs.find(c =>
      c.client_name.toLowerCase() === entry.client_name.toLowerCase()
    );
    if (!config) continue;

    const key = `${config.client_name}::${entry.month}`;
    if (!result[key]) continue;

    // Determine if this person is AM or CM
    const userInitials = initialsMap[entry.user_name] || '';
    const isAM = config.am && (config.am === userInitials || config.am === entry.user_name);
    const isCM = config.cm && (config.cm === userInitials || config.cm === entry.user_name);

    if (isAM) {
      result[key].am_hours += entry.hours;
    } else if (isCM) {
      result[key].cm_hours += entry.hours;
    }
    // Hours from other people don't count toward AM/CM split but still count total
    result[key].total_hours += entry.hours;
  }

  // Round values
  for (const r of Object.values(result)) {
    r.am_hours = Math.round(r.am_hours * 100) / 100;
    r.cm_hours = Math.round(r.cm_hours * 100) / 100;
    r.total_hours = Math.round(r.total_hours * 100) / 100;
  }

  return Object.values(result);
}

// ============================================================
// Capacity per person
// ============================================================

export async function getPersonCapacity(
  serviceType: string,
  month: string,
): Promise<PersonCapacity[]> {
  const configs = await getServiceConfigs({ serviceType });
  const initialsMap = await getInitialsMap();

  // Collect unique people (by initials)
  const people: Record<string, { initials: string; allocatedAM: number; allocatedCM: number }> = {};

  for (const c of configs) {
    if (c.am) {
      if (!people[c.am]) people[c.am] = { initials: c.am, allocatedAM: 0, allocatedCM: 0 };
      people[c.am].allocatedAM += c.am_hrs;
    }
    if (c.cm) {
      if (!people[c.cm]) people[c.cm] = { initials: c.cm, allocatedAM: 0, allocatedCM: 0 };
      people[c.cm].allocatedCM += c.cm_hrs;
    }
  }

  // Get actual hours for the month per person
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  const actuals = await rows<{ user_name: string; user_id: number; hours: number }>(`
    SELECT user_name, user_id, ROUND(SUM(hours), 2) as hours
    FROM harvest_time_entries
    WHERE spent_date >= ? AND spent_date <= ?
      AND client_name IS NOT NULL
    GROUP BY user_id, user_name
  `, [startDate, endDate]);

  // Get capacity from harvest_users
  const users = await rows<{ id: number; name: string; weekly_capacity_hours: number }>(`
    SELECT id, first_name || ' ' || last_name as name, weekly_capacity_hours
    FROM harvest_users WHERE is_active = 1
  `);

  // ~4.33 weeks per month, assume 80% billable
  const WEEKS_PER_MONTH = 4.33;
  const BILLABLE_PCT = 0.8;

  const result: PersonCapacity[] = [];

  for (const [initials, alloc] of Object.entries(people)) {
    // Find the matching Harvest user
    const matchedUser = users.find(u => initialsMap[u.name] === initials);
    const actualEntry = actuals.find(a => initialsMap[a.user_name] === initials);

    const capacityHours = matchedUser
      ? Math.round(matchedUser.weekly_capacity_hours * WEEKS_PER_MONTH * BILLABLE_PCT)
      : 151 * BILLABLE_PCT; // fallback: 151 hrs/month at 80%

    const actualHours = actualEntry?.hours || 0;
    const allocatedTotal = alloc.allocatedAM + alloc.allocatedCM;

    result.push({
      initials,
      user_name: matchedUser?.name || initials,
      user_id: matchedUser?.id || actualEntry?.user_id || 0,
      allocated_am_hrs: alloc.allocatedAM,
      allocated_cm_hrs: alloc.allocatedCM,
      actual_hours: actualHours,
      capacity_hours: Math.round(capacityHours),
      capacity_pct: capacityHours > 0
        ? Math.round(allocatedTotal / capacityHours * 100 * 10) / 10
        : 0,
    });
  }

  return result.sort((a, b) => b.capacity_pct - a.capacity_pct);
}

// ============================================================
// Deliverable completions
// ============================================================

export async function getCompletions(
  serviceType: string,
  months: string[],
): Promise<DeliverableCompletion[]> {
  await ensureSchema();
  if (!months.length) return [];
  const placeholders = months.map(() => '?').join(',');
  return rows<DeliverableCompletion>(`
    SELECT * FROM deliverable_completions
    WHERE service_type = ? AND month IN (${placeholders})
  `, [serviceType, ...months]);
}

export async function toggleCompletion(
  clientName: string,
  serviceType: string,
  month: string,
  userName: string,
): Promise<boolean> {
  await ensureSchema();
  // Check current state
  const existing = await scalar<number>(`
    SELECT completed FROM deliverable_completions
    WHERE client_name = ? AND service_type = ? AND month = ?
  `, [clientName, serviceType, month]);

  const newState = existing ? 0 : 1;

  await db.execute({
    sql: `INSERT INTO deliverable_completions (client_name, service_type, month, completed, completed_by, completed_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(client_name, service_type, month) DO UPDATE SET
            completed = ?, completed_by = ?, completed_at = datetime('now')`,
    args: [clientName, serviceType, month, newState, userName, newState, userName],
  });

  return newState === 1;
}

// ============================================================
// Distinct values for filters
// ============================================================

export async function getDistinctPeople(): Promise<string[]> {
  const ams = await rows<{ am: string }>('SELECT DISTINCT am FROM client_service_configs WHERE am IS NOT NULL AND status = \'active\'');
  const cms = await rows<{ cm: string }>('SELECT DISTINCT cm FROM client_service_configs WHERE cm IS NOT NULL AND status = \'active\'');
  const all = Array.from(new Set([...ams.map(a => a.am), ...cms.map(c => c.cm)]));
  return all.sort();
}

export async function getDistinctServiceTypes(): Promise<string[]> {
  const result = await rows<{ service_type: string }>('SELECT DISTINCT service_type FROM client_service_configs WHERE status = \'active\' ORDER BY service_type');
  return result.map(r => r.service_type);
}

// ============================================================
// Monthly spend from ad platforms (for budget comparison)
// ============================================================

export async function getMonthlySpend(
  clientName: string,
  months: string[],
): Promise<Record<string, number>> {
  if (!months.length) return {};
  const placeholders = months.map(() => '?').join(',');

  // Combine Meta + Google Ads spend
  const spendRows = await rows<{ month: string; spend: number }>(`
    SELECT strftime('%Y-%m', date) as month, ROUND(SUM(spend), 2) as spend
    FROM (
      SELECT date_start as date, spend FROM meta_ad_daily WHERE client_name = ? AND strftime('%Y-%m', date_start) IN (${placeholders})
      UNION ALL
      SELECT date as date, cost as spend FROM gads_campaign_daily WHERE client_name = ? AND strftime('%Y-%m', date) IN (${placeholders})
    )
    GROUP BY month
  `, [clientName, ...months, clientName, ...months]);

  const result: Record<string, number> = {};
  for (const r of spendRows) {
    result[r.month] = r.spend;
  }
  return result;
}

// ============================================================
// Helper: generate month strings
// ============================================================

export function generateMonths(count: number, endMonth?: string): string[] {
  const end = endMonth ? new Date(endMonth + '-15') : new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}
