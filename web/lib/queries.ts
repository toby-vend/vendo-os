import { createClient, type Client, type Row } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use Turso in production, local SQLite file in dev
const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export { client as db };

// --- Helpers ---

async function rows<T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> {
  const result = await client.execute({ sql, args });
  return result.rows as unknown as T[];
}

async function scalar<T = number>(sql: string, args: (string | number | null)[] = []): Promise<T | null> {
  const result = await client.execute({ sql, args });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row[result.columns[0]] as T;
}

// --- Interfaces ---

export interface DashboardStats {
  totalMeetings: number;
  openActions: number;
  activeClients: number;
  adSpend30d: number;
  dateRange: { from: string; to: string };
}

export interface MeetingRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
  client_name: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  attendees: string | null;
  url: string | null;
  excerpt?: string;
}

export interface ActionItemRow {
  id: number;
  meeting_id: string;
  description: string;
  assignee: string | null;
  completed: number;
  created_at: string;
  meeting_title?: string;
  meeting_date?: string;
}

export interface ClientRow {
  name: string;
  email: string | null;
  meeting_count: number;
  vertical: string | null;
  status: string;
  source: string;
  total_invoiced: number;
  outstanding: number;
  first_invoice_date: string | null;
  last_invoice_date: string | null;
  first_meeting_date: string | null;
  last_meeting_date: string | null;
}

export interface SyncLogRow {
  source: string;
  lastSync: string | null;
  rowCount: number;
}

export interface AssigneeSummary {
  assignee: string;
  total: number;
  open: number;
}

export interface AdAccountSummary {
  account_id: string;
  account_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

export interface CampaignSummary {
  campaign_id: string;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

// --- Dashboard ---

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalMeetings, openActions, activeClients, adSpend30d, range] = await Promise.all([
    scalar('SELECT COUNT(*) FROM meetings'),
    scalar('SELECT COUNT(*) FROM action_items WHERE completed = 0'),
    scalar("SELECT COUNT(*) FROM clients WHERE status = 'active'"),
    scalar("SELECT COALESCE(SUM(spend), 0) FROM meta_insights WHERE date >= date('now', '-30 days')"),
    client.execute('SELECT MIN(date) as min_date, MAX(date) as max_date FROM meetings'),
  ]);
  const row = range.rows[0];
  return {
    totalMeetings: (totalMeetings as number) ?? 0,
    openActions: (openActions as number) ?? 0,
    activeClients: (activeClients as number) ?? 0,
    adSpend30d: Math.round(((adSpend30d as number) ?? 0) * 100) / 100,
    dateRange: { from: (row?.min_date as string) || '', to: (row?.max_date as string) || '' },
  };
}

export async function getRecentMeetings(limit = 5): Promise<MeetingRow[]> {
  return rows<MeetingRow>('SELECT id, title, date, category, client_name, duration_seconds FROM meetings ORDER BY date DESC LIMIT ?', [limit]);
}

export async function getActionsByAssignee(): Promise<AssigneeSummary[]> {
  return rows<AssigneeSummary>(`
    SELECT COALESCE(assignee, 'Unassigned') as assignee,
           COUNT(*) as total,
           SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open
    FROM action_items GROUP BY assignee ORDER BY total DESC
  `);
}

// --- Meetings ---

export interface MeetingSearchOpts {
  search?: string;
  client?: string;
  category?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function searchMeetings(opts: MeetingSearchOpts): Promise<{ meetings: MeetingRow[]; total: number }> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (opts.search) {
    const ftsQuery = opts.search.replace(/['"]/g, '').split(/\s+/).map(w => w + '*').join(' ');

    const filterConditions: string[] = [];
    const filterArgs: (string | number)[] = [ftsQuery];

    if (opts.client) { filterConditions.push('m.client_name LIKE ?'); filterArgs.push(`%${opts.client}%`); }
    if (opts.category) { filterConditions.push('m.category = ?'); filterArgs.push(opts.category); }
    if (opts.from) { filterConditions.push('m.date >= ?'); filterArgs.push(opts.from); }
    if (opts.to) { filterConditions.push("m.date <= ? || 'T23:59:59Z'"); filterArgs.push(opts.to); }

    const whereExtra = filterConditions.length ? 'AND ' + filterConditions.join(' AND ') : '';

    const total = await scalar(`
      SELECT COUNT(*) FROM meetings_fts fts JOIN meetings m ON m.rowid = fts.rowid
      WHERE meetings_fts MATCH ? ${whereExtra}
    `, filterArgs) ?? 0;

    const meetings = await rows<MeetingRow>(`
      SELECT m.id, m.title, m.date, m.category, m.client_name, m.duration_seconds,
             snippet(meetings_fts, '<mark>', '</mark>', '...', -1, 40) as excerpt
      FROM meetings_fts fts JOIN meetings m ON m.rowid = fts.rowid
      WHERE meetings_fts MATCH ? ${whereExtra}
      ORDER BY m.date DESC LIMIT ? OFFSET ?
    `, [...filterArgs, opts.limit ?? 20, opts.offset ?? 0]);

    return { meetings, total: total as number };
  }

  // Non-FTS path
  if (opts.client) { conditions.push('client_name LIKE ?'); args.push(`%${opts.client}%`); }
  if (opts.category) { conditions.push('category = ?'); args.push(opts.category); }
  if (opts.from) { conditions.push('date >= ?'); args.push(opts.from); }
  if (opts.to) { conditions.push("date <= ? || 'T23:59:59Z'"); args.push(opts.to); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = await scalar(`SELECT COUNT(*) FROM meetings ${whereClause}`, args) ?? 0;
  const meetings = await rows<MeetingRow>(`
    SELECT id, title, date, category, client_name, duration_seconds
    FROM meetings ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?
  `, [...args, opts.limit ?? 20, opts.offset ?? 0]);

  return { meetings, total: total as number };
}

export async function getMeetingById(id: string): Promise<MeetingRow | null> {
  const result = await rows<MeetingRow>('SELECT * FROM meetings WHERE id = ?', [id]);
  return result[0] ?? null;
}

export async function getMeetingActionItems(meetingId: string): Promise<ActionItemRow[]> {
  return rows<ActionItemRow>('SELECT * FROM action_items WHERE meeting_id = ? ORDER BY id', [meetingId]);
}

// --- Action Items ---

export interface ActionItemSearchOpts {
  assignee?: string;
  status?: 'open' | 'completed' | 'all';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getActionItems(opts: ActionItemSearchOpts): Promise<{ items: ActionItemRow[]; total: number }> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (opts.assignee) { conditions.push('ai.assignee LIKE ?'); args.push(`%${opts.assignee}%`); }
  if (opts.status === 'open') { conditions.push('ai.completed = 0'); }
  else if (opts.status === 'completed') { conditions.push('ai.completed = 1'); }
  if (opts.from) { conditions.push('ai.created_at >= ?'); args.push(opts.from); }
  if (opts.to) { conditions.push("ai.created_at <= ? || 'T23:59:59Z'"); args.push(opts.to); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = await scalar(`SELECT COUNT(*) FROM action_items ai ${whereClause}`, args) ?? 0;
  const items = await rows<ActionItemRow>(`
    SELECT ai.*, m.title as meeting_title, m.date as meeting_date
    FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id
    ${whereClause} ORDER BY m.date DESC LIMIT ? OFFSET ?
  `, [...args, opts.limit ?? 50, opts.offset ?? 0]);

  return { items, total: total as number };
}

// --- Clients ---

export async function getClients(): Promise<ClientRow[]> {
  return rows<ClientRow>(`
    SELECT name, email, meeting_count, vertical, status, source,
           total_invoiced, outstanding, first_invoice_date, last_invoice_date,
           first_meeting_date, last_meeting_date
    FROM clients
    WHERE source = 'xero'
    ORDER BY total_invoiced DESC, meeting_count DESC
  `);
}

export async function getClientByName(name: string): Promise<{ client: ClientRow | null; meetings: MeetingRow[]; actions: ActionItemRow[] }> {
  const clients = await rows<ClientRow>(`
    SELECT name, email, meeting_count, vertical, status, source,
           total_invoiced, outstanding, first_invoice_date, last_invoice_date,
           first_meeting_date, last_meeting_date
    FROM clients WHERE name = ?
  `, [name]);
  const cl = clients[0] ?? null;
  if (!cl) return { client: null, meetings: [], actions: [] };

  const [meetings, actions] = await Promise.all([
    rows<MeetingRow>('SELECT id, title, date, category, client_name, duration_seconds FROM meetings WHERE client_name = ? ORDER BY date DESC', [name]),
    rows<ActionItemRow>(`
      SELECT ai.*, m.title as meeting_title, m.date as meeting_date
      FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id
      WHERE m.client_name = ? ORDER BY m.date DESC
    `, [name]),
  ]);

  return { client: cl, meetings, actions };
}

// --- Ads ---

export async function getAdAccountSummary(days = 30): Promise<AdAccountSummary[]> {
  return rows<AdAccountSummary>(`
    SELECT account_id, account_name,
           SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
           CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) / SUM(impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS REAL) / SUM(impressions) * 100, 2) ELSE 0 END as ctr
    FROM meta_insights
    WHERE date >= date('now', '-' || ? || ' days') AND level = 'campaign'
    GROUP BY account_id, account_name
    ORDER BY spend DESC
  `, [days]);
}

export async function getCampaignSummary(accountId: string, days = 30): Promise<CampaignSummary[]> {
  return rows<CampaignSummary>(`
    SELECT campaign_id, campaign_name,
           SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
           CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) / SUM(impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS REAL) / SUM(impressions) * 100, 2) ELSE 0 END as ctr
    FROM meta_insights
    WHERE account_id = ? AND date >= date('now', '-' || ? || ' days') AND level = 'campaign'
    GROUP BY campaign_id, campaign_name
    ORDER BY spend DESC
  `, [accountId, days]);
}

// --- Briefs ---

const BRIEFS_DIR = resolve(__dirname, '../../outputs/briefs');

export function listBriefs(): { date: string; filename: string }[] {
  if (!existsSync(BRIEFS_DIR)) return [];
  return readdirSync(BRIEFS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => b.localeCompare(a))
    .map(f => ({ date: f.replace('.md', ''), filename: f }));
}

export function getBriefContent(date: string): string | null {
  const filepath = resolve(BRIEFS_DIR, `${date}.md`);
  if (!existsSync(filepath)) return null;
  return readFileSync(filepath, 'utf-8');
}

// --- Sync Status ---

export async function getSyncStatus(): Promise<SyncLogRow[]> {
  const sources: SyncLogRow[] = [];

  const [meetingSync, meetingCount, metaSync, metaCount, xeroInvSync, xeroInvCount, xeroConSync, xeroConCount, xeroPnlSync, xeroPnlCount] = await Promise.all([
    scalar<string>("SELECT MAX(synced_at) FROM meetings"),
    scalar('SELECT COUNT(*) FROM meetings'),
    scalar<string>("SELECT MAX(synced_at) FROM meta_insights"),
    scalar('SELECT COUNT(*) FROM meta_insights'),
    scalar<string>("SELECT MAX(synced_at) FROM xero_invoices"),
    scalar('SELECT COUNT(*) FROM xero_invoices'),
    scalar<string>("SELECT MAX(synced_at) FROM xero_contacts"),
    scalar('SELECT COUNT(*) FROM xero_contacts'),
    scalar<string>("SELECT MAX(synced_at) FROM xero_pnl_monthly"),
    scalar('SELECT COUNT(*) FROM xero_pnl_monthly'),
    scalar<string>("SELECT MAX(synced_at) FROM ghl_opportunities"),
    scalar('SELECT COUNT(*) FROM ghl_opportunities'),
  ]);

  sources.push({ source: 'Fathom (Meetings)', lastSync: meetingSync, rowCount: (meetingCount as number) ?? 0 });
  sources.push({ source: 'Meta Ads', lastSync: metaSync, rowCount: (metaCount as number) ?? 0 });
  sources.push({ source: 'GHL (Pipeline)', lastSync: (await scalar<string>("SELECT MAX(synced_at) FROM ghl_opportunities")), rowCount: (await scalar('SELECT COUNT(*) FROM ghl_opportunities')) as number ?? 0 });
  sources.push({ source: 'Xero (Invoices)', lastSync: xeroInvSync, rowCount: (xeroInvCount as number) ?? 0 });
  sources.push({ source: 'Xero (Contacts)', lastSync: xeroConSync, rowCount: (xeroConCount as number) ?? 0 });
  sources.push({ source: 'Xero (P&L)', lastSync: xeroPnlSync, rowCount: (xeroPnlCount as number) ?? 0 });

  return sources;
}

// --- GHL Pipeline ---

export interface PipelineOverview {
  pipeline_id: string;
  pipeline_name: string;
  stages: { id: string; name: string; position: number; count: number; value: number }[];
  totalOpen: number;
  totalOpenValue: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
  lostThisMonth: number;
  totalDeals: number;
}

export interface OpportunityRow {
  id: string;
  name: string;
  monetary_value: number;
  pipeline_id: string;
  stage_id: string;
  stage_name?: string;
  pipeline_name?: string;
  status: string;
  source: string | null;
  contact_name: string | null;
  contact_company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  last_stage_change_at: string | null;
  days_in_stage?: number;
}

export async function getPipelineOverview(pipelineId?: string): Promise<PipelineOverview[]> {
  // Get all pipelines
  const pipelines = await rows<{ id: string; name: string }>(
    pipelineId
      ? 'SELECT id, name FROM ghl_pipelines WHERE id = ?'
      : 'SELECT id, name FROM ghl_pipelines ORDER BY name',
    pipelineId ? [pipelineId] : []
  );

  const overviews: PipelineOverview[] = [];

  for (const p of pipelines) {
    // Stages with counts
    const stageData = await rows<{ id: string; name: string; position: number; count: number; value: number }>(`
      SELECT s.id, s.name, s.position,
             COUNT(o.id) as count,
             COALESCE(SUM(o.monetary_value), 0) as value
      FROM ghl_stages s
      LEFT JOIN ghl_opportunities o ON o.stage_id = s.id AND o.status = 'open'
      WHERE s.pipeline_id = ?
      GROUP BY s.id, s.name, s.position
      ORDER BY s.position
    `, [p.id]);

    const totalOpen = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ?', [p.id, 'open']) ?? 0;
    const totalOpenValue = await scalar('SELECT COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ?', [p.id, 'open']) ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStr = monthStart.toISOString();

    const wonThisMonth = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'won', monthStr]) ?? 0;
    const wonThisMonthValue = await scalar('SELECT COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'won', monthStr]) ?? 0;
    const lostThisMonth = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ? AND status = ? AND updated_at >= ?', [p.id, 'lost', monthStr]) ?? 0;
    const totalDeals = await scalar('SELECT COUNT(*) FROM ghl_opportunities WHERE pipeline_id = ?', [p.id]) ?? 0;

    overviews.push({
      pipeline_id: p.id,
      pipeline_name: p.name,
      stages: stageData,
      totalOpen: totalOpen as number,
      totalOpenValue: Math.round((totalOpenValue as number) * 100) / 100,
      wonThisMonth: wonThisMonth as number,
      wonThisMonthValue: Math.round((wonThisMonthValue as number) * 100) / 100,
      lostThisMonth: lostThisMonth as number,
      totalDeals: totalDeals as number,
    });
  }

  return overviews;
}

export async function getRecentOpportunities(limit = 10, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [pipelineId, limit] : [limit];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'open' ${where}
    ORDER BY o.created_at DESC LIMIT ?
  `, args);
}

export async function getWonDeals(days = 30, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [days, pipelineId] : [days];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'won' AND o.updated_at >= date('now', '-' || ? || ' days') ${where}
    ORDER BY o.updated_at DESC
  `, args);
}

export async function getStalledDeals(days = 14, pipelineId?: string): Promise<OpportunityRow[]> {
  const where = pipelineId ? 'AND o.pipeline_id = ?' : '';
  const args: (string | number)[] = pipelineId ? [days, pipelineId] : [days];
  return rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name,
           CAST(julianday('now') - julianday(COALESCE(o.last_stage_change_at, o.created_at)) AS INTEGER) as days_in_stage
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.status = 'open'
      AND julianday('now') - julianday(COALESCE(o.last_stage_change_at, o.created_at)) >= ? ${where}
    ORDER BY days_in_stage DESC
    LIMIT 20
  `, args);
}

export async function getOpportunityDetail(id: string): Promise<OpportunityRow | null> {
  const result = await rows<OpportunityRow>(`
    SELECT o.*, s.name as stage_name, p.name as pipeline_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE o.id = ?
  `, [id]);
  return result[0] ?? null;
}

export async function getPipelineNames(): Promise<{ id: string; name: string }[]> {
  return rows<{ id: string; name: string }>('SELECT id, name FROM ghl_pipelines ORDER BY name');
}

// --- Filter helpers ---

export async function getCategories(): Promise<{ slug: string; label: string }[]> {
  return rows<{ slug: string; label: string }>('SELECT slug, label FROM meeting_categories ORDER BY label');
}

export async function getAssignees(): Promise<string[]> {
  const result = await rows<{ assignee: string }>('SELECT DISTINCT assignee FROM action_items WHERE assignee IS NOT NULL ORDER BY assignee');
  return result.map(r => r.assignee);
}

export async function getClientNames(): Promise<string[]> {
  const result = await rows<{ client_name: string }>('SELECT DISTINCT client_name FROM meetings WHERE client_name IS NOT NULL ORDER BY client_name');
  return result.map(r => r.client_name);
}

// --- Auth: Users ---

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
  await client.execute({
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

  await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
}

export async function deleteUser(id: string): Promise<void> {
  await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

export async function updateUserPassword(id: string, passwordHash: string, mustChange: boolean): Promise<void> {
  await client.execute({
    sql: 'UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?',
    args: [passwordHash, mustChange ? 1 : 0, new Date().toISOString(), id],
  });
}

// --- Auth: Channels ---

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
  await client.execute({ sql: 'DELETE FROM user_channels WHERE user_id = ?', args: [userId] });
  for (const channelId of channelIds) {
    await client.execute({
      sql: 'INSERT INTO user_channels (user_id, channel_id) VALUES (?, ?)',
      args: [userId, channelId],
    });
  }
}

// --- Auth: Permissions ---

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
  await client.execute({ sql: 'DELETE FROM channel_permissions', args: [] });
  for (const p of permissions) {
    await client.execute({
      sql: 'INSERT INTO channel_permissions (channel_id, route_slug) VALUES (?, ?)',
      args: [p.channelId, p.routeSlug],
    });
  }
}

// --- Schema init (for Turso production) ---

export async function initSchema(): Promise<void> {
  // Auth tables
  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'standard',
    must_change_password INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`, args: [] });

  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL
  )`, args: [] });

  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS user_channels (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, channel_id)
  )`, args: [] });

  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS channel_permissions (
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    route_slug TEXT NOT NULL,
    PRIMARY KEY (channel_id, route_slug)
  )`, args: [] });

  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS user_oauth_tokens (
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
  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS skills (
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
  await client.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    title,
    content,
    content='skills',
    tokenize='unicode61'
  )`, args: [] });

  // Brand hub table
  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS brand_hub (
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

  await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_brand_hub_client ON brand_hub(client_id)`, args: [] });

  // Drive watch channels table
  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS drive_watch_channels (
    id INTEGER PRIMARY KEY,
    channel_id TEXT NOT NULL UNIQUE,
    resource_id TEXT NOT NULL,
    expiration INTEGER NOT NULL,
    page_token TEXT,
    created_at TEXT NOT NULL,
    renewed_at TEXT
  )`, args: [] });

  // Task runs table
  await client.execute({ sql: `CREATE TABLE IF NOT EXISTS task_runs (
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

  await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_client ON task_runs(client_id)`, args: [] });
  await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status)`, args: [] });
  await client.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_task_runs_created ON task_runs(created_at)`, args: [] });
}

/** @deprecated Use initSchema instead */
export const initAuthSchema = initSchema;

// --- OAuth Tokens ---

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
  await client.execute({
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
  await client.execute({
    sql: 'UPDATE user_oauth_tokens SET access_token_enc = ?, token_expiry = ?, updated_at = ? WHERE user_id = ? AND provider = ?',
    args: [accessTokenEnc, tokenExpiry, new Date().toISOString(), userId, provider],
  });
}

export async function deleteUserOAuthToken(userId: string, provider = 'google'): Promise<void> {
  await client.execute({ sql: 'DELETE FROM user_oauth_tokens WHERE user_id = ? AND provider = ?', args: [userId, provider] });
}
