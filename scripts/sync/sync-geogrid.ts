/**
 * Geo-grid sync — pulls finished Local Viking geo-grid scans into
 * geogrid_scans, keyed to Vendo clients.
 *
 * Run: npm run sync:geogrid
 *
 * Client linkage uses client_source_mappings(source='localviking',
 * external_id=<LV location_id>). On first run, businesses with no mapping
 * are matched to a client by normalised-name prefix (e.g. LV "Zen House
 * Dental Banstead" → client "Zen House Dental") and the mapping is seeded
 * automatically. Ambiguous or unmatched businesses are logged and their
 * scans are still cached (client_id = NULL) so nothing is lost.
 *
 * Writes go to Turso when TURSO_DATABASE_URL is set (production DB), else a
 * local SQLite file — the same DB the report aggregators read.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchAllGeogrids, type LvGeogrid } from '../../web/lib/geogrid/localviking.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const API_KEY = process.env.LOCALVIKING_API_KEY;
if (!API_KEY) {
  console.error('✗ LOCALVIKING_API_KEY not set in .env.local');
  process.exit(1);
}

/** Collapse a business/client name to a comparison key. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
}

async function loadClients(): Promise<ClientRow[]> {
  const res = await db.execute(`SELECT id, name, display_name FROM clients`);
  return res.rows as unknown as ClientRow[];
}

async function loadLocationMappings(): Promise<Map<string, number>> {
  const res = await db.execute(
    `SELECT client_id, external_id FROM client_source_mappings WHERE source = 'localviking'`,
  );
  const map = new Map<string, number>();
  for (const r of res.rows as unknown as { client_id: number; external_id: string }[]) {
    map.set(r.external_id, r.client_id);
  }
  return map;
}

/**
 * Find the single best client for a business name. Returns the client whose
 * normalised name is a prefix of (or equal to) the business name, preferring
 * the longest/most-specific match. Returns null when there is no match or
 * the match is ambiguous (two equally-specific clients).
 */
function matchClient(businessName: string, clients: ClientRow[]): ClientRow | null {
  const nb = norm(businessName);
  if (nb.length < 6) return null;
  let best: ClientRow | null = null;
  let bestLen = 0;
  let tie = false;
  for (const c of clients) {
    const nc = norm(c.display_name || c.name);
    if (nc.length < 6) continue;
    // business starts with client name (LV adds a town suffix), or exact.
    if (nb === nc || nb.startsWith(nc) || nc.startsWith(nb)) {
      const len = Math.min(nc.length, nb.length);
      if (len > bestLen) {
        best = c;
        bestLen = len;
        tie = false;
      } else if (len === bestLen && best && norm(best.display_name || best.name) !== nc) {
        tie = true;
      }
    }
  }
  return tie ? null : best;
}

async function seedMapping(locationId: string, clientId: number, businessName: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO client_source_mappings (client_id, source, external_id, external_name, created_at)
          VALUES (?, 'localviking', ?, ?, ?)
          ON CONFLICT(source, external_id) DO UPDATE SET
            client_id = excluded.client_id,
            external_name = excluded.external_name`,
    args: [clientId, locationId, businessName, new Date().toISOString()],
  });
}

async function upsertScan(g: LvGeogrid, clientId: number | null, syncedAt: string): Promise<void> {
  const scannedAt = g.finished_at || g.created_at;
  await db.execute({
    sql: `INSERT INTO geogrid_scans (
            client_id, provider, external_id, location_id, business_name, business_place_id,
            search_term, grid_size, grid_point_distance, grid_distance_measure,
            grid_center_lat, grid_center_lng, agr, atgr, solv, ranks_json, state,
            scanned_at, created_at, synced_at
          ) VALUES (?, 'localviking', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(provider, external_id) DO UPDATE SET
            client_id = excluded.client_id,
            agr = excluded.agr,
            atgr = excluded.atgr,
            solv = excluded.solv,
            ranks_json = excluded.ranks_json,
            state = excluded.state,
            scanned_at = excluded.scanned_at,
            synced_at = excluded.synced_at`,
    args: [
      clientId,
      g.id,
      g.location_id,
      g.business_name,
      g.business_place_id,
      g.search_term,
      g.grid_size,
      g.grid_point_distance,
      g.grid_distance_measure,
      g.grid_center_lat,
      g.grid_center_lng,
      g.agr,
      g.atgr,
      g.solv,
      JSON.stringify(g.ranks),
      g.state,
      scannedAt,
      g.created_at,
      syncedAt,
    ],
  });
}

async function main(): Promise<void> {
  const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
  console.log(`Geo-grid sync → ${target}\n`);

  const grids = await fetchAllGeogrids(API_KEY!);
  const finished = grids.filter((g) => g.state === 'finished' && Array.isArray(g.ranks) && g.ranks.length > 0);
  console.log(`Fetched ${grids.length} scans (${finished.length} finished).`);

  const clients = await loadClients();
  const mappings = await loadLocationMappings();

  // One representative business per location_id (for mapping resolution).
  const businessByLocation = new Map<string, string>();
  for (const g of finished) {
    if (!businessByLocation.has(g.location_id)) businessByLocation.set(g.location_id, g.business_name);
  }

  // Resolve / seed mappings.
  let seeded = 0;
  const unmatched: string[] = [];
  for (const [locationId, businessName] of businessByLocation) {
    if (mappings.has(locationId)) continue;
    const match = matchClient(businessName, clients);
    if (match) {
      await seedMapping(locationId, match.id, businessName);
      mappings.set(locationId, match.id);
      seeded += 1;
      console.log(`  mapped "${businessName}" (${locationId}) → client #${match.id} ${match.display_name || match.name}`);
    } else {
      unmatched.push(`${businessName} (${locationId})`);
    }
  }
  if (seeded) console.log(`Seeded ${seeded} new client mapping(s).`);
  if (unmatched.length) {
    console.log(`\n${unmatched.length} unmatched business(es) — scans cached but unlinked:`);
    for (const u of unmatched) console.log(`  - ${u}`);
  }

  // Upsert scans.
  const syncedAt = new Date().toISOString();
  let upserted = 0;
  for (const g of finished) {
    const clientId = mappings.get(g.location_id) ?? null;
    await upsertScan(g, clientId, syncedAt);
    upserted += 1;
  }
  console.log(`\n✓ Upserted ${upserted} finished scan(s) into geogrid_scans.`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('✗ Sync error:', err.message);
  process.exit(1);
});
