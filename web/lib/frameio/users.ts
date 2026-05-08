import { db } from '../queries/base.js';
import { getUser, FrameioApiError } from './client.js';

/**
 * Frame.io user resolver + cache.
 *
 * The webhook envelope only includes `user.id`. Phase 3 needs to know
 * (a) the user's email so we can post a useful Slack alert and
 * (b) whether the user is internal (Vendo team) or external (client).
 *
 * We cache aggressively — Frame.io users rarely change and a hot project
 * can fire dozens of comments from the same person. The cache is bounded
 * by Frame.io's 100 req/min/user rate limit anyway.
 *
 * Internal heuristic: an email matching one of FRAMEIO_INTERNAL_DOMAINS
 * (default: `vendodigital.co.uk`) is treated as internal. Set the env var
 * to a comma-separated list to add domains.
 */

const DEFAULT_INTERNAL_DOMAINS = ['vendodigital.co.uk'];
let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_users (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      is_external INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT NOT NULL
    )
  `);
  schemaEnsured = true;
}

function internalDomains(): string[] {
  const v = process.env.FRAMEIO_INTERNAL_DOMAINS;
  if (!v) return DEFAULT_INTERNAL_DOMAINS;
  return v.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function isEmailInternal(email: string | null): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return internalDomains().includes(domain);
}

export interface ResolvedUser {
  userId: string;
  email: string | null;
  name: string | null;
  isExternal: boolean;
}

export async function resolveUser(opts: {
  accountId: string;
  userId: string;
}): Promise<ResolvedUser | null> {
  await ensureSchema();

  // Cache hit?
  const cached = await db.execute({
    sql: 'SELECT email, name, is_external FROM frameio_users WHERE user_id = ?',
    args: [opts.userId],
  });
  if (cached.rows.length > 0) {
    const row = cached.rows[0] as unknown as { email: string | null; name: string | null; is_external: number };
    return {
      userId: opts.userId,
      email: row.email,
      name: row.name,
      isExternal: row.is_external !== 0,
    };
  }

  // Miss — fetch from Frame.io.
  let user;
  try {
    user = await getUser(opts.accountId, opts.userId);
  } catch (err) {
    // Auth / network errors bubble up; 404 returns null. We don't cache
    // negatives — the user may exist, we just couldn't reach the API.
    if (err instanceof FrameioApiError && err.isAuthError) throw err;
    return null;
  }
  if (!user) return null;

  const isExternal = !isEmailInternal(user.email);
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO frameio_users (user_id, email, name, is_external, last_fetched_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            name = excluded.name,
            is_external = excluded.is_external,
            last_fetched_at = excluded.last_fetched_at`,
    args: [opts.userId, user.email, user.name, isExternal ? 1 : 0, now],
  });
  return { userId: opts.userId, email: user.email, name: user.name, isExternal };
}
