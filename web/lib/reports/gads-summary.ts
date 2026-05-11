/**
 * Structured Google Ads summary builder for the Client Reporting module.
 *
 * Reads from the daily-synced `gads_campaign_spend` table (populated by
 * `web/lib/jobs/sync-google-ads.ts`) and aggregates it into a per-campaign
 * breakdown for a client over a reporting period. The result is consumed by
 * `web/lib/report-ai.ts` and injected as canonical data into Claude's prompt
 * — replacing the screenshot OCR path for Google Ads only (other platforms
 * remain screenshot-driven in this phase).
 *
 * Rules (from plans/2026-05-11-google-ads-autonomous-reporting.md):
 *   - Currency: GBP throughout (Vendo convention; see report-ai.ts).
 *   - £0-spend campaigns are FILTERED OUT (mirrors the "skip inactive
 *     campaigns" rule in report-ai.ts).
 *   - CPR = spend / conversions; null only if conversions == 0 (rare after
 *     the £0-spend filter).
 *   - ROAS = conversion_value / spend; null when conversion_value == 0.
 *
 * The client → gads_customer_id mapping is owned by A1 and lives in
 * `web/lib/queries/reports.ts` (`getClientGadsCustomerIds`).
 */
import { rows, scalar } from '../queries/base.js';
import { getClientGadsCustomerIds } from '../queries/reports.js';

export interface GoogleAdsCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;                  // GBP
  conversions: number;
  conversion_value: number;
  cpr: number;                    // cost per result (spend / conversions)
  roas: number | null;            // null when no revenue attributed
  currency: string;
}

export interface GoogleAdsPeriodSummary {
  client_id: number;
  client_name: string;
  period_start: string;           // YYYY-MM-DD
  period_end: string;             // YYYY-MM-DD
  overall: {
    spend: number;
    conversions: number;
    conversion_value: number;
    cpr: number;
    roas: number | null;
  };
  campaigns: GoogleAdsCampaignRow[];   // £0-spend campaigns FILTERED OUT
  account_count: number;
  has_data: boolean;
}

interface SpendRow {
  account_id: string;
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  conversions: number;
  conversion_value: number;
}

/**
 * Build a structured Google Ads summary for `clientId` over the inclusive
 * date range [periodStart, periodEnd]. All currency is treated as GBP per
 * Vendo's reporting conventions.
 */
export async function buildGoogleAdsPeriodSummary(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<GoogleAdsPeriodSummary> {
  // 1. Lookup linked Google Ads customer IDs for this client.
  const customerIds = await getClientGadsCustomerIds(clientId);

  // 2. Resolve client display name (uses display_name fallback to name).
  const clientName = (await scalar<string>(
    `SELECT COALESCE(display_name, name) FROM clients WHERE id = ?`,
    [clientId],
  )) ?? `Client ${clientId}`;

  // 3. Short-circuit when the client has no mapped Google Ads accounts.
  if (!customerIds.length) {
    return {
      client_id: clientId,
      client_name: clientName,
      period_start: periodStart,
      period_end: periodEnd,
      overall: { spend: 0, conversions: 0, conversion_value: 0, cpr: 0, roas: null },
      campaigns: [],
      account_count: 0,
      has_data: false,
    };
  }

  // 4. Aggregate per-campaign across the period and across all mapped
  //    accounts (a client may have multiple linked Google Ads customers).
  const placeholders = customerIds.map(() => '?').join(', ');
  const spendRows = await rows<SpendRow>(
    `SELECT account_id,
            campaign_id,
            campaign_name,
            SUM(spend)             AS spend,
            SUM(conversions)       AS conversions,
            SUM(conversion_value)  AS conversion_value
       FROM gads_campaign_spend
      WHERE account_id IN (${placeholders})
        AND date BETWEEN ? AND ?
      GROUP BY account_id, campaign_id, campaign_name
      ORDER BY SUM(spend) DESC`,
    [...customerIds, periodStart, periodEnd],
  );

  // 5. Map → typed rows. Filter out £0-spend campaigns (inactive in period).
  const campaigns: GoogleAdsCampaignRow[] = [];
  for (const r of spendRows) {
    const spend = Number(r.spend ?? 0);
    if (spend <= 0) continue;
    const conversions = Number(r.conversions ?? 0);
    const conversionValue = Number(r.conversion_value ?? 0);
    const cpr = conversions > 0 ? spend / conversions : 0;
    const roas = conversionValue > 0 ? conversionValue / spend : null;
    campaigns.push({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name ?? '(unnamed campaign)',
      spend,
      conversions,
      conversion_value: conversionValue,
      cpr,
      roas,
      currency: 'GBP',
    });
  }

  // 6. Overall totals across remaining (active) campaigns.
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += c.spend;
      acc.conversions += c.conversions;
      acc.conversion_value += c.conversion_value;
      return acc;
    },
    { spend: 0, conversions: 0, conversion_value: 0 },
  );
  const overallCpr = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const overallRoas = totals.conversion_value > 0 && totals.spend > 0
    ? totals.conversion_value / totals.spend
    : null;

  return {
    client_id: clientId,
    client_name: clientName,
    period_start: periodStart,
    period_end: periodEnd,
    overall: {
      spend: totals.spend,
      conversions: totals.conversions,
      conversion_value: totals.conversion_value,
      cpr: overallCpr,
      roas: overallRoas,
    },
    campaigns,
    account_count: customerIds.length,
    has_data: campaigns.length > 0,
  };
}
