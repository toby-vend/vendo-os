import { db, rows, scalar } from './base.js';

// ============================================================
// Schema initialisation (runs once)
// ============================================================

let _schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  // Tables already exist on Turso (created during push/migration).
  // Use IF NOT EXISTS for local dev safety. Avoid datetime('now') defaults
  // which Turso/libSQL rejects as non-constant.
  const schemaSql = [
    `CREATE TABLE IF NOT EXISTS client_service_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL, service_type TEXT NOT NULL,
      am TEXT, cm TEXT, level TEXT DEFAULT 'Auto', tier INTEGER DEFAULT 3,
      calls INTEGER DEFAULT 1, am_hrs REAL DEFAULT 2, cm_hrs REAL DEFAULT 2,
      cs_hrs REAL DEFAULT 0,
      budget REAL DEFAULT 0, currency TEXT DEFAULT 'GBP', status TEXT DEFAULT 'active',
      created_at TEXT, updated_at TEXT, UNIQUE(client_name, service_type)
    )`,
    `CREATE TABLE IF NOT EXISTS deliverable_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL, service_type TEXT NOT NULL, month TEXT NOT NULL,
      completed INTEGER DEFAULT 0, completed_by TEXT, completed_at TEXT,
      UNIQUE(client_name, service_type, month)
    )`,
    `CREATE TABLE IF NOT EXISTS deliverable_hour_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL, service_type TEXT NOT NULL, month TEXT NOT NULL,
      user_initials TEXT NOT NULL, user_name TEXT NOT NULL, role TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 0, entered_at TEXT, updated_at TEXT
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_dhe_unique ON deliverable_hour_entries(client_name, service_type, month, user_initials, role)',
    `CREATE TABLE IF NOT EXISTS deliverable_team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      initials TEXT NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT,
      service_types TEXT NOT NULL DEFAULT 'paid_search,seo,paid_social',
      roles TEXT NOT NULL DEFAULT 'am,cm',
      is_active INTEGER DEFAULT 1
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_dtm_initials ON deliverable_team_members(initials)',
  ];
  for (const sql of schemaSql) {
    try { await db.execute({ sql, args: [] }); } catch { /* already exists */ }
  }
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
  cs_hrs: number;
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
    sql: `INSERT INTO client_service_configs (client_name, service_type, am, cm, level, tier, calls, am_hrs, cm_hrs, cs_hrs, budget, currency, status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(client_name, service_type) DO UPDATE SET
            am = excluded.am, cm = excluded.cm, level = excluded.level, tier = excluded.tier,
            calls = excluded.calls, am_hrs = excluded.am_hrs, cm_hrs = excluded.cm_hrs, cs_hrs = excluded.cs_hrs,
            budget = excluded.budget, currency = excluded.currency, status = excluded.status,
            updated_at = datetime('now')`,
    args: [config.client_name, config.service_type, config.am, config.cm, config.level,
           config.tier, config.calls, config.am_hrs, config.cm_hrs, config.cs_hrs ?? 0, config.budget, config.currency, config.status],
  });
}

export async function updateConfigField(id: number, field: string, value: string | number | null): Promise<void> {
  const allowed = ['am', 'cm', 'level', 'tier', 'calls', 'am_hrs', 'cm_hrs', 'cs_hrs', 'budget', 'currency'];
  if (!allowed.includes(field)) throw new Error('Invalid field: ' + field);
  await ensureSchema();
  await db.execute({
    sql: `UPDATE client_service_configs SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [value, id],
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
  const sorted = [...months].sort();
  const startDate = `${sorted[0]}-01`;
  const endDate = `${sorted[sorted.length - 1]}-31`;

  // Route through client_source_mappings for proper Harvest → canonical client resolution
  const entries = await rows<{
    config_client_name: string;
    user_name: string;
    month: string;
    hours: number;
  }>(`
    SELECT csc.client_name as config_client_name,
           h.user_name,
           strftime('%Y-%m', h.spent_date) as month,
           ROUND(SUM(h.hours), 2) as hours
    FROM harvest_time_entries h
    JOIN client_source_mappings csm
      ON CAST(h.client_id AS TEXT) = csm.external_id AND csm.source = 'harvest'
    JOIN clients c ON c.id = csm.client_id
    JOIN client_service_configs csc
      ON csc.service_type = ?
      AND csc.status = 'active'
      AND (LOWER(csc.client_name) = LOWER(c.name)
           OR LOWER(csc.client_name) = LOWER(c.display_name)
           OR INSTR(LOWER(c.name), LOWER(csc.client_name)) > 0
           OR INSTR(LOWER(COALESCE(c.display_name, '')), LOWER(csc.client_name)) > 0
           OR INSTR(LOWER(csc.client_name), LOWER(COALESCE(c.display_name, c.name))) > 0)
    WHERE h.spent_date >= ? AND h.spent_date <= ?
    GROUP BY csc.client_name, h.user_name, month

    UNION ALL

    SELECT csc2.client_name as config_client_name,
           h2.user_name,
           strftime('%Y-%m', h2.spent_date) as month,
           ROUND(SUM(h2.hours), 2) as hours
    FROM harvest_time_entries h2
    JOIN client_service_configs csc2
      ON (LOWER(h2.client_name) = LOWER(csc2.client_name)
          OR INSTR(LOWER(h2.client_name), LOWER(csc2.client_name)) > 0)
      AND csc2.service_type = ?
      AND csc2.status = 'active'
    WHERE h2.spent_date >= ? AND h2.spent_date <= ?
      AND h2.client_id NOT IN (
        SELECT CAST(csm2.external_id AS INTEGER)
        FROM client_source_mappings csm2
        WHERE csm2.source = 'harvest'
      )
    GROUP BY csc2.client_name, h2.user_name, month
  `, [serviceType, startDate, endDate, serviceType, startDate, endDate]);

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
    const config = configs.find(c => c.client_name === entry.config_client_name);
    if (!config) continue;

    const key = `${config.client_name}::${entry.month}`;
    if (!result[key]) continue;

    // Determine if this person is AM or CM (supports multi-person e.g. "SF / BD")
    const userInitials = initialsMap[entry.user_name] || '';
    const amPeople = parseMultiPerson(config.am);
    const cmPeople = parseMultiPerson(config.cm);
    const isAM = amPeople.includes(userInitials) || amPeople.includes(entry.user_name);
    const isCM = cmPeople.includes(userInitials) || cmPeople.includes(entry.user_name);

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

/**
 * Harvest hours in the same shape as getAggregatedHours() — keyed by "ClientName::2026-04"
 * with am/cm breakdown per person. This makes it drop-in compatible with the template.
 */
export async function getHarvestAggregatedHours(
  serviceType: string,
  months: string[],
): Promise<Record<string, { am: { total: number; breakdown: HourBreakdown[] }; cm: { total: number; breakdown: HourBreakdown[] } }>> {
  if (!months.length) return {};

  const configs = await getServiceConfigs({ serviceType });
  if (!configs.length) return {};

  const initialsMap = await getInitialsMap();

  const sorted = [...months].sort();
  const startDate = `${sorted[0]}-01`;
  const endDate = `${sorted[sorted.length - 1]}-31`;

  // Route through client_source_mappings → clients → client_service_configs
  // to handle Harvest client names that differ from config names.
  // Also fall back to direct name match for any clients not in the mapping table.
  const entries = await rows<{
    config_client_name: string;
    user_name: string;
    month: string;
    hours: number;
  }>(`
    SELECT csc.client_name as config_client_name,
           h.user_name,
           strftime('%Y-%m', h.spent_date) as month,
           ROUND(SUM(h.hours), 2) as hours
    FROM harvest_time_entries h
    JOIN client_source_mappings csm
      ON CAST(h.client_id AS TEXT) = csm.external_id AND csm.source = 'harvest'
    JOIN clients c ON c.id = csm.client_id
    JOIN client_service_configs csc
      ON csc.service_type = ?
      AND csc.status = 'active'
      AND (LOWER(csc.client_name) = LOWER(c.name)
           OR LOWER(csc.client_name) = LOWER(c.display_name)
           OR INSTR(LOWER(c.name), LOWER(csc.client_name)) > 0
           OR INSTR(LOWER(COALESCE(c.display_name, '')), LOWER(csc.client_name)) > 0
           OR INSTR(LOWER(csc.client_name), LOWER(COALESCE(c.display_name, c.name))) > 0)
    WHERE h.spent_date >= ? AND h.spent_date <= ?
    GROUP BY csc.client_name, h.user_name, month

    UNION ALL

    SELECT csc2.client_name as config_client_name,
           h2.user_name,
           strftime('%Y-%m', h2.spent_date) as month,
           ROUND(SUM(h2.hours), 2) as hours
    FROM harvest_time_entries h2
    JOIN client_service_configs csc2
      ON (LOWER(h2.client_name) = LOWER(csc2.client_name)
          OR INSTR(LOWER(h2.client_name), LOWER(csc2.client_name)) > 0)
      AND csc2.service_type = ?
      AND csc2.status = 'active'
    WHERE h2.spent_date >= ? AND h2.spent_date <= ?
      AND h2.client_id NOT IN (
        SELECT CAST(csm2.external_id AS INTEGER)
        FROM client_source_mappings csm2
        WHERE csm2.source = 'harvest'
      )
    GROUP BY csc2.client_name, h2.user_name, month
  `, [serviceType, startDate, endDate, serviceType, startDate, endDate]);

  const result: Record<string, { am: { total: number; breakdown: HourBreakdown[] }; cm: { total: number; breakdown: HourBreakdown[] } }> = {};

  for (const entry of entries) {
    const config = configs.find(c => c.client_name === entry.config_client_name);
    if (!config) continue;

    const key = `${config.client_name}::${entry.month}`;
    if (!result[key]) {
      result[key] = {
        am: { total: 0, breakdown: [] },
        cm: { total: 0, breakdown: [] },
      };
    }

    const userInit = initialsMap[entry.user_name] || entry.user_name;
    const amPeople = parseMultiPerson(config.am);
    const cmPeople = parseMultiPerson(config.cm);
    const isAM = amPeople.includes(userInit) || amPeople.includes(entry.user_name);
    const isCM = cmPeople.includes(userInit) || cmPeople.includes(entry.user_name);

    const bd: HourBreakdown = { user_initials: userInit, user_name: entry.user_name, hours: entry.hours };

    if (isAM) {
      result[key].am.total += entry.hours;
      result[key].am.breakdown.push(bd);
    } else if (isCM) {
      result[key].cm.total += entry.hours;
      result[key].cm.breakdown.push(bd);
    }
  }

  // Round totals
  for (const v of Object.values(result)) {
    v.am.total = Math.round(v.am.total * 100) / 100;
    v.cm.total = Math.round(v.cm.total * 100) / 100;
  }

  return result;
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

// ============================================================
// Multi-person helpers
// ============================================================

/** Parse "JD / MP" or "JD/MP" into ['JD', 'MP'] */
export function parseMultiPerson(val: string | null): string[] {
  if (!val) return [];
  return val.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
}

// ============================================================
// Hour entries CRUD
// ============================================================

export interface HourEntry {
  id: number;
  client_name: string;
  service_type: string;
  month: string;
  user_initials: string;
  user_name: string;
  role: string;
  hours: number;
}

export interface HourBreakdown {
  user_initials: string;
  user_name: string;
  hours: number;
}

/** Get all hour entries for a service type and set of months. */
export async function getHourEntries(
  serviceType: string,
  months: string[],
): Promise<HourEntry[]> {
  await ensureSchema();
  if (!months.length) return [];
  const placeholders = months.map(() => '?').join(',');
  return rows<HourEntry>(`
    SELECT * FROM deliverable_hour_entries
    WHERE service_type = ? AND month IN (${placeholders})
    ORDER BY client_name, month, role
  `, [serviceType, ...months]);
}

/** Get hour entries for a specific user's initials only. */
export async function getHourEntriesForUser(
  serviceType: string,
  months: string[],
  userInitials: string,
): Promise<HourEntry[]> {
  await ensureSchema();
  if (!months.length) return [];
  const placeholders = months.map(() => '?').join(',');
  return rows<HourEntry>(`
    SELECT * FROM deliverable_hour_entries
    WHERE service_type = ? AND month IN (${placeholders}) AND user_initials = ?
    ORDER BY client_name, month
  `, [serviceType, ...months, userInitials]);
}

/** Upsert hours for a specific user/client/month/role. */
export async function upsertHourEntry(
  clientName: string,
  serviceType: string,
  month: string,
  userInitials: string,
  userName: string,
  role: string,
  hours: number,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO deliverable_hour_entries (client_name, service_type, month, user_initials, user_name, role, hours, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(client_name, service_type, month, user_initials, role) DO UPDATE SET
            hours = ?, user_name = ?, updated_at = datetime('now')`,
    args: [clientName, serviceType, month, userInitials, userName, role, hours, hours, userName],
  });
}

/** Delete a user's hour entry (only their own). */
export async function deleteHourEntry(
  clientName: string,
  serviceType: string,
  month: string,
  userInitials: string,
  role: string,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `DELETE FROM deliverable_hour_entries
          WHERE client_name = ? AND service_type = ? AND month = ? AND user_initials = ? AND role = ?`,
    args: [clientName, serviceType, month, userInitials, role],
  });
}

/**
 * Build aggregated hours map: { "ClientName::2026-04": { am: { total, breakdown }, cm: { total, breakdown } } }
 */
export async function getAggregatedHours(
  serviceType: string,
  months: string[],
): Promise<Record<string, { am: { total: number; breakdown: HourBreakdown[] }; cm: { total: number; breakdown: HourBreakdown[] } }>> {
  const entries = await getHourEntries(serviceType, months);
  const result: Record<string, { am: { total: number; breakdown: HourBreakdown[] }; cm: { total: number; breakdown: HourBreakdown[] } }> = {};

  for (const e of entries) {
    const key = `${e.client_name}::${e.month}`;
    if (!result[key]) {
      result[key] = {
        am: { total: 0, breakdown: [] },
        cm: { total: 0, breakdown: [] },
      };
    }
    const bucket = e.role === 'am' ? result[key].am : result[key].cm;
    bucket.total += e.hours;
    bucket.breakdown.push({ user_initials: e.user_initials, user_name: e.user_name, hours: e.hours });
  }

  // Round totals
  for (const v of Object.values(result)) {
    v.am.total = Math.round(v.am.total * 100) / 100;
    v.cm.total = Math.round(v.cm.total * 100) / 100;
  }

  return result;
}

/**
 * Get service types that a given user (by initials) is assigned to.
 */
export async function getServiceTypesForUser(userInitials: string): Promise<string[]> {
  await ensureSchema();
  // Check both am and cm columns, handling multi-person like "JD / MP"
  const configs = await rows<{ service_type: string; am: string | null; cm: string | null }>(`
    SELECT DISTINCT service_type, am, cm FROM client_service_configs WHERE status = 'active'
  `);

  const types = new Set<string>();
  for (const c of configs) {
    const ams = parseMultiPerson(c.am);
    const cms = parseMultiPerson(c.cm);
    if (ams.includes(userInitials) || cms.includes(userInitials)) {
      types.add(c.service_type);
    }
  }
  return Array.from(types);
}

/**
 * Get configs filtered to only those where the user is assigned.
 */
export async function getServiceConfigsForUser(
  serviceType: string,
  userInitials: string,
): Promise<ServiceConfig[]> {
  await ensureSchema();
  const all = await getServiceConfigs({ serviceType });
  return all.filter(c => {
    const ams = parseMultiPerson(c.am);
    const cms = parseMultiPerson(c.cm);
    return ams.includes(userInitials) || cms.includes(userInitials);
  });
}

/**
 * Map a VendoOS user name or user_id to initials.
 * Checks deliverable_team_members first, then harvest_users, then falls back to initials.
 */
export async function getUserInitials(userName: string, userId?: string): Promise<string> {
  await ensureSchema();
  // Check team members table first (by user_id or name)
  if (userId) {
    const byId = await rows<{ initials: string }>('SELECT initials FROM deliverable_team_members WHERE user_id = ? AND is_active = 1', [userId]);
    if (byId.length) return byId[0].initials;
  }
  const byName = await rows<{ initials: string }>('SELECT initials FROM deliverable_team_members WHERE name = ? AND is_active = 1', [userName]);
  if (byName.length) return byName[0].initials;

  // Fall back to harvest/initials map
  const map = await getInitialsMap();
  if (map[userName]) return map[userName];
  const parts = userName.trim().split(/\s+/);
  return parts.map(p => p[0] || '').join('').toUpperCase();
}

// ============================================================
// Team member management
// ============================================================

export interface TeamMember {
  id: number;
  initials: string;
  name: string;
  user_id: string | null;
  service_types: string;
  roles: string;
  is_active: number;
}

export async function getTeamMembers(activeOnly = true): Promise<TeamMember[]> {
  await ensureSchema();
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  return rows<TeamMember>(`SELECT * FROM deliverable_team_members ${where} ORDER BY initials`);
}

export async function getTeamMembersForService(serviceType: string): Promise<TeamMember[]> {
  const all = await getTeamMembers();
  return all.filter(m => m.service_types.split(',').map(s => s.trim()).includes(serviceType));
}

export async function upsertTeamMember(member: Omit<TeamMember, 'id'>): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO deliverable_team_members (initials, name, user_id, service_types, roles, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(initials) DO UPDATE SET
            name = excluded.name, user_id = excluded.user_id,
            service_types = excluded.service_types, roles = excluded.roles,
            is_active = excluded.is_active`,
    args: [member.initials, member.name, member.user_id, member.service_types, member.roles, member.is_active],
  });
  clearInitialsCache();
}

export async function deleteTeamMember(id: number): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: 'DELETE FROM deliverable_team_members WHERE id = ?', args: [id] });
  clearInitialsCache();
}

/** Get VendoOS users for linking in settings. */
export async function getVendoUsers(): Promise<{ id: string; name: string; email: string }[]> {
  return rows<{ id: string; name: string; email: string }>('SELECT id, name, email FROM users ORDER BY name');
}
