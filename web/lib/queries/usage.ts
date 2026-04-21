import { db, rows, scalar } from './base.js';

// --- Cost constants (USD per million tokens) ---

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20241022': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
};

const USD_TO_GBP = 0.79;

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? { input: 3, output: 15 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

export function estimateCostGbp(model: string, inputTokens: number, outputTokens: number): number {
  return estimateCostUsd(model, inputTokens, outputTokens) * USD_TO_GBP;
}

/**
 * SQL CASE expression that computes cost in pence per row.
 * Uses USD rates * USD_TO_GBP * 100 to get pence.
 */
const COST_PENCE_SQL = `(CASE model
  WHEN 'claude-sonnet-4-5-20241022' THEN (input_tokens * 3.0 + output_tokens * 15.0)
  WHEN 'claude-sonnet-4-6' THEN (input_tokens * 3.0 + output_tokens * 15.0)
  WHEN 'claude-haiku-4-5-20251001' THEN (input_tokens * 0.80 + output_tokens * 4.0)
  ELSE (input_tokens * 3.0 + output_tokens * 15.0)
END / 1000000.0 * ${USD_TO_GBP} * 100)`;

// --- Recording ---

export async function recordUsage(params: {
  userId: string | null;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO api_usage (user_id, model, feature, input_tokens, output_tokens, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.userId, params.model, params.feature, params.inputTokens, params.outputTokens, new Date().toISOString()],
  });
}

// --- Querying ---

interface DateFilter {
  from?: string;
  to?: string;
}

function dateWhere(filter: DateFilter): { clause: string; args: (string | number | null)[] } {
  const conditions: string[] = [];
  const args: (string | number | null)[] = [];
  if (filter.from) {
    conditions.push('created_at >= ?');
    args.push(filter.from);
  }
  if (filter.to) {
    conditions.push('created_at < ?');
    // Add one day to make the "to" date inclusive
    const next = new Date(filter.to);
    next.setDate(next.getDate() + 1);
    args.push(next.toISOString().slice(0, 10));
  }
  return {
    clause: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
    args,
  };
}

export interface UsageSummary {
  total_input: number;
  total_output: number;
  total_calls: number;
}

export async function getUsageSummary(filter: DateFilter = {}): Promise<UsageSummary> {
  const { clause, args } = dateWhere(filter);
  const result = await rows<{ total_input: number; total_output: number; total_calls: number }>(
    `SELECT COALESCE(SUM(input_tokens), 0) as total_input,
            COALESCE(SUM(output_tokens), 0) as total_output,
            COUNT(*) as total_calls
     FROM api_usage${clause}`,
    args,
  );
  return result[0];
}

export interface UserUsageRow {
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  total_input: number;
  total_output: number;
  total_calls: number;
}

export async function getUsageByUser(filter: DateFilter = {}): Promise<UserUsageRow[]> {
  const { clause, args } = dateWhere(filter);
  return rows<UserUsageRow>(
    `SELECT a.user_id,
            u.name as user_name,
            u.email as user_email,
            COALESCE(SUM(a.input_tokens), 0) as total_input,
            COALESCE(SUM(a.output_tokens), 0) as total_output,
            COUNT(*) as total_calls
     FROM api_usage a
     LEFT JOIN users u ON a.user_id = u.id
     ${clause}
     GROUP BY a.user_id
     ORDER BY (COALESCE(SUM(a.input_tokens), 0) + COALESCE(SUM(a.output_tokens), 0)) DESC`,
    args,
  );
}

export interface ModelUsageRow {
  model: string;
  total_input: number;
  total_output: number;
  total_calls: number;
}

export async function getUsageByModel(filter: DateFilter = {}): Promise<ModelUsageRow[]> {
  const { clause, args } = dateWhere(filter);
  return rows<ModelUsageRow>(
    `SELECT model,
            COALESCE(SUM(input_tokens), 0) as total_input,
            COALESCE(SUM(output_tokens), 0) as total_output,
            COUNT(*) as total_calls
     FROM api_usage${clause}
     GROUP BY model
     ORDER BY (COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0)) DESC`,
    args,
  );
}

export interface FeatureUsageRow {
  feature: string;
  total_input: number;
  total_output: number;
  total_calls: number;
}

export async function getUsageByFeature(filter: DateFilter = {}): Promise<FeatureUsageRow[]> {
  const { clause, args } = dateWhere(filter);
  return rows<FeatureUsageRow>(
    `SELECT feature,
            COALESCE(SUM(input_tokens), 0) as total_input,
            COALESCE(SUM(output_tokens), 0) as total_output,
            COUNT(*) as total_calls
     FROM api_usage${clause}
     GROUP BY feature
     ORDER BY (COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0)) DESC`,
    args,
  );
}

// --- Limits (stored as pence) ---

/** Get a user's estimated spend in pence for the current month. */
export async function getUserMonthlyCostPence(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const result = await scalar<number>(
    `SELECT COALESCE(SUM(${COST_PENCE_SQL}), 0) FROM api_usage WHERE user_id = ? AND created_at >= ?`,
    [userId, monthStart],
  );
  return result ?? 0;
}

/** Get a user's estimated spend in pence for today. */
export async function getUserDailyCostPence(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await scalar<number>(
    `SELECT COALESCE(SUM(${COST_PENCE_SQL}), 0) FROM api_usage WHERE user_id = ? AND created_at >= ?`,
    [userId, today],
  );
  return result ?? 0;
}

interface UserCostLimits {
  monthly_token_limit: number | null; // pence
  daily_token_limit: number | null;   // pence
}

export async function getUserCostLimits(userId: string): Promise<UserCostLimits> {
  const result = await rows<UserCostLimits>(
    'SELECT monthly_token_limit, daily_token_limit FROM user_token_limits WHERE user_id = ?',
    [userId],
  );
  if (result.length === 0) return { monthly_token_limit: null, daily_token_limit: null };
  return result[0];
}

/** Set cost limits in pence. Pass null to remove a limit. */
export async function setUserCostLimits(userId: string, limits: { monthlyPence: number | null; dailyPence: number | null }): Promise<void> {
  if (limits.monthlyPence === null && limits.dailyPence === null) {
    await db.execute({ sql: 'DELETE FROM user_token_limits WHERE user_id = ?', args: [userId] });
  } else {
    await db.execute({
      sql: `INSERT INTO user_token_limits (user_id, monthly_token_limit, daily_token_limit, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              monthly_token_limit = excluded.monthly_token_limit,
              daily_token_limit = excluded.daily_token_limit,
              updated_at = excluded.updated_at`,
      args: [userId, limits.monthlyPence, limits.dailyPence, new Date().toISOString()],
    });
  }
}

/** Check if a user is within their daily and monthly cost limits. */
export async function checkUserWithinLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const limits = await getUserCostLimits(userId);

  // Check daily limit (pence)
  if (limits.daily_token_limit !== null) {
    const dailyCostPence = await getUserDailyCostPence(userId);
    if (dailyCostPence >= limits.daily_token_limit) {
      const spent = (dailyCostPence / 100).toFixed(2);
      const cap = (limits.daily_token_limit / 100).toFixed(2);
      return { allowed: false, message: `Daily spend limit reached (£${spent} / £${cap}).` };
    }
  }

  // Check monthly limit (pence)
  if (limits.monthly_token_limit !== null) {
    const monthlyCostPence = await getUserMonthlyCostPence(userId);
    if (monthlyCostPence >= limits.monthly_token_limit) {
      const spent = (monthlyCostPence / 100).toFixed(2);
      const cap = (limits.monthly_token_limit / 100).toFixed(2);
      return { allowed: false, message: `Monthly spend limit reached (£${spent} / £${cap}).` };
    }
  }

  return { allowed: true };
}

// --- Monthly forecast ---

export interface MonthlyForecast {
  monthStart: string;
  todayIso: string;
  daysElapsed: number;
  daysInMonth: number;
  monthToDatePence: number;
  projectedMonthPence: number;
  annualisedPence: number;
}

/**
 * Project the current month's full spend based on pro-rating the spend
 * recorded so far. Annualised figure is projected-month × 12 — a naive but
 * useful ceiling for budget conversations.
 */
export async function getMonthlyForecast(): Promise<MonthlyForecast> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const todayIso = now.toISOString().slice(0, 10);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = Math.max(1, now.getUTCDate());

  const monthToDatePence = (await scalar<number>(
    `SELECT COALESCE(SUM(${COST_PENCE_SQL}), 0) FROM api_usage WHERE created_at >= ?`,
    [monthStart],
  )) ?? 0;

  const projectedMonthPence = Math.round((monthToDatePence / daysElapsed) * daysInMonth);
  const annualisedPence = projectedMonthPence * 12;

  return {
    monthStart,
    todayIso,
    daysElapsed,
    daysInMonth,
    monthToDatePence,
    projectedMonthPence,
    annualisedPence,
  };
}

// --- Asana task volume (fed from fathom_asana_synced) ---

export interface AsanaVolumeRow {
  source_type: string;
  total: number;
  today: number;
  month: number;
}

export interface AsanaVolumeSummary {
  totalAllTime: number;
  totalToday: number;
  totalThisMonth: number;
  projectedThisMonth: number;
  bySource: AsanaVolumeRow[];
}

export async function getAsanaTaskVolume(): Promise<AsanaVolumeSummary> {
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = Math.max(1, now.getUTCDate());

  try {
    const bySource = await rows<AsanaVolumeRow>(
      `SELECT COALESCE(source_type, 'unknown') as source_type,
              COUNT(*) as total,
              SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today,
              SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as month
         FROM fathom_asana_synced
         GROUP BY source_type
         ORDER BY total DESC`,
      [today, monthStart],
    );
    const totalAllTime = bySource.reduce((sum, r) => sum + Number(r.total), 0);
    const totalToday = bySource.reduce((sum, r) => sum + Number(r.today), 0);
    const totalThisMonth = bySource.reduce((sum, r) => sum + Number(r.month), 0);
    const projectedThisMonth = Math.round((totalThisMonth / daysElapsed) * daysInMonth);
    return { totalAllTime, totalToday, totalThisMonth, projectedThisMonth, bySource };
  } catch {
    return { totalAllTime: 0, totalToday: 0, totalThisMonth: 0, projectedThisMonth: 0, bySource: [] };
  }
}

// --- Per-user limit info for admin view ---

export interface UserWithUsageRow {
  user_id: string;
  user_name: string;
  user_email: string;
  role: 'admin' | 'standard';
  monthly_limit_pence: number | null;
  daily_limit_pence: number | null;
  monthly_cost_pence: number;
  daily_cost_pence: number;
  total_input: number;
  total_output: number;
  total_calls: number;
}

export async function getAllUsersWithUsage(filter: DateFilter = {}): Promise<UserWithUsageRow[]> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const { clause, args: filterArgs } = dateWhere(filter);

  // Build the filtered usage subquery
  const filteredUsageWhere = clause ? clause.replace(' WHERE ', '') : '1=1';

  return rows<UserWithUsageRow>(
    `SELECT u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            u.role,
            l.monthly_token_limit as monthly_limit_pence,
            l.daily_token_limit as daily_limit_pence,
            COALESCE(mc.cost, 0) as monthly_cost_pence,
            COALESCE(dc.cost, 0) as daily_cost_pence,
            COALESCE(fu.total_input, 0) as total_input,
            COALESCE(fu.total_output, 0) as total_output,
            COALESCE(fu.total_calls, 0) as total_calls
     FROM users u
     LEFT JOIN user_token_limits l ON u.id = l.user_id
     LEFT JOIN (
       SELECT user_id, SUM(${COST_PENCE_SQL}) as cost
       FROM api_usage WHERE created_at >= ?
       GROUP BY user_id
     ) mc ON u.id = mc.user_id
     LEFT JOIN (
       SELECT user_id, SUM(${COST_PENCE_SQL}) as cost
       FROM api_usage WHERE created_at >= ?
       GROUP BY user_id
     ) dc ON u.id = dc.user_id
     LEFT JOIN (
       SELECT user_id,
              SUM(input_tokens) as total_input,
              SUM(output_tokens) as total_output,
              COUNT(*) as total_calls
       FROM api_usage WHERE ${filteredUsageWhere}
       GROUP BY user_id
     ) fu ON u.id = fu.user_id
     ORDER BY u.role ASC, u.name ASC`,
    [monthStart, today, ...filterArgs],
  );
}
