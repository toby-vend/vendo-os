/**
 * Performance Reviews — data-driven quarterly reviews with Asana metrics.
 *
 * Usage:
 *   npx tsx scripts/functions/performance-reviews.ts --create "Name" "Q1-2026"
 *   npx tsx scripts/functions/performance-reviews.ts --status
 *   npx tsx scripts/functions/performance-reviews.ts --metrics "Name"
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

async function gatherMetrics(personName: string): Promise<Record<string, unknown>> {
  const db = await getDb();

  // Asana task metrics (last 90 days)
  const tasks = db.exec(`
    SELECT
      COUNT(CASE WHEN completed = 1 THEN 1 END) as completed,
      COUNT(CASE WHEN completed = 0 THEN 1 END) as open,
      COUNT(CASE WHEN completed = 0 AND due_on < date('now') THEN 1 END) as overdue
    FROM asana_tasks
    WHERE assignee_name LIKE ? AND modified_at >= date('now', '-90 days')
  `, [`%${personName}%`]);

  const taskMetrics = tasks.length && tasks[0].values.length
    ? { completed: tasks[0].values[0][0], open: tasks[0].values[0][1], overdue: tasks[0].values[0][2] }
    : { completed: 0, open: 0, overdue: 0 };

  // QA scores
  const qa = db.exec(`
    SELECT ROUND(AVG(score), 2) as avg, COUNT(*) as total,
      SUM(CASE WHEN grade = 'fail' THEN 1 ELSE 0 END) as fails
    FROM qa_grades WHERE team_member LIKE ? AND created_at >= date('now', '-90 days')
  `, [`%${personName}%`]);

  const qaMetrics = qa.length && qa[0].values.length
    ? { avgScore: qa[0].values[0][0], total: qa[0].values[0][1], fails: qa[0].values[0][2] }
    : { avgScore: null, total: 0, fails: 0 };

  // Client health for their clients
  const clientHealth = db.exec(`
    SELECT COUNT(*) as clients, ROUND(AVG(health_score), 1) as avg_health
    FROM client_health
    WHERE period = (SELECT MAX(period) FROM client_health)
  `);

  return { tasks: taskMetrics, qa: qaMetrics, clientHealth: clientHealth[0]?.values[0] ?? null };
}

async function createReview(personName: string, period: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const metrics = await gatherMetrics(personName);

  db.run(`
    INSERT INTO performance_reviews (person_name, period, metrics, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
    ON CONFLICT(person_name, period) DO UPDATE SET metrics = excluded.metrics, created_at = excluded.created_at
  `, [personName, period, JSON.stringify(metrics), now]);

  saveDb();
  log('REVIEW', `Created review for ${personName} (${period})`);

  console.log('\n  Auto-gathered metrics:');
  const tm = metrics.tasks as Record<string, number>;
  console.log(`    Tasks: ${tm.completed} completed, ${tm.open} open, ${tm.overdue} overdue`);
  const qm = metrics.qa as Record<string, unknown>;
  if (qm.total) console.log(`    QA: avg ${qm.avgScore}, ${qm.total} graded, ${qm.fails} fails`);
  console.log('\n  Next steps:');
  console.log('    [ ] Self-assessment from team member');
  console.log('    [ ] Manager assessment');
  console.log('    [ ] Schedule review meeting');
  console.log('');
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT person_name, period, status, created_at FROM performance_reviews ORDER BY period DESC, person_name
  `);

  if (!result.length || !result[0].values.length) { log('REVIEW', 'No reviews'); return; }

  console.log('\n=== Performance Reviews ===\n');
  for (const row of result[0].values) {
    const [name, period, status, created] = row as string[];
    console.log(`  ${(name ?? '').padEnd(22)} ${(period ?? '').padEnd(10)} ${(status ?? '').padEnd(12)} ${(created ?? '').split('T')[0]}`);
  }
  console.log('');
}

async function showMetrics(personName: string): Promise<void> {
  const metrics = await gatherMetrics(personName);
  console.log(`\n=== Metrics for ${personName} (Last 90 Days) ===\n`);
  console.log(JSON.stringify(metrics, null, 2));
  console.log('');
}

async function main() {
  await initSchema();
  if (process.argv.includes('--create')) {
    const idx = process.argv.indexOf('--create');
    const name = process.argv[idx + 1]; const period = process.argv[idx + 2];
    if (!name || !period) { logError('REVIEW', 'Usage: --create "Name" "Q1-2026"'); process.exit(1); }
    await createReview(name, period);
  } else if (process.argv.includes('--metrics')) {
    const name = process.argv[process.argv.indexOf('--metrics') + 1];
    if (!name) { logError('REVIEW', 'Usage: --metrics "Name"'); process.exit(1); }
    await showMetrics(name);
  } else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('REVIEW', 'Failed', err); process.exit(1); });
