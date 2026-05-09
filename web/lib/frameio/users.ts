import { db } from '../queries/base.js';
import { listAccountUsers, FrameioApiError } from './client.js';

/**
 * Frame.io user resolver + cache.
 *
 * Frame.io's V4 API has no get-user-by-id endpoint, so we fetch the entire
 * account-users list (paginated) and cache it. A user appears in the list
 * iff they're a *member* of the Frame.io account (Vendo team). Clients who
 * comment via review-share links don't show up there — for those we get
 * `null` and treat them as external by default.
 *
 * Classification (in priority order):
 *   1. FRAMEIO_FORCE_ALL_EXTERNAL=true       → always external (test toggle)
 *   2. account-user with role=member|owner|admin
 *      AND email domain ∈ internal-domain set → internal
 *   3. anything else                          → external
 *
 * Internal-domain set:
 *   - default: 'vendodigital.co.uk', 'vendo.co.uk'
 *   - override via FRAMEIO_INTERNAL_DOMAINS=a.com,b.com (replaces default)
 *
 * Cache TTL: account-user list is refreshed if older than ACCOUNT_USERS_TTL_MS.
 * Per-user resolutions cache to `frameio_users` for fast subsequent lookups.
 */

const DEFAULT_INTERNAL_DOMAINS = ['vendodigital.co.uk', 'vendo.co.uk'];
const INTERNAL_ROLES = new Set(['member', 'owner', 'admin']);
const ACCOUNT_USERS_TTL_MS = 30 * 60 * 1000;     // 30 min
const PER_USER_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_users (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      role TEXT,
      is_external INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT NOT NULL
    )
  `);
  // Migration: add `role` column to existing tables (ignored if it exists).
  try { await db.execute('ALTER TABLE frameio_users ADD COLUMN role TEXT'); } catch { /* exists */ }
  schemaEnsured = true;
}

function internalDomains(): string[] {
  const v = process.env.FRAMEIO_INTERNAL_DOMAINS;
  if (!v) return DEFAULT_INTERNAL_DOMAINS;
  return v.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function forceAllExternal(): boolean {
  const v = process.env.FRAMEIO_FORCE_ALL_EXTERNAL;
  return v === 'true' || v === '1';
}

function isEmailInternal(email: string | null): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return internalDomains().includes(domain);
}

function classify(role: string | null, email: string | null): boolean {
  if (forceAllExternal()) return true;
  const roleInternal = role ? INTERNAL_ROLES.has(role) : false;
  // Internal iff *both* role AND domain say so. This avoids two failure
  // modes:
  //   - A Vendo person added to the Frame.io team using a Gmail address →
  //     role says member but email doesn't match → external (safer).
  //   - A guest commenter who happens to have a vendo.co.uk address →
  //     no role match → external (safer).
  return !(roleInternal && isEmailInternal(email));
}

export interface ResolvedUser {
  userId: string;
  email: string | null;
  name: string | null;
  role: string | null;
  isExternal: boolean;
}

interface CachedRow {
  email: string | null;
  name: string | null;
  role: string | null;
  is_external: number;
  last_fetched_at: string;
}

async function loadFromCache(userId: string): Promise<ResolvedUser | null> {
  const cached = await db.execute({
    sql: 'SELECT email, name, role, is_external, last_fetched_at FROM frameio_users WHERE user_id = ?',
    args: [userId],
  });
  if (cached.rows.length === 0) return null;
  const row = cached.rows[0] as unknown as CachedRow;
  const age = Date.now() - new Date(row.last_fetched_at).getTime();
  if (age > PER_USER_CACHE_TTL_MS) return null;
  return {
    userId,
    email: row.email,
    name: row.name,
    role: row.role,
    isExternal: row.is_external !== 0,
  };
}

async function persist(user: ResolvedUser): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO frameio_users (user_id, email, name, role, is_external, last_fetched_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            name = excluded.name,
            role = excluded.role,
            is_external = excluded.is_external,
            last_fetched_at = excluded.last_fetched_at`,
    args: [user.userId, user.email, user.name, user.role, user.isExternal ? 1 : 0, now],
  });
}

// In-memory cache of account-users to avoid hammering the list endpoint
// every webhook fan-out. Refreshed at TTL.
const accountListCache = new Map<string, { fetchedAtMs: number; entries: Awaited<ReturnType<typeof listAccountUsers>> }>();

async function loadAccountUsers(accountId: string): Promise<Awaited<ReturnType<typeof listAccountUsers>>> {
  const cached = accountListCache.get(accountId);
  if (cached && Date.now() - cached.fetchedAtMs < ACCOUNT_USERS_TTL_MS) return cached.entries;
  const entries = await listAccountUsers(accountId);
  accountListCache.set(accountId, { fetchedAtMs: Date.now(), entries });
  return entries;
}

export async function resolveUser(opts: {
  accountId: string;
  userId: string;
}): Promise<ResolvedUser | null> {
  await ensureSchema();

  // 1. DB cache hit (within TTL)
  const fromDb = await loadFromCache(opts.userId);
  if (fromDb) {
    // Re-classify on every lookup so env-var overrides take effect without
    // needing to flush the cache. Cheap (no I/O).
    const reclassified = classify(fromDb.role, fromDb.email);
    return { ...fromDb, isExternal: reclassified };
  }

  // 2. Look in the account-users list (in-memory cached, refreshed at TTL)
  let entries: Awaited<ReturnType<typeof listAccountUsers>>;
  try {
    entries = await loadAccountUsers(opts.accountId);
  } catch (err) {
    if (err instanceof FrameioApiError && err.isAuthError) throw err;
    // List endpoint failed transiently — surface null so caller can decide.
    return null;
  }

  const found = entries.find((e) => e.user.id === opts.userId);
  let role: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  if (found) {
    role = found.role;
    email = found.user.email;
    name = found.user.name;
  } else {
    // User isn't a member of the account — guest commenter via review link.
    // We have no way to fetch their email; classification falls through to
    // 'external' (correct default) and Slack alert may show 'unknown
    // reviewer' as the author label.
    role = null;
    email = null;
    name = null;
  }

  const isExternal = classify(role, email);
  const resolved: ResolvedUser = { userId: opts.userId, email, name, role, isExternal };
  await persist(resolved);
  return resolved;
}

/** Force the next resolution to bypass the DB cache. Used by /admin/* tools. */
export async function flushUserCache(userId?: string): Promise<void> {
  await ensureSchema();
  if (userId) {
    await db.execute({ sql: 'DELETE FROM frameio_users WHERE user_id = ?', args: [userId] });
  } else {
    await db.execute('DELETE FROM frameio_users');
  }
  accountListCache.clear();
}
