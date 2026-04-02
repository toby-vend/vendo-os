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

export async function getUserTokenLimit(userId: string): Promise<number | null> {
  const result = await scalar<number>(
    'SELECT monthly_token_limit FROM user_token_limits WHERE user_id = ?',
    [userId],
  );
  return result;
}

export async function setUserTokenLimit(userId: string, limit: number | null): Promise<void> {
  if (limit === null) {
    await db.execute({ sql: 'DELETE FROM user_token_limits WHERE user_id = ?', args: [userId] });
  } else {
    await db.execute({
      sql: `INSERT INTO user_token_limits (user_id, monthly_token_limit, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET monthly_token_limit = excluded.monthly_token_limit, updated_at = excluded.updated_at`,
      args: [userId, limit, new Date().toISOString()],
    });
  }
}

export async function checkUserWithinLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const [used, limit] = await Promise.all([
    getUserMonthlyUsage(userId),
    getUserTokenLimit(userId),
  ]);
  if (limit === null) return { allowed: true, used, limit };
  return { allowed: used < limit, used, limit };
}

// --- Per-user limit info for admin view ---

export interface UserLimitRow {
  user_id: string;
  monthly_token_limit: number | null;
  monthly_used: number;
}

export async function getAllUserLimits(): Promise<UserLimitRow[]> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return rows<UserLimitRow>(
    `SELECT u.id as user_id,
            l.monthly_token_limit,
            COALESCE(m.used, 0) as monthly_used
     FROM users u
     LEFT JOIN user_token_limits l ON u.id = l.user_id
     LEFT JOIN (
       SELECT user_id, SUM(input_tokens + output_tokens) as used
       FROM api_usage
       WHERE created_at >= ?
       GROUP BY user_id
     ) m ON u.id = m.user_id`,
    [monthStart],
  );
}
