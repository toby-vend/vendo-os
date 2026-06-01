/**
 * SEO (Organic Search) aggregator.
 *
 * Returns:
 *   - topline30 / topline90: 6 SeoTopline tiles each (current vs previous
 *     window of equal length) covering Organic Users, Sessions, Leads,
 *     Conversion Rate, Revenue, Avg Position.
 *   - topPages:  top 8 by organic users (we proxy "users" with GSC clicks
 *                until we wire per-page GA4 events). Leads-by-page is 0
 *                because `ghl_opportunities` has no landing-page column.
 *   - queries:   top 8 by clicks (with posChange vs the previous window).
 *   - health:    placeholders — indexed / crawlErrors / backlinks /
 *                referringDomains are not yet tracked. Core Web Vitals
 *                returns 'Unknown'. TODO: wire these once a source exists.
 *   - searchConsoleSeries: up to 104 weekly buckets (24 months) ending
 *                at range.current.end. Returns null only when this client
 *                has zero rows in gsc_daily.
 *
 * Source tables:
 *   - gsc_daily, gsc_queries, gsc_pages          (Google Search Console)
 *   - ga4_traffic_sources                        (organic sessions/users)
 *   - ghl_opportunities + booking-rule helpers   (organic leads + revenue)
 *
 * Client linkage uses `client_source_mappings` (source='gsc' / source='ga4')
 * — the same convention as `web/lib/queries/gsc.ts` and `ga4.ts`.
 *
 * All date maths is done in UTC. GSC retention is typically 16 months from
 * Google's API; the 24-month chart returns however many weeks the local
 * sync has captured.
 */
import { rows } from '../../queries/base.js';
import {
  classifyBookingSource,
  resolveBookingScope,
  bookingPredicate,
} from '../booking-rule.js';
import { buildGeoGrid } from './geogrid.js';
import type {
  DateRange,
  SeoBlock,
  SeoTopline,
  SeoTopPage,
  SeoQuery,
  SeoSearchConsoleSeries,
} from '../dashboard-types.js';

// ── Public entry ───────────────────────────────────────────────────────

export async function buildSeo(clientId: number, range: DateRange): Promise<SeoBlock> {
  const window30 = computeWindow(range.current.end, 30, range.current.start);
  const window90 = computeWindow(range.current.end, 90);

  const [
    topline30,
    topline90,
    topPages,
    queries,
    searchConsoleSeries,
    geoGrid,
  ] = await Promise.all([
    buildToplineSet(clientId, window30),
    buildToplineSet(clientId, window90),
    buildTopPages(clientId, window30),
    buildQueries(clientId, window30),
    buildSearchConsoleSeries(clientId, range.current.end, 104),
    buildGeoGrid(clientId),
  ]);

  return {
    topline30,
    topline90,
    topPages,
    queries,
    // TODO: wire indexed / crawlErrors / coreWebVitals / backlinks once a
    // source is available (PageSpeed Insights API, Ahrefs/Moz, etc.).
    health: {
      indexed: 0,
      crawlErrors: 0,
      coreWebVitals: 'Unknown',
      backlinks: 0,
      referringDomains: 0,
    },
    searchConsoleSeries,
    geoGrid,
  };
}

// ── Windows ────────────────────────────────────────────────────────────

interface Window {
  /** Current period start (inclusive, YYYY-MM-DD UTC). */
  curStart: string;
  /** Current period end (inclusive, YYYY-MM-DD UTC). */
  curEnd: string;
  /** Previous period start (inclusive). */
  prevStart: string;
  /** Previous period end (inclusive). */
  prevEnd: string;
}

/**
 * Build a current+previous window pair anchored at `endIso` going back
 * `days` days. When `startOverride` is provided we use it as the current
 * start — that's the 30-day case where we mirror the supplied range
 * verbatim so the SEO 30-day topline matches what the user requested.
 */
function computeWindow(endIso: string, days: number, startOverride?: string): Window {
  const end = parseUtcDate(endIso);
  const curStart = startOverride
    ? parseUtcDate(startOverride)
    : addDaysUtc(end, -(days - 1));
  const prevEnd = addDaysUtc(curStart, -1);
  const prevStart = addDaysUtc(prevEnd, -(days - 1));
  return {
    curStart: toIsoDate(curStart),
    curEnd: toIsoDate(end),
    prevStart: toIsoDate(prevStart),
    prevEnd: toIsoDate(prevEnd),
  };
}

// ── Topline (six tiles per window) ─────────────────────────────────────

interface BasicTotals {
  users: number;
  sessions: number;
}

async function getOrganicTotals(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<BasicTotals> {
  // GA4 marks organic traffic with medium='organic' (Google's default
  // channel grouping rule). We sum users + sessions across whatever
  // source values come through ('google', 'bing', etc.).
  const result = await rows<{ users: number | null; sessions: number | null }>(
    `SELECT COALESCE(SUM(ts.users), 0)    AS users,
            COALESCE(SUM(ts.sessions), 0) AS sessions
       FROM ga4_traffic_sources ts
       JOIN client_source_mappings csm
         ON csm.external_id = ts.property_id AND csm.source = 'ga4'
      WHERE csm.client_id = ?
        AND ts.medium     = 'organic'
        AND ts.date BETWEEN ? AND ?`,
    [clientId, startIso, endIso],
  );
  const row = result[0];
  return {
    users: row?.users ?? 0,
    sessions: row?.sessions ?? 0,
  };
}

async function getOrganicLeadsAndRevenue(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<{ leads: number; revenue: number }> {
  const scope = await resolveBookingScope(clientId);
  const predicate = bookingPredicate(scope);
  if (predicate.clause === '1=0') return { leads: 0, revenue: 0 };

  const startTs = startIso;
  const endTs = endIso + 'T23:59:59';

  const opps = await rows<{ source: string | null; monetary_value: number | null }>(
    `SELECT source, monetary_value
       FROM ghl_opportunities
      WHERE ${predicate.clause}
        AND COALESCE(last_stage_change_at, updated_at) >= ?
        AND COALESCE(last_stage_change_at, updated_at) <= ?`,
    [...predicate.params, startTs, endTs],
  );

  let leads = 0;
  let revenue = 0;
  for (const opp of opps) {
    if (classifyBookingSource(opp.source) === 'organic') {
      leads += 1;
      revenue += Number(opp.monetary_value ?? 0);
    }
  }
  return { leads, revenue };
}

interface PositionTotals {
  position: number;
  impressions: number;
}

async function getAvgPosition(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<PositionTotals> {
  // Weighted average position across the window — same shape the GSC
  // helpers already use elsewhere.
  const result = await rows<{
    pos: number | null;
    impressions: number | null;
  }>(
    `SELECT CASE WHEN SUM(d.impressions) > 0
              THEN SUM(d.avg_position * d.impressions) / SUM(d.impressions)
              ELSE 0
            END                            AS pos,
            COALESCE(SUM(d.impressions),0) AS impressions
       FROM gsc_daily d
       JOIN client_source_mappings csm
         ON csm.external_id = d.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND d.date BETWEEN ? AND ?`,
    [clientId, startIso, endIso],
  );
  const row = result[0];
  return {
    position: row?.pos ? Math.round(row.pos * 10) / 10 : 0,
    impressions: row?.impressions ?? 0,
  };
}

async function buildToplineSet(clientId: number, w: Window): Promise<SeoTopline[]> {
  const [curOrganic, prevOrganic, curLeadRev, prevLeadRev, curPos, prevPos] =
    await Promise.all([
      getOrganicTotals(clientId, w.curStart, w.curEnd),
      getOrganicTotals(clientId, w.prevStart, w.prevEnd),
      getOrganicLeadsAndRevenue(clientId, w.curStart, w.curEnd),
      getOrganicLeadsAndRevenue(clientId, w.prevStart, w.prevEnd),
      getAvgPosition(clientId, w.curStart, w.curEnd),
      getAvgPosition(clientId, w.prevStart, w.prevEnd),
    ]);

  const curCvr = ratePercent(curLeadRev.leads, curOrganic.sessions);
  const prevCvr = ratePercent(prevLeadRev.leads, prevOrganic.sessions);

  return [
    { key: 'organicUsers',   label: 'Organic users',     value: curOrganic.users,    prev: prevOrganic.users,    format: 'number' },
    { key: 'organicSessions',label: 'Organic sessions',  value: curOrganic.sessions, prev: prevOrganic.sessions, format: 'number' },
    { key: 'leads',          label: 'Organic leads',     value: curLeadRev.leads,    prev: prevLeadRev.leads,    format: 'number' },
    { key: 'cvr',            label: 'Conversion rate',   value: curCvr,              prev: prevCvr,              format: 'percent' },
    { key: 'revenue',        label: 'Organic revenue',   value: round2(curLeadRev.revenue), prev: round2(prevLeadRev.revenue), format: 'currency' },
    { key: 'avgPosition',    label: 'Avg position',      value: curPos.position,     prev: prevPos.position,     format: 'decimal', inverse: true },
  ];
}

// ── Top pages ──────────────────────────────────────────────────────────

async function buildTopPages(clientId: number, w: Window): Promise<SeoTopPage[]> {
  // We surface the top 8 organic landing pages by clicks (used as a proxy
  // for "users" since GSC pages don't expose users directly). Leads-per-
  // page would require landing-page attribution on `ghl_opportunities`
  // which we don't have yet — leads is set to 0 with a TODO.
  const current = await rows<{ page: string; clicks: number }>(
    `SELECT p.page,
            COALESCE(SUM(p.clicks), 0) AS clicks
       FROM gsc_pages p
       JOIN client_source_mappings csm
         ON csm.external_id = p.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND p.date BETWEEN ? AND ?
      GROUP BY p.page
      ORDER BY clicks DESC
      LIMIT 8`,
    [clientId, w.curStart, w.curEnd],
  );
  if (current.length === 0) return [];

  // Pull the same pages over the previous window in one go for delta %.
  const placeholders = current.map(() => '?').join(',');
  const prev = await rows<{ page: string; clicks: number }>(
    `SELECT p.page,
            COALESCE(SUM(p.clicks), 0) AS clicks
       FROM gsc_pages p
       JOIN client_source_mappings csm
         ON csm.external_id = p.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND p.date BETWEEN ? AND ?
        AND p.page IN (${placeholders})
      GROUP BY p.page`,
    [clientId, w.prevStart, w.prevEnd, ...current.map(r => r.page)],
  );
  const prevByPage = new Map(prev.map(r => [r.page, r.clicks]));

  return current.map(r => {
    const prevClicks = prevByPage.get(r.page) ?? 0;
    return {
      url: r.page,
      users: r.clicks,
      // TODO: attribute organic leads to landing pages once GHL ingestion
      // captures `pageUrl` / first-touch source on opportunities.
      leads: 0,
      change: percentChange(r.clicks, prevClicks),
    };
  });
}

// ── Queries ────────────────────────────────────────────────────────────

async function buildQueries(clientId: number, w: Window): Promise<SeoQuery[]> {
  // Top 8 queries by clicks, with weighted impression-share averages for
  // CTR (kept raw — 0-1 multiplier, no ×100) and position. posChange is
  // current minus previous (negative = improved, lower is better).
  const current = await rows<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>(
    `SELECT q.query,
            COALESCE(SUM(q.clicks), 0)      AS clicks,
            COALESCE(SUM(q.impressions), 0) AS impressions,
            CASE WHEN SUM(q.impressions) > 0
              THEN CAST(SUM(q.clicks) AS REAL) / SUM(q.impressions)
              ELSE 0
            END                              AS ctr,
            CASE WHEN SUM(q.impressions) > 0
              THEN SUM(q.position * q.impressions) / SUM(q.impressions)
              ELSE 0
            END                              AS position
       FROM gsc_queries q
       JOIN client_source_mappings csm
         ON csm.external_id = q.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND q.date BETWEEN ? AND ?
      GROUP BY q.query
      ORDER BY clicks DESC
      LIMIT 8`,
    [clientId, w.curStart, w.curEnd],
  );
  if (current.length === 0) return [];

  const placeholders = current.map(() => '?').join(',');
  const prev = await rows<{ query: string; position: number }>(
    `SELECT q.query,
            CASE WHEN SUM(q.impressions) > 0
              THEN SUM(q.position * q.impressions) / SUM(q.impressions)
              ELSE 0
            END AS position
       FROM gsc_queries q
       JOIN client_source_mappings csm
         ON csm.external_id = q.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND q.date BETWEEN ? AND ?
        AND q.query IN (${placeholders})
      GROUP BY q.query`,
    [clientId, w.prevStart, w.prevEnd, ...current.map(r => r.query)],
  );
  const prevByQuery = new Map(prev.map(r => [r.query, r.position]));

  return current.map(r => {
    const prevPos = prevByQuery.get(r.query) ?? 0;
    const posChange = prevPos > 0 ? round1(r.position - prevPos) : 0;
    return {
      q: r.query,
      clicks: r.clicks,
      impr: r.impressions,
      ctr: round4(r.ctr),
      pos: round1(r.position),
      posChange,
    };
  });
}

// ── Search Console weekly series ───────────────────────────────────────

async function buildSearchConsoleSeries(
  clientId: number,
  endIso: string,
  maxWeeks: number,
): Promise<SeoSearchConsoleSeries | null> {
  // Pull every gsc_daily row for this client and bucket into ISO weeks
  // (Mon-Sun) in JS so we keep all date maths in one place + UTC.
  const daily = await rows<{
    date: string;
    clicks: number;
    impressions: number;
    avg_position: number | null;
  }>(
    `SELECT d.date,
            COALESCE(SUM(d.clicks), 0)       AS clicks,
            COALESCE(SUM(d.impressions), 0)  AS impressions,
            CASE WHEN SUM(d.impressions) > 0
              THEN SUM(d.avg_position * d.impressions) / SUM(d.impressions)
              ELSE NULL
            END                              AS avg_position
       FROM gsc_daily d
       JOIN client_source_mappings csm
         ON csm.external_id = d.site_id AND csm.source = 'gsc'
      WHERE csm.client_id = ?
        AND d.date <= ?
      GROUP BY d.date
      ORDER BY d.date ASC`,
    [clientId, endIso],
  );
  if (daily.length === 0) return null;

  // Accumulate per-week totals + impression-weighted CTR / position.
  interface Bucket {
    weekStart: string;
    clicks: number;
    impressions: number;
    posWeighted: number; // SUM(position * impressions)
  }
  const buckets = new Map<string, Bucket>();
  for (const row of daily) {
    const weekStart = isoMondayUtc(parseUtcDate(row.date));
    const key = toIsoDate(weekStart);
    const b = buckets.get(key) ?? {
      weekStart: key,
      clicks: 0,
      impressions: 0,
      posWeighted: 0,
    };
    b.clicks += row.clicks ?? 0;
    b.impressions += row.impressions ?? 0;
    if (row.avg_position != null) {
      b.posWeighted += row.avg_position * (row.impressions ?? 0);
    }
    buckets.set(key, b);
  }

  // Sort ascending by week start, then take the most-recent N for the
  // chart. We don't need to pad missing weeks — the React chart treats
  // gaps as no-data.
  const ordered = Array.from(buckets.values()).sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : 1,
  );
  const sliced = ordered.slice(-maxWeeks);

  return {
    weeks:       sliced.map(b => b.weekStart),
    clicks:      sliced.map(b => b.clicks),
    impressions: sliced.map(b => b.impressions),
    // CTR on 0-100 scale per the contract.
    ctr: sliced.map(b =>
      b.impressions > 0 ? round2((b.clicks / b.impressions) * 100) : 0,
    ),
    position: sliced.map(b =>
      b.impressions > 0 ? round1(b.posWeighted / b.impressions) : 0,
    ),
  };
}

// ── Pure helpers ───────────────────────────────────────────────────────

function parseUtcDate(iso: string): Date {
  // Accept YYYY-MM-DD or full ISO; always interpret as UTC midnight.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoMondayUtc(d: Date): Date {
  // ISO week: Monday is the first day. getUTCDay returns 0=Sun..6=Sat.
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDaysUtc(d, offset);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function ratePercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return round2((numerator / denominator) * 100);
}

function percentChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return round1(((current - previous) / previous) * 100);
}
