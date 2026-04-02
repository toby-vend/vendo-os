/**
 * Emergency Outage / Incident Management — detect, mitigate, communicate, resolve.
 *
 * Usage:
 *   npx tsx scripts/functions/incident-management.ts --raise "Google Ads" "API returning 500s"
 *   npx tsx scripts/functions/incident-management.ts --resolve 1 "API restored"
 *   npx tsx scripts/functions/incident-management.ts --status
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

const CLIENT_COMMS_TEMPLATE = (platform: string, impact: string) =>
  `We're aware of an issue with ${platform} that may be affecting your campaigns. ` +
  `Impact: ${impact}. We're monitoring the situation and will update you as soon as it's resolved.`;

async function raiseIncident(platform: string, description: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Find affected clients (those with active ad accounts on this platform)
  let affected: string[] = [];
  const platformLower = platform.toLowerCase();

  if (platformLower.includes('google')) {
    const r = db.exec('SELECT DISTINCT account_name FROM gads_accounts WHERE status = \'ENABLED\'');
    if (r.length && r[0].values.length) affected = r[0].values.map((v: unknown[]) => v[0] as string);
  } else if (platformLower.includes('meta') || platformLower.includes('facebook')) {
    const r = db.exec('SELECT DISTINCT name FROM meta_ad_accounts WHERE account_status = 1');
    if (r.length && r[0].values.length) affected = r[0].values.map((v: unknown[]) => v[0] as string);
  }

  db.run(`
    INSERT INTO incidents (platform, description, clients_affected, status, created_at)
    VALUES (?, ?, ?, 'detected', ?)
  `, [platform, description, JSON.stringify(affected), now]);

  saveDb();

  log('INCIDENT', `Raised: ${platform} — ${description}`);
  log('INCIDENT', `  Affected clients: ${affected.length}`);

  await sendSlackAlert('incident', `OUTAGE: ${platform} — ${description}. ${affected.length} client(s) potentially affected.`).catch(() => {});

  console.log('\n  Client comms template:');
  console.log(`  "${CLIENT_COMMS_TEMPLATE(platform, description)}"`);
  console.log('');
}

async function resolveIncident(id: number, resolution: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    'UPDATE incidents SET status = \'resolved\', resolution = ?, resolved_at = ? WHERE id = ?',
    [resolution, now, id],
  );
  saveDb();
  log('INCIDENT', `Resolved #${id}: ${resolution}`);
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT id, platform, description, clients_affected, client_comms_sent, status, resolution, created_at, resolved_at
    FROM incidents ORDER BY CASE WHEN status != 'resolved' THEN 0 ELSE 1 END, created_at DESC LIMIT 15
  `);

  if (!result.length || !result[0].values.length) { log('INCIDENT', 'No incidents'); return; }

  console.log('\n=== Incidents ===\n');
  for (const row of result[0].values) {
    const [id, platform, desc, affectedJson, commsSent, status, resolution, created, resolved] =
      row as [number, string, string, string, number, string, string | null, string, string | null];
    const affected: string[] = JSON.parse(affectedJson || '[]');
    console.log(`  #${id} [${status.toUpperCase()}] ${platform}`);
    console.log(`    ${desc}`);
    console.log(`    Affected: ${affected.length} clients | Comms sent: ${commsSent ? 'Yes' : 'No'}`);
    if (resolution) console.log(`    Resolution: ${resolution}`);
    console.log(`    Raised: ${created.split('T')[0]}${resolved ? ' | Resolved: ' + resolved.split('T')[0] : ''}`);
    console.log('');
  }
}

async function main() {
  await initSchema();
  if (process.argv.includes('--raise')) {
    const idx = process.argv.indexOf('--raise');
    const platform = process.argv[idx + 1]; const desc = process.argv[idx + 2];
    if (!platform || !desc) { logError('INCIDENT', 'Usage: --raise "Platform" "Description"'); process.exit(1); }
    await raiseIncident(platform, desc);
  } else if (process.argv.includes('--resolve')) {
    const idx = process.argv.indexOf('--resolve');
    const id = parseInt(process.argv[idx + 1], 10); const resolution = process.argv[idx + 2] ?? '';
    if (isNaN(id)) { logError('INCIDENT', 'Usage: --resolve <id> "resolution"'); process.exit(1); }
    await resolveIncident(id, resolution);
  } else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('INCIDENT', 'Failed', err); process.exit(1); });
