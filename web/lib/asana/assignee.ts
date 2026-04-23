import { db } from '../queries/base.js';

/**
 * Shared Asana assignee resolution. Used by:
 *   - web/lib/jobs/sync-actions-to-asana.ts (Fathom action items)
 *   - web/lib/jobs/traffic-light.ts (client health alerts)
 *
 * Two responsibilities:
 *   1. Load a name/email/initials → Asana-user-gid map on first use, cached
 *      per container for 10 minutes.
 *   2. Resolve a client's AM, preferring the Deliverables module
 *      (client_service_configs) over the legacy clients.am column.
 */

const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || process.env.ASANA_WORKSPACE_ID || '';
const ASANA_API_KEY = process.env.ASANA_API_KEY || process.env.ASANA_PAT || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Only Asana users whose email sits in one of these domains can be assigned
 * auto-tasks. Guests / clients added to the Asana workspace must never be
 * picked up as an assignee by the sync pipeline. Mirrors
 * scripts/matching/team.ts' VENDO_TEAM_DOMAINS so there's one source of truth.
 */
const VENDO_EMAIL_DOMAINS = new Set([
  'vendodigital.co.uk',
  'vendodigital.com',
  'vendo.digital',
]);

export function isVendoEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  return VENDO_EMAIL_DOMAINS.has(email.slice(at + 1).toLowerCase().trim());
}

interface AsanaUser { gid: string; name: string; email?: string }

let _userMap: Map<string, string> | null = null;
let _loadedAt = 0;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z]+/g, '');
}

async function fetchAsanaUsers(): Promise<AsanaUser[]> {
  if (!ASANA_WORKSPACE_GID || !ASANA_API_KEY) return [];
  const res = await fetch(
    `${ASANA_BASE_URL}/users?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name,email`,
    { headers: { Authorization: `Bearer ${ASANA_API_KEY}` } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data: AsanaUser[] };
  return json.data || [];
}

async function buildUserMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const users = await fetchAsanaUsers();
  // Guests / clients in the workspace must not be picked up as assignees —
  // only include users whose email is a Vendo domain. A user with no email
  // exposed via the API is dropped to err on the side of safety.
  for (const u of users) {
    if (!isVendoEmail(u.email)) continue;
    const full = u.name.toLowerCase().trim();
    map.set(full, u.gid);
    map.set(norm(u.name), u.gid);
    const parts = u.name.split(/\s+/);
    if (parts[0]) map.set(parts[0].toLowerCase(), u.gid);
    if (parts.length > 1) map.set(parts[parts.length - 1].toLowerCase(), u.gid);
    if (u.email) map.set(u.email.toLowerCase(), u.gid);
  }

  // Enrich with deliverable_team_members — initials → name → GID
  try {
    const r = await db.execute(
      'SELECT initials, name FROM deliverable_team_members WHERE is_active = 1',
    );
    for (const row of r.rows) {
      const initials = (row.initials as string).toLowerCase();
      const name = (row.name as string).toLowerCase();
      const gid =
        map.get(name) ||
        map.get(norm(row.name as string)) ||
        map.get(name.split(/\s+/)[0]);
      if (gid) map.set(initials, gid);
    }
  } catch {
    /* table may not exist */
  }

  return map;
}

async function getUserMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (_userMap && now - _loadedAt < CACHE_TTL_MS) return _userMap;
  _userMap = await buildUserMap();
  _loadedAt = now;
  return _userMap;
}

/** Force a reload on next call. Used in tests. */
export function resetUserCache(): void {
  _userMap = null;
  _loadedAt = 0;
}

/**
 * Resolve a name or email to an Asana user GID. Tries multiple normalisations
 * (full name, first name, last name, email, normalised letters-only, initials).
 */
export async function resolveAssignee(nameOrInitials?: string, email?: string): Promise<string | undefined> {
  // Hard guard: if the caller supplied an email and it isn't on a Vendo
  // domain, refuse to resolve. Without this, a same-named external contact
  // could fall through to the name lookup and land on a Vendo staff member.
  if (email && !isVendoEmail(email)) return undefined;
  const map = await getUserMap();
  const candidates: string[] = [];
  if (email) candidates.push(email.toLowerCase().trim());
  if (nameOrInitials) {
    const trimmed = nameOrInitials.trim();
    candidates.push(trimmed.toLowerCase());
    candidates.push(norm(trimmed));
    const parts = trimmed.split(/\s+/);
    if (parts[0]) candidates.push(parts[0].toLowerCase());
    if (parts.length > 1) candidates.push(parts[parts.length - 1].toLowerCase());
  }
  for (const c of candidates) {
    if (!c) continue;
    const gid = map.get(c);
    if (gid) return gid;
  }
  return undefined;
}

/**
 * Resolve the AM name for a given client, preferring the Deliverables
 * module's client_service_configs (per-client, per-service AM) over the
 * legacy clients.am column. Returns the full name (or initials unresolved)
 * that can then be fed into resolveAssignee.
 */
export async function getClientAM(clientName: string | null): Promise<string | null> {
  if (!clientName) return null;

  // 1. Deliverables module — the live source of truth
  try {
    const r = await db.execute({
      sql: `SELECT am FROM client_service_configs
            WHERE client_name = ? AND status = 'active' AND am IS NOT NULL AND am != ''
            ORDER BY id DESC LIMIT 1`,
      args: [clientName],
    });
    const rawAm = r.rows[0]?.am as string | undefined;
    if (rawAm) {
      // Multi-person fields like "MP / SF" — pick the first
      const initials = rawAm.split(/[\/,]/)[0].trim().toUpperCase();
      if (initials) {
        const m = await db.execute({
          sql: 'SELECT name FROM deliverable_team_members WHERE UPPER(initials) = ? AND is_active = 1 LIMIT 1',
          args: [initials],
        });
        const name = m.rows[0]?.name as string | undefined;
        if (name) return name;
      }
      if (/[a-z]/.test(rawAm)) return rawAm;
    }
  } catch {
    /* table may not exist */
  }

  // 2. Legacy fallback — clients.am column
  try {
    const r = await db.execute({
      sql: `SELECT am FROM clients
            WHERE (name = ? OR display_name = ?) AND am IS NOT NULL LIMIT 1`,
      args: [clientName, clientName],
    });
    return (r.rows[0]?.am as string) || null;
  } catch {
    return null;
  }
}

/**
 * Convenience: resolve a client's AM all the way to an Asana GID.
 * Returns undefined if no AM is found or the AM can't be matched in Asana.
 */
export async function resolveClientAMGid(clientName: string | null): Promise<string | undefined> {
  const am = await getClientAM(clientName);
  if (!am) return undefined;
  return resolveAssignee(am);
}
