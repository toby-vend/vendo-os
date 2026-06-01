/**
 * Apply the reviewed GSC property → client mapping to client_account_map.
 *
 * Run: npm run map:gsc
 *
 * Reads data/gsc-site-map.proposed.json (produced by discover:gsc, after you
 * review and correct the clientName values) and upserts one row per mapped
 * property into client_account_map (platform = 'gsc'). sync-gsc.ts reads from
 * there. Entries with a null/blank clientName are skipped and reported.
 *
 * Every clientName must match an active client exactly (name, display_name or
 * alias). The run aborts without writing if any name is unresolved, so a typo
 * never silently drops a property.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { normaliseName } from '../matching/build-match-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const PROPOSAL_PATH = resolve(PROJECT_ROOT, 'data/gsc-site-map.proposed.json');

interface Proposal {
  siteUrl: string;
  permissionLevel?: string;
  clientId?: number | null;
  clientName?: string | null;
  confidence?: string;
}

async function apply() {
  let proposals: Proposal[];
  try {
    proposals = JSON.parse(readFileSync(PROPOSAL_PATH, 'utf-8'));
  } catch {
    logError('GSC', `No proposal file at ${PROPOSAL_PATH} — run: npm run discover:gsc`);
    process.exit(1);
  }

  await initSchema();
  const db = await getDb();

  // Build a lookup of every active client name/display_name/alias → record.
  const res = db.exec("SELECT id, name, display_name, aliases FROM clients WHERE status = 'active'");
  const byNorm = new Map<string, { id: number; name: string }>();
  if (res.length && res[0].values.length) {
    for (const row of res[0].values) {
      const rec = { id: row[0] as number, name: row[1] as string };
      const display = row[2] as string | null;
      const aliases = row[3] as string | null;
      byNorm.set(normaliseName(rec.name), rec);
      if (display) byNorm.set(normaliseName(display), rec);
      if (aliases) {
        let list: string[] = [];
        try { list = JSON.parse(aliases); } catch { list = aliases.split(',').map(a => a.trim()); }
        for (const a of list) if (a) byNorm.set(normaliseName(a), rec);
      }
    }
  }

  const toWrite: { siteUrl: string; client: { id: number; name: string } }[] = [];
  const unresolved: string[] = [];
  const skipped: string[] = [];

  for (const p of proposals) {
    const name = p.clientName?.trim();
    if (!name) { skipped.push(p.siteUrl); continue; }
    const client = byNorm.get(normaliseName(name));
    if (!client) { unresolved.push(`${p.siteUrl} → "${name}"`); continue; }
    toWrite.push({ siteUrl: p.siteUrl, client });
  }

  if (unresolved.length) {
    logError('GSC', `Aborting — ${unresolved.length} clientName value(s) don't match any active client. Fix these in the proposal file:`);
    for (const u of unresolved) logError('GSC', `  ${u}`);
    process.exit(1);
  }

  if (toWrite.length === 0) {
    logError('GSC', 'Nothing to map — every entry has a blank clientName. Fill them in and re-run.');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO client_account_map
       (client_id, client_name, platform, platform_account_id, platform_account_name, crm_type, created_at, updated_at)
     VALUES (?, ?, 'gsc', ?, ?, 'gsc', ?, ?)
     ON CONFLICT(client_id, platform, platform_account_id) DO UPDATE SET
       client_name = excluded.client_name,
       platform_account_name = excluded.platform_account_name,
       updated_at = excluded.updated_at`,
  );

  for (const { siteUrl, client } of toWrite) {
    upsert.run([client.id, client.name, siteUrl, siteUrl, now, now]);
    log('GSC', `  ${siteUrl} → ${client.name}`);
  }
  upsert.free();
  saveDb();
  closeDb();

  log('GSC', `\nMapped ${toWrite.length} propert${toWrite.length === 1 ? 'y' : 'ies'} to clients.`);
  if (skipped.length) {
    log('GSC', `Skipped ${skipped.length} unmapped propert${skipped.length === 1 ? 'y' : 'ies'} (blank clientName):`);
    for (const s of skipped) log('GSC', `  ${s}`);
  }
  log('GSC', '\nNext: npm run sync:gsc:backfill');
}

apply().catch(err => {
  logError('GSC', 'Mapping failed', err);
  process.exit(1);
});
