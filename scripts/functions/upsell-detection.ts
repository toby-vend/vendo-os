/**
 * Upsell and Cross-sell Detection — identify upsell opportunities from data.
 *
 * Trigger rules: high ROAS for 3+ months, meeting transcript buying signals,
 * client mentions new channel, strong performance growth.
 *
 * Usage:
 *   npx tsx scripts/functions/upsell-detection.ts           # scan for opportunities
 *   npx tsx scripts/functions/upsell-detection.ts --status   # show pipeline
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

async function scanForOpportunities(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  let found = 0;

  // 1. Clients with strong ad performance (high spend + clicks)
  const performanceResult = db.exec(`
    SELECT account_name, ROUND(SUM(spend), 2) as total_spend, SUM(clicks) as total_clicks
    FROM gads_campaign_spend
    WHERE date >= date('now', '-90 days')
    GROUP BY account_name
    HAVING total_spend > 5000 AND total_clicks > 1000
  `);

  if (performanceResult.length && performanceResult[0].values.length) {
    for (const row of performanceResult[0].values) {
      const [name, spend, clicks] = row as [string, number, number];
      const exists = db.exec(
        'SELECT id FROM upsell_opportunities WHERE client_name = ? AND trigger_type = ? AND created_at >= date(\'now\', \'-90 days\')',
        [name, 'high_performance'],
      );
      if (exists.length && exists[0].values.length) continue;

      db.run(`
        INSERT INTO upsell_opportunities (client_name, trigger_type, signal, confidence, recommended_action, status, created_at, updated_at)
        VALUES (?, 'high_performance', ?, 0.7, 'Propose budget increase or new channel expansion', 'identified', ?, ?)
      `, [name, `£${spend} spend, ${clicks} clicks in 90 days — strong performance suggests room to scale`, now, now]);
      found++;
    }
  }

  // 2. Clients with meetings mentioning expansion keywords
  const meetingResult = db.exec(`
    SELECT DISTINCT m.client_name
    FROM meetings m
    WHERE m.date >= date('now', '-30 days')
      AND m.client_name IS NOT NULL
      AND (m.summary LIKE '%new channel%' OR m.summary LIKE '%expand%' OR m.summary LIKE '%more budget%'
        OR m.summary LIKE '%linkedin%' OR m.summary LIKE '%tiktok%' OR m.summary LIKE '%seo%'
        OR m.summary LIKE '%new market%' OR m.summary LIKE '%grow%')
  `);

  if (meetingResult.length && meetingResult[0].values.length) {
    for (const row of meetingResult[0].values) {
      const name = row[0] as string;
      const exists = db.exec(
        'SELECT id FROM upsell_opportunities WHERE client_name = ? AND trigger_type = ? AND created_at >= date(\'now\', \'-30 days\')',
        [name, 'meeting_signal'],
      );
      if (exists.length && exists[0].values.length) continue;

      db.run(`
        INSERT INTO upsell_opportunities (client_name, trigger_type, signal, confidence, recommended_action, status, created_at, updated_at)
        VALUES (?, 'meeting_signal', 'Expansion language detected in recent meeting', 0.6, 'Review meeting notes and propose tailored expansion package', 'identified', ?, ?)
      `, [name, now, now]);
      found++;
    }
  }

  // 3. Healthy clients with high profitability (margin >60%)
  const profitResult = db.exec(`
    SELECT client_name, margin_pct
    FROM client_profitability
    WHERE period = (SELECT MAX(period) FROM client_profitability)
      AND margin_pct > 60
  `);

  if (profitResult.length && profitResult[0].values.length) {
    for (const row of profitResult[0].values) {
      const [name, margin] = row as [string, number];
      const exists = db.exec(
        'SELECT id FROM upsell_opportunities WHERE client_name = ? AND trigger_type = ? AND created_at >= date(\'now\', \'-90 days\')',
        [name, 'high_margin'],
      );
      if (exists.length && exists[0].values.length) continue;

      db.run(`
        INSERT INTO upsell_opportunities (client_name, trigger_type, signal, confidence, recommended_action, status, created_at, updated_at)
        VALUES (?, 'high_margin', ?, 0.5, 'Healthy margin — consider offering premium services or new channels', 'identified', ?, ?)
      `, [name, `${margin}% margin — capacity to deliver more value`, now, now]);
      found++;
    }
  }

  saveDb();
  log('UPSELL', found > 0 ? `Found ${found} new upsell opportunity(ies)` : 'No new opportunities detected');
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT client_name, trigger_type, signal, confidence, recommended_action, status, created_at
    FROM upsell_opportunities
    ORDER BY confidence DESC, created_at DESC
  `);

  if (!result.length || !result[0].values.length) { log('UPSELL', 'No upsell opportunities'); return; }

  console.log('\n=== Upsell Opportunities ===\n');
  for (const row of result[0].values) {
    const [client, trigger, signal, confidence, action, status, created] = row as [string, string, string, number, string, string, string];
    console.log(`  ${client} [${(confidence * 100).toFixed(0)}% confidence] — ${status}`);
    console.log(`    Trigger: ${trigger} | ${signal}`);
    console.log(`    Action: ${action}`);
    console.log(`    Identified: ${created.split('T')[0]}`);
    console.log('');
  }
}

async function main() {
  await initSchema();
  if (process.argv.includes('--status')) { await showStatus(); } else { await scanForOpportunities(); await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('UPSELL', 'Failed', err); process.exit(1); });
