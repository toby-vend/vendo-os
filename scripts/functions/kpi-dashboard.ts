/**
 * KPI Dashboard — aggregates all key metrics into a single view.
 *
 * Pulls from every data source to produce:
 *   - Revenue metrics (MRR, churn, overdue)
 *   - Delivery metrics (tasks completed, campaigns launched, QA scores)
 *   - Performance metrics (ad ROAS, CPA, leads)
 *   - Team metrics (task velocity, utilisation)
 *   - Client health summary
 *
 * Usage:
 *   npx tsx scripts/functions/kpi-dashboard.ts              # full dashboard
 *   npx tsx scripts/functions/kpi-dashboard.ts --json        # JSON output (for briefs)
 *   npx tsx scripts/functions/kpi-dashboard.ts --section revenue  # single section
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, closeDb, log, logError } from '../utils/db.js';

// --- Types ---

interface KpiSection {
  name: string;
  metrics: { label: string; value: string | number; trend?: string }[];
}

// --- Revenue metrics ---

async function getRevenueKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  // MRR (clients with 2+ invoices in last 90 days)
  const mrrResult = db.exec(`
    SELECT ROUND(SUM(avg_total), 2) as mrr
    FROM (
      SELECT contact_name, AVG(total) as avg_total
      FROM xero_invoices
      WHERE type = 'ACCREC' AND status IN ('AUTHORISED', 'PAID')
        AND date >= date('now', '-90 days')
      GROUP BY contact_name
      HAVING COUNT(*) >= 2
    )
  `);
  const mrr = mrrResult.length && mrrResult[0].values.length ? (mrrResult[0].values[0][0] as number) ?? 0 : 0;
  metrics.push({ label: 'MRR', value: `£${mrr.toLocaleString()}` });

  // Total revenue this month vs last month
  const revenueResult = db.exec(`
    SELECT
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) as this_month,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN total ELSE 0 END), 0) as last_month
    FROM xero_invoices
    WHERE type = 'ACCREC' AND status IN ('AUTHORISED', 'PAID')
  `);
  if (revenueResult.length && revenueResult[0].values.length) {
    const [thisMonth, lastMonth] = revenueResult[0].values[0] as [number, number];
    const trend = lastMonth > 0 ? `${((thisMonth / lastMonth - 1) * 100).toFixed(1)}%` : 'n/a';
    metrics.push({ label: 'Revenue (this month)', value: `£${(thisMonth ?? 0).toLocaleString()}`, trend });
  }

  // Outstanding & overdue
  const arResult = db.exec(`
    SELECT
      COALESCE(SUM(CASE WHEN due_date >= date('now') THEN amount_due ELSE 0 END), 0) as outstanding,
      COALESCE(SUM(CASE WHEN due_date < date('now') THEN amount_due ELSE 0 END), 0) as overdue,
      COUNT(CASE WHEN due_date < date('now') AND amount_due > 0 THEN 1 END) as overdue_count
    FROM xero_invoices
    WHERE type = 'ACCREC' AND status IN ('AUTHORISED', 'SUBMITTED')
  `);
  if (arResult.length && arResult[0].values.length) {
    const [outstanding, overdue, overdueCount] = arResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Outstanding', value: `£${(outstanding ?? 0).toLocaleString()}` });
    metrics.push({ label: 'Overdue', value: `£${(overdue ?? 0).toLocaleString()} (${overdueCount ?? 0} invoices)` });
  }

  // Active clients
  const clientCount = db.exec(`
    SELECT COUNT(DISTINCT contact_name)
    FROM xero_invoices
    WHERE type = 'ACCREC' AND status IN ('AUTHORISED', 'PAID')
      AND date >= date('now', '-90 days')
  `);
  if (clientCount.length && clientCount[0].values.length) {
    metrics.push({ label: 'Active clients (90d)', value: clientCount[0].values[0][0] as number });
  }

  return { name: 'Revenue', metrics };
}

// --- Delivery metrics ---

async function getDeliveryKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  // Tasks completed this month
  const taskResult = db.exec(`
    SELECT
      COUNT(CASE WHEN completed = 1 AND strftime('%Y-%m', completed_at) = strftime('%Y-%m', 'now') THEN 1 END) as completed_this_month,
      COUNT(CASE WHEN completed = 0 THEN 1 END) as open_tasks,
      COUNT(CASE WHEN completed = 0 AND due_on < date('now') THEN 1 END) as overdue_tasks
    FROM asana_tasks
  `);
  if (taskResult.length && taskResult[0].values.length) {
    const [completed, open, overdue] = taskResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Tasks completed (this month)', value: completed ?? 0 });
    metrics.push({ label: 'Open tasks', value: open ?? 0 });
    metrics.push({ label: 'Overdue tasks', value: overdue ?? 0 });
  }

  // Campaign builds
  const campaignResult = db.exec(`
    SELECT
      COUNT(*) as active,
      COUNT(CASE WHEN status = 'ready_to_launch' THEN 1 END) as ready,
      COUNT(CASE WHEN status = 'qa_pending' THEN 1 END) as qa_pending
    FROM campaign_builds
    WHERE status != 'launched'
  `);
  if (campaignResult.length && campaignResult[0].values.length) {
    const [active, ready, qaPending] = campaignResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Active campaign builds', value: `${active} (${ready} ready, ${qaPending} QA pending)` });
  }

  // QA scores
  const qaResult = db.exec(`
    SELECT
      ROUND(AVG(score), 2) as avg_score,
      COUNT(*) as graded,
      SUM(CASE WHEN grade = 'fail' THEN 1 ELSE 0 END) as fails
    FROM qa_grades
    WHERE created_at >= date('now', '-30 days')
  `);
  if (qaResult.length && qaResult[0].values.length) {
    const [avgScore, graded, fails] = qaResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'QA avg score (30d)', value: avgScore ?? 0 });
    metrics.push({ label: 'QA graded / fails (30d)', value: `${graded ?? 0} / ${fails ?? 0}` });
  }

  // Creative reviews
  const creativeResult = db.exec(`
    SELECT
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review,
      ROUND(AVG(revision_count), 1) as avg_revisions
    FROM creative_reviews
    WHERE status NOT IN ('approved', 'cancelled')
  `);
  if (creativeResult.length && creativeResult[0].values.length) {
    const [pending, inReview, avgRev] = creativeResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Creative reviews pending', value: `${(pending ?? 0) + (inReview ?? 0)}` });
    metrics.push({ label: 'Avg revisions per asset', value: avgRev ?? 0 });
  }

  return { name: 'Delivery', metrics };
}

// --- Performance metrics (ads) ---

async function getPerformanceKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  // Google Ads totals (this month)
  const gadsResult = db.exec(`
    SELECT
      ROUND(SUM(spend), 2) as total_spend,
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions
    FROM gads_campaign_spend
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `);
  if (gadsResult.length && gadsResult[0].values.length) {
    const [spend, clicks, impressions] = gadsResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Google Ads spend (month)', value: `£${(spend ?? 0).toLocaleString()}` });
    metrics.push({ label: 'Google Ads clicks', value: (clicks ?? 0).toLocaleString() });
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : 'n/a';
    metrics.push({ label: 'Google Ads CTR', value: ctr });
  }

  // Meta Ads totals (this month)
  const metaResult = db.exec(`
    SELECT
      ROUND(SUM(spend), 2) as total_spend,
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions
    FROM meta_insights
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      AND level = 'account'
  `);
  if (metaResult.length && metaResult[0].values.length) {
    const [spend, clicks, impressions] = metaResult[0].values[0] as [number, number, number];
    metrics.push({ label: 'Meta Ads spend (month)', value: `£${(spend ?? 0).toLocaleString()}` });
    metrics.push({ label: 'Meta Ads clicks', value: (clicks ?? 0).toLocaleString() });
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : 'n/a';
    metrics.push({ label: 'Meta Ads CTR', value: ctr });
  }

  // Total ad spend
  const totalSpendResult = db.exec(`
    SELECT ROUND(
      COALESCE((SELECT SUM(spend) FROM gads_campaign_spend WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')), 0) +
      COALESCE((SELECT SUM(spend) FROM meta_insights WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now') AND level = 'account'), 0)
    , 2) as total
  `);
  if (totalSpendResult.length && totalSpendResult[0].values.length) {
    metrics.push({ label: 'Total ad spend (month)', value: `£${((totalSpendResult[0].values[0][0] as number) ?? 0).toLocaleString()}` });
  }

  return { name: 'Performance (Ads)', metrics };
}

// --- Team metrics ---

async function getTeamKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  // Tasks per team member this month
  const teamResult = db.exec(`
    SELECT
      assignee_name,
      COUNT(CASE WHEN completed = 1 AND strftime('%Y-%m', completed_at) = strftime('%Y-%m', 'now') THEN 1 END) as completed,
      COUNT(CASE WHEN completed = 0 THEN 1 END) as open
    FROM asana_tasks
    WHERE assignee_name IS NOT NULL
    GROUP BY assignee_name
    ORDER BY completed DESC
  `);

  if (teamResult.length && teamResult[0].values.length) {
    for (const row of teamResult[0].values) {
      const [name, completed, open] = row as [string, number, number];
      metrics.push({ label: name, value: `${completed} done, ${open} open` });
    }
  }

  return { name: 'Team', metrics };
}

// --- Client health summary ---

async function getClientHealthKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  // From client_health table
  const healthResult = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN health_status = 'at_risk' THEN 1 ELSE 0 END) as at_risk,
      SUM(CASE WHEN health_status = 'critical' THEN 1 ELSE 0 END) as critical,
      ROUND(AVG(health_score), 1) as avg_score
    FROM client_health
    WHERE period = (SELECT MAX(period) FROM client_health)
  `);

  if (healthResult.length && healthResult[0].values.length) {
    const [total, healthy, atRisk, critical, avgScore] = healthResult[0].values[0] as [number, number, number, number, number];
    metrics.push({ label: 'Clients scored', value: total ?? 0 });
    metrics.push({ label: 'Healthy / At-risk / Critical', value: `${healthy ?? 0} / ${atRisk ?? 0} / ${critical ?? 0}` });
    metrics.push({ label: 'Avg health score', value: avgScore ?? 0 });
  }

  // From client_profitability
  const profitResult = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN classification = 'healthy' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN classification = 'warning' THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN classification = 'critical' THEN 1 ELSE 0 END) as critical,
      ROUND(AVG(margin_pct), 1) as avg_margin
    FROM client_profitability
    WHERE period = (SELECT MAX(period) FROM client_profitability)
  `);

  if (profitResult.length && profitResult[0].values.length) {
    const [total, healthy, warning, critical, avgMargin] = profitResult[0].values[0] as [number, number, number, number, number];
    if (total && total > 0) {
      metrics.push({ label: 'Profitability: H/W/C', value: `${healthy ?? 0} / ${warning ?? 0} / ${critical ?? 0}` });
      metrics.push({ label: 'Avg margin', value: `${avgMargin ?? 0}%` });
    }
  }

  return { name: 'Client Health', metrics };
}

// --- AI system health ---

async function getAiKpis(): Promise<KpiSection> {
  const db = await getDb();
  const metrics: KpiSection['metrics'] = [];

  const aiResult = db.exec(`
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
      ROUND(AVG(quality_score), 3) as avg_quality,
      SUM(input_tokens + output_tokens) as total_tokens
    FROM ai_audit_log
    WHERE created_at >= date('now', '-30 days')
  `);

  if (aiResult.length && aiResult[0].values.length) {
    const [totalCalls, errors, avgQuality, totalTokens] = aiResult[0].values[0] as [number, number, number, number];
    metrics.push({ label: 'AI calls (30d)', value: totalCalls ?? 0 });
    metrics.push({ label: 'AI errors (30d)', value: errors ?? 0 });
    metrics.push({ label: 'AI avg quality', value: avgQuality ?? 0 });
    metrics.push({ label: 'Total tokens used', value: (totalTokens ?? 0).toLocaleString() });
  }

  return { name: 'AI System', metrics };
}

// --- Display ---

function displaySection(section: KpiSection): void {
  console.log(`\n--- ${section.name} ---\n`);
  for (const m of section.metrics) {
    const trend = m.trend ? ` (${m.trend})` : '';
    console.log(`  ${m.label.padEnd(35)} ${String(m.value)}${trend}`);
  }
}

// --- Main ---

async function main() {
  await initSchema();

  const sectionFilter = process.argv.includes('--section')
    ? process.argv[process.argv.indexOf('--section') + 1]?.toLowerCase()
    : undefined;

  const jsonOutput = process.argv.includes('--json');

  const sections: KpiSection[] = [];

  const sectionMap: Record<string, () => Promise<KpiSection>> = {
    revenue: getRevenueKpis,
    delivery: getDeliveryKpis,
    performance: getPerformanceKpis,
    team: getTeamKpis,
    health: getClientHealthKpis,
    ai: getAiKpis,
  };

  if (sectionFilter && sectionMap[sectionFilter]) {
    sections.push(await sectionMap[sectionFilter]());
  } else {
    for (const fn of Object.values(sectionMap)) {
      sections.push(await fn());
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(sections, null, 2));
  } else {
    console.log('\n=== Vendo KPI Dashboard ===');
    console.log(`  Generated: ${new Date().toISOString().split('T')[0]}`);
    for (const section of sections) {
      displaySection(section);
    }
    console.log('');
  }

  closeDb();
}

main().catch((err) => {
  logError('KPI', 'KPI dashboard failed', err);
  process.exit(1);
});
