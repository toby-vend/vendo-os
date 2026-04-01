/**
 * Sync GHL pipelines and opportunities into local SQLite database.
 *
 * Usage:
 *   npm run sync:ghl
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;

if (!API_KEY || !LOCATION_ID) {
  console.error('GHL_API_KEY and GHL_LOCATION_ID must be set in .env.local');
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

async function fetchAllOpportunities(pipelineId: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfterId = '';
  let startAfter = '';

  while (true) {
    let url = `${BASE_URL}/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) {
      url += `&startAfterId=${startAfterId}&startAfter=${startAfter}`;
    }

    const data = await ghlFetch<{
      opportunities: GhlOpportunity[];
      meta: { startAfterId?: string; startAfter?: number; total: number };
    }>(url);

    all.push(...data.opportunities);
    log('GHL', `  Fetched ${all.length}/${data.meta.total} opportunities`);

    if (!data.meta.startAfterId || data.opportunities.length === 0) break;
    startAfterId = data.meta.startAfterId;
    startAfter = String(data.meta.startAfter || '');
  }

  return all;
}

async function main() {
  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  try {
    // 1. Fetch pipelines
    log('GHL', 'Fetching pipelines...');
    const { pipelines } = await ghlFetch<{ pipelines: GhlPipeline[] }>(
      `/opportunities/pipelines?locationId=${LOCATION_ID}`
    );

    // Upsert pipelines and stages
    for (const p of pipelines) {
      db.run(
        'INSERT OR REPLACE INTO ghl_pipelines (id, name, location_id, synced_at) VALUES (?, ?, ?, ?)',
        [p.id, p.name, p.locationId, now]
      );
      log('GHL', `Pipeline: ${p.name} (${p.stages.length} stages)`);

      for (const s of p.stages) {
        db.run(
          'INSERT OR REPLACE INTO ghl_stages (id, pipeline_id, name, position, synced_at) VALUES (?, ?, ?, ?, ?)',
          [s.id, p.id, s.name, s.position, now]
        );
      }
    }

    // 2. Fetch opportunities from all pipelines
    let totalOpps = 0;
    for (const p of pipelines) {
      log('GHL', `Fetching opportunities for ${p.name}...`);
      const opps = await fetchAllOpportunities(p.id);

      for (const o of opps) {
        db.run(`
          INSERT OR REPLACE INTO ghl_opportunities
          (id, name, monetary_value, pipeline_id, stage_id, status, source,
           contact_id, contact_name, contact_company, contact_email, contact_phone, contact_tags,
           created_at, updated_at, last_stage_change_at, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          o.id, o.name, o.monetaryValue || 0, o.pipelineId, o.pipelineStageId,
          o.status, o.source || null,
          o.contact?.id || null, o.contact?.name || null,
          o.contact?.companyName || null, o.contact?.email || null,
          o.contact?.phone || null, o.contact?.tags ? JSON.stringify(o.contact.tags) : null,
          o.createdAt, o.updatedAt, o.lastStageChangeAt || null, now,
        ]);
      }

      totalOpps += opps.length;
      log('GHL', `  Saved ${opps.length} opportunities from ${p.name}`);
    }

    saveDb();
    log('GHL', `Sync complete: ${pipelines.length} pipelines, ${totalOpps} opportunities`);
  } catch (err) {
    logError('GHL', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
