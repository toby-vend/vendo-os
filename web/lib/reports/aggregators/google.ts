/**
 * Google (Paid Search) aggregator.
 *
 * Builds the GoogleBlock for the v2 client dashboard:
 *   - 8 topline tiles (spend, clicks, leads, cpl, bookings, cpb,
 *     revenue, roas) with 30-day daily sparklines + previous-period
 *     comparisons
 *   - Top campaigns (≤10) by spend, with leads attributed by campaign id
 *     or name appearing in GHL opportunity.source
 *   - Top keywords (≤6) by clicks
 *   - Device split rows from gads_device_split (Mobile / Desktop / Tablet)
 *
 * Data sources:
 *   - gads_campaign_spend   (daily campaign performance)
 *   - gads_keyword_stats    (daily keyword performance)
 *   - gads_device_split     (daily device-segmented performance — new in
 *                            scripts/migrations/2026-05-12-gads-device-split.ts)
 *   - ghl_opportunities     (leads + bookings, attributed via
 *                            classifyBookingSource on the `source` field)
 *
 * Returns `{ block, deviceSplitMissing }`. The orchestrator
 * (build-dashboard-data.ts) unpacks the block into the payload and hoists
 * `deviceSplitMissing` into `payload.flags.deviceSplitMissing`.
 *
 * See plans/2026-05-12-client-report-v2-tab-dashboard.md §4.
 */
import { rows } from '../../queries/base.js';
import { getClientGadsCustomerIds } from '../../queries/reports.js';
import {
  campaignIdFilter,
  fetchLatestCampaignMeta,
  isActiveStatus,
} from '../gads-active-campaigns.js';
import { classifyBookingSource, countBookingsForClient, listBookingOpportunities } from '../booking-rule.js';
import { classifyByDefaults } from '../treatment-defaults.js';
import type {
  DateRange,
  GoogleBlock,
  GoogleCampaign,
  GoogleDevice,
  GoogleKeyword,
  ToplineTile,
} from '../dashboard-types.js';

const MAX_CAMPAIGNS = 10;
const MAX_KEYWORDS = 6;

export interface BuildGoogleResult {
  block: GoogleBlock;
  /** True when no rows exist in gads_device_split for this client/period. */
  deviceSplitMissing: boolean;
}

// ── Public entry point ────────────────────────────────────────────────────

export async function buildGoogle(clientId: number, range: DateRange): Promise<BuildGoogleResult> {
  const customerIds = await getClientGadsCustomerIds(clientId);

  // No mapped Google Ads accounts → return an empty block. We still flag
  // device-split as missing so the UI can show the "Coming soon" hint
  // consistently with clients who do have data but no device rows.
  if (customerIds.length === 0) {
    return {
      block: { topline: [], campaigns: [], keywords: [], devices: [] },
      deviceSplitMissing: true,
    };
  }

  // Resolve the active campaign set for the current period FIRST. A report
  // mirrors the live Google Ads account: paused/removed (wound-down) campaigns
  // are excluded from every rollup, so the toplines match the client's backend
  // rather than double-counting legacy campaigns left over from a restructure.
  // The same active set is reused for the previous period so % deltas compare
  // like-for-like (latest name/status also drives the campaign table display).
  const latestMeta = await fetchLatestCampaignMeta(customerIds, range.current.start, range.current.end);
  const metaById = new Map(latestMeta.map(m => [m.campaign_id, m]));
  const activeIds = latestMeta.filter(m => isActiveStatus(m.campaign_status)).map(m => m.campaign_id);

  // Fan out reads in parallel.
  const [
    currentDaily,
    prevDaily,
    campaignAgg,
    keywordAgg,
    deviceAgg,
    leadsCurrent,
    leadsPrev,
    bookingCount,
    bookingOpps,
  ] = await Promise.all([
    fetchDailyTotals(customerIds, range.current.start, range.current.end, activeIds),
    fetchDailyTotals(customerIds, range.previous.start, range.previous.end, activeIds),
    fetchCampaignAggregate(customerIds, range.current.start, range.current.end, activeIds),
    fetchKeywordAggregate(customerIds, range.current.start, range.current.end, activeIds),
    fetchDeviceAggregate(customerIds, range.current.start, range.current.end, activeIds),
    fetchGoogleLeads(clientId, range.current.start, range.current.end),
    fetchGoogleLeads(clientId, range.previous.start, range.previous.end),
    countBookingsForClient(clientId, range),
    listBookingOpportunities(clientId, range),
  ]);

  // ── Topline rollups ───────────────────────────────────────────────────
  const totalsCurrent = sumDaily(currentDaily);
  const totalsPrev = sumDaily(prevDaily);

  // Bookings attributed to Google by inspecting opportunity.source. The
  // booking-rule helper returns the *count* of all booked opportunities;
  // we re-filter the opportunity list down to Google-only here so the
  // tile is platform-specific.
  const googleBookingsCurrent = bookingOpps.filter(
    o => classifyBookingSource(o.source) === 'google',
  ).length;

  // We don't have a previous-period opp list (the booking-rule helper
  // doesn't return one) — for the v1 tile we compare current bookings
  // to total booking delta scaled by the share. Acceptable approximation
  // until A2 surfaces a previous-period opp list. Falls back to 0 when
  // current/total are both 0.
  const totalCurrent = bookingCount.total || 0;
  const googleShare = totalCurrent > 0 ? googleBookingsCurrent / totalCurrent : 0;
  const googleBookingsPrev = Math.round(bookingCount.totalPrev * googleShare);

  const leadsCurrentCount = leadsCurrent.length;
  const leadsPrevCount = leadsPrev.length;

  const series = sparklineSeries(currentDaily, range.current.start, range.current.end);

  const cplCurrent = leadsCurrentCount > 0 ? totalsCurrent.spend / leadsCurrentCount : 0;
  const cplPrev = leadsPrevCount > 0 ? totalsPrev.spend / leadsPrevCount : 0;
  const cpbCurrent = googleBookingsCurrent > 0 ? totalsCurrent.spend / googleBookingsCurrent : 0;
  const cpbPrev = googleBookingsPrev > 0 ? totalsPrev.spend / googleBookingsPrev : 0;
  const revenueCurrent = sumOppValue(bookingOpps.filter(o => classifyBookingSource(o.source) === 'google'));
  const revenuePrev = 0; // No prev-period opp list available; left at 0 for v1.
  const roasCurrent = totalsCurrent.spend > 0 ? revenueCurrent / totalsCurrent.spend : 0;
  const roasPrev = totalsPrev.spend > 0 ? revenuePrev / totalsPrev.spend : 0;

  const topline: ToplineTile[] = [
    {
      key: 'spend',
      label: 'Spend',
      value: totalsCurrent.spend,
      prev: totalsPrev.spend,
      format: 'currency',
      series: series.spend,
    },
    {
      key: 'clicks',
      label: 'Clicks',
      value: totalsCurrent.clicks,
      prev: totalsPrev.clicks,
      format: 'number',
      series: series.clicks,
    },
    {
      key: 'leads',
      label: 'Leads',
      value: leadsCurrentCount,
      prev: leadsPrevCount,
      format: 'number',
      series: series.clicks,  // sparkline placeholder — leads aren't daily-bucketed yet
    },
    {
      key: 'cpl',
      label: 'CPL',
      value: cplCurrent,
      prev: cplPrev,
      format: 'currency',
      inverse: true,
      series: series.spend,
    },
    {
      key: 'bookings',
      label: 'Bookings',
      value: googleBookingsCurrent,
      prev: googleBookingsPrev,
      format: 'number',
      totalLeads: leadsCurrentCount,
      prevLeads: leadsPrevCount,
      series: series.clicks,
    },
    {
      key: 'cpb',
      label: 'CPB',
      value: cpbCurrent,
      prev: cpbPrev,
      format: 'currency',
      inverse: true,
      series: series.spend,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      value: revenueCurrent,
      prev: revenuePrev,
      format: 'currency',
      series: series.spend,
    },
    {
      key: 'roas',
      label: 'ROAS',
      value: roasCurrent,
      prev: roasPrev,
      format: 'multiple',
      series: series.spend,
    },
  ];

  // ── Campaigns table ───────────────────────────────────────────────────
  // Enrich each campaign's period sums with its latest-known name + status
  // (correct display name after a rename, end-of-period status) from the
  // active-set metadata, rather than a lexicographic MAX().
  const campaignRows: CampaignAggRow[] = campaignAgg.map((c): CampaignAggRow => {
    const meta = metaById.get(c.campaign_id);
    return {
      ...c,
      campaign_name: meta?.campaign_name ?? null,
      campaign_status: meta?.campaign_status ?? null,
    };
  });

  const campaignLeadCounts = attributeLeadsToCampaigns(leadsCurrent, campaignRows);
  const campaignRevenueByName = attributeRevenueToCampaigns(
    bookingOpps.filter(o => classifyBookingSource(o.source) === 'google'),
    campaignRows,
  );

  const campaigns: GoogleCampaign[] = campaignRows
    .slice(0, MAX_CAMPAIGNS)
    .map((c): GoogleCampaign => {
      const leads = campaignLeadCounts.get(c.campaign_id) ?? 0;
      return {
        name: c.campaign_name || '(unnamed campaign)',
        status: c.campaign_status || 'Unknown',
        spend: c.spend,
        impr: c.impressions,
        clicks: c.clicks,
        leads,
        cpl: leads > 0 ? c.spend / leads : 0,
        revenue: campaignRevenueByName.get(c.campaign_id) ?? 0,
      };
    });

  // ── Keywords table ───────────────────────────────────────────────────
  const keywords: GoogleKeyword[] = keywordAgg
    .slice(0, MAX_KEYWORDS)
    .map((k): GoogleKeyword => ({
      kw: k.keyword_text,
      clicks: k.clicks,
      cost: k.spend,
      leads: 0,  // keyword-level attribution not wired yet
      cpc: k.clicks > 0 ? k.spend / k.clicks : 0,
    }));

  // ── Device split ──────────────────────────────────────────────────────
  // share = clicks share (a sensible proxy for "where leads are coming from"
  // when we don't have device-level GHL data). Leads per device approximated
  // by leads × clickShare. Empty array signals deviceSplitMissing.
  const deviceSplitMissing = deviceAgg.length === 0;
  const totalDeviceClicks = deviceAgg.reduce((s, d) => s + d.clicks, 0);

  const devices: GoogleDevice[] = deviceAgg
    .filter(d => d.device === 'Mobile' || d.device === 'Desktop' || d.device === 'Tablet')
    .map((d): GoogleDevice => {
      const share = totalDeviceClicks > 0 ? (d.clicks / totalDeviceClicks) * 100 : 0;
      const leadsForDevice = Math.round(leadsCurrentCount * (share / 100));
      return {
        name: d.device as 'Mobile' | 'Desktop' | 'Tablet',
        share,
        leads: leadsForDevice,
        cpl: leadsForDevice > 0 ? d.spend / leadsForDevice : 0,
      };
    });

  return {
    block: { topline, campaigns, keywords, devices },
    deviceSplitMissing,
  };
}

// ── Daily totals + sparkline ─────────────────────────────────────────────

interface DailyRow {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversion_value: number;
}

async function fetchDailyTotals(
  customerIds: string[],
  start: string,
  end: string,
  activeIds: string[],
): Promise<DailyRow[]> {
  const placeholders = customerIds.map(() => '?').join(',');
  const active = campaignIdFilter(activeIds);
  return rows<DailyRow>(
    `SELECT date,
            SUM(spend)            AS spend,
            SUM(clicks)           AS clicks,
            SUM(impressions)      AS impressions,
            SUM(conversions)      AS conversions,
            SUM(conversion_value) AS conversion_value
       FROM gads_campaign_spend
      WHERE account_id IN (${placeholders})
        AND date BETWEEN ? AND ?${active.clause}
      GROUP BY date
      ORDER BY date ASC`,
    [...customerIds, start, end, ...active.params],
  );
}

interface PeriodTotals {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversion_value: number;
}

function sumDaily(daily: DailyRow[]): PeriodTotals {
  return daily.reduce(
    (acc, d) => ({
      spend: acc.spend + Number(d.spend ?? 0),
      clicks: acc.clicks + Number(d.clicks ?? 0),
      impressions: acc.impressions + Number(d.impressions ?? 0),
      conversions: acc.conversions + Number(d.conversions ?? 0),
      conversion_value: acc.conversion_value + Number(d.conversion_value ?? 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0 },
  );
}

/**
 * Build a dense daily series across [start, end]. Missing dates fill with 0.
 * Returns parallel arrays for the sparkline tiles.
 */
function sparklineSeries(daily: DailyRow[], start: string, end: string): {
  spend: number[];
  clicks: number[];
} {
  const byDate = new Map(daily.map(d => [d.date, d]));
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  const days = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000)) + 1;
  const spend: number[] = [];
  const clicks: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const row = byDate.get(iso);
    spend.push(row ? Number(row.spend ?? 0) : 0);
    clicks.push(row ? Number(row.clicks ?? 0) : 0);
  }
  return { spend, clicks };
}

// ── Campaign rollup ───────────────────────────────────────────────────────

interface CampaignSumRow {
  account_id: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
}

/** Sums + the latest-known name/status (merged in `buildGoogle`). */
interface CampaignAggRow extends CampaignSumRow {
  campaign_name: string | null;
  campaign_status: string | null;
}

async function fetchCampaignAggregate(
  customerIds: string[],
  start: string,
  end: string,
  activeIds: string[],
): Promise<CampaignSumRow[]> {
  const placeholders = customerIds.map(() => '?').join(',');
  const active = campaignIdFilter(activeIds);
  // Period sums per campaign. Name + status are NOT taken here (a lexicographic
  // MAX mis-picks after a rename/re-enable); the caller merges the latest-by-
  // date values from fetchLatestCampaignMeta. The active filter drops paused/
  // removed campaigns so the table mirrors the live account.
  return rows<CampaignSumRow>(
    `SELECT account_id,
            campaign_id,
            SUM(spend)            AS spend,
            SUM(impressions)      AS impressions,
            SUM(clicks)           AS clicks,
            SUM(conversions)      AS conversions,
            SUM(conversion_value) AS conversion_value
       FROM gads_campaign_spend
      WHERE account_id IN (${placeholders})
        AND date BETWEEN ? AND ?${active.clause}
      GROUP BY account_id, campaign_id
      HAVING SUM(spend) > 0
      ORDER BY SUM(spend) DESC`,
    [...customerIds, start, end, ...active.params],
  );
}

// ── Keyword rollup ────────────────────────────────────────────────────────

interface KeywordAggRow {
  keyword_text: string;
  campaign_name: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

async function fetchKeywordAggregate(
  customerIds: string[],
  start: string,
  end: string,
  activeIds: string[],
): Promise<KeywordAggRow[]> {
  const placeholders = customerIds.map(() => '?').join(',');
  const active = campaignIdFilter(activeIds);
  return rows<KeywordAggRow>(
    `SELECT keyword_text,
            MAX(campaign_name) AS campaign_name,
            SUM(spend)         AS spend,
            SUM(clicks)        AS clicks,
            SUM(impressions)   AS impressions,
            SUM(conversions)   AS conversions
       FROM gads_keyword_stats
      WHERE account_id IN (${placeholders})
        AND date BETWEEN ? AND ?${active.clause}
      GROUP BY keyword_text
      HAVING SUM(clicks) > 0
      ORDER BY SUM(clicks) DESC
      LIMIT 50`,
    [...customerIds, start, end, ...active.params],
  );
}

// ── Device rollup ─────────────────────────────────────────────────────────

interface DeviceAggRow {
  device: string;
  spend: number;
  clicks: number;
  impressions: number;
}

async function fetchDeviceAggregate(
  customerIds: string[],
  start: string,
  end: string,
  activeIds: string[],
): Promise<DeviceAggRow[]> {
  const placeholders = customerIds.map(() => '?').join(',');
  const active = campaignIdFilter(activeIds);
  // The gads_device_split table may not exist on clients whose machine
  // hasn't run the new migration yet. Catch + return [] so the aggregator
  // degrades gracefully (the orchestrator then sets deviceSplitMissing).
  try {
    return await rows<DeviceAggRow>(
      `SELECT device,
              SUM(spend)       AS spend,
              SUM(clicks)      AS clicks,
              SUM(impressions) AS impressions
         FROM gads_device_split
        WHERE account_id IN (${placeholders})
          AND date BETWEEN ? AND ?${active.clause}
        GROUP BY device
        ORDER BY SUM(spend) DESC`,
      [...customerIds, start, end, ...active.params],
    );
  } catch {
    return [];
  }
}

// ── Lead attribution (GHL → Google) ───────────────────────────────────────

interface GhlOppLite {
  id: string;
  source: string | null;
  monetary_value: number;
  created_at: string | null;
  /** GHL pipeline name (each pipeline is a treatment) — the real attribution
   *  signal. Optional so booking-rule opportunities (which don't carry it)
   *  remain assignable; those fall back to `source`. */
  pipeline_name?: string | null;
}

/**
 * All Google-attributed opportunities created in the period. We rely on
 * `classifyBookingSource` to decide which `source` strings count as Google.
 * Filtering happens in JS (cheap; clients have hundreds, not millions, of
 * opps) so the SQL stays simple and the classifier is the single source
 * of truth for "is this Google".
 */
async function fetchGoogleLeads(
  clientId: number,
  start: string,
  end: string,
): Promise<GhlOppLite[]> {
  const all = await rows<GhlOppLite>(
    `SELECT o.id, o.source, o.monetary_value, o.created_at, p.name AS pipeline_name
       FROM ghl_opportunities o
       LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
      WHERE o.location_id IN (
              SELECT external_id FROM client_source_mappings
               WHERE client_id = ? AND source = 'ghl'
            )
        AND o.created_at IS NOT NULL
        AND o.created_at >= ?
        AND o.created_at <= ?`,
    [clientId, start, end + 'T23:59:59'],
  );
  return all.filter(o => classifyBookingSource(o.source) === 'google');
}

/**
 * Map opp.source → campaign row by substring matching campaign id or name.
 * Returns a Map<campaign_id, leadCount>. Unmatched leads are dropped
 * silently (they still count in the topline tile — they just don't show
 * up against a specific campaign).
 */
/**
 * Map each treatment to its highest-spend campaign for this client. GHL leads
 * carry no campaign reference — only a pipeline, and each pipeline IS a
 * treatment (e.g. "General Dentistry Appointments"). Campaigns classify to the
 * same treatment labels via the built-in keyword library, so treatment is the
 * join key. When several campaigns share a treatment the top spender wins.
 */
function buildTreatmentToCampaign(campaigns: CampaignAggRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of [...campaigns].sort((a, b) => b.spend - a.spend)) {
    const treatment = classifyByDefaults(c.campaign_name ?? '');
    if (treatment && !map.has(treatment)) map.set(treatment, c.campaign_id);
  }
  return map;
}

/**
 * Treatment for a GHL opportunity: prefer its pipeline name (the real signal),
 * fall back to the free-text `source` for opps without a classifiable pipeline.
 */
function oppTreatment(opp: GhlOppLite): string | null {
  return (
    classifyByDefaults(opp.pipeline_name ?? '') ??
    (opp.source ? classifyByDefaults(opp.source) : null)
  );
}

/**
 * Attribute leads to campaigns via pipeline → treatment → campaign. Opps whose
 * treatment maps to no active campaign (e.g. a PMax-only treatment) stay
 * unattributed — they still count in the topline Leads tile.
 */
function attributeLeadsToCampaigns(
  opps: GhlOppLite[],
  campaigns: CampaignAggRow[],
): Map<string, number> {
  const treatmentToCampaign = buildTreatmentToCampaign(campaigns);
  const counts = new Map<string, number>();
  for (const opp of opps) {
    const treatment = oppTreatment(opp);
    if (!treatment) continue;
    const campaignId = treatmentToCampaign.get(treatment);
    if (!campaignId) continue;
    counts.set(campaignId, (counts.get(campaignId) ?? 0) + 1);
  }
  return counts;
}

/** Same attribution as above but summing monetary_value instead of count. */
function attributeRevenueToCampaigns(
  opps: GhlOppLite[],
  campaigns: CampaignAggRow[],
): Map<string, number> {
  const treatmentToCampaign = buildTreatmentToCampaign(campaigns);
  const revenue = new Map<string, number>();
  for (const opp of opps) {
    const treatment = oppTreatment(opp);
    if (!treatment) continue;
    const campaignId = treatmentToCampaign.get(treatment);
    if (!campaignId) continue;
    revenue.set(campaignId, (revenue.get(campaignId) ?? 0) + Number(opp.monetary_value ?? 0));
  }
  return revenue;
}

function sumOppValue(opps: GhlOppLite[]): number {
  return opps.reduce((s, o) => s + Number(o.monetary_value ?? 0), 0);
}
