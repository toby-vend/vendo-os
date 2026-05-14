/**
 * Turso-native port of scripts/functions/client-profitability.ts.
 * Wave R / R1 — replaces exec('npx tsx ...') shim in cron.ts.
 *
 * For each client with revenue this period:
 *   - Revenue: SUM(xero_invoices.total) where ACCREC AUTHORISED|PAID this month
 *   - AM cost: COUNT(asana_tasks) × AVG_HOURS_PER_TASK × HOURLY_RATE_AM
 *   - Ad mgmt cost: (SUM(gads_campaign_spend.spend) + SUM(meta_insights.spend)) × AD_MGMT_OVERHEAD_PCT
 *   - AI cost: flat AI_COST_PER_CLIENT
 *   - Margin pct + threshold classification (healthy/warning/critical)
 *
 * Upserts into client_profitability keyed on (client_name, period).
 *
 * Cost assumptions match the CLI script verbatim. Tune in one place
 * (this file) when rates change.
 */
import { db } from '../queries/base.js';

const HOURLY_RATE_AM = 45;
const AD_MGMT_OVERHEAD_PCT = 0.10;
const AI_COST_PER_CLIENT = 15;
const AVG_HOURS_PER_TASK = 0.5;

export interface ProfitabilityRow {
  clientName: string;
  revenue: number;
  taskCount: number;
  amHours: number;
  costAmHours: number;
  adSpend: number;
  costAdMgmt: number;
  costAi: number;
  costTotal: number;
  grossMargin: number;
  marginPct: number;
  classification: 'healthy' | 'warning' | 'critical';
  rootCause: string | null;
}

export interface ProfitabilityResult {
  period: string;
  clientsProcessed: number;
  healthy: number;
  warning: number;
  critical: number;
  upserted: number;
  durationMs: number;
  rows: ProfitabilityRow[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS client_profitability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      period TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      cost_am_hours REAL NOT NULL DEFAULT 0,
      cost_ad_mgmt REAL NOT NULL DEFAULT 0,
      cost_ai REAL NOT NULL DEFAULT 0,
      cost_total REAL NOT NULL DEFAULT 0,
      gross_margin REAL NOT NULL DEFAULT 0,
      margin_pct REAL NOT NULL DEFAULT 0,
      classification TEXT NOT NULL DEFAULT 'unknown',
      root_cause TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(client_name, period)
    )
  `);
  // Indexes are cheap to re-run (IF NOT EXISTS).
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_profitability_client ON client_profitability(client_name)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_profitability_period ON client_profitability(period)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_profitability_class ON client_profitability(classification)`);
}

function classify(marginPct: number, revenue: number, amHours: number, costAdMgmt: number): {
  classification: 'healthy' | 'warning' | 'critical';
  rootCause: string | null;
} {
  if (marginPct >= 50) return { classification: 'healthy', rootCause: null };
  if (marginPct >= 30) {
    let rootCause = 'low_retainer_vs_effort';
    if (amHours > 20) rootCause = 'high_am_hours';
    else if (costAdMgmt > revenue * 0.3) rootCause = 'high_ad_management_overhead';
    return { classification: 'warning', rootCause };
  }
  let rootCause = 'inefficiency';
  if (revenue < 500) rootCause = 'retainer_too_low';
  else if (amHours > 30) rootCause = 'scope_creep';
  return { classification: 'critical', rootCause };
}

/**
 * Recompute profitability for the current month (falling back to last
 * month if no Xero data yet). Idempotent — upserts on (client_name, period).
 */
export async function recomputeClientProfitability(): Promise<ProfitabilityResult> {
  const start = Date.now();
  await ensureSchema();

  // Determine the period: current month, falling back to last month.
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  let period = currentMonth;
  let revenueRows = await db.execute({
    sql: `SELECT contact_name, ROUND(SUM(total), 2) AS monthly_revenue
          FROM xero_invoices
          WHERE type = 'ACCREC'
            AND status IN ('AUTHORISED', 'PAID')
            AND strftime('%Y-%m', date) = ?
            AND contact_name IS NOT NULL
          GROUP BY contact_name
          ORDER BY monthly_revenue DESC`,
    args: [currentMonth],
  });

  if (revenueRows.rows.length === 0) {
    period = lastMonth;
    revenueRows = await db.execute({
      sql: `SELECT contact_name, ROUND(SUM(total), 2) AS monthly_revenue
            FROM xero_invoices
            WHERE type = 'ACCREC'
              AND status IN ('AUTHORISED', 'PAID')
              AND strftime('%Y-%m', date) = ?
              AND contact_name IS NOT NULL
            GROUP BY contact_name
            ORDER BY monthly_revenue DESC`,
      args: [lastMonth],
    });
  }

  const results: ProfitabilityRow[] = [];
  const nowIso = new Date().toISOString();

  for (const row of revenueRows.rows) {
    const clientName = String(row.contact_name);
    const revenue = Number(row.monthly_revenue) || 0;

    // Task count (proxy for AM hours)
    const taskRes = await db.execute({
      sql: `SELECT COUNT(*) AS task_count
            FROM asana_tasks
            WHERE project_name LIKE ?
              AND deleted = 0
              AND (
                (completed = 1 AND strftime('%Y-%m', completed_at) = ?)
                OR (completed = 0 AND strftime('%Y-%m', modified_at) = ?)
              )`,
      args: [`%${clientName}%`, period, period],
    });
    const taskCount = Number(taskRes.rows[0]?.task_count) || 0;
    const amHours = taskCount * AVG_HOURS_PER_TASK;
    const costAmHours = Math.round(amHours * HOURLY_RATE_AM * 100) / 100;

    // Ad spend (gads + meta combined)
    const adRes = await db.execute({
      sql: `SELECT COALESCE(SUM(spend), 0) AS total_spend FROM (
              SELECT spend FROM gads_campaign_spend
              WHERE account_name LIKE ? AND strftime('%Y-%m', date) = ?
              UNION ALL
              SELECT spend FROM meta_insights
              WHERE account_name LIKE ? AND strftime('%Y-%m', date) = ? AND level = 'account'
            )`,
      args: [`%${clientName}%`, period, `%${clientName}%`, period],
    });
    const adSpend = Number(adRes.rows[0]?.total_spend) || 0;
    const costAdMgmt = Math.round(adSpend * AD_MGMT_OVERHEAD_PCT * 100) / 100;

    const costAi = AI_COST_PER_CLIENT;
    const costTotal = Math.round((costAmHours + costAdMgmt + costAi) * 100) / 100;
    const grossMargin = Math.round((revenue - costTotal) * 100) / 100;
    const marginPct = revenue > 0 ? Math.round((grossMargin / revenue) * 100) : 0;
    const { classification, rootCause } = classify(marginPct, revenue, amHours, costAdMgmt);

    results.push({
      clientName, revenue, taskCount, amHours, costAmHours,
      adSpend, costAdMgmt, costAi, costTotal, grossMargin, marginPct,
      classification, rootCause,
    });
  }

  // Upsert in batches
  const CHUNK = 50;
  let upserted = 0;
  for (let i = 0; i < results.length; i += CHUNK) {
    const slice = results.slice(i, i + CHUNK);
    const stmts = slice.map((c) => ({
      sql: `INSERT INTO client_profitability
              (client_name, period, revenue, cost_am_hours, cost_ad_mgmt, cost_ai,
               cost_total, gross_margin, margin_pct, classification, root_cause, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(client_name, period) DO UPDATE SET
              revenue = excluded.revenue,
              cost_am_hours = excluded.cost_am_hours,
              cost_ad_mgmt = excluded.cost_ad_mgmt,
              cost_ai = excluded.cost_ai,
              cost_total = excluded.cost_total,
              gross_margin = excluded.gross_margin,
              margin_pct = excluded.margin_pct,
              classification = excluded.classification,
              root_cause = excluded.root_cause,
              created_at = excluded.created_at`,
      args: [
        c.clientName, period, c.revenue, c.costAmHours, c.costAdMgmt, c.costAi,
        c.costTotal, c.grossMargin, c.marginPct, c.classification, c.rootCause, nowIso,
      ] as (string | number | null)[],
    }));
    if (stmts.length > 0) {
      await db.batch(stmts, 'write');
      upserted += stmts.length;
    }
  }

  const healthy = results.filter((r) => r.classification === 'healthy').length;
  const warning = results.filter((r) => r.classification === 'warning').length;
  const critical = results.filter((r) => r.classification === 'critical').length;

  return {
    period,
    clientsProcessed: results.length,
    healthy,
    warning,
    critical,
    upserted,
    durationMs: Date.now() - start,
    rows: results,
  };
}
