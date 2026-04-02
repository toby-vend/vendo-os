/**
 * Client NPS and Feedback — track NPS scores, trends, detractor alerts.
 *
 * Usage:
 *   npx tsx scripts/functions/nps-tracking.ts --add "Client" 8 "Great service"
 *   npx tsx scripts/functions/nps-tracking.ts --status     # NPS dashboard
 *   npx tsx scripts/functions/nps-tracking.ts --detractors  # show detractors needing follow-up
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

async function addResponse(client: string, score: number, feedback: string | null): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO nps_responses (client_name, score, feedback, created_at) VALUES (?, ?, ?, ?)',
    [client, score, feedback, now],
  );
  saveDb();

  const category = score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor';
  log('NPS', `Recorded: ${client} — ${score}/10 (${category})`);

  if (score < 7) {
    await sendSlackAlert('nps', `Detractor alert: ${client} scored ${score}/10 — immediate follow-up needed`, 'warning').catch(() => {});
  }
}

async function showDashboard(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      COUNT(*) as total,
      ROUND(AVG(score), 1) as avg_score,
      SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as promoters,
      SUM(CASE WHEN score >= 7 AND score < 9 THEN 1 ELSE 0 END) as passives,
      SUM(CASE WHEN score < 7 THEN 1 ELSE 0 END) as detractors
    FROM nps_responses
  `);

  if (!result.length || !result[0].values.length || !(result[0].values[0][0] as number)) {
    log('NPS', 'No NPS responses recorded'); return;
  }

  const [total, avg, promoters, passives, detractors] = result[0].values[0] as number[];
  const npsScore = Math.round(((promoters - detractors) / total) * 100);

  console.log('\n=== NPS Dashboard ===\n');
  console.log(`  NPS Score: ${npsScore} (${total} responses)`);
  console.log(`  Average: ${avg}/10`);
  console.log(`  Promoters (9-10): ${promoters} | Passives (7-8): ${passives} | Detractors (0-6): ${detractors}`);

  // Recent responses
  const recent = db.exec(`
    SELECT client_name, score, feedback, created_at FROM nps_responses
    ORDER BY created_at DESC LIMIT 10
  `);

  if (recent.length && recent[0].values.length) {
    console.log('\n  Recent responses:');
    for (const row of recent[0].values) {
      const [client, score, feedback, date] = row as [string, number, string | null, string];
      const cat = score >= 9 ? 'P' : score >= 7 ? '-' : 'D';
      console.log(`    [${cat}] ${(client ?? '').padEnd(25)} ${score}/10  ${(feedback ?? '').slice(0, 40)}  (${date.split('T')[0]})`);
    }
  }
  console.log('');
}

async function showDetractors(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT client_name, score, feedback, follow_up_action, follow_up_done, created_at
    FROM nps_responses WHERE score < 7 ORDER BY created_at DESC
  `);

  if (!result.length || !result[0].values.length) { log('NPS', 'No detractors'); return; }

  console.log('\n=== Detractors Needing Follow-up ===\n');
  for (const row of result[0].values) {
    const [client, score, feedback, action, done, date] = row as [string, number, string | null, string | null, number, string];
    const status = done ? 'DONE' : 'PENDING';
    console.log(`  [${status}] ${client} — ${score}/10 (${date.split('T')[0]})`);
    if (feedback) console.log(`    Feedback: ${feedback}`);
    if (action) console.log(`    Follow-up: ${action}`);
    console.log('');
  }
}

async function main() {
  await initSchema();
  if (process.argv.includes('--add')) {
    const idx = process.argv.indexOf('--add');
    const client = process.argv[idx + 1]; const score = parseInt(process.argv[idx + 2], 10);
    const feedback = process.argv[idx + 3] ?? null;
    if (!client || isNaN(score)) { logError('NPS', 'Usage: --add "Client" <score> "feedback"'); process.exit(1); }
    await addResponse(client, score, feedback);
  } else if (process.argv.includes('--detractors')) { await showDetractors(); }
  else { await showDashboard(); }
  closeDb();
}

main().catch((err) => { logError('NPS', 'Failed', err); process.exit(1); });
