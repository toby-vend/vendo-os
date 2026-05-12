/**
 * Dashboard shell helpers — Phase 0 minimum surface.
 *
 * The full data assembly (overview / meta / google / seo / aiSummary
 * aggregators, cache writes, treatment mapping) lands in Phase 1. This
 * module exists so the route handlers can render the React shell against
 * a real report row without pulling in any aggregator code yet.
 *
 * See plans/2026-05-12-client-report-v2-tab-dashboard.md.
 */
import { rows } from '../queries/base.js';

export type DashboardMode = 'internal' | 'client';

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

export interface DashboardShellPayload {
  mode: DashboardMode;
  client: ClientHeader;
  report: ReportHeader;
  flags?: Record<string, true>;
}

/**
 * Fetch the minimum client header info from `clients` for the dashboard.
 * Falls back to safe defaults if the row is missing (deleted client edge
 * case — the report still renders).
 */
async function fetchClientHeader(clientId: number): Promise<ClientHeader> {
  const found = await rows<{
    id: number;
    name: string;
    display_name: string | null;
    vertical: string | null;
  }>(
    `SELECT id, name, display_name, vertical
       FROM clients
      WHERE id = ?
      LIMIT 1`,
    [clientId],
  );
  const row = found[0];
  const name = (row?.display_name || row?.name || 'Unknown client').trim();
  return {
    id: clientId,
    name,
    // `clients` doesn't carry a location column today — leave blank; the
    // mockup tolerates empty meta. Phase 4 can wire this from a richer source.
    location: '',
    initials: deriveInitials(name),
    since: '',
    vertical: (row?.vertical || 'other').trim() || 'other',
  };
}

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Build a Phase 0 payload — just the headers needed for the shell to
 * render. No tab data yet; the React app shows per-tab placeholders.
 */
export async function buildPhase0Payload(
  report: {
    id: number;
    client_id: number;
    status: string;
    period_label: string;
    period_start: string;
    period_end: string;
  },
  mode: DashboardMode,
): Promise<DashboardShellPayload> {
  const client = await fetchClientHeader(report.client_id);
  return {
    mode,
    client,
    report: {
      id: report.id,
      status: (report.status as ReportHeader['status']) || 'draft',
      periodLabel: report.period_label,
      periodStart: report.period_start,
      periodEnd: report.period_end,
    },
    flags: { gbpComingSoon: true, geoGridComingSoon: true },
  };
}

// JS line separators (U+2028 / U+2029) are valid in JSON but fatal inside
// a <script> tag body. Built via String.fromCharCode so the source file
// never contains the literal codepoints (some tooling silently strips them).
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * JSON-stringify for inline injection into an Eta template. Escapes the
 * sequences that could break out of a <script> tag (per OWASP guidance).
 */
export function safeStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}
