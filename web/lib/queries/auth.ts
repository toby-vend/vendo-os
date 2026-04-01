import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'standard';
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelRow {
  id: string;
  slug: string;
  name: string;
}

export interface UserOAuthTokenRow {
  user_id: string;
  provider: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expiry: number;
  scopes: string;
  provider_email: string | null;
  provider_name: string | null;
  created_at: string;
  updated_at: string;
}

// --- Users ---

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const result = await rows<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  return result[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const result = await rows<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return result[0] ?? null;
}

export async function getAllUsers(): Promise<(UserRow & { channels: string; google_connected: number })[]> {
  return rows<UserRow & { channels: string; google_connected: number }>(`
    SELECT u.*,
           COALESCE(GROUP_CONCAT(c.name, ', '), '') as channels,
           COUNT(t.user_id) as google_connected
    FROM users u
    LEFT JOIN user_channels uc ON u.id = uc.user_id
    LEFT JOIN channels c ON uc.channel_id = c.id
    LEFT JOIN user_oauth_tokens t ON u.id = t.user_id AND t.provider = 'google'
    GROUP BY u.id
    ORDER BY u.name
  `);
}

export async function createUser(user: { id: string; email: string; name: string; passwordHash: string; role: string }): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO users (id, email, name, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    args: [user.id, user.email, user.name, user.passwordHash, user.role, now, now],
  });
}

export async function updateUser(id: string, data: { name?: string; role?: string; email?: string }): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (data.name) { sets.push('name = ?'); args.push(data.name); }
  if (data.role) { sets.push('role = ?'); args.push(data.role); }
  if (data.email) { sets.push('email = ?'); args.push(data.email); }
  sets.push('updated_at = ?'); args.push(new Date().toISOString());
  args.push(id);

  await db.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
}

export async function deleteUser(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

export async function updateUserPassword(id: string, passwordHash: string, mustChange: boolean): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?',
    args: [passwordHash, mustChange ? 1 : 0, new Date().toISOString(), id],
  });
}

// --- Channels ---

export async function getChannels(): Promise<ChannelRow[]> {
  return rows<ChannelRow>('SELECT * FROM channels ORDER BY name');
}

export async function getUserChannelSlugs(userId: string): Promise<string[]> {
  const result = await rows<{ slug: string }>(`
    SELECT c.slug FROM channels c
    JOIN user_channels uc ON c.id = uc.channel_id
    WHERE uc.user_id = ?
  `, [userId]);
  return result.map(r => r.slug);
}

export async function setUserChannels(userId: string, channelIds: string[]): Promise<void> {
  await db.execute({ sql: 'DELETE FROM user_channels WHERE user_id = ?', args: [userId] });
  for (const channelId of channelIds) {
    await db.execute({
      sql: 'INSERT INTO user_channels (user_id, channel_id) VALUES (?, ?)',
      args: [userId, channelId],
    });
  }
}

// --- Permissions ---

export async function getUserAllowedRoutes(userId: string): Promise<string[]> {
  const result = await rows<{ route_slug: string }>(`
    SELECT DISTINCT cp.route_slug
    FROM channel_permissions cp
    JOIN user_channels uc ON cp.channel_id = uc.channel_id
    WHERE uc.user_id = ?
  `, [userId]);
  return result.map(r => r.route_slug);
}

export async function getAllPermissions(): Promise<{ channel_id: string; route_slug: string }[]> {
  return rows<{ channel_id: string; route_slug: string }>('SELECT channel_id, route_slug FROM channel_permissions');
}

export async function setAllPermissions(permissions: { channelId: string; routeSlug: string }[]): Promise<void> {
  await db.execute({ sql: 'DELETE FROM channel_permissions', args: [] });
  for (const p of permissions) {
    await db.execute({
      sql: 'INSERT INTO channel_permissions (channel_id, route_slug) VALUES (?, ?)',
      args: [p.channelId, p.routeSlug],
    });
  }
}

// --- Schema init (for Turso production) ---

export async function initSchema(): Promise<void> {
  // Auth tables
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'standard',
    must_change_password INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS user_channels (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, channel_id)
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS channel_permissions (
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    route_slug TEXT NOT NULL,
    PRIMARY KEY (channel_id, route_slug)
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS user_oauth_tokens (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    token_expiry INTEGER NOT NULL,
    scopes TEXT NOT NULL,
    provider_email TEXT,
    provider_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, provider)
  )`, args: [] });

  // Skills tables
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY,
    drive_file_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    channel TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    drive_modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  )`, args: [] });

  // FTS5 virtual table for skills full-text search (Turso/libsql only — NOT sql.js)
  await db.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    title,
    content,
    content='skills',
    tokenize='unicode61'
  )`, args: [] });

  // Brand hub table
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS brand_hub (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    drive_file_id TEXT,
    drive_modified_at TEXT,
    indexed_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_brand_hub_client ON brand_hub(client_id)`, args: [] });

  // Drive watch channels table
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS drive_watch_channels (
    id INTEGER PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    resource_id TEXT NOT NULL,
    expiration INTEGER NOT NULL,
    page_token TEXT,
    created_at TEXT NOT NULL,
    renewed_at TEXT
  )`, args: [] });

  // Migrate: add user_id column to drive_watch_channels if upgrading from old schema
  try {
    await db.execute({ sql: 'ALTER TABLE drive_watch_channels ADD COLUMN user_id TEXT', args: [] });
  } catch { /* already exists */ }

  // Drive sync queue table
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS drive_sync_queue (
    id INTEGER PRIMARY KEY,
    channel_id TEXT NOT NULL,
    resource_state TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processed_at TEXT,
    error TEXT
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_dsq_unprocessed ON drive_sync_queue(processed_at) WHERE processed_at IS NULL`, args: [] });

  // Task runs table
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS task_runs (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL,
    channel TEXT NOT NULL,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    sops_used TEXT,
    brand_context_id INTEGER,
    output TEXT,
    qa_score REAL,
    qa_critique TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_client ON task_runs(client_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_created ON task_runs(created_at)`, args: [] });

  // Asana tasks
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS asana_tasks (
    gid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    assignee_gid TEXT,
    assignee_name TEXT,
    due_on TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    section_name TEXT,
    project_gid TEXT,
    project_name TEXT,
    notes TEXT,
    permalink_url TEXT,
    created_at TEXT,
    modified_at TEXT,
    synced_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_asana_tasks_assignee ON asana_tasks(assignee_name)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_asana_tasks_due ON asana_tasks(due_on)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_asana_tasks_completed ON asana_tasks(completed)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_asana_tasks_project ON asana_tasks(project_gid)`, args: [] });
}

/** @deprecated Use initSchema instead */
export const initAuthSchema = initSchema;

// --- OAuth Tokens ---

export async function getUserOAuthToken(userId: string, provider = 'google'): Promise<UserOAuthTokenRow | null> {
  const result = await rows<UserOAuthTokenRow>(
    'SELECT * FROM user_oauth_tokens WHERE user_id = ? AND provider = ?', [userId, provider]
  );
  return result[0] ?? null;
}

export async function hasUserOAuthToken(userId: string, provider = 'google'): Promise<boolean> {
  const count = await scalar('SELECT COUNT(*) FROM user_oauth_tokens WHERE user_id = ? AND provider = ?', [userId, provider]);
  return (count as number) > 0;
}

export async function upsertUserOAuthToken(data: {
  userId: string;
  provider: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiry: number;
  scopes: string;
  providerEmail?: string;
  providerName?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO user_oauth_tokens (user_id, provider, access_token_enc, refresh_token_enc, token_expiry, scopes, provider_email, provider_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, provider) DO UPDATE SET
            access_token_enc = excluded.access_token_enc,
            refresh_token_enc = excluded.refresh_token_enc,
            token_expiry = excluded.token_expiry,
            scopes = excluded.scopes,
            provider_email = excluded.provider_email,
            provider_name = excluded.provider_name,
            updated_at = excluded.updated_at`,
    args: [data.userId, data.provider, data.accessTokenEnc, data.refreshTokenEnc, data.tokenExpiry, data.scopes, data.providerEmail ?? null, data.providerName ?? null, now, now],
  });
}

export async function updateUserOAuthAccessToken(userId: string, provider: string, accessTokenEnc: string, tokenExpiry: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE user_oauth_tokens SET access_token_enc = ?, token_expiry = ?, updated_at = ? WHERE user_id = ? AND provider = ?',
    args: [accessTokenEnc, tokenExpiry, new Date().toISOString(), userId, provider],
  });
}

export async function deleteUserOAuthToken(userId: string, provider = 'google'): Promise<void> {
  await db.execute({ sql: 'DELETE FROM user_oauth_tokens WHERE user_id = ? AND provider = ?', args: [userId, provider] });
}
