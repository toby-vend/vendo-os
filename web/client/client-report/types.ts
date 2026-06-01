/**
 * Client-side types for the report dashboard.
 *
 * Re-exports the server-side DashboardPayload contract from
 * web/lib/reports/dashboard-types.ts so the React app and the API both
 * speak the same shape. The dashboard-types module has no runtime
 * imports — esbuild bundles it as types-only, no JS in the output.
 */

export type {
  DashboardMode,
  DashboardPayload,
  ClientHeader,
  ReportHeader,
  DateRange,
  Granularity,
  NumberFormat,
  Kpi,
  ToplineTile,
  ChannelDelta,
  OverviewChannel,
  OverviewTreatment,
  OverviewBlock,
  MetaCampaign,
  MetaCreative,
  MetaAudience,
  MetaBlock,
  GoogleCampaign,
  GoogleKeyword,
  GoogleDevice,
  GoogleBlock,
  SeoTopline,
  SeoTopPage,
  SeoQuery,
  SeoHealth,
  SeoSearchConsoleSeries,
  GeoGridKeyword,
  GeoGridBlock,
  SeoBlock,
  AiSummaryBlock,
  DashboardFlags,
} from '../../lib/reports/dashboard-types.js';

export type TabId = 'overview' | 'summary' | 'meta' | 'google' | 'seo';

declare global {
  interface Window {
    VENDO_REPORT?: import('../../lib/reports/dashboard-types.js').DashboardPayload;
  }
}
