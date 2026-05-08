/**
 * Push VendoOS clients → ClientDashboard (Supabase) organisations.
 *
 * One-way bridge. Idempotent. Keyed on organisations.external_vendo_id =
 * VendoOS clients.id. See plans/2026-05-08-clientdashboard-integration.md and
 * plans/2026-05-08-clientdashboard-schema-delta.md for the full design.
 *
 * Usage:
 *   npm run sync:portal -- --dry-run        # plan only, no writes
 *   npm run sync:portal                      # live run, all clients
 *   npm run sync:portal -- --client 42       # single VendoOS client id
 *
 * Required env (in .env.local):
 *   PORTAL_SUPABASE_URL                      # https://<ref>.supabase.co
 *   PORTAL_SUPABASE_SERVICE_ROLE_KEY         # service_role secret
 *   TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN   # already used by VendoOS
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { rows } from '../../web/lib/queries/base.js';

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

const DRY_RUN = process.argv.includes('--dry-run');
const CLIENT_FLAG = process.argv.indexOf('--client');
const SINGLE_CLIENT_ID =
  CLIENT_FLAG > -1 && process.argv[CLIENT_FLAG + 1]
    ? Number(process.argv[CLIENT_FLAG + 1])
    : null;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
  return value;
}

/**
 * Slugify a client name. Lowercase, hyphenated, ASCII only.
 * Collisions are resolved by the caller appending the external_vendo_id.
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
 * Falls back to 'other' with a stderr warning.
 */
function resolveVerticalSlug(raw: string | null): string {
  if (!raw) return 'other';
  const v = raw.toLowerCase().trim();
  if (v.includes('dental') || v.includes('dentist')) return 'dental';
  if (v.includes('ecom') || v.includes('e-com') || v.includes('shopify') || v.includes('retail'))
    return 'ecom';
  if (v.includes('plant') || v.includes('hire')) return 'plant-hire';
  console.warn(`  ! unmapped vertical "${raw}" → defaulting to "other"`);
  return 'other';
}

async function fetchVendoClients(): Promise<VendoClient[]> {
  const sql = SINGLE_CLIENT_ID
    ? 'SELECT id, name, display_name, email, vertical, status FROM clients WHERE id = ?'
    : 'SELECT id, name, display_name, email, vertical, status FROM clients ORDER BY id';
  const args = SINGLE_CLIENT_ID ? [SINGLE_CLIENT_ID] : [];
  return rows<VendoClient>(sql, args);
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnv('PORTAL_SUPABASE_URL');
  const supabaseKey = requireEnv('PORTAL_SUPABASE_SERVICE_ROLE_KEY');

  const portal = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`push-clients-to-portal: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SINGLE_CLIENT_ID ? ` (client ${SINGLE_CLIENT_ID})` : ''}`);

  // 1. Load vertical slug → uuid map from CD
  const { data: verticals, error: vErr } = await portal
    .from('verticals')
    .select('id, slug')
    .returns<VerticalRow[]>();
  if (vErr) {
    console.error('Failed to load verticals from portal:', vErr.message);
    process.exit(1);
  }
  const verticalIdBySlug = new Map(verticals?.map((v) => [v.slug, v.id]) ?? []);
  for (const required of ['dental', 'ecom', 'plant-hire', 'other']) {
    if (!verticalIdBySlug.has(required)) {
      console.error(`Portal verticals table missing required slug "${required}". Apply migration 00016_external_bridge.sql first.`);
      process.exit(1);
    }
  }

  // 2. Load existing org slugs to detect collisions
  const { data: existing, error: oErr } = await portal
    .from('organisations')
    .select('slug, external_vendo_id')
    .returns<{ slug: string; external_vendo_id: number | null }[]>();
  if (oErr) {
    console.error('Failed to load organisations:', oErr.message);
    process.exit(1);
  }
  const slugToVendoId = new Map(existing?.map((o) => [o.slug, o.external_vendo_id]) ?? []);

  // 3. Fetch VendoOS clients
  const clients = await fetchVendoClients();
  console.log(`  loaded ${clients.length} client(s) from VendoOS`);

  const upserts: OrgUpsert[] = [];
  let collisions = 0;

  for (const c of clients) {
    const displayName = c.display_name?.trim() || c.name.trim();
    let slug = slugify(displayName);
    if (!slug) {
      console.warn(`  ! client ${c.id} (${c.name}) produced empty slug; skipping`);
      continue;
    }

    // Slug collision: existing org with this slug belongs to a different vendo client
    const owner = slugToVendoId.get(slug);
    if (owner !== undefined && owner !== c.id) {
      const suffixed = `${slug}-${c.id}`;
      console.warn(`  ! slug collision "${slug}" (owned by vendo_id=${owner}) — using "${suffixed}" for client ${c.id}`);
      slug = suffixed;
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

  console.log(`  prepared ${upserts.length} upsert(s) (${collisions} slug collision(s) resolved)`);

  if (DRY_RUN) {
    console.log('  --dry-run set; no writes performed');
    if (upserts.length > 0) {
      console.log(`  sample row:`, upserts[0]);
    }
    process.exit(0);
  }

  // 4. Upsert in chunks (Supabase REST has a request size limit)
  const CHUNK = 50;
  let written = 0;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const chunk = upserts.slice(i, i + CHUNK);
    const { error: upErr, count } = await portal
      .from('organisations')
      .upsert(chunk, { onConflict: 'external_vendo_id', count: 'exact' });
    if (upErr) {
      console.error(`  upsert chunk ${i}-${i + chunk.length} failed:`, upErr.message);
      process.exit(1);
    }
    written += count ?? chunk.length;
    console.log(`  upserted chunk ${i + 1}-${i + chunk.length}`);
  }

  console.log(`  done: ${written} row(s) written to organisations`);
}

main().catch((err: Error) => {
  console.error('push-clients-to-portal failed:', err.message);
  process.exit(1);
});
