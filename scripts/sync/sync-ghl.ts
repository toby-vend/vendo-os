/**
 * Sync GHL pipelines and opportunities from all sub-accounts.
 *
 * Reads locations from the ghl_locations table (populated by discover-ghl-locations).
 * Falls back to GHL_LOCATION_ID env var if no locations table exists.
 *
 * Usage:
 *   npm run sync:ghl
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY!;

if (!API_KEY) {
  console.error('GHL_API_KEY must be set in .env.local');
  process.exit(1);
}

const headers: Record<string, string> = {
  'Authorization': `Bearer ${API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

async function ghlFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GHL ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json() as Promise<T>;
}

interface GhlStage {
  id: string;
  name: string;
  position: number;
}

interface GhlPipeline {
  id: string;
  name: string;
  locationId: string;
  stages: GhlStage[];
}

interface GhlContact {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  tags: string[];
}

interface GhlOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastStageChangeAt: string;
  contactId: string;
  contact: GhlContact;
}

async function fetchAllOpportunities(locationId: string, pipelineId: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfterId = '';
  let startAfter = '';

  while (true) {
    let url = `${BASE_URL}/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) {
      url += `&startAfterId=${startAfterId}&startAfter=${startAfter}`;
    }

    const data = await ghlFetch<{
      opportunities: GhlOpportunity[];
      meta: { startAfterId?: string; startAfter?: number; total: number };
    }>(url);

    all.push(...data.opportunities);

    if (!data.meta.startAfterId || data.opportunities.length === 0) break;
    startAfterId = data.meta.startAfterId;
    startAfter = String(data.meta.startAfter || '');
  }

  return all;
}

async function syncLocation(db: any, locationId: string, locationName: string, now: string): Promise<{ pipelines: number; opportunities: number }> {
  let totalPipelines = 0;
  let totalOpps = 0;

  try {
    const { pipelines } = await ghlFetch<{ pipelines: GhlPipeline[] }>(
      `/opportunities/pipelines?locationId=${locationId}`
    );

    for (const p of pipelines) {
      db.run(
        'INSERT OR REPLACE INTO ghl_pipelines (id, name, location_id, synced_at) VALUES (?, ?, ?, ?)',
        [p.id, p.name, p.locationId, now]
      );

      for (const s of p.stages) {
        db.run(
          'INSERT OR REPLACE INTO ghl_stages (id, pipeline_id, name, position, synced_at) VALUES (?, ?, ?, ?, ?)',
          [s.id, p.id, s.name, s.position, now]
        );
      }

      totalPipelines++;
    }

    for (const p of pipelines) {
      const opps = await fetchAllOpportunities(locationId, p.id);

      for (const o of opps) {
        db.run(`
          INSERT OR REPLACE INTO ghl_opportunities
          (id, name, monetary_value, pipeline_id, stage_id, status, source,
           contact_id, contact_name, contact_company, contact_email, contact_phone, contact_tags,
           created_at, updated_at, last_stage_change_at, location_id, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          o.id, o.name, o.monetaryValue || 0, o.pipelineId, o.pipelineStageId,
          o.status, o.source || null,
          o.contact?.id || null, o.contact?.name || null,
          o.contact?.companyName || null, o.contact?.email || null,
          o.contact?.phone || null, o.contact?.tags ? JSON.stringify(o.contact.tags) : null,
          o.createdAt, o.updatedAt, o.lastStageChangeAt || null, locationId, now,
        ]);
      }

      totalOpps += opps.length;
    }
  } catch (err: any) {
    // Log but don't fail the entire sync for one location
    logError('GHL', `  Failed to sync ${locationName} (${locationId}): ${err.message?.slice(0, 150)}`);
  }

  return { pipelines: totalPipelines, opportunities: totalOpps };
}

async function main() {
  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  // Add location_id column if missing
  try { db.run('ALTER TABLE ghl_opportunities ADD COLUMN location_id TEXT'); } catch { /* already exists */ }

  // Get locations: prefer ghl_locations table, fall back to env var
  let locations: { id: string; name: string }[] = [];

  try {
    const result = db.exec('SELECT id, name FROM ghl_locations ORDER BY name');
    if (result.length > 0) {
      locations = result[0].values.map((row: any) => ({ id: row[0] as string, name: row[1] as string }));
    }
  } catch {
    // Table doesn't exist
  }

  if (locations.length === 0) {
    const fallbackId = process.env.GHL_LOCATION_ID;
    if (!fallbackId) {
      console.error('No ghl_locations table and no GHL_LOCATION_ID set. Run discover-ghl-locations first.');
      process.exit(1);
    }
    locations = [{ id: fallbackId, name: 'Default Location' }];
    log('GHL', 'No ghl_locations table found, using GHL_LOCATION_ID fallback');
  }

  log('GHL', `Syncing ${locations.length} locations...`);

  let grandPipelines = 0;
  let grandOpps = 0;
  let successCount = 0;

  try {
    for (const loc of locations) {
      log('GHL', `[${loc.name}] Syncing...`);
      const { pipelines, opportunities } = await syncLocation(db, loc.id, loc.name, now);
      grandPipelines += pipelines;
      grandOpps += opportunities;
      if (pipelines > 0 || opportunities > 0) {
        log('GHL', `[${loc.name}] ${pipelines} pipelines, ${opportunities} opportunities`);
        successCount++;
      } else {
        log('GHL', `[${loc.name}] No data`);
      }

      // Save periodically to avoid losing progress
      if (successCount % 10 === 0) saveDb();
    }

    saveDb();
    log('GHL', `Sync complete: ${successCount}/${locations.length} locations, ${grandPipelines} pipelines, ${grandOpps} opportunities`);
  } catch (err) {
    logError('GHL', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
