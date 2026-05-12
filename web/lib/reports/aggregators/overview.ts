/**
 * Overview aggregator (stub).
 *
 * A3 fills this in: pulls daily Meta + Google spend, GHL leads + revenue,
 * GA4 organic users, and assembles the 4 top KPIs, the 3-channel grid
 * (Meta / Google / SEO) with deltas, and re-exports the treatment rows
 * from buildTreatments.
 *
 * Returns an empty-but-valid OverviewBlock so the orchestrator compiles
 * before A3 lands.
 */
import type { DateRange, OverviewBlock } from '../dashboard-types.js';

export async function buildOverview(_clientId: number, _range: DateRange): Promise<OverviewBlock> {
  return {
    kpis: [],
    channels: [],
    treatments: [],
  };
}
