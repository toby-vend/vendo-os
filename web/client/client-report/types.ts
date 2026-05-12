/**
 * Shared types for the client report dashboard.
 *
 * The full DashboardPayload contract lives server-side in
 * web/lib/reports/dashboard-types.ts (Phase 1). This file is intentionally
 * minimal — just enough for the Phase 0 shell to render against a stub
 * payload. Phase 1 will replace the body of this file with re-exports of
 * the server contract.
 */

export type DashboardMode = 'internal' | 'client';

export type TabId = 'overview' | 'summary' | 'meta' | 'google' | 'seo';

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

export interface DashboardPayload {
  mode: DashboardMode;
  client: ClientHeader;
  report: ReportHeader;
  // Phase 0: tab bodies are optional. Phase 1 fills these in.
  overview?: unknown;
  summary?: unknown;
  meta?: unknown;
  google?: unknown;
  seo?: unknown;
  flags?: {
    gbpComingSoon?: true;
    geoGridComingSoon?: true;
    bookingPipelineMissing?: true;
    averageCaseValueIsDefault?: true;
    treatmentMappingMissing?: true;
  };
}

declare global {
  interface Window {
    VENDO_REPORT?: DashboardPayload;
  }
}
