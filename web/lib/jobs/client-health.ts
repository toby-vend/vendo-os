import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Turso-native port of scripts/functions/client-health.ts. Runs monthly
 * (1st of month) from /api/cron/health-score. Writes per-client health
 * scores into the client_health table partitioned by period (YYYY-MM).
 *
 * Turso schema differs from the old sql.js DB:
 *   client_source_mappings.source_type → .source
 *   client_source_mappings.source_id   → .external_id
 */

interface HealthBreakdown {
  adSpend: number;
  ctr: number;
  spendConsistency: number;
  recentMeeting: number;
  actionsResolved: number;
  noOverdue: number;
  paidOnTime: number;
}

interface ClientResult {
  name: string;
  score: number;
  tier: 'healthy' | 'at-risk' | 'critical';
}

function graduated(value: number, min: number, max: number, maxPoints: number): number {
  if (value <= min) return 0;
  if (value >= max) return maxPoints;
  return Math.round(((value - min) / (max - min)) * maxPoints);
}

function graduatedInverse(value: number, best: number, worst: number, maxPoints: number): number {
  if (value <= best) return maxPoints;
  if (value >= worst) return 0;
  return Math.round(((worst - value) / (worst - best)) * maxPoints);
}

async function scalar(sql: string, args: Array<string | number> = []): Promise<number> {
  try {
    const r = await db.execute({ sql, args });
    const v = r.rows[0]?.[r.columns[0]];
    return typeof v === 'number' ? v : Number(v ?? 0) || 0;
  } catch {
    return 0;
  }
}

async function hasAdAccounts(clientId: number): Promise<boolean> {
  return (await scalar(
    "SELECT COUNT(*) FROM client_source_mappings WHERE client_id = ? AND source IN ('meta', 'gads')",
    [clientId],
  )) > 0;
}

async function hasSeoAccounts(clientId: number): Promise<boolean> {
  return (await scalar(
    "SELECT COUNT(*) FROM client_source_mappings WHERE client_id = ? AND source IN ('ga4', 'gsc')",
    [clientId],
  )) > 0;
}

async function scoreAdsPerformance(clientId: number, thirtyDaysAgo: string): Promise<Pick<HealthBreakdown, 'adSpend' | 'ctr' | 'spendConsistency'>> {
  const metaSpend = await scalar(
    `SELECT COALESCE(SUM(mi.spend), 0) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const gadsSpend = await scalar(
    `SELECT COALESCE(SUM(gs.spend), 0) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const adSpend = graduated(metaSpend + gadsSpend, 0, 5000, 20);

  const metaClicks = await scalar(
    `SELECT COALESCE(SUM(mi.clicks), 0) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const metaImpressions = await scalar(
    `SELECT COALESCE(SUM(mi.impressions), 0) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const gadsClicks = await scalar(
    `SELECT COALESCE(SUM(gs.clicks), 0) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const gadsImpressions = await scalar(
    `SELECT COALESCE(SUM(gs.impressions), 0) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const totalClicks = metaClicks + gadsClicks;
  const totalImpressions = metaImpressions + gadsImpressions;
  const ctrPct = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const ctr = graduated(ctrPct, 0, 2, 10);

  const metaDays = await scalar(
    `SELECT COUNT(DISTINCT mi.date) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ? AND mi.spend > 0`,
    [clientId, thirtyDaysAgo],
  );
  const gadsDays = await scalar(
    `SELECT COUNT(DISTINCT gs.date) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ? AND gs.spend > 0`,
    [clientId, thirtyDaysAgo],
  );
  const spendConsistency = graduated(Math.max(metaDays, gadsDays), 0, 25, 10);

  return { adSpend, ctr, spendConsistency };
}

async function scoreSeoPerformance(clientId: number, thirtyDaysAgo: string): Promise<Pick<HealthBreakdown, 'adSpend' | 'ctr' | 'spendConsistency'>> {
  const organicSessions = await scalar(
    `SELECT COALESCE(SUM(ts.sessions), 0) FROM ga4_traffic_sources ts
     JOIN client_source_mappings csm ON ts.property_id = csm.external_id AND csm.source = 'ga4'
     WHERE csm.client_id = ? AND ts.date >= ? AND ts.medium = 'organic'`,
    [clientId, thirtyDaysAgo],
  );
  const adSpend = graduated(organicSessions, 0, 2000, 20);

  const avgEngagement = await scalar(
    `SELECT AVG(d.engagement_rate) FROM ga4_daily d
     JOIN client_source_mappings csm ON d.property_id = csm.external_id AND csm.source = 'ga4'
     WHERE csm.client_id = ? AND d.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const ctr = graduated(avgEngagement, 0, 0.7, 10);

  const trafficDays = await scalar(
    `SELECT COUNT(DISTINCT d.date) FROM ga4_daily d
     JOIN client_source_mappings csm ON d.property_id = csm.external_id AND csm.source = 'ga4'
     WHERE csm.client_id = ? AND d.date >= ? AND d.sessions > 0`,
    [clientId, thirtyDaysAgo],
  );
  const spendConsistency = graduated(trafficDays, 0, 25, 10);

  return { adSpend, ctr, spendConsistency };
}

export interface HealthScoreResult {
  period: string;
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
  overdueInvoices: string[];
  durationMs: number;
}

export async function runClientHealthScoring(): Promise<HealthScoreResult> {
  const start = Date.now();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nowIso = now.toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { rows: clientRows } = await db.execute(
    "SELECT id, name FROM clients WHERE status = 'active'",
  );
  if (!clientRows.length) {
    consoleLog('health', 'No active clients');
    return { period, total: 0, healthy: 0, atRisk: 0, critical: 0, overdueInvoices: [], durationMs: Date.now() - start };
  }

  const results: ClientResult[] = [];
  const overdueInvoices: string[] = [];

  for (const client of clientRows) {
    const clientId = client.id as number;
    const name = client.name as string;
    const breakdown: HealthBreakdown = {
      adSpend: 0, ctr: 0, spendConsistency: 0,
      recentMeeting: 0, actionsResolved: 0,
      noOverdue: 0, paidOnTime: 0,
    };

    // Performance
    if (await hasAdAccounts(clientId)) {
      Object.assign(breakdown, await scoreAdsPerformance(clientId, thirtyDaysAgo));
    } else if (await hasSeoAccounts(clientId)) {
      Object.assign(breakdown, await scoreSeoPerformance(clientId, thirtyDaysAgo));
    }

    // Relationship — meeting recency
    try {
      const r = await db.execute({
        sql: 'SELECT MAX(date) as d FROM meetings WHERE client_name = ? AND date >= ?',
        args: [name, ninetyDaysAgo],
      });
      const lastMeetingDate = r.rows[0]?.d as string | null;
      if (lastMeetingDate) {
        const days = Math.floor((now.getTime() - new Date(lastMeetingDate).getTime()) / (24 * 60 * 60 * 1000));
        breakdown.recentMeeting = graduatedInverse(days, 0, 45, 15);
      }
    } catch { /* meetings may not exist */ }

    // Actions resolved
    try {
      const total = await scalar(
        'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ?',
        [name],
      );
      if (total === 0) {
        breakdown.actionsResolved = 15;
      } else {
        const completed = await scalar(
          'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ? AND ai.completed = 1',
          [name],
        );
        breakdown.actionsResolved = graduated(completed / total, 0, 1, 15);
      }
    } catch {
      breakdown.actionsResolved = 15;
    }

    // Financial
    const overdueCount = await scalar(
      "SELECT COUNT(*) FROM xero_invoices WHERE contact_name = ? AND status = 'AUTHORISED' AND due_date < date('now') AND amount_due > 0",
      [name],
    );
    if (overdueCount === 0) breakdown.noOverdue = 15;
    else overdueInvoices.push(`${name}: ${overdueCount} overdue`);

    try {
      const r = await db.execute({
        sql: "SELECT amount_due FROM xero_invoices WHERE contact_name = ? AND type = 'ACCREC' ORDER BY date DESC LIMIT 1",
        args: [name],
      });
      if (!r.rows.length || (r.rows[0].amount_due as number) === 0) {
        breakdown.paidOnTime = 15;
      }
    } catch { /* xero may not exist */ }

    const performanceScore = breakdown.adSpend + breakdown.ctr + breakdown.spendConsistency;
    const relationshipScore = breakdown.recentMeeting + breakdown.actionsResolved;
    const financialScore = breakdown.noOverdue + breakdown.paidOnTime;
    const totalScore = performanceScore + relationshipScore + financialScore;

    await db.execute({
      sql: `INSERT INTO client_health (client_name, score, performance_score, relationship_score, financial_score, breakdown, period, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(client_name, period) DO UPDATE SET
              score = excluded.score,
              performance_score = excluded.performance_score,
              relationship_score = excluded.relationship_score,
              financial_score = excluded.financial_score,
              breakdown = excluded.breakdown,
              created_at = excluded.created_at`,
      args: [name, totalScore, performanceScore, relationshipScore, financialScore, JSON.stringify(breakdown), period, nowIso],
    });

    const tier: ClientResult['tier'] = totalScore >= 70 ? 'healthy' : totalScore >= 40 ? 'at-risk' : 'critical';
    results.push({ name, score: totalScore, tier });
  }

  const healthy = results.filter((r) => r.tier === 'healthy').length;
  const atRisk = results.filter((r) => r.tier === 'at-risk').length;
  const critical = results.filter((r) => r.tier === 'critical').length;

  const durationMs = Date.now() - start;
  consoleLog('health', `Period ${period}: ${healthy} healthy, ${atRisk} at-risk, ${critical} critical in ${durationMs}ms`);

  return { period, total: results.length, healthy, atRisk, critical, overdueInvoices, durationMs };
}
