/**
 * Extra per-client queries that feed the Client Knowledge briefing
 * beyond the original Phase A scope:
 *
 *   - getHarvestHours       — billable + non-billable hours, last 7/30 days
 *   - getGa4Stats           — organic sessions, users, conversions, 30d
 *   - getGscStats           — impressions, clicks, CTR, avg position, 30d
 *   - getRecentConcerns     — high/critical meeting concerns, last 90d
 *   - getLatestProfitability — most recent margin row
 *
 * All bridge to a canonical `clients.id` via `client_source_mappings`
 * (source = 'harvest' | 'ga4' | 'gsc') or via the `clients.name` field
 * (for meeting_concerns + client_profitability, which still key by name).
 */
import { rows } from './base.js';

export interface HarvestHoursStats {
  hoursLast7: number;
  hoursLast30: number;
  billableLast30: number;
  byUserLast30: Array<{ userName: string | null; hours: number }>;
  lastEntryDate: string | null;
  lastSyncedAt: string | null;
}

export interface Ga4Stats {
  sessions30d: number;
  users30d: number;
  newUsers30d: number;
  conversions30d: number;
  prev30dSessions: number;       // for trend
  lastSyncedAt: string | null;
}

export interface GscStats {
  impressions30d: number;
  clicks30d: number;
  ctr30d: number | null;
  avgPosition30d: number | null;
  lastSyncedAt: string | null;
}

export interface RecentConcernRow {
  meetingId: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  severity: string | null;
  category: string | null;
  aiSummary: string | null;
  createdAt: string | null;
}

export interface LatestProfitability {
  period: string;
  revenue: number;
  costTotal: number;
  grossMargin: number;
  marginPct: number;
  classification: string;
  rootCause: string | null;
  createdAt: string;
}

interface HarvestRow {
  spent_date: string;
  hours: number;
  billable: number;
  user_name: string | null;
  synced_at: string | null;
}

interface Ga4Row {
  sessions: number;
  users: number;
  new_users: number;
  conversions: number;
  synced_at: string | null;
}

interface GscRow {
  impressions: number;
  clicks: number;
  ctr_weighted: number | null;
  pos_weighted: number | null;
  synced_at: string | null;
}

interface ConcernRow {
  meeting_id: string;
  meeting_title: string | null;
  meeting_date: string | null;
  severity: string | null;
  category: string | null;
  ai_summary: string | null;
  created_at: string | null;
}

interface ProfitabilityRow {
  period: string;
  revenue: number;
  cost_total: number;
  gross_margin: number;
  margin_pct: number;
  classification: string;
  root_cause: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Harvest hours (last 7/30 days)
// ----------------------------------------------------------------------------

export async function getHarvestHours(clientId: number): Promise<HarvestHoursStats | null> {
  const result = await rows<HarvestRow>(
    `SELECT h.spent_date, h.hours, h.billable, h.user_name, h.synced_at
     FROM harvest_time_entries h
     WHERE h.client_id IN (
       SELECT CAST(external_id AS INTEGER) FROM client_source_mappings
       WHERE client_id = ? AND source = 'harvest'
     ) AND h.spent_date >= date('now', '-30 days')`,
    [clientId],
  );

  if (result.length === 0) return null;

  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let hoursLast7 = 0;
  let hoursLast30 = 0;
  let billableLast30 = 0;
  let lastEntryDate: string | null = null;
  let lastSyncedAt: string | null = null;
  const byUser = new Map<string | null, number>();

  for (const r of result) {
    hoursLast30 += r.hours || 0;
    if (r.billable === 1) billableLast30 += r.hours || 0;
    if (r.spent_date >= sevenAgo) hoursLast7 += r.hours || 0;
    byUser.set(r.user_name, (byUser.get(r.user_name) ?? 0) + (r.hours || 0));
    if (!lastEntryDate || r.spent_date > lastEntryDate) lastEntryDate = r.spent_date;
    if (r.synced_at && (!lastSyncedAt || r.synced_at > lastSyncedAt)) lastSyncedAt = r.synced_at;
  }

  return {
    hoursLast7: Math.round(hoursLast7 * 10) / 10,
    hoursLast30: Math.round(hoursLast30 * 10) / 10,
    billableLast30: Math.round(billableLast30 * 10) / 10,
    byUserLast30: [...byUser]
      .map(([userName, hours]) => ({ userName, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours),
    lastEntryDate,
    lastSyncedAt,
  };
}

// ----------------------------------------------------------------------------
// GA4 (last 30 days, with prev-30 baseline)
// ----------------------------------------------------------------------------

export async function getGa4Stats(clientId: number): Promise<Ga4Stats | null> {
  const last30 = await rows<Ga4Row>(
    `SELECT COALESCE(SUM(sessions), 0) AS sessions,
            COALESCE(SUM(users), 0) AS users,
            COALESCE(SUM(new_users), 0) AS new_users,
            COALESCE(SUM(conversions), 0) AS conversions,
            MAX(synced_at) AS synced_at
     FROM ga4_daily
     WHERE property_id IN (
       SELECT external_id FROM client_source_mappings
       WHERE client_id = ? AND source = 'ga4'
     ) AND date >= date('now', '-30 days')`,
    [clientId],
  );

  const prev30 = await rows<Ga4Row>(
    `SELECT COALESCE(SUM(sessions), 0) AS sessions,
            0 AS users, 0 AS new_users, 0 AS conversions, NULL AS synced_at
     FROM ga4_daily
     WHERE property_id IN (
       SELECT external_id FROM client_source_mappings
       WHERE client_id = ? AND source = 'ga4'
     ) AND date >= date('now', '-60 days') AND date < date('now', '-30 days')`,
    [clientId],
  );

  const row = last30[0];
  if (!row || (row.sessions === 0 && row.users === 0)) return null;

  return {
    sessions30d: row.sessions,
    users30d: row.users,
    newUsers30d: row.new_users,
    conversions30d: row.conversions,
    prev30dSessions: prev30[0]?.sessions ?? 0,
    lastSyncedAt: row.synced_at,
  };
}

// ----------------------------------------------------------------------------
// Google Search Console (last 30 days)
// ----------------------------------------------------------------------------

export async function getGscStats(clientId: number): Promise<GscStats | null> {
  // CTR and avg-position are weighted by impressions, not simple averages.
  const result = await rows<GscRow>(
    `SELECT COALESCE(SUM(impressions), 0) AS impressions,
            COALESCE(SUM(clicks), 0) AS clicks,
            CASE WHEN SUM(impressions) > 0
                 THEN SUM(clicks) * 1.0 / SUM(impressions) ELSE NULL END AS ctr_weighted,
            CASE WHEN SUM(impressions) > 0
                 THEN SUM(avg_position * impressions) / SUM(impressions) ELSE NULL END AS pos_weighted,
            MAX(synced_at) AS synced_at
     FROM gsc_daily
     WHERE site_id IN (
       SELECT external_id FROM client_source_mappings
       WHERE client_id = ? AND source = 'gsc'
     ) AND date >= date('now', '-30 days')`,
    [clientId],
  );

  const row = result[0];
  if (!row || row.impressions === 0) return null;

  return {
    impressions30d: row.impressions,
    clicks30d: row.clicks,
    ctr30d: row.ctr_weighted,
    avgPosition30d: row.pos_weighted,
    lastSyncedAt: row.synced_at,
  };
}

// ----------------------------------------------------------------------------
// Recent meeting concerns (last 90 days, severity high/critical)
// ----------------------------------------------------------------------------

export async function getRecentConcerns(clientId: number, limit = 5): Promise<RecentConcernRow[]> {
  const result = await rows<ConcernRow>(
    `SELECT mc.meeting_id, m.title AS meeting_title, m.date AS meeting_date,
            mc.severity, mc.category, mc.ai_summary, mc.created_at
     FROM meeting_concerns mc
     JOIN meetings m ON m.id = mc.meeting_id
     JOIN clients c ON c.name = m.client_name
     WHERE c.id = ?
       AND mc.concern_detected = 1
       AND LOWER(COALESCE(mc.severity, '')) IN ('high', 'critical')
       AND m.date >= date('now', '-90 days')
     ORDER BY m.date DESC, mc.created_at DESC
     LIMIT ?`,
    [clientId, limit],
  );

  return result.map((r) => ({
    meetingId: r.meeting_id,
    meetingTitle: r.meeting_title,
    meetingDate: r.meeting_date,
    severity: r.severity,
    category: r.category,
    aiSummary: r.ai_summary,
    createdAt: r.created_at,
  }));
}

// ----------------------------------------------------------------------------
// Latest profitability row (keyed by client_name)
// ----------------------------------------------------------------------------

export async function getLatestProfitability(clientName: string): Promise<LatestProfitability | null> {
  const result = await rows<ProfitabilityRow>(
    `SELECT period, revenue, cost_total, gross_margin, margin_pct,
            classification, root_cause, created_at
     FROM client_profitability
     WHERE client_name = ?
     ORDER BY period DESC LIMIT 1`,
    [clientName],
  );
  const r = result[0];
  if (!r) return null;
  return {
    period: r.period,
    revenue: r.revenue,
    costTotal: r.cost_total,
    grossMargin: r.gross_margin,
    marginPct: r.margin_pct,
    classification: r.classification,
    rootCause: r.root_cause,
    createdAt: r.created_at,
  };
}
