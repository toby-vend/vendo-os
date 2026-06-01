/**
 * Create geogrid_scans table.
 *
 * Local SEO "geo grid" rank tracking. We pull finished scans from Local
 * Viking (https://api.localviking.com/geogrids) and cache them here, keyed
 * to a Vendo client via client_source_mappings(source='localviking').
 *
 * Each row is one scan of one keyword for one location: an NxN matrix of
 * Google Maps ranks across a grid centred on the business, plus the three
 * headline metrics Local Viking computes — AGR (average grid rank), ATGR
 * (average *total* grid rank, counts not-found nodes), and SoLV (Share of
 * Local Voice, 0-1).
 *
 * The raw rank matrix is stored as JSON in `ranks_json` (values are the
 * rank string per node, "X" = not in the top 20). The aggregator parses it.
 *
 * See plans/2026-06-01-geogrid-integration.md.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-06-01-geogrid.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS geogrid_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    provider TEXT NOT NULL DEFAULT 'localviking',
    external_id TEXT NOT NULL,            -- provider scan id (e.g. LV 'zdr90w9e')
    location_id TEXT,                     -- provider location id
    business_name TEXT,
    business_place_id TEXT,
    search_term TEXT NOT NULL,
    grid_size INTEGER NOT NULL,           -- N for an NxN grid
    grid_point_distance REAL,             -- spacing between nodes
    grid_distance_measure TEXT,           -- 'miles' | 'meters'
    grid_center_lat REAL,
    grid_center_lng REAL,
    agr REAL,                             -- average grid rank
    atgr REAL,                            -- average total grid rank
    solv REAL,                            -- share of local voice (0-1)
    ranks_json TEXT NOT NULL,             -- NxN matrix of rank strings ("X" = >20)
    state TEXT,                           -- 'finished' | 'processing' | ...
    scanned_at TEXT,                      -- finished_at, else created_at (ISO)
    created_at TEXT NOT NULL,             -- provider created_at (ISO)
    synced_at TEXT NOT NULL,              -- when we last pulled it (ISO)
    UNIQUE(provider, external_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_geogrid_client_term
     ON geogrid_scans(client_id, search_term, scanned_at)`,
  `CREATE INDEX IF NOT EXISTS idx_geogrid_client_scanned
     ON geogrid_scans(client_id, scanned_at)`,
  `CREATE INDEX IF NOT EXISTS idx_geogrid_location
     ON geogrid_scans(location_id)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running geogrid migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ geogrid_scans created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
