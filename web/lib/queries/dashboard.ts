import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { rows, scalar, db } from './base.js';
import type { MeetingRow, ActionItemRow } from './meetings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIEFS_DIR = resolve(__dirname, '../../../outputs/briefs');

// --- Interfaces ---

export interface DashboardStats {
  totalMeetings: number;
  openActions: number;
  activeClients: number;
  adSpend30d: number;
  metaSpend30d: number;
  gadsSpend30d: number;
  dateRange: { from: string; to: string };
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

// --- Dashboard ---

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalMeetings, openActions, activeClients, adSpend30d, range] = await Promise.all([
    scalar('SELECT COUNT(*) FROM meetings'),
    scalar('SELECT COUNT(*) FROM action_items WHERE completed = 0'),
    scalar("SELECT COUNT(*) FROM clients WHERE status = 'active'"),
    scalar("SELECT COALESCE(SUM(spend), 0) FROM meta_insights WHERE date >= date('now', '-30 days')"),
    db.execute('SELECT MIN(date) as min_date, MAX(date) as max_date FROM meetings'),
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

// --- Sync Status ---

export async function getSyncStatus(): Promise<SyncLogRow[]> {
  const sources: SyncLogRow[] = [];

  const [meetingSync, meetingCount, metaSync, metaCount, xeroInvSync, xeroInvCount, xeroConSync, xeroConCount, xeroPnlSync, xeroPnlCount, ghlSync, ghlCount] = await Promise.all([
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
  sources.push({ source: 'GHL (Pipeline)', lastSync: ghlSync, rowCount: (ghlCount as number) ?? 0 });
  sources.push({ source: 'Xero (Invoices)', lastSync: xeroInvSync, rowCount: (xeroInvCount as number) ?? 0 });
  sources.push({ source: 'Xero (Contacts)', lastSync: xeroConSync, rowCount: (xeroConCount as number) ?? 0 });
  sources.push({ source: 'Xero (P&L)', lastSync: xeroPnlSync, rowCount: (xeroPnlCount as number) ?? 0 });

  return sources;
}

// --- Briefs ---

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
