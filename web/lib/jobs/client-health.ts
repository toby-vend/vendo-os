import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Client health scoring — v2 (Phase 2 of plans/wild-dreaming-grove.md).
 *
 * The number on each dimension is graduated (0 → maxPoints) and everything
 * is normalised against per-client baselines so a £500/mo dental and a
 * £50k/mo retail client can both score 40/40 on performance when they're
 * each hitting their own budget.
 *
 * Scoring map (100 pts total):
 *   Performance (40)
 *     adSpend           20   Per-client normalised — % of budget hit this month
 *     ctr               10   CTR% vs 2% target (gated on impressions > 1000)
 *     spendConsistency  10   Days with spend in last 30 days
 *   Relationship (30)
 *     meetingCadence    10   Inverse-graduated days since last meeting, 0-45 days
 *     meetingSentiment  10   From meeting_concerns over last 3 meetings
 *     actionsResolved   10   Completion rate of action items in last 90 days
 *   Financial (30)
 *     overdueSeverity   15   % overdue vs last-90-days invoiced total
 *     overdueAge        15   Inverse-graduated max days overdue, 0-60 days
 *   Penalty (-10)             If any Critical AI concern flagged this month
 *
 * Each sub-score is smoothed with a 3-month rolling average before being
 * combined into the final score. The smoothing only kicks in once 2+
 * periods exist for the client.
 *
 * Unmapped clients (no ads, no SEO) are scored on the 60 non-perf points
 * scaled to 100 — their performance dimension doesn't factor in.
 *
 * New clients (first meeting <90 days ago) are flagged grace_period = 1.
 * The alert job skips them; the dashboard shows them with a "New" badge.
 */

interface HealthBreakdownV2 {
  // Performance
  adSpend: number;
  ctr: number;
  spendConsistency: number;
  // Relationship
  meetingCadence: number;
  meetingSentiment: number;
  actionsResolved: number;
  // Financial
  overdueSeverity: number;
  overdueAge: number;
  // Diagnostics (not part of score)
  perfApplicable: boolean;
  criticalConcernPenalty: number;
  graceperiod: boolean;
  topDrivers: string[];
}

function graduated(value: number, min: number, max: number, maxPoints: number): number {
  if (!Number.isFinite(value) || value <= min) return 0;
  if (value >= max) return maxPoints;
  return Math.round(((value - min) / (max - min)) * maxPoints);
}

function graduatedInverse(value: number, best: number, worst: number, maxPoints: number): number {
  if (!Number.isFinite(value) || value <= best) return maxPoints;
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

// --- Performance ---

async function scoreAdsPerformance(clientId: number, thirtyDaysAgo: string, ninetyDaysAgo: string): Promise<{ adSpend: number; ctr: number; spendConsistency: number }> {
  // Current 30-day spend
  const metaSpend30 = await scalar(
    `SELECT COALESCE(SUM(mi.spend), 0) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const gadsSpend30 = await scalar(
    `SELECT COALESCE(SUM(gs.spend), 0) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ?`,
    [clientId, thirtyDaysAgo],
  );
  const totalSpend30 = metaSpend30 + gadsSpend30;

  // Baseline = 90-day average daily spend × 30, floored at £500/mo to avoid
  // tiny new clients needing to hit £50 to score 40/40.
  const metaSpend90 = await scalar(
    `SELECT COALESCE(SUM(mi.spend), 0) FROM meta_insights mi
     JOIN client_source_mappings csm ON mi.account_id = csm.external_id AND csm.source = 'meta'
     WHERE csm.client_id = ? AND mi.date >= ?`,
    [clientId, ninetyDaysAgo],
  );
  const gadsSpend90 = await scalar(
    `SELECT COALESCE(SUM(gs.spend), 0) FROM gads_campaign_spend gs
     JOIN client_source_mappings csm ON gs.account_id = csm.external_id AND csm.source = 'gads'
     WHERE csm.client_id = ? AND gs.date >= ?`,
    [clientId, ninetyDaysAgo],
  );
  const totalSpend90 = metaSpend90 + gadsSpend90;
  const baseline90d = totalSpend90 / 90 * 30;
  // Prefer the explicit deliverables budget when set.
  const deliverablesBudget = await scalar(
    `SELECT COALESCE(SUM(budget), 0) FROM client_service_configs
     WHERE client_name = (SELECT name FROM clients WHERE id = ?) AND status = 'active'`,
    [clientId],
  );
  const targetSpend = Math.max(deliverablesBudget, baseline90d, 500);
  const adSpend = graduated(totalSpend30 / targetSpend, 0, 1, 20);

  // CTR — gate on impressions > 1000 to avoid noise
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
  const totalImpressions = metaImpressions + gadsImpressions;
  const totalClicks = metaClicks + gadsClicks;
  const ctr = totalImpressions > 1000
    ? graduated((totalClicks / totalImpressions) * 100, 0, 2, 10)
    : 5; // neutral if too few impressions to judge

  // Spend consistency — days with any spend in last 30 days
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

async function scoreSeoPerformance(clientId: number, thirtyDaysAgo: string): Promise<{ adSpend: number; ctr: number; spendConsistency: number }> {
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

// --- Relationship ---

async function scoreRelationship(clientName: string, now: Date, ninetyDaysAgo: string): Promise<{ meetingCadence: number; meetingSentiment: number; actionsResolved: number }> {
  // Meeting cadence
  let meetingCadence = 0;
  try {
    const r = await db.execute({
      sql: 'SELECT MAX(date) as d FROM meetings WHERE client_name = ? AND date >= ?',
      args: [clientName, ninetyDaysAgo],
    });
    const lastMeetingDate = r.rows[0]?.d as string | null;
    if (lastMeetingDate) {
      const days = Math.floor((now.getTime() - new Date(lastMeetingDate).getTime()) / (24 * 60 * 60 * 1000));
      meetingCadence = graduatedInverse(days, 0, 45, 10);
    }
  } catch { /* meetings table may be absent in dev */ }

  // Meeting sentiment — last 3 meetings' AI concern count
  let meetingSentiment = 5; // neutral default when no meeting data
  try {
    const r = await db.execute({
      sql: `SELECT mc.severity
            FROM meetings m
            LEFT JOIN meeting_concerns mc ON mc.meeting_id = m.id
            WHERE m.client_name = ?
            ORDER BY m.date DESC
            LIMIT 3`,
      args: [clientName],
    });
    if (r.rows.length) {
      const severities = r.rows.map((row) => row.severity as string | null);
      const hasCritical = severities.some((s) => s === 'critical');
      const highCount = severities.filter((s) => s === 'high').length;
      if (hasCritical) meetingSentiment = 0;
      else if (highCount >= 2) meetingSentiment = 0;
      else if (highCount === 1) meetingSentiment = 7;
      else meetingSentiment = 10; // all clean
    }
  } catch { /* meeting_concerns table missing */ }

  // Action items resolution rate in last 90 days
  let actionsResolved = 5; // neutral default when no actions
  try {
    const total = await scalar(
      `SELECT COUNT(*) FROM action_items ai
       JOIN meetings m ON ai.meeting_id = m.id
       WHERE m.client_name = ? AND m.date >= ?`,
      [clientName, ninetyDaysAgo],
    );
    if (total > 0) {
      const completed = await scalar(
        `SELECT COUNT(*) FROM action_items ai
         JOIN meetings m ON ai.meeting_id = m.id
         WHERE m.client_name = ? AND m.date >= ? AND ai.completed = 1`,
        [clientName, ninetyDaysAgo],
      );
      actionsResolved = graduated(completed / total, 0, 1, 10);
    }
  } catch { /* action_items may not exist */ }

  return { meetingCadence, meetingSentiment, actionsResolved };
}

// --- Financial ---

async function scoreFinancial(xeroContactId: string | null, clientName: string, ninetyDaysAgo: string): Promise<{ overdueSeverity: number; overdueAge: number }> {
  const matchField = xeroContactId ? 'contact_id' : 'contact_name';
  const matchValue = xeroContactId || clientName;

  // Overdue severity: sum(overdue amount) / sum(last-90-days invoiced total)
  const overdueAmount = await scalar(
    `SELECT COALESCE(SUM(amount_due), 0) FROM xero_invoices
     WHERE ${matchField} = ? AND status = 'AUTHORISED' AND due_date < date('now') AND amount_due > 0`,
    [matchValue],
  );
  const invoicedTotal = await scalar(
    `SELECT COALESCE(SUM(total), 0) FROM xero_invoices
     WHERE ${matchField} = ? AND type = 'ACCREC' AND date >= ?`,
    [matchValue, ninetyDaysAgo],
  );
  const overdueRatio = invoicedTotal > 0 ? overdueAmount / invoicedTotal : 0;
  // 0% → 15 pts, 10%+ → 0 pts
  const overdueSeverity = graduatedInverse(overdueRatio, 0, 0.1, 15);

  // Overdue age: max days overdue across all unpaid invoices
  let maxDaysOverdue = 0;
  try {
    const r = await db.execute({
      sql: `SELECT due_date FROM xero_invoices
            WHERE ${matchField} = ? AND status = 'AUTHORISED' AND amount_due > 0 AND due_date < date('now')
            ORDER BY due_date ASC LIMIT 1`,
      args: [matchValue],
    });
    if (r.rows.length) {
      const dueDate = r.rows[0].due_date as string;
      const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (24 * 60 * 60 * 1000));
      maxDaysOverdue = Math.max(0, days);
    }
  } catch { /* xero_invoices may not exist */ }
  // 0 days → 15 pts, 60+ days → 0 pts
  const overdueAge = graduatedInverse(maxDaysOverdue, 0, 60, 15);

  return { overdueSeverity, overdueAge };
}

// --- AI concern penalty ---

async function getCriticalConcernPenalty(clientName: string): Promise<number> {
  try {
    const n = await scalar(
      `SELECT COUNT(*) FROM meeting_concerns mc
       JOIN meetings m ON mc.meeting_id = m.id
       WHERE m.client_name = ?
         AND mc.severity = 'critical'
         AND m.date >= date('now', '-30 days')`,
      [clientName],
    );
    return n > 0 ? 10 : 0;
  } catch {
    return 0;
  }
}

// --- Rolling smoothing ---

interface PriorPeriod { period: string; breakdown: HealthBreakdownV2 | null }

async function getPriorBreakdowns(clientName: string, currentPeriod: string): Promise<PriorPeriod[]> {
  try {
    const r = await db.execute({
      sql: `SELECT period, breakdown FROM client_health
            WHERE client_name = ? AND period < ?
            ORDER BY period DESC LIMIT 2`,
      args: [clientName, currentPeriod],
    });
    return r.rows.map((row) => {
      let parsed: HealthBreakdownV2 | null = null;
      try { parsed = JSON.parse(row.breakdown as string); } catch { parsed = null; }
      return { period: row.period as string, breakdown: parsed };
    });
  } catch {
    return [];
  }
}

function average(values: number[]): number {
  const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
}

function rollingAverage(current: HealthBreakdownV2, priors: PriorPeriod[]): HealthBreakdownV2 {
  if (!priors.length) return current; // no history yet — use raw values
  const keys: (keyof HealthBreakdownV2)[] = [
    'adSpend', 'ctr', 'spendConsistency',
    'meetingCadence', 'meetingSentiment', 'actionsResolved',
    'overdueSeverity', 'overdueAge',
  ];
  const smoothed: HealthBreakdownV2 = { ...current };
  for (const key of keys) {
    const vals: number[] = [current[key] as number];
    for (const p of priors) {
      if (p.breakdown && typeof p.breakdown[key] === 'number') {
        vals.push(p.breakdown[key] as number);
      }
    }
    smoothed[key] = average(vals) as never;
  }
  return smoothed;
}

// --- Grace period ---

async function isGracePeriod(clientId: number): Promise<boolean> {
  try {
    const r = await db.execute({
      sql: `SELECT first_meeting_date, contract_start FROM clients WHERE id = ?`,
      args: [clientId],
    });
    const row = r.rows[0];
    if (!row) return false;
    const candidates: string[] = [];
    if (row.first_meeting_date) candidates.push(row.first_meeting_date as string);
    if (row.contract_start) candidates.push(row.contract_start as string);
    if (!candidates.length) return false;
    const earliest = candidates.sort()[0];
    const days = Math.floor((Date.now() - new Date(earliest).getTime()) / (24 * 60 * 60 * 1000));
    return days < 90;
  } catch {
    return false;
  }
}

// --- Schema migration for new columns on client_health ---

let _schemaChecked = false;
async function ensureHealthSchema(): Promise<void> {
  if (_schemaChecked) return;
  for (const sql of [
    `ALTER TABLE client_health ADD COLUMN grace_period INTEGER DEFAULT 0`,
    `ALTER TABLE client_health ADD COLUMN priority REAL`,
    `ALTER TABLE client_health ADD COLUMN mrr REAL`,
  ]) {
    try { await db.execute(sql); } catch { /* column exists */ }
  }
  _schemaChecked = true;
}

// --- Entry point ---

export interface HealthScoreResult {
  period: string;
  total: number;
  healthy: number;
  amber: number;
  orange: number;
  red: number;
  gracePeriod: number;
  overdueInvoices: string[];
  durationMs: number;
}

export async function runClientHealthScoring(): Promise<HealthScoreResult> {
  const start = Date.now();
  await ensureHealthSchema();
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nowIso = now.toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { rows: clientRows } = await db.execute(
    "SELECT id, name, xero_contact_id, mrr FROM clients WHERE status = 'active'",
  );
  if (!clientRows.length) {
    return { period, total: 0, healthy: 0, amber: 0, orange: 0, red: 0, gracePeriod: 0, overdueInvoices: [], durationMs: Date.now() - start };
  }

  const overdueInvoices: string[] = [];
  let healthy = 0, amber = 0, orange = 0, red = 0, graceCount = 0;

  for (const client of clientRows) {
    const clientId = client.id as number;
    const name = client.name as string;
    const xeroId = (client.xero_contact_id as string) || null;
    const mrr = (client.mrr as number) || 0;

    // Performance
    const hasAds = await hasAdAccounts(clientId);
    const hasSeo = !hasAds && (await hasSeoAccounts(clientId));
    const perfApplicable = hasAds || hasSeo;
    let perf = { adSpend: 0, ctr: 0, spendConsistency: 0 };
    if (hasAds) perf = await scoreAdsPerformance(clientId, thirtyDaysAgo, ninetyDaysAgo);
    else if (hasSeo) perf = await scoreSeoPerformance(clientId, thirtyDaysAgo);

    const relationship = await scoreRelationship(name, now, ninetyDaysAgo);
    const financial = await scoreFinancial(xeroId, name, ninetyDaysAgo);
    const criticalConcernPenalty = await getCriticalConcernPenalty(name);
    const gracePeriod = await isGracePeriod(clientId);

    const rawBreakdown: HealthBreakdownV2 = {
      ...perf,
      ...relationship,
      ...financial,
      perfApplicable,
      criticalConcernPenalty,
      graceperiod: gracePeriod,
      topDrivers: [],
    };

    // 3-month rolling smoothing on the numeric sub-scores (not flags).
    const priors = await getPriorBreakdowns(name, period);
    const smoothed = rollingAverage(rawBreakdown, priors);

    // Top-driver diagnostic for the alert. Compare each dimension to its max.
    const driverChecks: Array<{ name: string; value: number; max: number }> = [
      { name: 'adSpend', value: smoothed.adSpend, max: 20 },
      { name: 'meetingCadence', value: smoothed.meetingCadence, max: 10 },
      { name: 'meetingSentiment', value: smoothed.meetingSentiment, max: 10 },
      { name: 'actionsResolved', value: smoothed.actionsResolved, max: 10 },
      { name: 'overdueSeverity', value: smoothed.overdueSeverity, max: 15 },
      { name: 'overdueAge', value: smoothed.overdueAge, max: 15 },
    ];
    const drivers = driverChecks
      .sort((a, b) => (a.value / a.max) - (b.value / b.max))
      .slice(0, 2)
      .filter((d) => d.value < d.max)
      .map((d) => `${d.name}: ${d.value}/${d.max}`);
    smoothed.topDrivers = drivers;

    // Totals
    const performanceScore = smoothed.adSpend + smoothed.ctr + smoothed.spendConsistency;
    const relationshipScore = smoothed.meetingCadence + smoothed.meetingSentiment + smoothed.actionsResolved;
    const financialScore = smoothed.overdueSeverity + smoothed.overdueAge;
    let totalScore = perfApplicable
      ? performanceScore + relationshipScore + financialScore
      : Math.round(((relationshipScore + financialScore) / 60) * 100);
    totalScore = Math.max(0, totalScore - criticalConcernPenalty);

    // MRR-weighted priority for dashboard triage ordering.
    // priority = (100 - score) × log10(mrr + 1). Higher = more urgent.
    const priority = (100 - totalScore) * Math.log10(mrr + 1);

    await db.execute({
      sql: `INSERT INTO client_health
              (client_name, score, performance_score, relationship_score, financial_score,
               breakdown, period, created_at, grace_period, priority, mrr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(client_name, period) DO UPDATE SET
              score = excluded.score,
              performance_score = excluded.performance_score,
              relationship_score = excluded.relationship_score,
              financial_score = excluded.financial_score,
              breakdown = excluded.breakdown,
              created_at = excluded.created_at,
              grace_period = excluded.grace_period,
              priority = excluded.priority,
              mrr = excluded.mrr`,
      args: [
        name, totalScore, performanceScore, relationshipScore, financialScore,
        JSON.stringify(smoothed), period, nowIso,
        gracePeriod ? 1 : 0, priority, mrr,
      ],
    });

    // Overdue list for summary
    if (smoothed.overdueSeverity < 15 || smoothed.overdueAge < 15) {
      overdueInvoices.push(`${name}: severity ${smoothed.overdueSeverity}/15, age ${smoothed.overdueAge}/15`);
    }

    // Tier counters (use shared tiers.ts)
    if (gracePeriod) graceCount++;
    if (totalScore >= 70) healthy++;
    else if (totalScore >= 55) amber++;
    else if (totalScore >= 40) orange++;
    else red++;
  }

  const durationMs = Date.now() - start;
  consoleLog('health', `Period ${period}: ${healthy} healthy, ${amber} amber, ${orange} orange, ${red} red (${graceCount} in grace) in ${durationMs}ms`);

  return { period, total: clientRows.length, healthy, amber, orange, red, gracePeriod: graceCount, overdueInvoices, durationMs };
}
