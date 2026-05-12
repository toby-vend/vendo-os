/**
 * Meta (Paid Social) aggregator (stub).
 *
 * A3 fills this in: 8 topline tiles with sparklines, campaigns table,
 * top creative cards with thumbnails, and audience share.
 * Source tables: meta_insights (campaign + creative levels), and
 * ghl_opportunities filtered through the booking-rule (booked
 * appointment pipeline) joined on source/utm_campaign.
 *
 * Returns an empty MetaBlock for now.
 */
import type { DateRange, MetaBlock } from '../dashboard-types.js';

export async function buildMeta(_clientId: number, _range: DateRange): Promise<MetaBlock> {
  return {
    topline: [],
    campaigns: [],
    creative: [],
    audiences: [],
  };
}
