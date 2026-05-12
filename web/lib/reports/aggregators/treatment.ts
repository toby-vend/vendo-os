/**
 * Treatment aggregator (stub).
 *
 * A6 fills this in: campaign-name → treatment classification with the
 * 3-tier resolution defined in plan §4.5:
 *   1. client_treatment_mappings.avg_case_value_gbp (override)
 *   2. treatment_value_defaults for the client's vertical
 *   3. vertical-agnostic £500 fallback (sets averageCaseValueIsDefault)
 *
 * Source tables: client_treatment_mappings, treatment_value_defaults,
 * meta_insights, gads_campaign_spend, ghl_opportunities (filtered
 * through booking-rule).
 *
 * Returns an empty list for now; the orchestrator wires this into both
 * OverviewBlock.treatments and the flags payload.
 */
import type { DateRange, OverviewTreatment } from '../dashboard-types.js';

export interface TreatmentAggregatorResult {
  treatments: OverviewTreatment[];
  /** Set when at least one row used the defaults table. */
  averageCaseValueIsDefault: boolean;
  /** Set when no mappings exist for this client and nothing matched the
   * built-in regex library — UI shows a hint to configure mappings. */
  treatmentMappingMissing: boolean;
}

export async function buildTreatments(
  _clientId: number,
  _range: DateRange,
): Promise<TreatmentAggregatorResult> {
  return {
    treatments: [],
    averageCaseValueIsDefault: false,
    treatmentMappingMissing: false,
  };
}
