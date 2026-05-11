/**
 * Past Meta ad performance per client — used by the Frame.io → Meta Ad Copy
 * flow to ground new generations in what's already worked.
 *
 * Strategy: join meta_insights to client_source_mappings(source='meta')
 * via account_id, take ad-level rows from the last N days, sum leads from
 * the `actions` JSON blob, rank by leads then ctr, return the top few.
 *
 * Defensive against missing tables — mirrors the safe() pattern used in
 * frameio-dashboard.ts so callers don't need to wrap us in try/catch.
 */
import { db } from './base.js';

export interface MetaWinnerRow {
  ad_id: string;
  ad_name: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number; // % (Meta reports it pre-multiplied)
  leads: number;
  thumbnail_url: string | null;
}

interface InsightAggRow {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  spend_sum: number | null;
  impressions_sum: number | null;
  clicks_sum: number | null;
  thumbnail_url: string | null;
  // We aggregate leads in JS — `actions` is JSON text per row.
  actions_blobs: string | null;
}

/**
 * Count lead actions from a Meta `actions` JSON blob. Matches the lenient
 * matcher in web/lib/monitors/meta-cpl.ts:9-19 — any action_type containing
 * 'lead' counts (covers 'lead', 'offsite_conversion.fb_pixel_lead',
 * 'onsite_conversion.lead_grouped', etc.).
 */
function countLeadsFromActions(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions = JSON.parse(actionsJson) as Array<{ action_type?: string; value?: string }>;
    if (!Array.isArray(actions)) return 0;
    return actions
      .filter((a) => typeof a.action_type === 'string' && a.action_type.toLowerCase().includes('lead'))
      .reduce((sum, a) => sum + (parseInt(a.value ?? '0', 10) || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Top performing Meta ads for a client over the last `days` days.
 *
 * Returns up to `limit` rows, ranked by leads desc, then ctr desc.
 * Quietly returns [] if meta_insights / client_source_mappings are missing
 * or the client has no Meta mapping.
 */
export async function getTopMetaAdsForClient(
  clientId: number,
  days = 60,
  limit = 3,
): Promise<MetaWinnerRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // group_concat is fine on small windows; we use it to pull every actions blob
  // per ad in one round-trip so we can sum leads in JS without N queries.
  let raw;
  try {
    raw = await db.execute({
      sql: `SELECT mi.ad_id,
                   MAX(mi.ad_name)        AS ad_name,
                   MAX(mi.campaign_name)  AS campaign_name,
                   SUM(mi.spend)          AS spend_sum,
                   SUM(mi.impressions)    AS impressions_sum,
                   SUM(mi.clicks)         AS clicks_sum,
                   MAX(mi.thumbnail_url)  AS thumbnail_url,
                   GROUP_CONCAT(mi.actions, char(30)) AS actions_blobs
            FROM meta_insights mi
            JOIN client_source_mappings csm
              ON csm.external_id = mi.account_id AND csm.source = 'meta'
            WHERE csm.client_id = ?
              AND mi.level = 'ad'
              AND mi.ad_id IS NOT NULL
              AND mi.date >= ?
            GROUP BY mi.ad_id`,
      args: [clientId, since],
    });
  } catch {
    return [];
  }

  const aggregated = (raw.rows as unknown as InsightAggRow[])
    .map((row) => {
      const spend = row.spend_sum ?? 0;
      const impressions = row.impressions_sum ?? 0;
      const clicks = row.clicks_sum ?? 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      // GROUP_CONCAT joins with our delimiter (char(30) = ASCII RS). Split,
      // sum leads across every day's blob for this ad.
      const blobs = (row.actions_blobs ?? '').split('\x1e');
      const leads = blobs.reduce((sum, blob) => sum + countLeadsFromActions(blob || null), 0);

      return {
        ad_id: row.ad_id,
        ad_name: row.ad_name ?? '(unnamed ad)',
        campaign_name: row.campaign_name,
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        ctr: Math.round(ctr * 100) / 100,
        leads,
        thumbnail_url: row.thumbnail_url,
      } satisfies MetaWinnerRow;
    })
    // Don't surface ads with no measurable performance — they're noise.
    .filter((r) => r.leads > 0 || r.spend > 0)
    .sort((a, b) => {
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.ctr - a.ctr;
    })
    .slice(0, limit);

  return aggregated;
}
