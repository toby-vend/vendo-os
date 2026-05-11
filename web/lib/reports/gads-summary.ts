/**
 * AGENT-COORD: STUB — Owned by Agent A2 (Summariser).
 *
 * This file exists in A4's worktree only so `npm run typecheck` passes while
 * A2 builds the real implementation in parallel. The coordinator will replace
 * this file at merge time with A2's branch contents. Do NOT edit signatures
 * here without coordinating with A2.
 *
 * Contract (per plans/2026-05-11-google-ads-autonomous-reporting.md):
 *   - Reads `gads_campaign_spend` + `gads_keyword_stats` for the client's
 *     mapped Google Ads customer IDs (via A1's gads_account_client_map +
 *     getClientGadsCustomerIds).
 *   - Aggregates spend / conversions / conversion_value / cpr / roas at the
 *     campaign and account level.
 *   - Filters out £0-spend campaigns.
 *   - Returns `has_data: false` if no mapped customers OR no rows in the
 *     period — callers must check this flag before using the summary.
 */

export interface GoogleAdsCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  conversions: number;
  conversion_value: number;
  cpr: number;
  roas: number | null;
  currency: string;
}

export interface GoogleAdsPeriodSummary {
  client_id: number;
  client_name: string;
  period_start: string;
  period_end: string;
  overall: {
    spend: number;
    conversions: number;
    conversion_value: number;
    cpr: number;
    roas: number | null;
  };
  campaigns: GoogleAdsCampaignRow[];
  account_count: number;
  has_data: boolean;
}

/**
 * STUB — returns a no-data shell. A2 will replace this with the real
 * aggregation. Until then, callers that check `.has_data` will skip the
 * structured-summary branch and fall back to screenshot OCR.
 */
export async function buildGoogleAdsPeriodSummary(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<GoogleAdsPeriodSummary> {
  return {
    client_id: clientId,
    client_name: '',
    period_start: periodStart,
    period_end: periodEnd,
    overall: {
      spend: 0,
      conversions: 0,
      conversion_value: 0,
      cpr: 0,
      roas: null,
    },
    campaigns: [],
    account_count: 0,
    has_data: false,
  };
}
