/**
 * Upsell detection — Turso-native port of scripts/functions/upsell-detection.ts.
 * Wave V / V2. Runs weekly via /api/cron/upsell-detection (Wed 10:00 UTC).
 *
 * Scans three signal sources and writes new rows into upsell_opportunities.
 * Idempotent: an existing identified row in the relevant window for the same
 * (client, trigger_type) is skipped — re-runs don't duplicate.
 *
 * Signals:
 *   1. high_performance — Google Ads spend > £5k AND clicks > 1k in 90 days
 *   2. meeting_signal   — recent meeting summary mentions expansion keywords
 *   3. high_margin      — latest profitability period > 60% margin
 *
 * Atlas-AM follow-up drafts (planned in the original Wave V / V2 spec) are
 * deferred — they need the Slack-send path lit. For now this job just
 * detects + persists; the drafts will come in a future iteration.
 */
import { db } from '../queries/base.js';

export interface UpsellSignal {
  clientName: string;
  triggerType: 'high_performance' | 'meeting_signal' | 'high_margin';
  signal: string;
  confidence: number;
  recommendedAction: string;
}

export interface UpsellResult {
  candidates: number;
  inserted: number;
  skipped: number;
  durationMs: number;
  rows: UpsellSignal[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS upsell_opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      signal TEXT NOT NULL,
      confidence REAL NOT NULL,
      recommended_action TEXT,
      status TEXT NOT NULL DEFAULT 'identified',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

async function alreadyOpen(clientName: string, triggerType: string, daysBack: number): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM upsell_opportunities
          WHERE client_name = ? AND trigger_type = ?
            AND created_at >= date('now', ?)
          LIMIT 1`,
    args: [clientName, triggerType, `-${daysBack} days`],
  });
  return r.rows.length > 0;
}

export async function runUpsellDetection(): Promise<UpsellResult> {
  const start = Date.now();
  await ensureSchema();
  const now = new Date().toISOString();
  const candidates: UpsellSignal[] = [];
  let skipped = 0;

  // 1. high_performance: Google Ads spend
  const perf = await db.execute(`
    SELECT account_name,
           ROUND(SUM(spend), 2) AS total_spend,
           SUM(clicks) AS total_clicks
    FROM gads_campaign_spend
    WHERE date >= date('now', '-90 days')
    GROUP BY account_name
    HAVING total_spend > 5000 AND total_clicks > 1000
  `);
  for (const row of perf.rows) {
    const name = String(row.account_name);
    if (await alreadyOpen(name, 'high_performance', 90)) { skipped++; continue; }
    candidates.push({
      clientName: name,
      triggerType: 'high_performance',
      signal: `£${row.total_spend} spend, ${row.total_clicks} clicks in 90 days — strong performance suggests room to scale`,
      confidence: 0.7,
      recommendedAction: 'Propose budget increase or new channel expansion',
    });
  }

  // 2. meeting_signal: recent meeting expansion keywords
  const meetings = await db.execute(`
    SELECT DISTINCT m.client_name
    FROM meetings m
    WHERE m.date >= date('now', '-30 days')
      AND m.client_name IS NOT NULL
      AND (m.summary LIKE '%new channel%' OR m.summary LIKE '%expand%' OR m.summary LIKE '%more budget%'
        OR m.summary LIKE '%linkedin%' OR m.summary LIKE '%tiktok%' OR m.summary LIKE '%seo%'
        OR m.summary LIKE '%new market%' OR m.summary LIKE '%grow%')
  `);
  for (const row of meetings.rows) {
    const name = String(row.client_name);
    if (await alreadyOpen(name, 'meeting_signal', 30)) { skipped++; continue; }
    candidates.push({
      clientName: name,
      triggerType: 'meeting_signal',
      signal: 'Expansion language detected in recent meeting',
      confidence: 0.6,
      recommendedAction: 'Review meeting notes and propose tailored expansion package',
    });
  }

  // 3. high_margin: latest profitability period > 60%
  const profit = await db.execute(`
    SELECT client_name, margin_pct
    FROM client_profitability
    WHERE period = (SELECT MAX(period) FROM client_profitability)
      AND margin_pct > 60
  `);
  for (const row of profit.rows) {
    const name = String(row.client_name);
    if (await alreadyOpen(name, 'high_margin', 90)) { skipped++; continue; }
    candidates.push({
      clientName: name,
      triggerType: 'high_margin',
      signal: `${row.margin_pct}% margin — capacity to deliver more value`,
      confidence: 0.5,
      recommendedAction: 'Healthy margin — consider offering premium services or new channels',
    });
  }

  // Insert
  if (candidates.length > 0) {
    const stmts = candidates.map((c) => ({
      sql: `INSERT INTO upsell_opportunities
              (client_name, trigger_type, signal, confidence, recommended_action,
               status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'identified', ?, ?)`,
      args: [
        c.clientName, c.triggerType, c.signal, c.confidence,
        c.recommendedAction, now, now,
      ] as (string | number | null)[],
    }));
    await db.batch(stmts, 'write');
  }

  return {
    candidates: candidates.length + skipped,
    inserted: candidates.length,
    skipped,
    durationMs: Date.now() - start,
    rows: candidates,
  };
}
