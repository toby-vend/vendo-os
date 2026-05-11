/**
 * Briefing orchestrator. Pulls every existing data source for a client in
 * parallel and assembles a ClientBriefing object.
 *
 * No AI calls. No new tables (Phase A). Notes default to [] until Phase B.
 * Caches per-client briefings for 60s in memory.
 */
import { rows } from '../queries/base.js';
import { getClientHealth } from '../queries/clients.js';
import type {
  ClientBriefing,
  BriefingMeta,
  BriefingHealth,
  BriefingMeetingSummary,
  BriefingActionItem,
  BriefingAsanaTask,
  BriefingGhlOpp,
  BriefingPerformance,
  BriefingPipeline,
  BriefingBrand,
  ClientNote,
} from './types.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map<number, { briefing: ClientBriefing; expiresAt: number }>();

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
  email: string | null;
  vertical: string | null;
  status: string | null;
  total_invoiced: number | null;
  outstanding: number | null;
  first_invoice_date: string | null;
  last_invoice_date: string | null;
  first_meeting_date: string | null;
  last_meeting_date: string | null;
  meeting_count: number | null;
}

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
  duration_seconds: number | null;
  summary: string | null;
}

interface ActionRow {
  id: number;
  description: string;
  assignee: string | null;
  completed: number;
  meeting_id: string;
  meeting_title: string | null;
  meeting_date: string | null;
}

interface AsanaRow {
  gid: string;
  name: string;
  assignee_name: string | null;
  due_on: string | null;
  completed: number;
  section_name: string | null;
  project_name: string | null;
}

interface MetaSpendRow { total_spend: number; impressions: number; clicks: number; }
interface GadsSpendRow { total_spend: number; impressions: number; clicks: number; }

interface GhlRow {
  id: string;
  name: string | null;
  monetary_value: number;
  status: string;
  stage_name: string | null;
  contact_name: string | null;
  created_at: string | null;
}

interface BrandCountRow {
  file_count: number;
}

interface NoteRow {
  id: number;
  body: string;
  category: 'context' | 'gotcha' | 'preference' | 'history' | 'todo';
  source: string | null;
  author_user_id: string;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

function tierFromScore(score: number | null | undefined): 'green' | 'orange' | 'red' | 'unknown' {
  // Matches web/views/clients/detail.eta: >=70 healthy, >=40 at-risk, <40 critical.
  if (score == null) return 'unknown';
  if (score >= 70) return 'green';
  if (score >= 40) return 'orange';
  return 'red';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateBriefing(clientId: number): Promise<ClientBriefing | null> {
  // Cache check
  const cached = cache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.briefing;
  }

  // 1. Resolve client + base meeting/action snapshot in parallel
  const today = todayIso();
  const [
    clientResult,
    meetingsResult,
    openActionsResult,
    asanaResult,
    overdueAsanaResult,
    metaResult,
    gadsResult,
    ghlResult,
    brandResult,
    notesResult,
  ] = await Promise.all([
    rows<ClientRow>(
      `SELECT id, name, display_name, email, vertical, status,
              total_invoiced, outstanding, first_invoice_date, last_invoice_date,
              first_meeting_date, last_meeting_date, meeting_count
       FROM clients WHERE id = ?`,
      [clientId],
    ),
    rows<MeetingRow>(
      `SELECT m.id, m.title, m.date, m.category, m.duration_seconds, m.summary
       FROM meetings m
       JOIN clients c ON c.name = m.client_name
       WHERE c.id = ?
       ORDER BY m.date DESC LIMIT 4`,
      [clientId],
    ),
    rows<ActionRow>(
      `SELECT ai.id, ai.description, ai.assignee, ai.completed,
              ai.meeting_id, m.title AS meeting_title, m.date AS meeting_date
       FROM action_items ai
       JOIN meetings m ON ai.meeting_id = m.id
       JOIN clients c ON c.name = m.client_name
       WHERE c.id = ? AND ai.completed = 0
       ORDER BY m.date DESC LIMIT 10`,
      [clientId],
    ),
    rows<AsanaRow>(
      `SELECT gid, name, assignee_name, due_on, completed, section_name, project_name
       FROM asana_tasks
       WHERE project_gid IN (
         SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'asana'
       ) AND completed = 0
       ORDER BY due_on ASC NULLS LAST LIMIT 10`,
      [clientId],
    ),
    rows<AsanaRow>(
      `SELECT gid, name, assignee_name, due_on, completed, section_name, project_name
       FROM asana_tasks
       WHERE project_gid IN (
         SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'asana'
       ) AND completed = 0 AND due_on IS NOT NULL AND due_on < ?
       ORDER BY due_on ASC LIMIT 20`,
      [clientId, today],
    ),
    rows<MetaSpendRow>(
      `SELECT COALESCE(SUM(spend), 0) AS total_spend,
              COALESCE(SUM(impressions), 0) AS impressions,
              COALESCE(SUM(clicks), 0) AS clicks
       FROM meta_insights
       WHERE account_id IN (
         SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'meta'
       ) AND date >= date('now', '-30 days')`,
      [clientId],
    ),
    rows<GadsSpendRow>(
      `SELECT COALESCE(SUM(spend), 0) AS total_spend,
              COALESCE(SUM(impressions), 0) AS impressions,
              COALESCE(SUM(clicks), 0) AS clicks
       FROM gads_campaign_spend
       WHERE account_id IN (
         SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'gads'
       ) AND date >= date('now', '-30 days')`,
      [clientId],
    ),
    rows<GhlRow>(
      `SELECT o.id, o.name, o.monetary_value, o.status,
              s.name AS stage_name, o.contact_name, o.created_at
       FROM ghl_opportunities o
       LEFT JOIN ghl_stages s ON o.stage_id = s.id
       WHERE (
         o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
         OR o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
       ) AND o.status = 'open'
       ORDER BY o.created_at DESC LIMIT 10`,
      [clientId, clientId],
    ),
    rows<BrandCountRow>(
      `SELECT COUNT(*) AS file_count FROM brand_hub WHERE client_id = ?`,
      [clientId],
    ),
    // Notes — gracefully returns [] until client_notes table exists (Phase B)
    rows<NoteRow>(
      `SELECT cn.id, cn.body, cn.category, cn.source, cn.author_user_id,
              u.name AS author_name, cn.created_at, cn.updated_at
       FROM client_notes cn
       LEFT JOIN users u ON u.id = cn.author_user_id
       WHERE cn.client_id = ? AND cn.archived_at IS NULL
       ORDER BY cn.updated_at DESC LIMIT 50`,
      [clientId],
    ).catch(() => [] as NoteRow[]),
  ]);

  const client = clientResult[0];
  if (!client) return null;

  // 2. Health (uses client_name)
  const health = await getClientHealth(client.name);

  // 3. Shape into briefing
  const meetings: BriefingMeetingSummary[] = meetingsResult.map((m) => ({
    id: m.id,
    title: m.title,
    date: m.date,
    category: m.category,
    durationSeconds: m.duration_seconds,
  }));

  const lastMeetingRow = meetingsResult[0] ?? null;
  const lastMeeting: BriefingMeetingSummary | null = lastMeetingRow
    ? {
        id: lastMeetingRow.id,
        title: lastMeetingRow.title,
        date: lastMeetingRow.date,
        category: lastMeetingRow.category,
        durationSeconds: lastMeetingRow.duration_seconds,
      }
    : null;
  const recentMeetings = meetings.slice(1, 4); // next 3 after last

  const openActionItems: BriefingActionItem[] = openActionsResult.map((a) => ({
    id: a.id,
    description: a.description,
    assignee: a.assignee,
    completed: a.completed === 1,
    meetingId: a.meeting_id,
    meetingTitle: a.meeting_title,
    meetingDate: a.meeting_date,
  }));

  const toAsana = (a: AsanaRow): BriefingAsanaTask => ({
    gid: a.gid,
    name: a.name,
    assignee: a.assignee_name,
    dueOn: a.due_on,
    completed: a.completed === 1,
    section: a.section_name,
    project: a.project_name,
  });

  const openTasks: BriefingAsanaTask[] = asanaResult.map(toAsana);
  const overdueTasks: BriefingAsanaTask[] = overdueAsanaResult.map(toAsana);

  const meta = metaResult[0] ?? { total_spend: 0, impressions: 0, clicks: 0 };
  const gads = gadsResult[0] ?? { total_spend: 0, impressions: 0, clicks: 0 };
  const performance: BriefingPerformance = {
    metaSpend: meta.total_spend,
    metaImpressions: meta.impressions,
    metaClicks: meta.clicks,
    gadsSpend: gads.total_spend,
    gadsImpressions: gads.impressions,
    gadsClicks: gads.clicks,
  };

  const openOpps: BriefingGhlOpp[] = ghlResult.map((o) => ({
    id: o.id,
    name: o.name,
    monetaryValue: o.monetary_value,
    status: o.status,
    stage: o.stage_name,
    contact: o.contact_name,
    createdAt: o.created_at,
  }));
  const totalValueOpen = openOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);

  const brand: BriefingBrand = {
    fileCount: brandResult[0]?.file_count ?? 0,
    hasGuidelines: (brandResult[0]?.file_count ?? 0) > 0,
  };

  const notes: ClientNote[] = notesResult.map((n) => ({
    id: n.id,
    body: n.body,
    category: n.category,
    source: n.source,
    authorUserId: n.author_user_id,
    authorName: n.author_name,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const metaShape: BriefingMeta = {
    id: client.id,
    name: client.name,
    displayName: client.display_name,
    vertical: client.vertical,
    status: client.status,
    email: client.email,
    totalInvoiced: client.total_invoiced ?? 0,
    outstanding: client.outstanding ?? 0,
    firstInvoiceDate: client.first_invoice_date,
    lastInvoiceDate: client.last_invoice_date,
    firstMeetingDate: client.first_meeting_date,
    lastMeetingDate: client.last_meeting_date,
    meetingCount: client.meeting_count ?? 0,
  };

  const briefingHealth: BriefingHealth | null = health
    ? {
        score: health.score,
        tier: tierFromScore(health.score),
        trend: health.trend,
        performance: health.performance_score,
        relationship: health.relationship_score,
        financial: health.financial_score,
        period: health.period,
        prevScore: health.prev_score,
      }
    : null;

  const briefing: ClientBriefing = {
    generatedAt: new Date().toISOString(),
    meta: metaShape,
    health: briefingHealth,
    activity: { lastMeeting, recentMeetings, openActionItems, openTasks, overdueTasks },
    performance,
    pipeline: { openOpps, totalValueOpen },
    brand,
    notes,
  };

  cache.set(clientId, { briefing, expiresAt: Date.now() + CACHE_TTL_MS });
  return briefing;
}

/** Drop any cached briefing for a client. Call from note-write paths. */
export function invalidateBriefingCache(clientId: number): void {
  cache.delete(clientId);
}
