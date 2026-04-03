import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: 'admin' | 'standard' | 'client';
  must_change_password: number;
  created_at: string;
  updated_at: string;
}

export interface ClientUserMapRow {
  user_id: string;
  client_id: number;
  client_name: string;
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

// --- Client-user mapping ---

export async function getClientForUser(userId: string): Promise<ClientUserMapRow | null> {
  const result = await rows<ClientUserMapRow>(
    'SELECT user_id, client_id, client_name FROM client_user_map WHERE user_id = ?',
    [userId],
  );
  return result[0] ?? null;
}

export async function getAllPortalUsers(): Promise<(UserRow & { client_id: number | null; client_name: string | null })[]> {
  return rows<UserRow & { client_id: number | null; client_name: string | null }>(`
    SELECT u.*, cum.client_id, cum.client_name
    FROM users u
    LEFT JOIN client_user_map cum ON u.id = cum.user_id
    WHERE u.role = 'client'
    ORDER BY u.name
  `);
}

export async function createPortalUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  clientId: number;
  clientName: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO users (id, email, name, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    args: [user.id, user.email, user.name, user.passwordHash, 'client', now, now],
  });
  await db.execute({
    sql: 'INSERT INTO client_user_map (user_id, client_id, client_name) VALUES (?, ?, ?)',
    args: [user.id, user.clientId, user.clientName],
  });
}

export async function deletePortalUser(userId: string): Promise<void> {
  // client_user_map has ON DELETE CASCADE, but delete explicitly for clarity
  await db.execute({ sql: 'DELETE FROM client_user_map WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ? AND role = ?', args: [userId, 'client'] });
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

  await db.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_drive_file ON skills(drive_file_id) WHERE drive_file_id IS NOT NULL`, args: [] });

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

  // Migrate: add title column to brand_hub if upgrading from old schema
  try {
    await db.execute({ sql: `ALTER TABLE brand_hub ADD COLUMN title TEXT NOT NULL DEFAULT ''`, args: [] });
  } catch { /* already exists */ }

  // UNIQUE index required for ON CONFLICT(drive_file_id) upsert
  await db.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_hub_drive_file ON brand_hub(drive_file_id)`, args: [] });

  // FTS5 virtual table for brand hub full-text search (Turso/libsql only — NOT sql.js)
  await db.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS brand_hub_fts USING fts5(
    client_name,
    content,
    content='brand_hub',
    tokenize='unicode61'
  )`, args: [] });

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

  // AUDT-03: Attempt database-level append-only enforcement.
  // Turso/libsql hosted environment may not support CREATE TRIGGER DDL.
  // If it fails, the application-layer policy (no DELETE export in task-runs.ts) is the enforcer.
  try {
    await db.execute({
      sql: `CREATE TRIGGER IF NOT EXISTS prevent_task_run_delete
            BEFORE DELETE ON task_runs
            BEGIN
              SELECT RAISE(ABORT, 'task_runs is append-only — deletions are prohibited (AUDT-03)');
            END`,
      args: [],
    });
  } catch {
    // Turso/libsql does not support triggers — append-only enforced at application layer.
    // See web/lib/queries/task-runs.ts module header comment.
  }

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

  // API usage tracking
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    model TEXT NOT NULL,
    feature TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at)`, args: [] });

  // Per-user token limits
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS user_token_limits (
    user_id TEXT PRIMARY KEY,
    monthly_token_limit INTEGER,
    updated_at TEXT NOT NULL
  )`, args: [] });

  // Add daily_token_limit column (migration for existing tables)
  try {
    await db.execute({ sql: 'ALTER TABLE user_token_limits ADD COLUMN daily_token_limit INTEGER', args: [] });
  } catch {
    // Column already exists
  }

  // --- Client-account mapping table ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS client_account_map (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_account_id TEXT NOT NULL,
    platform_account_name TEXT,
    crm_type TEXT NOT NULL DEFAULT 'ghl',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(client_id, platform, platform_account_id)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_cam_client ON client_account_map(client_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_cam_platform ON client_account_map(platform)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_cam_platform_account ON client_account_map(platform_account_id)`, args: [] });

  // --- GA4 tables ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS ga4_properties (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    time_zone TEXT,
    currency TEXT,
    synced_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS ga4_daily (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    property_id TEXT NOT NULL,
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    engaged_sessions INTEGER DEFAULT 0,
    engagement_rate REAL,
    avg_session_duration REAL,
    bounce_rate REAL,
    conversions INTEGER DEFAULT 0,
    conversion_events TEXT,
    synced_at TEXT NOT NULL,
    UNIQUE(date, property_id)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_ga4_daily_date ON ga4_daily(date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_ga4_daily_property ON ga4_daily(property_id)`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS ga4_traffic_sources (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    property_id TEXT NOT NULL,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    sessions INTEGER DEFAULT 0,
    users INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    synced_at TEXT NOT NULL,
    UNIQUE(date, property_id, source, medium, campaign)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_ga4_traffic_date ON ga4_traffic_sources(date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_ga4_traffic_property ON ga4_traffic_sources(property_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_ga4_traffic_source ON ga4_traffic_sources(source, medium)`, args: [] });

  // --- Google Search Console tables ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS gsc_sites (
    id TEXT PRIMARY KEY,
    permission_level TEXT,
    synced_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS gsc_daily (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    site_id TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr REAL,
    avg_position REAL,
    synced_at TEXT NOT NULL,
    UNIQUE(date, site_id)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_daily_date ON gsc_daily(date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_daily_site ON gsc_daily(site_id)`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS gsc_queries (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    site_id TEXT NOT NULL,
    query TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr REAL,
    position REAL,
    synced_at TEXT NOT NULL,
    UNIQUE(date, site_id, query)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_queries_date ON gsc_queries(date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_queries_site ON gsc_queries(site_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_queries_query ON gsc_queries(query)`, args: [] });

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS gsc_pages (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    site_id TEXT NOT NULL,
    page TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr REAL,
    position REAL,
    synced_at TEXT NOT NULL,
    UNIQUE(date, site_id, page)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_pages_date ON gsc_pages(date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_gsc_pages_site ON gsc_pages(site_id)`, args: [] });

  // --- Lead attribution table ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS attributed_leads (
    id INTEGER PRIMARY KEY,
    ghl_opportunity_id TEXT NOT NULL UNIQUE,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    attributed_source TEXT NOT NULL,
    attribution_method TEXT NOT NULL,
    attribution_confidence TEXT NOT NULL DEFAULT 'medium',
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    landing_page TEXT,
    treatment_type TEXT,
    treatment_value REAL,
    conversion_status TEXT NOT NULL DEFAULT 'lead',
    lead_date TEXT NOT NULL,
    qualified_at TEXT,
    converted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_client ON attributed_leads(client_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_source ON attributed_leads(attributed_source)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_treatment ON attributed_leads(treatment_type)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_status ON attributed_leads(conversion_status)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_date ON attributed_leads(lead_date)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_attr_leads_ghl ON attributed_leads(ghl_opportunity_id)`, args: [] });

  // --- Treatment types reference table ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS treatment_types (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    default_value REAL NOT NULL DEFAULT 0,
    vertical TEXT NOT NULL DEFAULT 'dental',
    keywords TEXT
  )`, args: [] });

  // --- Client-user mapping table ---

  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS client_user_map (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    PRIMARY KEY (user_id)
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_cum_client ON client_user_map(client_id)`, args: [] });

  // --- Audit log table ---
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`, args: [] });

  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_type)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`, args: [] });
  await db.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`, args: [] });

  // Migrate: add conversion columns to gads_campaign_spend
  try {
    await db.execute({ sql: 'ALTER TABLE gads_campaign_spend ADD COLUMN conversions REAL DEFAULT 0', args: [] });
  } catch {
    // Column already exists
  }
  try {
    await db.execute({ sql: 'ALTER TABLE gads_campaign_spend ADD COLUMN conversion_value REAL DEFAULT 0', args: [] });
  } catch {
    // Column already exists
  }
  try {
    await db.execute({ sql: 'ALTER TABLE gads_campaign_spend ADD COLUMN cost_per_conversion REAL', args: [] });
  } catch {
    // Column already exists
  }
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

// --- Audit Log ---

export type AuditEventType = 'login_success' | 'login_failed' | 'password_changed' | 'user_created' | 'user_deleted' | 'oauth_connected' | 'oauth_disconnected';

export async function logAuditEvent(event: {
  eventType: AuditEventType;
  userId?: string;
  ipAddress?: string;
  details?: string;
}): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO audit_log (event_type, user_id, ip_address, details, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [event.eventType, event.userId ?? null, event.ipAddress ?? null, event.details ?? null, new Date().toISOString()],
  });
}
