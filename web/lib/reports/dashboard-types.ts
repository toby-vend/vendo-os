/**
 * DashboardPayload — full structured contract for the v2 client report.
 *
 * Shapes mirror the mockup's data.jsx so the React port lifts directly.
 * Each aggregator returns its own block; the orchestrator
 * (build-dashboard-data.ts) assembles them.
 *
 * See plans/2026-05-12-client-report-v2-tab-dashboard.md.
 */

export type DashboardMode = 'internal' | 'client';

export type Granularity = 'day';

export type NumberFormat =
  | 'currency'    // £1,234 / £12.34
  | 'number'      // 1,234
  | 'percent'     // 12.34%
  | 'multiple'    // 2.34×
  | 'decimal';    // 8.4

// ── Header ─────────────────────────────────────────────────────────────

export interface ClientHeader {
  id: number;
  name: string;
  location: string;
  initials: string;
  since: string;
  vertical: string;
}

export interface ReportHeader {
  id: number;
  status: 'draft' | 'review' | 'final';
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}

export interface DateRange {
  current: { start: string; end: string };
  previous: { start: string; end: string };
  granularity: Granularity;
}

// ── Generic tile primitives ────────────────────────────────────────────

/**
 * A KPI with a sparkline. Used in Overview top row and as ToplineTile
 * for Meta/Google channel pages.
 */
export interface Kpi {
  key: string;
  label: string;
  value: number;
  prev: number;
  format: NumberFormat;
  /** lower-is-better — flips the delta colouring */
  inverse?: boolean;
  /** daily series for the sparkline; ~30 points */
  series?: number[];
}

/**
 * Topline tile used on channel pages. Same shape as KPI plus an optional
 * booking-rate sidecar for the "bookings" tile.
 */
export interface ToplineTile extends Kpi {
  totalLeads?: number;
  prevLeads?: number;
}

// ── Overview block ─────────────────────────────────────────────────────

export interface ChannelDelta {
  spend?: number;
  leads?: number;
  cpl?: number;
  revenue?: number;
  traffic?: number;
}

export interface OverviewChannel {
  key: 'meta' | 'google' | 'seo';
  name: string;
  sub: string;
  spend: number | null;
  traffic?: number;
  leads: number;
  cpl: number;
  revenue: number;
  delta: ChannelDelta;
  tone: 'indigo' | 'amber' | 'teal' | 'rose' | 'violet';
}

export interface OverviewTreatment {
  name: string;
  spend: number;
  leads: number;
  cpl: number;
  cac: number;
  revenue: number;
  avgValue: number;
  /** true when the avg case value falls back to the defaults table */
  avgValueIsDefault: boolean;
}

export interface OverviewBlock {
  kpis: Kpi[];
  channels: OverviewChannel[];
  treatments: OverviewTreatment[];
}

// ── Meta block ─────────────────────────────────────────────────────────

export interface MetaCampaign {
  name: string;
  status: 'Active' | 'Paused';
  spend: number;
  impr: number;
  clicks: number;
  leads: number;
  cpl: number;
  revenue: number;
}

export interface MetaCreative {
  name: string;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  /** Blob URL or null. Phase 1 may use Meta's short-lived thumbnail_url
   * directly; Phase 4 rehosts to Vercel Blob. */
  thumb: string | null;
}

export interface MetaAudience {
  name: string;
  leads: number;
  cpl: number;
  /** share-of-leads percentage 0-100 */
  share: number;
}

export interface MetaBlock {
  topline: ToplineTile[];
  campaigns: MetaCampaign[];
  creative: MetaCreative[];
  audiences: MetaAudience[];
}

// ── Google block ───────────────────────────────────────────────────────

export interface GoogleCampaign {
  name: string;
  status: string;
  spend: number;
  impr: number;
  clicks: number;
  leads: number;
  cpl: number;
  revenue: number;
}

export interface GoogleKeyword {
  kw: string;
  clicks: number;
  cost: number;
  leads: number;
  cpc: number;
}

export interface GoogleDevice {
  name: 'Mobile' | 'Desktop' | 'Tablet';
  share: number;
  leads: number;
  cpl: number;
}

export interface GoogleBlock {
  topline: ToplineTile[];
  campaigns: GoogleCampaign[];
  keywords: GoogleKeyword[];
  devices: GoogleDevice[];
}

// ── SEO block ──────────────────────────────────────────────────────────

export interface SeoTopline {
  key: string;
  label: string;
  value: number;
  prev: number;
  format: NumberFormat;
  inverse?: boolean;
}

export interface SeoTopPage {
  url: string;
  users: number;
  leads: number;
  /** percent change vs previous period */
  change: number;
}

export interface SeoQuery {
  q: string;
  clicks: number;
  impr: number;
  ctr: number;
  pos: number;
  /** lower is better; negative = position improved */
  posChange: number;
}

export interface SeoHealth {
  indexed: number;
  crawlErrors: number;
  coreWebVitals: string;
  backlinks: number;
  referringDomains: number;
}

/** ~104 weekly points = 24 months for the Search Console chart. */
export interface SeoSearchConsoleSeries {
  /** ISO date string per bucket (week start) */
  weeks: string[];
  clicks: number[];
  impressions: number[];
  /** 0-100 */
  ctr: number[];
  position: number[];
}

export interface SeoBlock {
  topline30: SeoTopline[];
  topline90: SeoTopline[];
  topPages: SeoTopPage[];
  queries: SeoQuery[];
  health: SeoHealth;
  searchConsoleSeries: SeoSearchConsoleSeries | null;
}

// ── AI summary block ───────────────────────────────────────────────────

export interface AiSummaryBlock {
  period: string;
  /** Markdown for the headline paragraph */
  headlineMd: string;
  wins: string[];
  watch: string[];
  focus: string[];
  generatedAt: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// ── Flags ──────────────────────────────────────────────────────────────

export interface DashboardFlags {
  gbpComingSoon: true;
  geoGridComingSoon: true;
  bookingPipelineMissing?: true;
  averageCaseValueIsDefault?: true;
  treatmentMappingMissing?: true;
  deviceSplitMissing?: true;
}

// ── Top-level payload ──────────────────────────────────────────────────

export interface DashboardPayload {
  mode: DashboardMode;
  client: ClientHeader;
  report: ReportHeader;
  range: DateRange;
  overview: OverviewBlock;
  meta: MetaBlock;
  google: GoogleBlock;
  seo: SeoBlock;
  aiSummary: AiSummaryBlock;
  flags: DashboardFlags;
  /** ISO timestamp when this payload was assembled */
  computedAt: string;
}
