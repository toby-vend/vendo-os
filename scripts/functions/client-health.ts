/**
 * Client health scoring — monthly health check for all active clients.
 *
 * Scoring dimensions (max 100):
 *   Performance (40):   ad spend (20), CTR (10), spend consistency (10)
 *                       — OR for SEO-only clients: sessions (20), engagement (10), consistency (10)
 *   Relationship (30):  meeting recency (15), action items resolved (15)
 *   Financial (30):     no overdue invoices (15), last invoice paid (15)
 *
 * Tiers:
 *   Healthy  >70   — on track
 *   At-risk  40-70 — needs attention
 *   Critical <40   — immediate intervention
 *
 * Scoring is graduated (linear interpolation), not binary.
 * Client-to-account matching uses client_source_mappings, not LIKE.
 *
 * Usage:
 *   npx tsx scripts/functions/client-health.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

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

/** Linearly interpolate a value within [min, max] to [0, maxPoints]. Clamped. */
function graduated(value: number, min: number, max: number, maxPoints: number): number {
  if (value <= min) return 0;
  if (value >= max) return maxPoints;
  return Math.round(((value - min) / (max - min)) * maxPoints);
}

/** Inverse interpolation — higher value = fewer points (e.g. days since meeting). */
function graduatedInverse(value: number, best: number, worst: number, maxPoints: number): number {
  if (value <= best) return maxPoints;
  if (value >= worst) return 0;
  return Math.round(((worst - value) / (worst - best)) * maxPoints);
}

async function ensureHealthSchema(): Promise<void> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS client_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      performance_score INTEGER NOT NULL,
      relationship_score INTEGER NOT NULL,
      financial_score INTEGER NOT NULL,
      breakdown TEXT NOT NULL,
      period TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(client_name, period)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_client_health_period ON client_health(period)');
  db.run('CREATE INDEX IF NOT EXISTS idx_client_health_client ON client_health(client_name)');
}

/** Run a SELECT and return an array of row objects. */
function queryRows(db: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj;
  });
}

/** Run a SELECT and return the first column of the first row, or null. */
function queryScalar(db: Database, sql: string, params: unknown[] = []): unknown {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  return result[0].values[0][0];
}

/** Check if a client has ad accounts linked (meta or gads). */
function hasAdAccounts(db: Database, clientId: number): boolean {
  const count = (queryScalar(db,
    "SELECT COUNT(*) FROM client_source_mappings WHERE client_id = ? AND source_type IN ('meta', 'gads')",
    [clientId],
  ) as number) || 0;
  return count > 0;
}

/** Check if a client has GA4/GSC linked (SEO). */
function hasSeoAccounts(db: Database, clientId: number): boolean {
  const count = (queryScalar(db,
    "SELECT COUNT(*) FROM client_source_mappings WHERE client_id = ? AND source_type IN ('ga4', 'gsc')",
    [clientId],
  ) as number) || 0;
  return count > 0;
}

/** Score Performance for ad-based clients (Meta + Google Ads). */
function scoreAdsPerformance(db: Database, clientId: number, thirtyDaysAgo: string): Pick<HealthBreakdown, 'adSpend' | 'ctr' | 'spendConsistency'> {
  // Ad spend across Meta + Google Ads via client_source_mappings
  const metaSpend = (queryScalar(db, `
    SELECT COALESCE(SUM(mi.spend), 0)
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    WHERE csm.client_id = ? AND mi.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const gadsSpend = (queryScalar(db, `
    SELECT COALESCE(SUM(gs.spend), 0)
    FROM gads_campaign_spend gs
    JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
    WHERE csm.client_id = ? AND gs.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const totalSpend = metaSpend + gadsSpend;
  // Graduated: 0–5000 maps to 0–20
  const adSpend = graduated(totalSpend, 0, 5000, 20);

  // CTR across both Meta and Google Ads
  const metaClicks = (queryScalar(db, `
    SELECT COALESCE(SUM(mi.clicks), 0)
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    WHERE csm.client_id = ? AND mi.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const metaImpressions = (queryScalar(db, `
    SELECT COALESCE(SUM(mi.impressions), 0)
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    WHERE csm.client_id = ? AND mi.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const gadsClicks = (queryScalar(db, `
    SELECT COALESCE(SUM(gs.clicks), 0)
    FROM gads_campaign_spend gs
    JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
    WHERE csm.client_id = ? AND gs.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const gadsImpressions = (queryScalar(db, `
    SELECT COALESCE(SUM(gs.impressions), 0)
    FROM gads_campaign_spend gs
    JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
    WHERE csm.client_id = ? AND gs.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const totalClicks = metaClicks + gadsClicks;
  const totalImpressions = metaImpressions + gadsImpressions;
  const ctrPct = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  // Graduated: 0–2% CTR maps to 0–10
  const ctr = graduated(ctrPct, 0, 2, 10);

  // Spend consistency — days with any spend in last 30 days (Meta + Google combined)
  const metaDays = (queryScalar(db, `
    SELECT COUNT(DISTINCT mi.date)
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    WHERE csm.client_id = ? AND mi.date >= ? AND mi.spend > 0
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  const gadsDays = (queryScalar(db, `
    SELECT COUNT(DISTINCT gs.date)
    FROM gads_campaign_spend gs
    JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
    WHERE csm.client_id = ? AND gs.date >= ? AND gs.spend > 0
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  // Use the higher of the two — if either platform is running consistently, that counts
  const bestDays = Math.max(metaDays, gadsDays);
  // Graduated: 0–25 days maps to 0–10
  const spendConsistency = graduated(bestDays, 0, 25, 10);

  return { adSpend, ctr, spendConsistency };
}

/** Score Performance for SEO-only clients (GA4 organic traffic). */
function scoreSeoPerformance(db: Database, clientId: number, thirtyDaysAgo: string): Pick<HealthBreakdown, 'adSpend' | 'ctr' | 'spendConsistency'> {
  // For SEO clients, re-use the same breakdown keys but with different meaning:
  // adSpend → organic sessions (20 pts), ctr → engagement rate (10 pts), spendConsistency → traffic consistency (10 pts)

  // Organic sessions via GA4 traffic sources (medium = 'organic')
  const organicSessions = (queryScalar(db, `
    SELECT COALESCE(SUM(ts.sessions), 0)
    FROM ga4_traffic_sources ts
    JOIN client_source_mappings csm ON ts.property_id = csm.source_id AND csm.source_type = 'ga4'
    WHERE csm.client_id = ? AND ts.date >= ? AND ts.medium = 'organic'
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  // Graduated: 0–2000 organic sessions maps to 0–20
  const adSpend = graduated(organicSessions, 0, 2000, 20);

  // Engagement rate from GA4 daily
  const avgEngagement = (queryScalar(db, `
    SELECT AVG(d.engagement_rate)
    FROM ga4_daily d
    JOIN client_source_mappings csm ON d.property_id = csm.source_id AND csm.source_type = 'ga4'
    WHERE csm.client_id = ? AND d.date >= ?
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  // Graduated: 0–0.7 (70%) engagement rate maps to 0–10
  const ctr = graduated(avgEngagement, 0, 0.7, 10);

  // Traffic consistency — days with sessions in last 30 days
  const trafficDays = (queryScalar(db, `
    SELECT COUNT(DISTINCT d.date)
    FROM ga4_daily d
    JOIN client_source_mappings csm ON d.property_id = csm.source_id AND csm.source_type = 'ga4'
    WHERE csm.client_id = ? AND d.date >= ? AND d.sessions > 0
  `, [clientId, thirtyDaysAgo]) as number) || 0;

  // Graduated: 0–25 days maps to 0–10
  const spendConsistency = graduated(trafficDays, 0, 25, 10);

  return { adSpend, ctr, spendConsistency };
}

async function main() {
  await initSchema();
  await ensureHealthSchema();
  const db = await getDb();

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nowIso = now.toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Fetch active clients with their IDs
  const clientRows = queryRows(db, "SELECT id, name FROM clients WHERE status = 'active'");
  if (!clientRows.length) {
    log('HEALTH', 'No active clients found');
    closeDb();
    return;
  }

  log('HEALTH', `Scoring ${clientRows.length} active clients for period ${period}...`);

  const results: ClientResult[] = [];
  const overdueAlerts: string[] = [];

  for (const client of clientRows) {
    const clientId = client.id as number;
    const name = client.name as string;
    const breakdown: HealthBreakdown = {
      adSpend: 0,
      ctr: 0,
      spendConsistency: 0,
      recentMeeting: 0,
      actionsResolved: 0,
      noOverdue: 0,
      paidOnTime: 0,
    };

    // --- Performance (40 pts max) ---
    // Choose scoring path: ads if they have ad accounts, SEO if they have GA4/GSC, else zero
    const hasAds = hasAdAccounts(db, clientId);
    const hasSeo = hasSeoAccounts(db, clientId);

    if (hasAds) {
      const perfScores = scoreAdsPerformance(db, clientId, thirtyDaysAgo);
      breakdown.adSpend = perfScores.adSpend;
      breakdown.ctr = perfScores.ctr;
      breakdown.spendConsistency = perfScores.spendConsistency;
    } else if (hasSeo) {
      const perfScores = scoreSeoPerformance(db, clientId, thirtyDaysAgo);
      breakdown.adSpend = perfScores.adSpend;
      breakdown.ctr = perfScores.ctr;
      breakdown.spendConsistency = perfScores.spendConsistency;
    }
    // Clients with neither ads nor SEO accounts get 0/40 for performance

    // --- Relationship (30 pts max) ---

    // Meeting recency — graduated: 0 days ago = 15 pts, 45+ days ago = 0 pts
    const lastMeetingDate = queryScalar(db,
      'SELECT MAX(date) FROM meetings WHERE client_name = ? AND date >= ?',
      [name, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]],
    ) as string | null;

    if (lastMeetingDate) {
      const daysSinceMeeting = Math.floor(
        (now.getTime() - new Date(lastMeetingDate).getTime()) / (24 * 60 * 60 * 1000)
      );
      breakdown.recentMeeting = graduatedInverse(daysSinceMeeting, 0, 45, 15);
    }

    // Action items completion rate — graduated: 0–100% maps to 0–15
    const totalActions = (queryScalar(db,
      'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ?',
      [name],
    ) as number) || 0;

    const completedActions = (queryScalar(db,
      'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ? AND ai.completed = 1',
      [name],
    ) as number) || 0;

    if (totalActions === 0) {
      // No action items = full marks (nothing outstanding)
      breakdown.actionsResolved = 15;
    } else {
      const completionRate = completedActions / totalActions;
      breakdown.actionsResolved = graduated(completionRate, 0, 1, 15);
    }

    // --- Financial (30 pts max) — stays binary ---

    // Overdue invoices (AUTHORISED with amount_due > 0 past due_date)
    const overdueCount = (queryScalar(db,
      "SELECT COUNT(*) FROM xero_invoices WHERE contact_name = ? AND status = 'AUTHORISED' AND due_date < date('now') AND amount_due > 0",
      [name],
    ) as number) || 0;

    if (overdueCount === 0) {
      breakdown.noOverdue = 15;
    } else {
      overdueAlerts.push(`${name}: ${overdueCount} overdue invoice(s)`);
    }

    // Last invoice paid on time (amount_due = 0)
    const lastInvoiceRows = queryRows(db,
      "SELECT amount_due FROM xero_invoices WHERE contact_name = ? AND type = 'ACCREC' ORDER BY date DESC LIMIT 1",
      [name],
    );

    if (!lastInvoiceRows.length || (lastInvoiceRows[0].amount_due as number) === 0) {
      breakdown.paidOnTime = 15; // No invoices or last one fully paid
    }

    // --- Totals ---
    const performanceScore = breakdown.adSpend + breakdown.ctr + breakdown.spendConsistency;
    const relationshipScore = breakdown.recentMeeting + breakdown.actionsResolved;
    const financialScore = breakdown.noOverdue + breakdown.paidOnTime;
    const totalScore = performanceScore + relationshipScore + financialScore;

    // Upsert into client_health
    db.run(`
      INSERT INTO client_health (client_name, score, performance_score, relationship_score, financial_score, breakdown, period, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_name, period) DO UPDATE SET
        score = excluded.score,
        performance_score = excluded.performance_score,
        relationship_score = excluded.relationship_score,
        financial_score = excluded.financial_score,
        breakdown = excluded.breakdown,
        created_at = excluded.created_at
    `, [name, totalScore, performanceScore, relationshipScore, financialScore, JSON.stringify(breakdown), period, nowIso]);

    const tier: ClientResult['tier'] = totalScore >= 70 ? 'healthy' : totalScore >= 40 ? 'at-risk' : 'critical';
    results.push({ name, score: totalScore, tier });
  }

  saveDb();

  // --- Summary ---
  const healthy = results.filter(r => r.tier === 'healthy');
  const atRisk = results.filter(r => r.tier === 'at-risk');
  const critical = results.filter(r => r.tier === 'critical');

  log('HEALTH', `\n--- Client Health Summary (${period}) ---`);
  log('HEALTH', `  Healthy (>70):   ${healthy.length} clients`);
  log('HEALTH', `  At-risk (40-70): ${atRisk.length} clients`);
  log('HEALTH', `  Critical (<40):  ${critical.length} clients`);

  if (atRisk.length) {
    log('HEALTH', '\n  At-risk:');
    for (const r of atRisk) log('HEALTH', `    ${r.score}/100  ${r.name}`);
  }

  if (critical.length) {
    log('HEALTH', '\n  Critical:');
    for (const r of critical) log('HEALTH', `    ${r.score}/100  ${r.name}`);
  }

  if (overdueAlerts.length) {
    log('HEALTH', '\n  Overdue invoices:');
    for (const a of overdueAlerts) log('HEALTH', `    ${a}`);
  }

  closeDb();
}

main().catch(err => {
  logError('HEALTH', 'Failed', err);
  process.exit(1);
});
