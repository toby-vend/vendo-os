/**
 * Query helpers for the campaign → treatment classification tables:
 *   - client_treatment_mappings  (per-client overrides; tier 1)
 *   - treatment_value_defaults   (vertical-wide avg_case_value lookup)
 *
 * Both tables created by scripts/migrations/2026-05-12-client-report-v2.ts.
 *
 * Used by:
 *   - web/lib/reports/aggregators/treatment.ts (build the treatment block)
 *   - the future admin UI at /admin/clients/:clientId/treatment-mappings
 */
import { rows, scalar } from './base.js';

/** `applies_to` values stored on client_treatment_mappings. */
export type AppliesTo = 'meta' | 'google' | 'both';

export interface TreatmentMappingRow {
  id: number;
  client_id: number;
  treatment_name: string;
  /** Stored as a regex pattern string. May be invalid — callers
   *  must wrap `new RegExp(...)` in try/catch. */
  campaign_pattern: string;
  applies_to: AppliesTo;
  /** Override for the treatment's avg case value. NULL → fall through to
   *  treatment_value_defaults. */
  avg_case_value_gbp: number | null;
  /** Lower wins when multiple patterns match the same campaign. */
  priority: number;
  is_active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * List active mappings for a client, lowest-priority-number first so
 * callers can iterate in match-order without an extra sort.
 */
export async function listMappingsForClient(clientId: number): Promise<TreatmentMappingRow[]> {
  return rows<TreatmentMappingRow>(
    `SELECT id, client_id, treatment_name, campaign_pattern, applies_to,
            avg_case_value_gbp, priority, is_active, created_by,
            created_at, updated_at
       FROM client_treatment_mappings
      WHERE client_id = ?
        AND is_active = 1
      ORDER BY priority ASC, id ASC`,
    [clientId],
  );
}

/**
 * Tier-2 lookup of `treatment_value_defaults` — vertical-wide default
 * for a given (vertical, treatment_name). Returns NULL when no row
 * matches; the caller falls through to the £500 vertical-agnostic
 * fallback.
 */
export async function lookupTreatmentDefault(
  vertical: string,
  treatmentName: string,
): Promise<number | null> {
  const value = await scalar<number>(
    `SELECT avg_case_value_gbp
       FROM treatment_value_defaults
      WHERE vertical = ?
        AND treatment_name = ?`,
    [vertical, treatmentName],
  );
  return value ?? null;
}

/**
 * Vertical-agnostic fallback. Used only when both the per-client
 * override and the vertical-default lookup come back empty. Sets
 * `flags.averageCaseValueIsDefault` on the dashboard payload so the UI
 * can render a "default value" hint.
 */
export const VERTICAL_AGNOSTIC_FALLBACK_GBP = 500;
