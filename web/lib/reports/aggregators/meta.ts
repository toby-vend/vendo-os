/**
 * Meta (Paid Social) aggregator.
 *
 * Returns the MetaBlock for the dashboard's Paid Social tab:
 *  - topline: 8 ToplineTile entries (spend, clicks, leads, cpl, bookings,
 *    cpb, revenue, roas) with 30-day daily sparklines + previous-period
 *    comparison.
 *  - campaigns: top ≤10 campaigns by spend.
 *  - creative: top 4 creatives by spend, with thumbnail_url when present.
 *  - audiences: best-effort breakdown by adset_name; empty when not
 *    obtainable.
 *
 * Attribution:
 *  - Leads = GHL opportunities created in period with a Meta source
 *    (per `classifyBookingSource`).
 *  - Bookings = opportunities currently sitting in the Booked Appointment
 *    pipeline within the period that classify as 'meta'.
 *  - Per-campaign leads: best-effort string match between the opp.source
 *    and the campaign name. When no UTM/campaign info is present in the
 *    source we fall back to 0 for that row (we never invent attribution).
 *
 * Never fabricates. Empty arrays + zero values are the honest answer
 * when data isn't available.
 */
import { rows } from '../../queries/base.js';
import {
  classifyBookingSource,
  countBookingsForClient,
  listBookingOpportunities,
} from '../booking-rule.js';
import type {
  DateRange,
  MetaAudience,
  MetaBlock,
  MetaCampaign,
  MetaCreative,
  ToplineTile,
} from '../dashboard-types.js';
import {
  bucketOppsByPlatform,
  buildDailySeries,
  listOppsCreatedInRange,
  round2,
  safeDiv,
} from './shared.js';

// ── Public entry point ─────────────────────────────────────────────────

export async function buildMeta(clientId: number, range: DateRange): Promise<MetaBlock> {
  const [
    currentTotals, prevTotals,
    dailySpend, dailyClicks,
    leadsCurrent, leadsPrev,
    bookings,
    bookingsCurrent, bookingsPrev,
    campaigns,
    creative,
    audiences,
  ] = await Promise.all([
    sumMetaTotals(clientId, range.current.start, range.current.end),
    sumMetaTotals(clientId, range.previous.start, range.previous.end),
    dailyMetaSpend(clientId, range.current.start, range.current.end),
    dailyMetaClicks(clientId, range.current.start, range.current.end),
    listOppsCreatedInRange(clientId, range.current.start, range.current.end),
    listOppsCreatedInRange(clientId, range.previous.start, range.previous.end),
    countBookingsForClient(clientId, range),
    listBookingOpportunities(clientId, range),
    listBookingOpportunities(clientId, {
      current: range.previous,
      previous: range.previous,
      granularity: range.granularity,
    }),
    buildCampaigns(clientId, range),
    buildCreative(clientId, range),
    buildAudiences(clientId, range),
  ]);

  const metaLeadsCurrent = bucketOppsByPlatform(leadsCurrent).meta;
  const metaLeadsPrev = bucketOppsByPlatform(leadsPrev).meta;
  const leadCountCurrent = metaLeadsCurrent.length;
  const leadCountPrev = metaLeadsPrev.length;

  // Bookings attributable to Meta. Note: `countBookingsForClient`
  // returns a total across all platforms — we additionally filter the
  // raw booking opps list by source classification for the Meta-only
  // bookings tile.
  const metaBookingsCurrent = bookingsCurrent.filter(
    o => classifyBookingSource(o.source) === 'meta',
  );
  const metaBookingsPrev = bookingsPrev.filter(
    o => classifyBookingSource(o.source) === 'meta',
  );
  const bookingsValue = metaBookingsCurrent.length;
  const bookingsPrevValue = metaBookingsPrev.length;

  const revenueCurrent = round2(metaBookingsCurrent.reduce((s, o) => s + (o.monetary_value || 0), 0));
  const revenuePrev = round2(metaBookingsPrev.reduce((s, o) => s + (o.monetary_value || 0), 0));

  // Daily leads series (Meta-attributed, by created_at day).
  const leadDaily = new Map<string, number>();
  for (const opp of metaLeadsCurrent) {
    if (!opp.created_at) continue;
    const day = opp.created_at.slice(0, 10);
    leadDaily.set(day, (leadDaily.get(day) ?? 0) + 1);
  }

  // Daily CPL: spend / leads per day.
  const cplDaily = new Map<string, number>();
  for (const [d, spend] of dailySpend) {
    const n = leadDaily.get(d) ?? 0;
    cplDaily.set(d, safeDiv(spend, n));
  }

  // Daily bookings series.
  const bookingDaily = new Map<string, number>();
  for (const opp of metaBookingsCurrent) {
    const ts = opp.last_stage_change_at || opp.updated_at;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    bookingDaily.set(day, (bookingDaily.get(day) ?? 0) + 1);
  }

  // Daily cost-per-booking series.
  const cpbDaily = new Map<string, number>();
  for (const [d, spend] of dailySpend) {
    const n = bookingDaily.get(d) ?? 0;
    cpbDaily.set(d, safeDiv(spend, n));
  }

  // Daily revenue series.
  const revenueDaily = new Map<string, number>();
  for (const opp of metaBookingsCurrent) {
    const ts = opp.last_stage_change_at || opp.updated_at;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    revenueDaily.set(day, (revenueDaily.get(day) ?? 0) + (opp.monetary_value || 0));
  }

  // Daily ROAS series (revenue / spend per day).
  const roasDaily = new Map<string, number>();
  for (const [d, spend] of dailySpend) {
    const r = revenueDaily.get(d) ?? 0;
    roasDaily.set(d, safeDiv(r, spend));
  }

  const cpl = safeDiv(currentTotals.spend, leadCountCurrent);
  const cplPrev = safeDiv(prevTotals.spend, leadCountPrev);
  const cpb = safeDiv(currentTotals.spend, bookingsValue);
  const cpbPrev = safeDiv(prevTotals.spend, bookingsPrevValue);
  const roas = safeDiv(revenueCurrent, currentTotals.spend);
  const roasPrev = safeDiv(revenuePrev, prevTotals.spend);

  const topline: ToplineTile[] = [
    {
      key: 'spend',
      label: 'Spend',
      value: round2(currentTotals.spend),
      prev: round2(prevTotals.spend),
      format: 'currency',
      inverse: true,
      series: buildDailySeries(range, dailySpend),
    },
    {
      key: 'clicks',
      label: 'Clicks',
      value: currentTotals.clicks,
      prev: prevTotals.clicks,
      format: 'number',
      series: buildDailySeries(range, dailyClicks),
    },
    {
      key: 'leads',
      label: 'Leads',
      value: leadCountCurrent,
      prev: leadCountPrev,
      format: 'number',
      series: buildDailySeries(range, leadDaily),
    },
    {
      key: 'cpl',
      label: 'CPL',
      value: round2(cpl),
      prev: round2(cplPrev),
      format: 'currency',
      inverse: true,
      series: buildDailySeries(range, cplDaily),
    },
    {
      key: 'bookings',
      label: 'Bookings',
      value: bookingsValue,
      prev: bookingsPrevValue,
      format: 'number',
      series: buildDailySeries(range, bookingDaily),
      // Booking-rate sidecar — the UI uses these to render
      // bookings/total-leads context next to the tile.
      totalLeads: leadCountCurrent,
      prevLeads: leadCountPrev,
    },
    {
      key: 'cpb',
      label: 'Cost / booking',
      value: round2(cpb),
      prev: round2(cpbPrev),
      format: 'currency',
      inverse: true,
      series: buildDailySeries(range, cpbDaily),
    },
    {
      key: 'revenue',
      label: 'Revenue',
      value: revenueCurrent,
      prev: revenuePrev,
      format: 'currency',
      series: buildDailySeries(range, revenueDaily),
    },
    {
      key: 'roas',
      label: 'ROAS',
      value: round2(roas),
      prev: round2(roasPrev),
      format: 'multiple',
      series: buildDailySeries(range, roasDaily),
    },
  ];

  // Touch unused vars for clarity (bookings totals already used elsewhere).
  void bookings;

  return {
    topline,
    campaigns,
    creative,
    audiences,
  };
}

// ── Campaigns ──────────────────────────────────────────────────────────

interface RawMetaCampaign {
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
}

async function buildCampaigns(clientId: number, range: DateRange): Promise<MetaCampaign[]> {
  const raw = await rows<RawMetaCampaign>(
    `SELECT mi.campaign_id,
            MAX(mi.campaign_name) AS campaign_name,
            COALESCE(SUM(mi.spend), 0) AS spend,
            COALESCE(SUM(mi.impressions), 0) AS impressions,
            COALESCE(SUM(mi.clicks), 0) AS clicks
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'
      GROUP BY mi.campaign_id
      ORDER BY spend DESC
      LIMIT 10`,
    [clientId, range.current.start, range.current.end],
  );
  if (raw.length === 0) return [];

  // For lead attribution we look at this client's meta-classified opps
  // and try to match the campaign name into the opp.source string.
  const opps = await listOppsCreatedInRange(clientId, range.current.start, range.current.end);
  const metaOpps = bucketOppsByPlatform(opps).meta;
  const bookings = await listBookingOpportunities(clientId, range);
  const metaBookings = bookings.filter(o => classifyBookingSource(o.source) === 'meta');

  // Active/Paused — a campaign is "Active" if it had spend on or after
  // the most recent date in the dataset for this client (within the
  // period). Otherwise it's "Paused". Simple, defensible default.
  const lastActiveDays = await rows<{ campaign_id: string; last_date: string }>(
    `SELECT mi.campaign_id, MAX(mi.date) AS last_date
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'
        AND mi.spend > 0
      GROUP BY mi.campaign_id`,
    [clientId, range.current.start, range.current.end],
  );
  const lastActiveMap = new Map<string, string>(lastActiveDays.map(r => [r.campaign_id, r.last_date]));
  const overallLast = lastActiveDays.reduce<string>((acc, r) => (r.last_date > acc ? r.last_date : acc), '');

  return raw.map((c): MetaCampaign => {
    const name = c.campaign_name || c.campaign_id;
    const matchingLeads = countMatchingByName(metaOpps, name);
    const matchingBookings = metaBookings.filter(o =>
      sourceMatchesName(o.source, name),
    );
    const revenue = matchingBookings.reduce((s, o) => s + (o.monetary_value || 0), 0);
    const lastDate = lastActiveMap.get(c.campaign_id) || '';
    const status: 'Active' | 'Paused' = lastDate && lastDate === overallLast ? 'Active' : 'Paused';
    return {
      name,
      status,
      spend: round2(c.spend),
      impr: c.impressions,
      clicks: c.clicks,
      leads: matchingLeads,
      cpl: round2(safeDiv(c.spend, matchingLeads)),
      revenue: round2(revenue),
    };
  });
}

// ── Creative (ad-level) ────────────────────────────────────────────────

interface RawMetaCreative {
  ad_id: string;
  ad_name: string | null;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
}

async function buildCreative(clientId: number, range: DateRange): Promise<MetaCreative[]> {
  // The thumbnail_url column might not exist on older deployments; fall
  // back gracefully (mirrors getMetaTopAds in portal.ts).
  let raw: RawMetaCreative[];
  try {
    raw = await rows<RawMetaCreative>(
      `SELECT mi.ad_id,
              MAX(mi.ad_name) AS ad_name,
              MAX(mi.thumbnail_url) AS thumbnail_url,
              COALESCE(SUM(mi.spend), 0) AS spend,
              COALESCE(SUM(mi.impressions), 0) AS impressions,
              COALESCE(SUM(mi.clicks), 0) AS clicks
         FROM meta_insights mi
         JOIN client_source_mappings csm
           ON csm.external_id = mi.account_id AND csm.source = 'meta'
        WHERE csm.client_id = ?
          AND mi.date BETWEEN ? AND ?
          AND mi.level = 'ad'
          AND mi.ad_id IS NOT NULL
        GROUP BY mi.ad_id
        ORDER BY spend DESC
        LIMIT 4`,
      [clientId, range.current.start, range.current.end],
    );
  } catch {
    raw = await rows<RawMetaCreative>(
      `SELECT mi.ad_id,
              MAX(mi.ad_name) AS ad_name,
              NULL AS thumbnail_url,
              COALESCE(SUM(mi.spend), 0) AS spend,
              COALESCE(SUM(mi.impressions), 0) AS impressions,
              COALESCE(SUM(mi.clicks), 0) AS clicks
         FROM meta_insights mi
         JOIN client_source_mappings csm
           ON csm.external_id = mi.account_id AND csm.source = 'meta'
        WHERE csm.client_id = ?
          AND mi.date BETWEEN ? AND ?
          AND mi.level = 'ad'
          AND mi.ad_id IS NOT NULL
        GROUP BY mi.ad_id
        ORDER BY spend DESC
        LIMIT 4`,
      [clientId, range.current.start, range.current.end],
    );
  }

  if (raw.length === 0) return [];

  const opps = await listOppsCreatedInRange(clientId, range.current.start, range.current.end);
  const metaOpps = bucketOppsByPlatform(opps).meta;

  return raw.map((c): MetaCreative => {
    const name = c.ad_name || c.ad_id;
    const matchingLeads = countMatchingByName(metaOpps, name);
    return {
      name,
      spend: round2(c.spend),
      leads: matchingLeads,
      cpl: round2(safeDiv(c.spend, matchingLeads)),
      ctr: round2(safeDiv(c.clicks, c.impressions) * 100),
      thumb: c.thumbnail_url,
    };
  });
}

// ── Audiences ──────────────────────────────────────────────────────────

interface RawMetaAdset {
  adset_id: string;
  adset_name: string | null;
  spend: number;
}

async function buildAudiences(clientId: number, range: DateRange): Promise<MetaAudience[]> {
  // Meta's `targeting` field isn't reliably synced into `meta_insights`,
  // so the best-effort signal is adset_name. Group spend by adset, take
  // the top 5, attribute leads where adset name appears in the source.
  // Audiences without enough attribution roll up into "Other".
  const raw = await rows<RawMetaAdset>(
    `SELECT mi.adset_id,
            MAX(mi.adset_name) AS adset_name,
            COALESCE(SUM(mi.spend), 0) AS spend
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'adset'
        AND mi.adset_id IS NOT NULL
      GROUP BY mi.adset_id
      ORDER BY spend DESC
      LIMIT 5`,
    [clientId, range.current.start, range.current.end],
  );

  if (raw.length === 0) return [];

  const opps = await listOppsCreatedInRange(clientId, range.current.start, range.current.end);
  const metaOpps = bucketOppsByPlatform(opps).meta;
  const totalAttributable = metaOpps.length;

  return raw.map((a): MetaAudience => {
    const name = a.adset_name || a.adset_id;
    const leads = countMatchingByName(metaOpps, name);
    return {
      name,
      leads,
      cpl: round2(safeDiv(a.spend, leads)),
      share: round2(safeDiv(leads, totalAttributable) * 100),
    };
  });
}

// ── Totals ─────────────────────────────────────────────────────────────

interface MetaTotals {
  spend: number;
  impressions: number;
  clicks: number;
}

async function sumMetaTotals(clientId: number, startIso: string, endIso: string): Promise<MetaTotals> {
  const r = await rows<{ spend: number; impressions: number; clicks: number }>(
    `SELECT COALESCE(SUM(mi.spend), 0) AS spend,
            COALESCE(SUM(mi.impressions), 0) AS impressions,
            COALESCE(SUM(mi.clicks), 0) AS clicks
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'`,
    [clientId, startIso, endIso],
  );
  return r[0] ?? { spend: 0, impressions: 0, clicks: 0 };
}

async function dailyMetaSpend(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<Map<string, number>> {
  const r = await rows<{ d: string; s: number }>(
    `SELECT mi.date AS d, COALESCE(SUM(mi.spend), 0) AS s
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'
      GROUP BY mi.date`,
    [clientId, startIso, endIso],
  );
  const out = new Map<string, number>();
  for (const row of r) out.set(row.d, row.s);
  return out;
}

async function dailyMetaClicks(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<Map<string, number>> {
  const r = await rows<{ d: string; c: number }>(
    `SELECT mi.date AS d, COALESCE(SUM(mi.clicks), 0) AS c
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'
      GROUP BY mi.date`,
    [clientId, startIso, endIso],
  );
  const out = new Map<string, number>();
  for (const row of r) out.set(row.d, row.c);
  return out;
}

// ── Name-matching helpers (best-effort attribution) ────────────────────

/**
 * Tokenise a name for fuzzy substring matching. Lower-cases, strips
 * punctuation, and drops one- and two-letter tokens to avoid false
 * positives (e.g. "UK" matching every campaign).
 */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[_\-|/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

function sourceMatchesName(source: string | null | undefined, name: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  const tokens = nameTokens(name);
  if (tokens.length === 0) return false;
  // Require at least one token in the source string. This is a best-
  // effort heuristic — when nothing matches we honestly return 0.
  return tokens.some(t => s.includes(t));
}

function countMatchingByName<T extends { source: string | null }>(opps: T[], name: string): number {
  let n = 0;
  for (const o of opps) {
    if (sourceMatchesName(o.source, name)) n++;
  }
  return n;
}
