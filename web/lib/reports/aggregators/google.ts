/**
 * Google (Paid Search) aggregator (stub).
 *
 * A4 fills this in: 8 topline tiles, campaigns table, top keywords,
 * device split. Source tables: gads_campaign_spend, gads_keyword_stats,
 * and (after the sync extension) gads_device_split or a new device
 * column on gads_campaign_spend.
 *
 * If device data isn't available yet, returns flags.deviceSplitMissing
 * via the orchestrator and an empty devices array.
 */
import type { DateRange, GoogleBlock } from '../dashboard-types.js';

export async function buildGoogle(_clientId: number, _range: DateRange): Promise<GoogleBlock> {
  return {
    topline: [],
    campaigns: [],
    keywords: [],
    devices: [],
  };
}
