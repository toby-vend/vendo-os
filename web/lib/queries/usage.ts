import { db, rows, scalar } from './base.js';

// --- Cost constants (USD per million tokens) ---

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20241022': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? { input: 3, output: 15 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

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

// --- Limits ---

export async function getUserMonthlyUsage(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const result = await scalar<number>(
    `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM api_usage WHERE user_id = ? AND created_at >= ?`,
    [userId, monthStart],
  );
  return result ?? 0;
}

export async function getUserDailyUsage(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await scalar<number>(
    `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM api_usage WHERE user_id = ? AND created_at >= ?`,
    [userId, today],
  );
  return result ?? 0;
}

interface UserLimits {
  monthly_token_limit: number | null;
  daily_token_limit: number | null;
}

export async function getUserTokenLimits(userId: string): Promise<UserLimits> {
  const result = await rows<UserLimits>(
    'SELECT monthly_token_limit, daily_token_limit FROM user_token_limits WHERE user_id = ?',
    [userId],
  );
  if (result.length === 0) return { monthly_token_limit: null, daily_token_limit: null };
  return result[0];
}

export async function setUserTokenLimits(userId: string, limits: { monthly: number | null; daily: number | null }): Promise<void> {
  if (limits.monthly === null && limits.daily === null) {
    await db.execute({ sql: 'DELETE FROM user_token_limits WHERE user_id = ?', args: [userId] });
  } else {
    await db.execute({
      sql: `INSERT INTO user_token_limits (user_id, monthly_token_limit, daily_token_limit, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              monthly_token_limit = excluded.monthly_token_limit,
              daily_token_limit = excluded.daily_token_limit,
              updated_at = excluded.updated_at`,
      args: [userId, limits.monthly, limits.daily, new Date().toISOString()],
    });
  }
}

export async function checkUserWithinLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const limits = await getUserTokenLimits(userId);

  // Check daily limit
  if (limits.daily_token_limit !== null) {
    const dailyUsed = await getUserDailyUsage(userId);
    if (dailyUsed >= limits.daily_token_limit) {
      return { allowed: false, message: `Daily token limit reached (${dailyUsed.toLocaleString()} / ${limits.daily_token_limit.toLocaleString()}).` };
    }
  }

  // Check monthly limit
  if (limits.monthly_token_limit !== null) {
    const monthlyUsed = await getUserMonthlyUsage(userId);
    if (monthlyUsed >= limits.monthly_token_limit) {
      return { allowed: false, message: `Monthly token limit reached (${monthlyUsed.toLocaleString()} / ${limits.monthly_token_limit.toLocaleString()}).` };
    }
  }

  return { allowed: true };
}

// --- Per-user limit info for admin view ---

export interface UserWithUsageRow {
  user_id: string;
  user_name: string;
  user_email: string;
  role: 'admin' | 'standard';
  monthly_token_limit: number | null;
  daily_token_limit: number | null;
  monthly_used: number;
  daily_used: number;
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
            l.monthly_token_limit,
            l.daily_token_limit,
            COALESCE(mu.used, 0) as monthly_used,
            COALESCE(du.used, 0) as daily_used,
            COALESCE(fu.total_input, 0) as total_input,
            COALESCE(fu.total_output, 0) as total_output,
            COALESCE(fu.total_calls, 0) as total_calls
     FROM users u
     LEFT JOIN user_token_limits l ON u.id = l.user_id
     LEFT JOIN (
       SELECT user_id, SUM(input_tokens + output_tokens) as used
       FROM api_usage WHERE created_at >= ?
       GROUP BY user_id
     ) mu ON u.id = mu.user_id
     LEFT JOIN (
       SELECT user_id, SUM(input_tokens + output_tokens) as used
       FROM api_usage WHERE created_at >= ?
       GROUP BY user_id
     ) du ON u.id = du.user_id
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
