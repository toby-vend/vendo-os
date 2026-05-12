/**
 * Treatment aggregator.
 *
 * Classifies every Meta + Google campaign for the client into a treatment
 * label, then rolls up spend / leads / CPL / CAC / revenue / avgValue per
 * treatment. Returns the rows that populate OverviewBlock.treatments.
 *
 * Classification — three tiers, in order (plan §4.3):
 *
 *   1. Per-client overrides from `client_treatment_mappings` — regex
 *      patterns evaluated in ascending `priority`; first match wins.
 *   2. Built-in defaults from `treatment-defaults.ts` (Invisalign, Implants,
 *      Emergency, Smile Makeover, Whitening, Bonding, General Dentistry,
 *      plus Botox / Fillers / Skin / Quote stubs).
 *   3. Anything still unmatched goes into the "Other" bucket so totals
 *      always balance.
 *
 * Avg-case-value resolution — three steps (plan §4.5):
 *
 *   1. `client_treatment_mappings.avg_case_value_gbp` for that client +
 *      treatment_name (override, if the matching mapping row carried a
 *      value).
 *   2. `treatment_value_defaults` for the client's vertical + treatment.
 *   3. £500 vertical-agnostic fallback.
 *
 * Steps 2 and 3 flip `avgValueIsDefault` on the row AND propagate
 * `averageCaseValueIsDefault: true` to the result so the UI can show a
 * "default value — not your data" hint.
 *
 * Lead attribution heuristic — see comment block above
 * `attributeLeadsToTreatments` further down.
 *
 * UK English. GBP currency throughout.
 */
import { rows } from '../../queries/base.js';
import {
  listMappingsForClient,
  lookupTreatmentDefault,
  VERTICAL_AGNOSTIC_FALLBACK_GBP,
  type AppliesTo,
  type TreatmentMappingRow,
} from '../../queries/treatment-mappings.js';
import { classifyByDefaults } from '../treatment-defaults.js';
import { countBookingsForClient, listBookingOpportunities, type BookingOpportunity } from '../booking-rule.js';
import type { DateRange, OverviewTreatment } from '../dashboard-types.js';

export interface TreatmentAggregatorResult {
  treatments: OverviewTreatment[];
  /** Set when at least one row resolved its avg case value from the
   *  defaults table or the £500 fallback (i.e. NOT from a per-client
   *  override). */
  averageCaseValueIsDefault: boolean;
  /** Set when the client has zero rows in client_treatment_mappings AND
   *  no campaign matched any built-in pattern (everything fell into
   *  "Other"). UI uses this to nudge the AM to configure mappings. */
  treatmentMappingMissing: boolean;
}

// ── Internal types ─────────────────────────────────────────────────────

interface CampaignRow {
  name: string;
  platform: 'meta' | 'google';
  spend: number;
}

interface CompiledMapping {
  treatment: string;
  regex: RegExp;
  appliesTo: AppliesTo;
  avgValueOverride: number | null;
}

interface TreatmentAccumulator {
  spend: number;
  leads: number;
  bookings: number;
  /** Lowercased campaign name fragments owned by this treatment. Used
   *  by the lead-attribution heuristic. */
  campaignNames: Set<string>;
  /** Override value (from tier 1) if any campaign in this bucket was
   *  matched via a per-client mapping that carried an avg_case_value
   *  override. Tracks the first override we see — multiple campaigns
   *  matching the same treatment shouldn't disagree in practice. */
  overrideAvgValue: number | null;
}

// ── Main entry point ───────────────────────────────────────────────────

export async function buildTreatments(
  clientId: number,
  range: DateRange,
): Promise<TreatmentAggregatorResult> {
  const [mappings, vertical, campaigns, bookingOpps, bookingCount] = await Promise.all([
    listMappingsForClient(clientId),
    fetchClientVertical(clientId),
    fetchCampaignSpend(clientId, range),
    listBookingOpportunities(clientId, range),
    countBookingsForClient(clientId, range),
  ]);

  // Empty input → no rows. Don't surface "missing mappings" here — that
  // flag is reserved for the "we have campaigns but nothing matched" case.
  if (campaigns.length === 0) {
    return {
      treatments: [],
      averageCaseValueIsDefault: false,
      treatmentMappingMissing: false,
    };
  }

  const compiledMappings = compileMappings(mappings);

  // Step 1 — classify every campaign into a treatment bucket.
  const buckets = new Map<string, TreatmentAccumulator>();
  let anyMatchedBeyondOther = false;

  for (const campaign of campaigns) {
    const result = classifyCampaign(campaign, compiledMappings);
    const treatment = result.treatment;
    if (treatment !== 'Other') anyMatchedBeyondOther = true;

    let bucket = buckets.get(treatment);
    if (!bucket) {
      bucket = {
        spend: 0,
        leads: 0,
        bookings: 0,
        campaignNames: new Set<string>(),
        overrideAvgValue: null,
      };
      buckets.set(treatment, bucket);
    }
    bucket.spend += campaign.spend;
    bucket.campaignNames.add(campaign.name.toLowerCase());
    if (result.overrideAvgValue != null && bucket.overrideAvgValue == null) {
      bucket.overrideAvgValue = result.overrideAvgValue;
    }
  }

  // Step 2 — attribute leads + bookings to treatment buckets via the
  // `source` substring heuristic. Leads not attributable to any
  // treatment's campaigns roll into "Other".
  attributeLeadsToTreatments(bookingOpps, buckets);

  // Step 3 — resolve avg case value + assemble OverviewTreatment rows.
  const treatments: OverviewTreatment[] = [];
  let averageCaseValueIsDefault = false;

  for (const [name, bucket] of buckets) {
    const resolved = await resolveAvgCaseValue(
      bucket.overrideAvgValue,
      vertical,
      name,
    );
    if (resolved.isDefault) averageCaseValueIsDefault = true;

    const cpl = bucket.leads > 0 ? bucket.spend / bucket.leads : 0;
    const cac = bucket.bookings > 0 ? bucket.spend / bucket.bookings : 0;
    const revenue = bucket.bookings * resolved.value;

    treatments.push({
      name,
      spend: round2(bucket.spend),
      leads: bucket.leads,
      cpl: round2(cpl),
      cac: round2(cac),
      revenue: round2(revenue),
      avgValue: round2(resolved.value),
      avgValueIsDefault: resolved.isDefault,
    });
  }

  // Stable order: highest spend first, but keep "Other" pinned at the
  // bottom so it never looks like a primary treatment line.
  treatments.sort((a, b) => {
    if (a.name === 'Other' && b.name !== 'Other') return 1;
    if (b.name === 'Other' && a.name !== 'Other') return -1;
    return b.spend - a.spend;
  });

  // Suppress unused-variable lint when bookings are 0 for a client w/o a
  // booking pipeline — we still want the value tracked for future use.
  void bookingCount;

  return {
    treatments,
    averageCaseValueIsDefault,
    // Only true when we had NO per-client mappings AND nothing matched
    // the built-in regex library either.
    treatmentMappingMissing: mappings.length === 0 && !anyMatchedBeyondOther,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Compile per-client regex strings into RegExp instances once per call.
 * Invalid patterns are skipped with a console warning rather than
 * crashing the build — a bad regex in one row shouldn't break the
 * whole dashboard.
 */
function compileMappings(mappings: TreatmentMappingRow[]): CompiledMapping[] {
  const compiled: CompiledMapping[] = [];
  for (const row of mappings) {
    try {
      const regex = new RegExp(row.campaign_pattern, 'i');
      compiled.push({
        treatment: row.treatment_name,
        regex,
        appliesTo: row.applies_to,
        avgValueOverride: row.avg_case_value_gbp,
      });
    } catch (err) {
      // Bad regex on a single row → skip it; everything else still works.
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[treatment-aggregator] skipping invalid regex for mapping id=${row.id} ` +
          `client=${row.client_id} treatment="${row.treatment_name}" pattern=${row.campaign_pattern}: ${reason}`,
      );
    }
  }
  return compiled;
}

interface ClassifyResult {
  treatment: string;
  /** Per-client override avg case value if this match carried one. */
  overrideAvgValue: number | null;
}

/**
 * Run the 3-tier classifier against a single campaign:
 *   1. Per-client mappings (already compiled, in priority order)
 *   2. Built-in defaults from treatment-defaults.ts
 *   3. "Other" bucket
 */
function classifyCampaign(
  campaign: CampaignRow,
  mappings: CompiledMapping[],
): ClassifyResult {
  for (const m of mappings) {
    // applies_to filter — 'meta' / 'google' / 'both'.
    if (m.appliesTo !== 'both' && m.appliesTo !== campaign.platform) continue;
    if (m.regex.test(campaign.name)) {
      return { treatment: m.treatment, overrideAvgValue: m.avgValueOverride };
    }
  }

  const def = classifyByDefaults(campaign.name);
  if (def) return { treatment: def, overrideAvgValue: null };

  return { treatment: 'Other', overrideAvgValue: null };
}

/**
 * Lead-attribution heuristic.
 *
 * GHL's `source` field is unstructured free text — it can be a page URL
 * with utm_campaign, a campaign name copy-pasted in, "Facebook lead
 * ads", or empty. There's no foreign key from `ghl_opportunities` to a
 * campaign, so we infer.
 *
 * For each booking opportunity we lowercase the `source` field, then
 * check it against each treatment bucket's known campaign-name
 * substrings. First match wins (we walk buckets in spend-descending
 * order so high-spend treatments win when the source contains multiple
 * keywords). Unmatched opportunities go into the "Other" bucket so the
 * totals balance.
 *
 * Each matched opportunity counts as both a lead AND a booking. The
 * `listBookingOpportunities` call upstream already filters to opps
 * currently in a Booked Appointment pipeline, so every opp returned IS
 * a booking by the universal rule.
 */
function attributeLeadsToTreatments(
  opps: BookingOpportunity[],
  buckets: Map<string, TreatmentAccumulator>,
): void {
  // Walk buckets in spend-descending order for tie-breaking — but we
  // need a snapshot list now, before we start mutating leads/bookings.
  const ordered = [...buckets.entries()]
    .filter(([name]) => name !== 'Other')
    .sort((a, b) => b[1].spend - a[1].spend);

  let other = buckets.get('Other');

  for (const opp of opps) {
    const source = (opp.source || '').toLowerCase().trim();
    let assigned = false;
    if (source) {
      for (const [, bucket] of ordered) {
        for (const cname of bucket.campaignNames) {
          if (cname && source.includes(cname)) {
            bucket.leads += 1;
            bucket.bookings += 1;
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
    }
    if (!assigned) {
      // Park in "Other" so totals balance, even if we never had any
      // unmatched campaign spend.
      if (!other) {
        other = {
          spend: 0,
          leads: 0,
          bookings: 0,
          campaignNames: new Set<string>(),
          overrideAvgValue: null,
        };
        buckets.set('Other', other);
      }
      other.leads += 1;
      other.bookings += 1;
    }
  }
}

interface ResolvedAvgValue {
  value: number;
  isDefault: boolean;
}

/**
 * 3-step avg case value resolution. Tier-1 hits are exact client-set
 * numbers; tier-2 and tier-3 hits set `isDefault` so the UI can flag.
 */
async function resolveAvgCaseValue(
  override: number | null,
  vertical: string,
  treatmentName: string,
): Promise<ResolvedAvgValue> {
  if (override != null && Number.isFinite(override) && override > 0) {
    return { value: override, isDefault: false };
  }

  const verticalDefault = await lookupTreatmentDefault(vertical, treatmentName);
  if (verticalDefault != null && verticalDefault > 0) {
    return { value: verticalDefault, isDefault: true };
  }

  return { value: VERTICAL_AGNOSTIC_FALLBACK_GBP, isDefault: true };
}

/**
 * Pull the client's vertical for the avg-case-value lookup. Defaults
 * to 'other' if the client row is missing a vertical (so the lookup
 * just falls through to the vertical-agnostic fallback).
 */
async function fetchClientVertical(clientId: number): Promise<string> {
  const result = await rows<{ vertical: string | null }>(
    'SELECT vertical FROM clients WHERE id = ? LIMIT 1',
    [clientId],
  );
  const v = (result[0]?.vertical || '').trim().toLowerCase();
  return v || 'other';
}

/**
 * Pull Meta + Google campaign spend for the client in the current
 * period. `client_source_mappings` resolves both Meta ad-account IDs
 * and Google Ads customer IDs to the client. Campaigns with zero
 * spend in the period are still returned — they may still attribute
 * leads via the `source` substring heuristic.
 */
async function fetchCampaignSpend(
  clientId: number,
  range: DateRange,
): Promise<CampaignRow[]> {
  const start = range.current.start;
  const end = range.current.end;

  const [metaRows, gadsRows] = await Promise.all([
    rows<{ campaign_name: string | null; spend: number | null }>(
      `SELECT mi.campaign_name, SUM(mi.spend) AS spend
         FROM meta_insights mi
         JOIN client_source_mappings csm
           ON mi.account_id = csm.external_id AND csm.source = 'meta'
        WHERE csm.client_id = ?
          AND mi.level = 'campaign'
          AND mi.date >= ?
          AND mi.date <= ?
          AND mi.campaign_name IS NOT NULL
        GROUP BY mi.campaign_name`,
      [clientId, start, end],
    ),
    rows<{ campaign_name: string | null; spend: number | null }>(
      `SELECT gs.campaign_name, SUM(gs.spend) AS spend
         FROM gads_campaign_spend gs
         JOIN client_source_mappings csm
           ON gs.account_id = csm.external_id AND csm.source = 'gads'
        WHERE csm.client_id = ?
          AND gs.date >= ?
          AND gs.date <= ?
          AND gs.campaign_name IS NOT NULL
        GROUP BY gs.campaign_name`,
      [clientId, start, end],
    ),
  ]);

  const out: CampaignRow[] = [];
  for (const r of metaRows) {
    if (!r.campaign_name) continue;
    out.push({ name: r.campaign_name, platform: 'meta', spend: r.spend || 0 });
  }
  for (const r of gadsRows) {
    if (!r.campaign_name) continue;
    out.push({ name: r.campaign_name, platform: 'google', spend: r.spend || 0 });
  }
  return out;
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
