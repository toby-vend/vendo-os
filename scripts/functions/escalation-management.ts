/**
 * Client Escalation and Crisis — escalation tiers, SLA tracking, post-mortems.
 *
 * Tiers: AM → Founder → Emergency
 *
 * Usage:
 *   npx tsx scripts/functions/escalation-management.ts --raise "Client" "am" "Description"
 *   npx tsx scripts/functions/escalation-management.ts --resolve 1 "Resolution notes"
 *   npx tsx scripts/functions/escalation-management.ts --status
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

async function raiseEscalation(client: string, tier: string, description: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO escalations (client_name, tier, description, status, created_at) VALUES (?, ?, ?, \'open\', ?)',
    [client, tier, description, now],
  );
  saveDb();

  log('ESCALATION', `Raised: ${client} [${tier.toUpperCase()}] — ${description}`);

  if (tier === 'founder' || tier === 'emergency') {
    await sendSlackAlert('escalation', `${tier.toUpperCase()} escalation: ${client} — ${description}`).catch(() => {});
  }
}

async function resolveEscalation(id: number, resolution: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const result = db.exec('SELECT created_at FROM escalations WHERE id = ?', [id]);
  if (!result.length || !result[0].values.length) { logError('ESCALATION', `#${id} not found`); return; }

  const created = new Date(result[0].values[0][0] as string);
  const minutes = Math.round((Date.now() - created.getTime()) / 60000);

  db.run(
    'UPDATE escalations SET status = \'resolved\', resolution = ?, resolution_minutes = ?, resolved_at = ? WHERE id = ?',
    [resolution, minutes, now, id],
  );
  saveDb();
  log('ESCALATION', `Resolved #${id} in ${minutes} minutes`);
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT id, client_name, tier, description, status, resolution, resolution_minutes, created_at, resolved_at
    FROM escalations ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, created_at DESC LIMIT 20
  `);

  if (!result.length || !result[0].values.length) { log('ESCALATION', 'No escalations'); return; }

  console.log('\n=== Escalations ===\n');
  for (const row of result[0].values) {
    const [id, client, tier, desc, status, resolution, minutes, created] = row as [number, string, string, string, string, string | null, number | null, string];
    const statusIcon = status === 'open' ? 'OPEN' : 'CLOSED';
    console.log(`  #${id} [${statusIcon}] ${client} — ${tier.toUpperCase()}`);
    console.log(`    ${desc}`);
    if (resolution) console.log(`    Resolution (${minutes}min): ${resolution}`);
    console.log(`    Raised: ${created.split('T')[0]}`);
    console.log('');
  }

  // SLA summary
  const sla = db.exec(`
    SELECT tier, COUNT(*) as total, ROUND(AVG(resolution_minutes), 0) as avg_min
    FROM escalations WHERE status = 'resolved' GROUP BY tier
  `);
  if (sla.length && sla[0].values.length) {
    console.log('  SLA Summary:');
    for (const row of sla[0].values) {
      console.log(`    ${(row[0] as string).padEnd(12)} ${row[1]} resolved, avg ${row[2]}min`);
    }
    console.log('');
  }
}

async function main() {
  await initSchema();
  if (process.argv.includes('--raise')) {
    const idx = process.argv.indexOf('--raise');
    const client = process.argv[idx + 1]; const tier = process.argv[idx + 2]; const desc = process.argv[idx + 3];
    if (!client || !tier || !desc) { logError('ESCALATION', 'Usage: --raise "Client" "am|founder|emergency" "Description"'); process.exit(1); }
    await raiseEscalation(client, tier, desc);
  } else if (process.argv.includes('--resolve')) {
    const idx = process.argv.indexOf('--resolve');
    const id = parseInt(process.argv[idx + 1], 10); const resolution = process.argv[idx + 2] ?? '';
    if (isNaN(id)) { logError('ESCALATION', 'Usage: --resolve <id> "resolution"'); process.exit(1); }
    await resolveEscalation(id, resolution);
  } else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('ESCALATION', 'Failed', err); process.exit(1); });
