import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';
import { decryptToken } from '../crypto.js';

/**
 * Turso-native port of scripts/sync/sync-ghl.ts. Runs in-process on Vercel
 * serverless — no sql.js, no filesystem, no child process.
 *
 * Auth: per-location API keys already live in Turso (ghl_locations.api_key,
 * optionally encrypted with a v1: prefix). No token migration needed.
 *
 * Scope — parity with the original incremental sync:
 *   1. Per location, pull pipelines + stages → ghl_pipelines, ghl_stages
 *   2. Per pipeline, pull opportunities      → ghl_opportunities
 *   3. Per-location errors are isolated; the whole sync does not fail
 *      because one location's token is dead.
 */

const LOG = 'sync-ghl';
const BASE_URL = 'https://services.leadconnectorhq.com';

export interface GhlSyncResult {
  locations: number;
  successfulLocations: number;
  pipelines: number;
  opportunities: number;
  durationMs: number;
}

interface GhlStage { id: string; name: string; position: number }
interface GhlPipeline { id: string; name: string; locationId: string; stages: GhlStage[] }
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

function makeHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };
}

async function ghlFetch<T>(path: string, apiKey: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const resp = await fetch(url, { headers: makeHeaders(apiKey) });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GHL ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json() as Promise<T>;
}

async function fetchAllOpportunities(locationId: string, pipelineId: string, apiKey: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfterId = '';
  let startAfter = '';

  while (true) {
    let url = `${BASE_URL}/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) url += `&startAfterId=${startAfterId}&startAfter=${startAfter}`;

    const data = await ghlFetch<{
      opportunities: GhlOpportunity[];
      meta: { startAfterId?: string; startAfter?: number; total: number };
    }>(url, apiKey);

    all.push(...data.opportunities);
    if (!data.meta.startAfterId || data.opportunities.length === 0) break;
    startAfterId = data.meta.startAfterId;
    startAfter = String(data.meta.startAfter || '');
  }
  return all;
}

async function syncLocation(
  locationId: string,
  locationName: string,
  apiKey: string,
  now: string,
): Promise<{ pipelines: number; opportunities: number }> {
  const { pipelines } = await ghlFetch<{ pipelines: GhlPipeline[] }>(
    `/opportunities/pipelines?locationId=${locationId}`,
    apiKey,
  );

  // Pipelines + stages
  const pipelineBatch: Array<{ sql: string; args: (string | number | null)[] }> = [];
  for (const p of pipelines) {
    pipelineBatch.push({
      sql: 'INSERT OR REPLACE INTO ghl_pipelines (id, name, location_id, synced_at) VALUES (?, ?, ?, ?)',
      args: [p.id, p.name, p.locationId, now],
    });
    for (const s of p.stages) {
      pipelineBatch.push({
        sql: 'INSERT OR REPLACE INTO ghl_stages (id, pipeline_id, name, position, synced_at) VALUES (?, ?, ?, ?, ?)',
        args: [s.id, p.id, s.name, s.position, now],
      });
    }
  }
  if (pipelineBatch.length) await db.batch(pipelineBatch);

  // Opportunities
  let totalOpps = 0;
  for (const p of pipelines) {
    const opps = await fetchAllOpportunities(locationId, p.id, apiKey);
    if (!opps.length) continue;

    const oppBatch = opps.map(o => ({
      sql: `INSERT OR REPLACE INTO ghl_opportunities
            (id, name, monetary_value, pipeline_id, stage_id, status, source,
             contact_id, contact_name, contact_company, contact_email, contact_phone, contact_tags,
             created_at, updated_at, last_stage_change_at, location_id, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        o.id,
        o.name,
        o.monetaryValue || 0,
        o.pipelineId,
        o.pipelineStageId,
        o.status,
        o.source || null,
        o.contact?.id || null,
        o.contact?.name || null,
        o.contact?.companyName || null,
        o.contact?.email || null,
        o.contact?.phone || null,
        o.contact?.tags ? JSON.stringify(o.contact.tags) : null,
        o.createdAt,
        o.updatedAt,
        o.lastStageChangeAt || null,
        locationId,
        now,
      ] as (string | number | null)[],
    }));

    // Turso caps batch size; chunk conservatively
    const CHUNK = 50;
    for (let i = 0; i < oppBatch.length; i += CHUNK) {
      await db.batch(oppBatch.slice(i, i + CHUNK));
    }
    totalOpps += opps.length;
  }

  consoleLog(LOG, `[${locationName}] ${pipelines.length} pipelines, ${totalOpps} opportunities`);
  return { pipelines: pipelines.length, opportunities: totalOpps };
}

export async function syncGhl(): Promise<GhlSyncResult> {
  const start = Date.now();

  // Load locations with API keys from Turso
  const result = await db.execute(
    'SELECT id, name, api_key FROM ghl_locations WHERE api_key IS NOT NULL ORDER BY name',
  );
  if (!result.rows.length) {
    throw new Error('No GHL locations with API keys found in ghl_locations table');
  }

  const locations = result.rows.map(row => {
    const rawKey = row.api_key as string;
    const apiKey = rawKey.startsWith('v1:') ? decryptToken(rawKey) : rawKey;
    return { id: row.id as string, name: row.name as string, apiKey };
  });

  consoleLog(LOG, `Syncing ${locations.length} locations`);

  const now = new Date().toISOString();
  let grandPipelines = 0;
  let grandOpps = 0;
  let successful = 0;

  for (const loc of locations) {
    try {
      const { pipelines, opportunities } = await syncLocation(loc.id, loc.name, loc.apiKey, now);
      grandPipelines += pipelines;
      grandOpps += opportunities;
      if (pipelines > 0 || opportunities > 0) successful++;
    } catch (err) {
      consoleLog(LOG, `[${loc.name}] failed: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
    }
  }

  const durationMs = Date.now() - start;
  consoleLog(LOG, `Sync complete in ${durationMs}ms: ${successful}/${locations.length} locations, ${grandPipelines} pipelines, ${grandOpps} opportunities`);
  return {
    locations: locations.length,
    successfulLocations: successful,
    pipelines: grandPipelines,
    opportunities: grandOpps,
    durationMs,
  };
}
