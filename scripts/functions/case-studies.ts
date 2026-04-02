/**
 * Case Study and Social Proof — identify wins, draft case studies, track distribution.
 *
 * Monthly win identification from reporting data, client permission tracking,
 * AI-drafted case studies, multi-channel distribution checklist.
 *
 * Usage:
 *   npx tsx scripts/functions/case-studies.ts              # identify new wins
 *   npx tsx scripts/functions/case-studies.ts --draft       # draft pending case studies
 *   npx tsx scripts/functions/case-studies.ts --status      # show all case studies
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

// --- Win identification criteria ---

interface WinCandidate {
  clientName: string;
  winType: string;
  metricHighlight: string;
}

async function identifyWins(): Promise<WinCandidate[]> {
  const db = await getDb();
  const wins: WinCandidate[] = [];

  // Check Google Ads — clients with strong ROAS or significant spend growth
  const gadsWins = db.exec(`
    SELECT
      account_name,
      ROUND(SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN spend ELSE 0 END), 2) as last_month_spend,
      ROUND(SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-2 month') THEN spend ELSE 0 END), 2) as prev_month_spend,
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN clicks ELSE 0 END) as last_month_clicks
    FROM gads_campaign_spend
    WHERE date >= date('now', '-90 days')
    GROUP BY account_name
    HAVING last_month_clicks > 100
  `);

  if (gadsWins.length && gadsWins[0].values.length) {
    for (const row of gadsWins[0].values) {
      const [name, lastSpend, prevSpend, clicks] = row as [string, number, number, number];
      // Growth >20% is noteworthy
      if (prevSpend > 0 && lastSpend > prevSpend * 1.2) {
        const growth = Math.round(((lastSpend / prevSpend) - 1) * 100);
        wins.push({
          clientName: name,
          winType: 'spend_growth',
          metricHighlight: `${growth}% spend growth month-on-month (${clicks} clicks)`,
        });
      }
    }
  }

  // Check Meta Ads — strong engagement
  const metaWins = db.exec(`
    SELECT
      account_name,
      ROUND(SUM(spend), 2) as total_spend,
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions
    FROM meta_insights
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month')
      AND level = 'account'
    GROUP BY account_name
    HAVING total_clicks > 200
  `);

  if (metaWins.length && metaWins[0].values.length) {
    for (const row of metaWins[0].values) {
      const [name, spend, clicks, impressions] = row as [string, number, number, number];
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      if (ctr > 2) { // Above-average CTR
        wins.push({
          clientName: name,
          winType: 'high_ctr',
          metricHighlight: `${ctr.toFixed(2)}% CTR on Meta Ads (${clicks} clicks from £${spend.toFixed(0)} spend)`,
        });
      }
    }
  }

  // Check client health — any client that improved significantly
  const healthWins = db.exec(`
    SELECT
      h1.client_name,
      h1.health_score as current_score,
      h2.health_score as prev_score
    FROM client_health h1
    JOIN client_health h2 ON h1.client_name = h2.client_name
    WHERE h1.period = (SELECT MAX(period) FROM client_health)
      AND h2.period = (SELECT MAX(period) FROM client_health WHERE period < (SELECT MAX(period) FROM client_health))
      AND h1.health_score > h2.health_score + 15
  `);

  if (healthWins.length && healthWins[0].values.length) {
    for (const row of healthWins[0].values) {
      const [name, current, prev] = row as [string, number, number];
      wins.push({
        clientName: name,
        winType: 'health_improvement',
        metricHighlight: `Health score improved from ${prev} to ${current}`,
      });
    }
  }

  // Filter out clients that already have a case study this quarter
  const existing = db.exec(`
    SELECT client_name FROM case_studies
    WHERE created_at >= date('now', '-90 days')
  `);

  const existingNames = new Set(
    existing.length && existing[0].values.length
      ? existing[0].values.map((r: unknown[]) => r[0] as string)
      : [],
  );

  return wins.filter((w) => !existingNames.has(w.clientName));
}

// --- Draft case study ---

async function draftCaseStudy(id: number, clientName: string, winType: string, metric: string): Promise<string> {
  const db = await getDb();

  // Gather context
  let context = `Client: ${clientName}\nWin type: ${winType}\nKey metric: ${metric}\n`;

  // Get recent meeting summary
  const meeting = db.exec(`
    SELECT summary FROM meetings
    WHERE client_name LIKE ? AND summary IS NOT NULL
    ORDER BY date DESC LIMIT 1
  `, [`%${clientName}%`]);

  if (meeting.length && meeting[0].values.length) {
    context += `\nRecent meeting context: ${(meeting[0].values[0][0] as string).slice(0, 500)}`;
  }

  // Get brand context
  const brand = db.exec(
    'SELECT content FROM brand_hub WHERE client_name LIKE ? LIMIT 1',
    [`%${clientName}%`],
  );

  if (brand.length && brand[0].values.length) {
    context += `\nBrand context: ${(brand[0].values[0][0] as string).slice(0, 300)}`;
  }

  const result = await aiCall('case-study-draft', {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    system: `You write case studies for Vendo, a UK paid media agency. Format: Challenge → Approach → Results → Quote placeholder. Keep it factual, concise, under 400 words. UK English.`,
    messages: [{
      role: 'user',
      content: `Draft a case study based on this data:\n\n${context}\n\nInclude a [CLIENT QUOTE PLACEHOLDER] for the testimonial.`,
    }],
  });

  return result.text;
}

// --- Distribution checklist ---

const DISTRIBUTION_CHANNELS = [
  'Published to website',
  'LinkedIn post (Sell pillar)',
  'Added to proposal deck',
  'Added to outbound email sequence',
  'Stored in Google Drive',
];

// --- Commands ---

async function identifyAndStore(): Promise<void> {
  log('CASE-STUDY', 'Identifying recent wins...');

  const wins = await identifyWins();

  if (!wins.length) {
    log('CASE-STUDY', 'No new wins identified this period');
    return;
  }

  const db = await getDb();
  const now = new Date().toISOString();

  for (const win of wins) {
    db.run(`
      INSERT INTO case_studies (client_name, win_type, metric_highlight, status, created_at, updated_at)
      VALUES (?, ?, ?, 'identified', ?, ?)
    `, [win.clientName, win.winType, win.metricHighlight, now, now]);

    log('CASE-STUDY', `  Win: ${win.clientName} — ${win.winType}: ${win.metricHighlight}`);
  }

  saveDb();
  log('CASE-STUDY', `${wins.length} win(s) identified`);
}

async function draftPending(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const pending = db.exec(`
    SELECT id, client_name, win_type, metric_highlight
    FROM case_studies
    WHERE status IN ('identified', 'approved') AND draft IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (!pending.length || !pending[0].values.length) {
    log('CASE-STUDY', 'No case studies pending drafting');
    return;
  }

  log('CASE-STUDY', `Drafting ${pending[0].values.length} case study(ies)...`);

  for (const row of pending[0].values) {
    const [id, clientName, winType, metric] = row as [number, string, string, string];

    log('CASE-STUDY', `  Drafting: ${clientName}`);
    const draft = await draftCaseStudy(id, clientName, winType, metric);

    const distribution = JSON.stringify(
      DISTRIBUTION_CHANNELS.map((ch) => ({ channel: ch, done: false })),
    );

    db.run(
      'UPDATE case_studies SET draft = ?, distribution = ?, status = \'drafted\', updated_at = ? WHERE id = ?',
      [draft, distribution, now, id],
    );

    log('CASE-STUDY', `  Drafted (${draft.length} chars)`);
  }

  saveDb();
}

async function showStatus(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT client_name, win_type, metric_highlight, status, client_approved, anonymous, created_at
    FROM case_studies
    ORDER BY created_at DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('CASE-STUDY', 'No case studies');
    return;
  }

  console.log('\n=== Case Studies ===\n');
  console.log('  Client                   Win Type            Status       Approved  Date');
  console.log('  ' + '-'.repeat(80));

  for (const row of result[0].values) {
    const [client, winType, _metric, status, approved, anonymous, created] = row as [string, string, string, string, number, number, string];
    const approvedStr = approved ? 'Yes' : anonymous ? 'Anon' : 'Pending';
    console.log(
      `  ${(client ?? '').slice(0, 24).padEnd(24)} ` +
      `${(winType ?? '').padEnd(19)} ` +
      `${(status ?? '').padEnd(12)} ` +
      `${approvedStr.padEnd(9)} ` +
      `${(created ?? '').split('T')[0]}`,
    );
  }

  // Summary
  const summary = db.exec(`
    SELECT status, COUNT(*) FROM case_studies GROUP BY status
  `);

  if (summary.length && summary[0].values.length) {
    console.log('\n  Pipeline:');
    for (const row of summary[0].values) {
      console.log(`    ${(row[0] as string).padEnd(15)} ${row[1]}`);
    }
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--draft')) {
    await draftPending();
  } else if (process.argv.includes('--status')) {
    await showStatus();
  } else {
    await identifyAndStore();
  }

  closeDb();
}

main().catch((err) => {
  logError('CASE-STUDY', 'Case study flow failed', err);
  process.exit(1);
});
