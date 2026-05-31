/**
 * Active-campaign resolution for Google Ads reporting.
 *
 * A client report mirrors the client-facing Google Ads account: it shows
 * *active* campaigns only. After an account restructure, the old campaigns are
 * paused/removed but their historical spend still sits in `gads_campaign_spend`
 * — and because the report aggregators previously filtered only on
 * `SUM(spend) > 0`, those wound-down campaigns leaked into the toplines and the
 * campaign table, overstating spend and clicks (see
 * plans/elegant-nibbling-crescent.md).
 *
 * This module is the single source of truth for "which campaigns are active in
 * a period". A campaign is active when its status on the MOST RECENT date it
 * appears in the period is not PAUSED/REMOVED. We use the latest row rather
 * than `MAX(campaign_status)` because MAX is lexicographic, not chronological,
 * and would mis-rank statuses (e.g. a re-enabled campaign).
 */
import { rows } from '../queries/base.js';

export interface CampaignMeta {
  account_id: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
}

/** Campaign statuses excluded from "active campaigns" reporting. */
const INACTIVE_STATUSES = new Set(['PAUSED', 'REMOVED']);

/** Unknown/missing status is treated as active — never silently drop data. */
export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return !INACTIVE_STATUSES.has(status.toUpperCase());
}

/**
 * Latest known name + status for every campaign that had a row in
 * [start, end], taken from the most recent date per campaign. This is the
 * campaign's end-of-period state — the correct basis for "is it still active"
 * and for displaying the current name after a rename.
 */
export async function fetchLatestCampaignMeta(
  customerIds: string[],
  start: string,
  end: string,
): Promise<CampaignMeta[]> {
  if (customerIds.length === 0) return [];
  const ph = customerIds.map(() => '?').join(',');
  return rows<CampaignMeta>(
    `SELECT s.account_id      AS account_id,
            s.campaign_id     AS campaign_id,
            s.campaign_name   AS campaign_name,
            s.campaign_status AS campaign_status
       FROM gads_campaign_spend s
       JOIN (
              SELECT account_id, campaign_id, MAX(date) AS max_date
                FROM gads_campaign_spend
               WHERE account_id IN (${ph})
                 AND date BETWEEN ? AND ?
               GROUP BY account_id, campaign_id
            ) latest
         ON latest.account_id  = s.account_id
        AND latest.campaign_id = s.campaign_id
        AND latest.max_date    = s.date`,
    [...customerIds, start, end],
  );
}

/**
 * campaign_ids whose end-of-period status is active (not PAUSED/REMOVED).
 * Returns an empty array when the client has no mapped accounts or no rows.
 */
export async function fetchActiveCampaignIds(
  customerIds: string[],
  start: string,
  end: string,
): Promise<string[]> {
  const meta = await fetchLatestCampaignMeta(customerIds, start, end);
  return meta.filter(m => isActiveStatus(m.campaign_status)).map(m => m.campaign_id);
}

/**
 * Build an `AND campaign_id IN (...)` clause + bind params for restricting a
 * query to the active set. When `activeIds` is empty the clause is omitted, so
 * a fully wound-down account still renders its (paused) history rather than
 * erroring on `IN ()` — callers append `.clause` to their WHERE and spread
 * `.params` into the bind list at the matching position.
 */
export function campaignIdFilter(activeIds: string[]): { clause: string; params: string[] } {
  if (activeIds.length === 0) return { clause: '', params: [] };
  const ph = activeIds.map(() => '?').join(',');
  return { clause: ` AND campaign_id IN (${ph})`, params: [...activeIds] };
}
