/**
 * Google Ads reconciliation guardrail.
 *
 * A detective control for the reporting pipeline: at report-generation time we
 * pull the live account-level active spend straight from the Google Ads API for
 * the reporting period and compare it to what the DB (gads_campaign_spend) holds
 * for the same active-campaign set. A material gap means the synced data has
 * drifted from Google (missed sync days, attribution lag, a restructure the
 * sync hasn't caught) — exactly the class of problem that silently corrupts a
 * client report. The caller logs/flags the variance so a bad report never ships
 * unnoticed.
 *
 * This runs ONLY at generation time (monthly cron + manual generate) — never in
 * the 15-minute dashboard rebuild path — so it adds at most a handful of API
 * calls per report. It is strictly non-blocking: any failure (missing creds,
 * API error) returns null and the report proceeds.
 */
import { rows } from '../queries/base.js';
import { getClientGadsCustomerIds } from '../queries/reports.js';
import { mintAccessToken, gadsQuery } from '../jobs/sync-google-ads.js';
import { campaignIdFilter, fetchActiveCampaignIds } from './gads-active-campaigns.js';

/** Statuses excluded from active spend — must match gads-active-campaigns.ts. */
const INACTIVE_STATUSES = new Set(['PAUSED', 'REMOVED']);

/** Variance above this (percent) is treated as a material discrepancy. */
export const GADS_RECONCILE_TOLERANCE_PCT = 2;

export interface GadsReconciliation {
  customerIds: string[];
  periodStart: string;
  periodEnd: string;
  /** Sum of spend in gads_campaign_spend for the active campaign set. */
  dbActiveSpend: number;
  /** Sum of cost from the live Google Ads API for currently-active campaigns. */
  apiActiveSpend: number;
  /** |api − db| / max(api, 1) × 100. */
  variancePct: number;
  withinTolerance: boolean;
}

async function sumDbActiveSpend(
  customerIds: string[],
  start: string,
  end: string,
  activeIds: string[],
): Promise<number> {
  const placeholders = customerIds.map(() => '?').join(',');
  const active = campaignIdFilter(activeIds);
  const result = await rows<{ total: number }>(
    `SELECT COALESCE(SUM(spend), 0) AS total
       FROM gads_campaign_spend
      WHERE account_id IN (${placeholders})
        AND date BETWEEN ? AND ?${active.clause}`,
    [...customerIds, start, end, ...active.params],
  );
  return Number(result[0]?.total ?? 0);
}

/**
 * Reconcile the DB's active spend against the live Google Ads API for the
 * period. Returns null when the client has no mapped accounts or the API is
 * unavailable (non-blocking — never throws into the report flow).
 */
export async function reconcileGadsActiveSpend(
  customerIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<GadsReconciliation | null> {
  if (customerIds.length === 0) return null;

  let accessToken: string;
  try {
    accessToken = await mintAccessToken();
  } catch {
    return null; // credentials not configured in this environment — skip.
  }

  let apiActiveSpend = 0;
  try {
    for (const customerId of customerIds) {
      // No segments.date in SELECT → metrics aggregate over the whole range,
      // one row per campaign. campaign.status is the live (current) status.
      const gaql =
        `SELECT campaign.id, campaign.status, metrics.cost_micros ` +
        `FROM campaign WHERE segments.date BETWEEN '${periodStart}' AND '${periodEnd}'`;
      const apiRows = await gadsQuery(accessToken, customerId, gaql);
      for (const r of apiRows) {
        const status = String(r.campaign?.status ?? '').toUpperCase();
        if (INACTIVE_STATUSES.has(status)) continue;
        apiActiveSpend += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
      }
    }
  } catch {
    return null; // transient API failure — don't block the report.
  }

  const activeIds = await fetchActiveCampaignIds(customerIds, periodStart, periodEnd);
  const dbActiveSpend = await sumDbActiveSpend(customerIds, periodStart, periodEnd, activeIds);

  const variancePct = (Math.abs(apiActiveSpend - dbActiveSpend) / Math.max(apiActiveSpend, 1)) * 100;
  return {
    customerIds,
    periodStart,
    periodEnd,
    dbActiveSpend,
    apiActiveSpend,
    variancePct,
    withinTolerance: variancePct <= GADS_RECONCILE_TOLERANCE_PCT,
  };
}

/** Client-scoped convenience wrapper. */
export async function reconcileClientGads(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<GadsReconciliation | null> {
  const customerIds = await getClientGadsCustomerIds(clientId);
  if (customerIds.length === 0) return null;
  return reconcileGadsActiveSpend(customerIds, periodStart, periodEnd);
}
