/**
 * Overview aggregator.
 *
 * Builds the Overview tab's KPI row (4 KPIs with 30-day sparklines) and
 * the 3-channel grid (Meta, Google, SEO) with deltas vs the previous
 * period.
 *
 * Treatment rows are owned by A6 (`treatment.ts`). We leave
 * `treatments: []` here — the orchestrator (`build-dashboard-data.ts`)
 * merges A6's output into this block.
 *
 * Conventions:
 *  - Spend is Meta (`meta_insights`) + Google (`gads_campaign_spend`)
 *    at campaign level, joined to the client via `client_source_mappings`.
 *  - Leads = GHL opportunities `created_at` within the period.
 *  - Revenue = sum of `monetary_value` from `ghl_opportunities` that sit
 *    in the Booked Appointment pipeline within the period (booking-rule).
 *  - SEO traffic = `ga4_traffic_sources` rows where `medium = 'organic'`.
 *  - Per-channel leads attribute via `classifyBookingSource(opp.source)`.
 *
 * Never fabricates: when a source has no data we return 0/[] and let
 * the React UI surface the right empty state.
 */
import { rows } from '../../queries/base.js';
import { listBookingOpportunities, classifyBookingSource } from '../booking-rule.js';
import type {
  ChannelDelta,
  DateRange,
  Kpi,
  OverviewBlock,
  OverviewChannel,
} from '../dashboard-types.js';
import {
  bucketOppsByPlatform,
  buildDailySeries,
  listOppsCreatedInRange,
  round2,
  safeDiv,
} from './shared.js';

// ── Public entry point ─────────────────────────────────────────────────

export async function buildOverview(clientId: number, range: DateRange): Promise<OverviewBlock> {
  const [
    metaSpendCurrent, metaSpendPrev,
    googleSpendCurrent, googleSpendPrev,
    metaDailyCurrent,
    googleDailyCurrent,
    leadsCurrent, leadsPrev,
    organicDailyCurrent, organicTotalCurrent, organicTotalPrev,
    bookingsCurrent, bookingsPrev,
  ] = await Promise.all([
    sumMetaSpend(clientId, range.current.start, range.current.end),
    sumMetaSpend(clientId, range.previous.start, range.previous.end),
    sumGoogleSpend(clientId, range.current.start, range.current.end),
    sumGoogleSpend(clientId, range.previous.start, range.previous.end),
    dailyMetaSpend(clientId, range.current.start, range.current.end),
    dailyGoogleSpend(clientId, range.current.start, range.current.end),
    listOppsCreatedInRange(clientId, range.current.start, range.current.end),
    listOppsCreatedInRange(clientId, range.previous.start, range.previous.end),
    dailyOrganicUsers(clientId, range.current.start, range.current.end),
    sumOrganicUsers(clientId, range.current.start, range.current.end),
    sumOrganicUsers(clientId, range.previous.start, range.previous.end),
    listBookingOpportunities(clientId, range),
    listBookingOpportunities(clientId, {
      current: range.previous,
      previous: range.previous,
      granularity: range.granularity,
    }),
  ]);

  const spendCurrent = round2(metaSpendCurrent + googleSpendCurrent);
  const spendPrev = round2(metaSpendPrev + googleSpendPrev);
  const leadCountCurrent = leadsCurrent.length;
  const leadCountPrev = leadsPrev.length;
  const revenueCurrent = round2(bookingsCurrent.reduce((s, o) => s + (o.monetary_value || 0), 0));
  const revenuePrev = round2(bookingsPrev.reduce((s, o) => s + (o.monetary_value || 0), 0));

  // Combined daily spend series for the spend KPI.
  const totalDaily = new Map<string, number>();
  for (const [d, v] of metaDailyCurrent) totalDaily.set(d, (totalDaily.get(d) ?? 0) + v);
  for (const [d, v] of googleDailyCurrent) totalDaily.set(d, (totalDaily.get(d) ?? 0) + v);

  // Daily lead series — bucket leadsCurrent by created_at day.
  const leadDaily = new Map<string, number>();
  for (const opp of leadsCurrent) {
    if (!opp.created_at) continue;
    const day = opp.created_at.slice(0, 10);
    leadDaily.set(day, (leadDaily.get(day) ?? 0) + 1);
  }

  // Daily CPL — derived from the two series above, day by day.
  const cplDaily = new Map<string, number>();
  for (const [d, spend] of totalDaily) {
    const n = leadDaily.get(d) ?? 0;
    cplDaily.set(d, safeDiv(spend, n));
  }

  // Daily revenue series — sum bookings by last_stage_change_at day
  // (falling back to updated_at, matching booking-rule.ts semantics).
  const revenueDaily = new Map<string, number>();
  for (const opp of bookingsCurrent) {
    const ts = opp.last_stage_change_at || opp.updated_at;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    revenueDaily.set(day, (revenueDaily.get(day) ?? 0) + (opp.monetary_value || 0));
  }

  const kpis: Kpi[] = [
    {
      key: 'spend',
      label: 'Spend',
      value: spendCurrent,
      prev: spendPrev,
      format: 'currency',
      inverse: true,
      series: buildDailySeries(range, totalDaily),
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
      value: round2(safeDiv(spendCurrent, leadCountCurrent)),
      prev: round2(safeDiv(spendPrev, leadCountPrev)),
      format: 'currency',
      inverse: true,
      series: buildDailySeries(range, cplDaily),
    },
    {
      key: 'revenue',
      label: 'Revenue',
      value: revenueCurrent,
      prev: revenuePrev,
      format: 'currency',
      series: buildDailySeries(range, revenueDaily),
    },
  ];

  // Per-channel attribution
  const currentBuckets = bucketOppsByPlatform(leadsCurrent);
  const prevBuckets = bucketOppsByPlatform(leadsPrev);

  const metaLeadsCurrent = currentBuckets.meta.length;
  const metaLeadsPrev = prevBuckets.meta.length;
  const googleLeadsCurrent = currentBuckets.google.length;
  const googleLeadsPrev = prevBuckets.google.length;
  const organicLeadsCurrent = currentBuckets.organic.length;
  const organicLeadsPrev = prevBuckets.organic.length;

  // Per-channel revenue — sum monetary_value of bookings whose source
  // classifies to that platform.
  const sumBookingRevenue = (
    list: typeof bookingsCurrent,
    platform: 'meta' | 'google' | 'organic',
  ): number =>
    list
      .filter(o => classifyBookingSource(o.source) === platform)
      .reduce((s, o) => s + (o.monetary_value || 0), 0);

  const metaRevenueCurrent = round2(sumBookingRevenue(bookingsCurrent, 'meta'));
  const metaRevenuePrev = round2(sumBookingRevenue(bookingsPrev, 'meta'));
  const googleRevenueCurrent = round2(sumBookingRevenue(bookingsCurrent, 'google'));
  const googleRevenuePrev = round2(sumBookingRevenue(bookingsPrev, 'google'));
  const organicRevenueCurrent = round2(sumBookingRevenue(bookingsCurrent, 'organic'));
  const organicRevenuePrev = round2(sumBookingRevenue(bookingsPrev, 'organic'));

  const metaCpl = safeDiv(metaSpendCurrent, metaLeadsCurrent);
  const metaCplPrev = safeDiv(metaSpendPrev, metaLeadsPrev);
  const googleCpl = safeDiv(googleSpendCurrent, googleLeadsCurrent);
  const googleCplPrev = safeDiv(googleSpendPrev, googleLeadsPrev);
  const organicCpl = 0; // organic has no spend
  const organicCplPrev = 0;

  const metaChannel: OverviewChannel = {
    key: 'meta',
    name: 'Meta',
    sub: 'Facebook & Instagram',
    spend: round2(metaSpendCurrent),
    leads: metaLeadsCurrent,
    cpl: round2(metaCpl),
    revenue: metaRevenueCurrent,
    delta: pctDelta({
      spend: { current: metaSpendCurrent, prev: metaSpendPrev },
      leads: { current: metaLeadsCurrent, prev: metaLeadsPrev },
      cpl: { current: metaCpl, prev: metaCplPrev },
      revenue: { current: metaRevenueCurrent, prev: metaRevenuePrev },
    }),
    tone: 'indigo',
  };

  const googleChannel: OverviewChannel = {
    key: 'google',
    name: 'Google',
    sub: 'Paid search',
    spend: round2(googleSpendCurrent),
    leads: googleLeadsCurrent,
    cpl: round2(googleCpl),
    revenue: googleRevenueCurrent,
    delta: pctDelta({
      spend: { current: googleSpendCurrent, prev: googleSpendPrev },
      leads: { current: googleLeadsCurrent, prev: googleLeadsPrev },
      cpl: { current: googleCpl, prev: googleCplPrev },
      revenue: { current: googleRevenueCurrent, prev: googleRevenuePrev },
    }),
    tone: 'amber',
  };

  const seoChannel: OverviewChannel = {
    key: 'seo',
    name: 'SEO',
    sub: 'Organic search',
    spend: null,
    traffic: organicTotalCurrent,
    leads: organicLeadsCurrent,
    cpl: round2(organicCpl),
    revenue: organicRevenueCurrent,
    delta: pctDelta({
      traffic: { current: organicTotalCurrent, prev: organicTotalPrev },
      leads: { current: organicLeadsCurrent, prev: organicLeadsPrev },
      cpl: { current: organicCpl, prev: organicCplPrev },
      revenue: { current: organicRevenueCurrent, prev: organicRevenuePrev },
    }),
    tone: 'teal',
  };

  // Use organic daily series to allow the SEO card to render a sparkline
  // if the UI wants one in future — currently unused but cheap to compute.
  void organicDailyCurrent;

  return {
    kpis,
    channels: [metaChannel, googleChannel, seoChannel],
    treatments: [], // A6 owns this; orchestrator merges in.
  };
}

// ── SQL helpers ────────────────────────────────────────────────────────

async function sumMetaSpend(clientId: number, startIso: string, endIso: string): Promise<number> {
  const r = await rows<{ s: number | null }>(
    `SELECT COALESCE(SUM(mi.spend), 0) AS s
       FROM meta_insights mi
       JOIN client_source_mappings csm
         ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ?
        AND mi.date BETWEEN ? AND ?
        AND mi.level = 'campaign'`,
    [clientId, startIso, endIso],
  );
  return r[0]?.s ?? 0;
}

async function sumGoogleSpend(clientId: number, startIso: string, endIso: string): Promise<number> {
  const r = await rows<{ s: number | null }>(
    `SELECT COALESCE(SUM(gs.spend), 0) AS s
       FROM gads_campaign_spend gs
       JOIN client_source_mappings csm
         ON csm.external_id = gs.account_id AND csm.source = 'gads'
      WHERE csm.client_id = ?
        AND gs.date BETWEEN ? AND ?`,
    [clientId, startIso, endIso],
  );
  return r[0]?.s ?? 0;
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

async function dailyGoogleSpend(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<Map<string, number>> {
  const r = await rows<{ d: string; s: number }>(
    `SELECT gs.date AS d, COALESCE(SUM(gs.spend), 0) AS s
       FROM gads_campaign_spend gs
       JOIN client_source_mappings csm
         ON csm.external_id = gs.account_id AND csm.source = 'gads'
      WHERE csm.client_id = ?
        AND gs.date BETWEEN ? AND ?
      GROUP BY gs.date`,
    [clientId, startIso, endIso],
  );
  const out = new Map<string, number>();
  for (const row of r) out.set(row.d, row.s);
  return out;
}

async function dailyOrganicUsers(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<Map<string, number>> {
  const r = await rows<{ d: string; u: number }>(
    `SELECT ts.date AS d, COALESCE(SUM(ts.users), 0) AS u
       FROM ga4_traffic_sources ts
       JOIN client_source_mappings csm
         ON csm.external_id = ts.property_id AND csm.source = 'ga4'
      WHERE csm.client_id = ?
        AND ts.date BETWEEN ? AND ?
        AND LOWER(ts.medium) = 'organic'
      GROUP BY ts.date`,
    [clientId, startIso, endIso],
  );
  const out = new Map<string, number>();
  for (const row of r) out.set(row.d, row.u);
  return out;
}

async function sumOrganicUsers(clientId: number, startIso: string, endIso: string): Promise<number> {
  const r = await rows<{ u: number | null }>(
    `SELECT COALESCE(SUM(ts.users), 0) AS u
       FROM ga4_traffic_sources ts
       JOIN client_source_mappings csm
         ON csm.external_id = ts.property_id AND csm.source = 'ga4'
      WHERE csm.client_id = ?
        AND ts.date BETWEEN ? AND ?
        AND LOWER(ts.medium) = 'organic'`,
    [clientId, startIso, endIso],
  );
  return r[0]?.u ?? 0;
}

// ── Delta helper ───────────────────────────────────────────────────────

function pctDelta(values: {
  spend?: { current: number; prev: number };
  leads?: { current: number; prev: number };
  cpl?: { current: number; prev: number };
  revenue?: { current: number; prev: number };
  traffic?: { current: number; prev: number };
}): ChannelDelta {
  const compute = (a?: { current: number; prev: number }): number | undefined => {
    if (!a) return undefined;
    if (!a.prev) return a.current === 0 ? 0 : undefined; // undefined = no comparable baseline
    return round2(((a.current - a.prev) / a.prev) * 100);
  };
  const out: ChannelDelta = {};
  const spend = compute(values.spend); if (spend !== undefined) out.spend = spend;
  const leads = compute(values.leads); if (leads !== undefined) out.leads = leads;
  const cpl = compute(values.cpl); if (cpl !== undefined) out.cpl = cpl;
  const revenue = compute(values.revenue); if (revenue !== undefined) out.revenue = revenue;
  const traffic = compute(values.traffic); if (traffic !== undefined) out.traffic = traffic;
  return out;
}
