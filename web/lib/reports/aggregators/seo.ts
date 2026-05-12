/**
 * SEO (Organic Search) aggregator (stub).
 *
 * A5 fills this in: 30-day + 90-day topline tiles, top pages, top
 * queries, site health, and the 24-month Search Console weekly series.
 * Source tables: gsc_daily, gsc_queries, gsc_pages, ga4_daily.
 *
 * If GSC retention is shorter than 24 months, searchConsoleSeries.weeks
 * starts from the earliest available point and the React chart adapts.
 */
import type { DateRange, SeoBlock } from '../dashboard-types.js';

export async function buildSeo(_clientId: number, _range: DateRange): Promise<SeoBlock> {
  return {
    topline30: [],
    topline90: [],
    topPages: [],
    queries: [],
    health: {
      indexed: 0,
      crawlErrors: 0,
      coreWebVitals: 'Unknown',
      backlinks: 0,
      referringDomains: 0,
    },
    searchConsoleSeries: null,
  };
}
