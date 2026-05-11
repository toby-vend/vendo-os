/**
 * Sales pipeline digest — weekly Friday 17:00 UTC.
 * Wave C / C3.
 *
 * Reads ghl_opportunities (already scored by Wave V / V1 lead-scoring) and
 * builds a Slack digest with:
 *   - Top 10 open opportunities by score
 *   - Open pipeline value vs 7 days ago
 *   - Wins + losses in the last 7 days
 *
 * Posts to SLACK_CHANNEL_SALES (fallback to ALERTS). Idempotent within
 * 5 days — re-runs the same week won't double-post.
 */
import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'sales-pipeline-digest';

interface OppSummary {
  id: string;
  name: string;
  contact: string;
  stage: string;
  value: number;
  score: number;
}

export interface SalesPipelineDigestResult {
  posted: boolean;
  topCount: number;
  openValue: number;
  prevOpenValue: number;
  wonLast7: number;
  wonValueLast7: number;
  lostLast7: number;
  durationMs: number;
  topRows: OppSummary[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_pipeline_digest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      posted_at TEXT NOT NULL,
      open_value REAL NOT NULL,
      won_count INTEGER NOT NULL,
      lost_count INTEGER NOT NULL
    )
  `);
}

async function recentlyPosted(daysBack: number): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM sales_pipeline_digest_runs
          WHERE posted_at >= datetime('now', ?) LIMIT 1`,
    args: [`-${daysBack} days`],
  });
  return r.rows.length > 0;
}

export async function runSalesPipelineDigest(): Promise<SalesPipelineDigestResult> {
  const start = Date.now();
  await ensureSchema();

  // Top 10 open scored opportunities
  const topRes = await db.execute(`
    SELECT o.id, COALESCE(o.name, o.contact_name, '(unnamed)') AS name,
           COALESCE(o.contact_name, o.contact_company, '') AS contact,
           COALESCE(s.name, '(no stage)') AS stage,
           COALESCE(o.monetary_value, 0) AS value,
           COALESCE(o.lead_score, 0) AS score
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE o.status = 'open'
    ORDER BY o.lead_score DESC NULLS LAST, o.monetary_value DESC
    LIMIT 10
  `);
  const topRows = topRes.rows as unknown as OppSummary[];

  // Open pipeline value snapshots: now vs 7 days ago (approx via
  // updated_at; treats opps closed in the last 7d as having been open 7d ago).
  const openValueRes = await db.execute(`
    SELECT COALESCE(SUM(monetary_value), 0) AS v
    FROM ghl_opportunities
    WHERE status = 'open'
  `);
  const openValue = Number(openValueRes.rows[0]?.v ?? 0);

  const prevOpenValueRes = await db.execute(`
    SELECT COALESCE(SUM(monetary_value), 0) AS v
    FROM ghl_opportunities
    WHERE (status = 'open' AND created_at <= datetime('now', '-7 days'))
       OR (status != 'open' AND last_stage_change_at >= datetime('now', '-7 days'))
  `);
  const prevOpenValue = Number(prevOpenValueRes.rows[0]?.v ?? 0);

  // Wins + losses last 7 days
  const wonRes = await db.execute(`
    SELECT COUNT(*) AS c, COALESCE(SUM(monetary_value), 0) AS v
    FROM ghl_opportunities
    WHERE status = 'won' AND last_stage_change_at >= datetime('now', '-7 days')
  `);
  const wonLast7 = Number(wonRes.rows[0]?.c ?? 0);
  const wonValueLast7 = Number(wonRes.rows[0]?.v ?? 0);

  const lostRes = await db.execute(`
    SELECT COUNT(*) AS c FROM ghl_opportunities
    WHERE status = 'lost' AND last_stage_change_at >= datetime('now', '-7 days')
  `);
  const lostLast7 = Number(lostRes.rows[0]?.c ?? 0);

  let posted = false;
  if (!(await recentlyPosted(5))) {
    const channel = process.env.SLACK_CHANNEL_SALES
      || process.env.SLACK_CHANNEL_ALERTS
      || '#alerts';
    const delta = openValue - prevOpenValue;
    const arrow = delta >= 0 ? '↑' : '↓';
    const lines = [
      `:moneybag: *Sales pipeline — week to ${new Date().toISOString().slice(0, 10)}*`,
      '',
      `*Open pipeline:* £${Math.round(openValue).toLocaleString()} ${arrow} £${Math.round(Math.abs(delta)).toLocaleString()} vs last week`,
      `*Wins last 7d:* ${wonLast7} (£${Math.round(wonValueLast7).toLocaleString()})`,
      `*Losses last 7d:* ${lostLast7}`,
    ];
    if (topRows.length > 0) {
      lines.push('', '*Top 10 scored leads:*');
      for (const r of topRows) {
        const valueStr = r.value > 0 ? ` · £${Math.round(r.value).toLocaleString()}` : '';
        const contactStr = r.contact ? ` (${r.contact})` : '';
        lines.push(`  • ${r.score}/100 — ${r.name}${contactStr} · ${r.stage}${valueStr}`);
      }
    }
    try {
      await sendSlackMessage(channel, lines.join('\n'));
      posted = true;
      await db.execute({
        sql: `INSERT INTO sales_pipeline_digest_runs (posted_at, open_value, won_count, lost_count) VALUES (?, ?, ?, ?)`,
        args: [new Date().toISOString(), openValue, wonLast7, lostLast7] as (string | number | null)[],
      });
    } catch (err) {
      consoleLog(LOG_SOURCE, `Slack post failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return {
    posted,
    topCount: topRows.length,
    openValue,
    prevOpenValue,
    wonLast7,
    wonValueLast7,
    lostLast7,
    durationMs: Date.now() - start,
    topRows,
  };
}
