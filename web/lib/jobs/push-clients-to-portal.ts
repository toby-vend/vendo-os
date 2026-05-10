/**
 * Bridge sync: VendoOS Turso `clients` -> ClientDashboard Postgres `organisations`.
 *
 * Idempotent. Keyed on `organisations.external_vendo_id`. Used by:
 *   - scripts/sync/push-clients-to-portal.ts (CLI: npm run sync:portal)
 *   - web/routes/api/cron.ts (Vercel cron: /api/cron/push-clients-to-portal)
 *
 * See plans/2026-05-08-clientdashboard-integration.md for the design.
 */
import { createClient } from '@supabase/supabase-js';
import { rows } from '../queries/base.js';

interface VendoClient {
  id: number;
  name: string;
  display_name: string | null;
  email: string | null;
  vertical: string | null;
  status: string | null;
}

interface VerticalRow {
  id: string;
  slug: string;
}

interface OrgUpsert {
  external_vendo_id: number;
  name: string;
  slug: string;
  vertical_id: string | null;
  contact_email: string | null;
  archived_at: string | null;
  updated_at: string;
}

export interface PushClientsResult {
  dryRun: boolean;
  loaded: number;
  prepared: number;
  written: number;
  collisions: number;
  warnings: string[];
  sample: OrgUpsert | null;
}

/**
 * Slugify a client name. Lowercase, hyphenated, ASCII only.
 * Collisions are resolved by suffixing with the external_vendo_id.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Map free-text VendoOS vertical → CD vertical slug.
 * Falls back to 'other' for anything we don't recognise.
 */
function resolveVerticalSlug(raw: string | null): string {
  if (!raw) return 'other';
  const v = raw.toLowerCase().trim();
  if (v.includes('dental') || v.includes('dentist')) return 'dental';
  if (v.includes('ecom') || v.includes('e-com') || v.includes('shopify') || v.includes('retail')) {
    return 'ecom';
  }
  if (v.includes('plant') || v.includes('hire')) return 'plant-hire';
  return 'other';
}

async function fetchVendoClients(singleClientId: number | null): Promise<VendoClient[]> {
  const sql = singleClientId
    ? 'SELECT id, name, display_name, email, vertical, status FROM clients WHERE id = ?'
    : 'SELECT id, name, display_name, email, vertical, status FROM clients ORDER BY id';
  const args = singleClientId ? [singleClientId] : [];
  return rows<VendoClient>(sql, args);
}

export async function pushClientsToPortal(
  opts: { dryRun?: boolean; singleClientId?: number | null } = {},
): Promise<PushClientsResult> {
  const dryRun = opts.dryRun ?? false;
  const singleClientId = opts.singleClientId ?? null;
  const warnings: string[] = [];

  const supabaseUrl = process.env.PORTAL_SUPABASE_URL;
  const supabaseKey = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing PORTAL_SUPABASE_URL or PORTAL_SUPABASE_SERVICE_ROLE_KEY');
  }

  const portal = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 1. Load vertical slug → uuid map
  const { data: verticals, error: vErr } = await portal
    .from('verticals')
    .select('id, slug')
    .returns<VerticalRow[]>();
  if (vErr) throw new Error(`load verticals: ${vErr.message}`);

  const verticalIdBySlug = new Map(verticals?.map((v) => [v.slug, v.id]) ?? []);
  for (const required of ['dental', 'ecom', 'plant-hire', 'other']) {
    if (!verticalIdBySlug.has(required)) {
      throw new Error(
        `Portal verticals table missing required slug "${required}" — apply 00016_external_bridge.sql`,
      );
    }
  }

  // 2. Load existing org slugs to detect collisions
  const { data: existing, error: oErr } = await portal
    .from('organisations')
    .select('slug, external_vendo_id')
    .returns<{ slug: string; external_vendo_id: number | null }[]>();
  if (oErr) throw new Error(`load organisations: ${oErr.message}`);

  const slugToVendoId = new Map(existing?.map((o) => [o.slug, o.external_vendo_id]) ?? []);

  // 3. Fetch VendoOS clients
  const clients = await fetchVendoClients(singleClientId);

  const upserts: OrgUpsert[] = [];
  let collisions = 0;

  for (const c of clients) {
    const displayName = c.display_name?.trim() || c.name.trim();
    let slug = slugify(displayName);
    if (!slug) {
      warnings.push(`client ${c.id} (${c.name}) produced empty slug; skipping`);
      continue;
    }

    const owner = slugToVendoId.get(slug);
    if (owner !== undefined && owner !== c.id) {
      slug = `${slug}-${c.id}`;
      collisions++;
    }

    const verticalSlug = resolveVerticalSlug(c.vertical);
    const verticalId = verticalIdBySlug.get(verticalSlug) ?? null;
    const archivedAt =
      c.status && c.status.toLowerCase() !== 'active' ? new Date().toISOString() : null;

    upserts.push({
      external_vendo_id: c.id,
      name: displayName,
      slug,
      vertical_id: verticalId,
      contact_email: c.email,
      archived_at: archivedAt,
      updated_at: new Date().toISOString(),
    });
  }

  if (dryRun) {
    return {
      dryRun: true,
      loaded: clients.length,
      prepared: upserts.length,
      written: 0,
      collisions,
      warnings,
      sample: upserts[0] ?? null,
    };
  }

  // 4. Upsert in chunks
  const CHUNK = 50;
  let written = 0;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const chunk = upserts.slice(i, i + CHUNK);
    const { error: upErr, count } = await portal
      .from('organisations')
      .upsert(chunk, { onConflict: 'external_vendo_id', count: 'exact' });
    if (upErr) throw new Error(`upsert chunk ${i}-${i + chunk.length}: ${upErr.message}`);
    written += count ?? chunk.length;
  }

  return {
    dryRun: false,
    loaded: clients.length,
    prepared: upserts.length,
    written,
    collisions,
    warnings,
    sample: upserts[0] ?? null,
  };
}
