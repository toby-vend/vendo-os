/**
 * Client health scoring — monthly health check for all active clients.
 *
 * Scoring dimensions (max 100):
 *   Performance (40):   ad spend (20), CTR >1% (10), spend consistency (10)
 *   Relationship (30):  recent meeting (15), action items resolved (15)
 *   Financial (30):     no overdue invoices (15), last invoice paid (15)
 *
 * Tiers:
 *   Healthy  >70   — on track
 *   At-risk  40-70 — needs attention
 *   Critical <40   — immediate intervention
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

  // Fetch active clients
  const clientResult = db.exec("SELECT name FROM clients WHERE status = 'active'");
  if (!clientResult.length || !clientResult[0].values.length) {
    log('HEALTH', 'No active clients found');
    closeDb();
    return;
  }

  const cols = clientResult[0].columns;
  const clients = clientResult[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj;
  });

  log('HEALTH', `Scoring ${clients.length} active clients for period ${period}...`);

  const results: ClientResult[] = [];
  const overdueAlerts: string[] = [];

  for (const client of clients) {
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

    // Ad spend across Meta + Google Ads (matched by account_name containing client name)
    const metaSpend = (queryScalar(db,
      'SELECT COALESCE(SUM(spend), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?',
      [thirtyDaysAgo, `%${name}%`],
    ) as number) || 0;

    const gadsSpend = (queryScalar(db,
      'SELECT COALESCE(SUM(spend), 0) FROM gads_campaign_spend WHERE date >= ? AND account_name LIKE ?',
      [thirtyDaysAgo, `%${name}%`],
    ) as number) || 0;

    const totalSpend = metaSpend + gadsSpend;
    if (totalSpend > 1000) breakdown.adSpend = 20;
    else if (totalSpend > 0) breakdown.adSpend = 10;

    // CTR (Meta only — has impressions/clicks at account level)
    const metaClicks = (queryScalar(db,
      'SELECT COALESCE(SUM(clicks), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?',
      [thirtyDaysAgo, `%${name}%`],
    ) as number) || 0;

    const metaImpressions = (queryScalar(db,
      'SELECT COALESCE(SUM(impressions), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?',
      [thirtyDaysAgo, `%${name}%`],
    ) as number) || 0;

    const ctr = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;
    if (ctr > 1) breakdown.ctr = 10;

    // Spend consistency — no gaps >7 days means spending on most days
    const spendDays = (queryScalar(db,
      'SELECT COUNT(DISTINCT date) FROM meta_insights WHERE date >= ? AND account_name LIKE ? AND spend > 0',
      [thirtyDaysAgo, `%${name}%`],
    ) as number) || 0;

    if (spendDays >= 20) breakdown.spendConsistency = 10;

    // --- Relationship (30 pts max) ---

    // Recent meeting within 30 days
    const recentMeetingCount = (queryScalar(db,
      'SELECT COUNT(*) FROM meetings WHERE client_name = ? AND date >= ?',
      [name, thirtyDaysAgo],
    ) as number) || 0;

    if (recentMeetingCount > 0) breakdown.recentMeeting = 15;

    // Action items completion rate (>50% completed = full marks; zero actions = full marks)
    const totalActions = (queryScalar(db,
      'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ?',
      [name],
    ) as number) || 0;

    const completedActions = (queryScalar(db,
      'SELECT COUNT(*) FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id WHERE m.client_name = ? AND ai.completed = 1',
      [name],
    ) as number) || 0;

    if (totalActions === 0 || (completedActions / totalActions) > 0.5) {
      breakdown.actionsResolved = 15;
    }

    // --- Financial (30 pts max) ---

    // Overdue invoices (AUTHORISED with amount_due > 0 past due_date)
    const overdueCount = (queryScalar(db,
      "SELECT COUNT(*) FROM xero_invoices WHERE contact_name = ? AND status = 'AUTHORISED' AND due_date < ? AND amount_due > 0",
      [name, nowIso],
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
