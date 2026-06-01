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
 * "default value — not your data" hint. This fallback only kicks in when
 * the client's GHL carries no `monetary_value` at all — otherwise revenue
 * comes straight from GHL (see below).
 *
 * Leads / bookings / revenue — attributed from GHL via the opportunity's
 * PIPELINE (pipelines are named per service line), not the free-text
 * `source` field. See `attributeByPipeline` further down.
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
import { resolveBookingScope, bookingPredicate, type BookingScope } from '../booking-rule.js';
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
  /** Set when there were booking opportunities but NONE could be attributed
   *  to a named treatment — the client's GHL `source` field carries channel
   *  labels, not campaign names, so the substring heuristic can never match.
   *  Treatment rows are emitted spend-only (leads/cpl/cac/revenue = null) and
   *  the "Other" lead-dump is suppressed. */
  leadAttributionUnavailable: boolean;
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
  /** Leads = GHL opportunities CREATED in the period whose pipeline maps to
   *  this treatment. */
  leads: number;
  /** Bookings = booked-or-beyond opps whose pipeline maps to this treatment. */
  bookings: number;
  /** Revenue = sum of real GHL `monetary_value` across this treatment's
   *  bookings. Zero when the client carries no monetary values (then the
   *  row falls back to an avg-case-value estimate). */
  revenue: number;
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
  const [mappings, vertical, campaigns, scope] = await Promise.all([
    listMappingsForClient(clientId),
    fetchClientVertical(clientId),
    fetchCampaignSpend(clientId, range),
    resolveBookingScope(clientId),
  ]);

  // Empty input → no rows. Don't surface "missing mappings" here — that
  // flag is reserved for the "we have campaigns but nothing matched" case.
  if (campaigns.length === 0) {
    return {
      treatments: [],
      averageCaseValueIsDefault: false,
      treatmentMappingMissing: false,
      leadAttributionUnavailable: false,
    };
  }

  const compiledMappings = compileMappings(mappings);

  const makeBucket = (): TreatmentAccumulator => ({
    spend: 0,
    leads: 0,
    bookings: 0,
    revenue: 0,
    overrideAvgValue: null,
  });

  // Step 1 — classify every campaign into a treatment bucket (spend side).
  const buckets = new Map<string, TreatmentAccumulator>();
  let anyMatchedBeyondOther = false;

  for (const campaign of campaigns) {
    const result = classifyCampaign(campaign, compiledMappings);
    const treatment = result.treatment;
    if (treatment !== 'Other') anyMatchedBeyondOther = true;

    let bucket = buckets.get(treatment);
    if (!bucket) {
      bucket = makeBucket();
      buckets.set(treatment, bucket);
    }
    bucket.spend += campaign.spend;
    if (result.overrideAvgValue != null && bucket.overrideAvgValue == null) {
      bucket.overrideAvgValue = result.overrideAvgValue;
    }
  }

  // Step 2 — attribute leads, bookings and revenue from GHL using the
  // opportunity's PIPELINE as the source of truth for the treatment. GHL
  // pipelines are named per service line ("Dental Implant Appointments",
  // "Invisalign/Orthodontic Appointments", …), so the same classifier that
  // maps campaign names to treatments maps pipeline names too. Revenue is
  // the real sum of `monetary_value` on booked-or-beyond opps.
  const ghl = await attributeByPipeline(clientId, range, scope, compiledMappings);
  for (const [treatment, agg] of ghl.byTreatment) {
    let bucket = buckets.get(treatment);
    if (!bucket) {
      bucket = makeBucket();
      buckets.set(treatment, bucket);
    }
    bucket.leads = agg.leads;
    bucket.bookings = agg.bookings;
    bucket.revenue = agg.revenue;
  }

  // Attribution is "unavailable" only when GHL gave us leads/bookings but
  // NONE landed on a named treatment (e.g. the client routes everything
  // through one generic pipeline). Then we fall back to spend-only rows +
  // an honest UI note rather than dumping everything into "Other".
  const ghlActivity = ghl.totalLeads + ghl.totalBookings;
  const namedActivity = [...buckets.entries()]
    .filter(([name]) => name !== 'Other')
    .reduce((s, [, b]) => s + b.leads + b.bookings, 0);
  const leadAttributionUnavailable = ghlActivity > 0 && namedActivity === 0;

  // Step 3 — assemble OverviewTreatment rows.
  const treatments: OverviewTreatment[] = [];
  let averageCaseValueIsDefault = false;

  for (const [name, bucket] of buckets) {
    if (leadAttributionUnavailable) {
      // Keep genuine campaign-spend rows, but null the lead/booking-derived
      // columns the UI can't honestly populate. Drop buckets that exist only
      // because of GHL activity that couldn't be attributed.
      if (bucket.spend <= 0) continue;
      treatments.push({
        name,
        spend: round2(bucket.spend),
        leads: null,
        cpl: null,
        cac: null,
        revenue: null,
        avgValue: 0,
        avgValueIsDefault: false,
      });
      continue;
    }

    const cpl = bucket.leads > 0 ? bucket.spend / bucket.leads : 0;
    const cac = bucket.bookings > 0 ? bucket.spend / bucket.bookings : 0;

    // Revenue: prefer the real GHL monetary_value sum. Only fall back to an
    // avg-case-value estimate when the client's GHL carries no monetary
    // values at all (so we never silently show £0 against a real booking).
    let revenue: number;
    let avgValue: number;
    let avgValueIsDefault: boolean;
    if (ghl.monetaryPresent) {
      revenue = bucket.revenue;
      avgValue = bucket.bookings > 0 ? bucket.revenue / bucket.bookings : 0;
      avgValueIsDefault = false;
    } else {
      const resolved = await resolveAvgCaseValue(bucket.overrideAvgValue, vertical, name);
      if (resolved.isDefault) averageCaseValueIsDefault = true;
      avgValue = resolved.value;
      avgValueIsDefault = resolved.isDefault;
      revenue = bucket.bookings * resolved.value;
    }

    treatments.push({
      name,
      spend: round2(bucket.spend),
      leads: bucket.leads,
      cpl: round2(cpl),
      cac: round2(cac),
      revenue: round2(revenue),
      avgValue: round2(avgValue),
      avgValueIsDefault,
    });
  }

  // Stable order: highest revenue first (the column the table sorts by),
  // but keep "Other" pinned at the bottom so it never looks like a primary
  // treatment line.
  treatments.sort((a, b) => {
    if (a.name === 'Other' && b.name !== 'Other') return 1;
    if (b.name === 'Other' && a.name !== 'Other') return -1;
    return (b.revenue ?? b.spend) - (a.revenue ?? a.spend);
  });

  return {
    treatments,
    averageCaseValueIsDefault,
    // Only true when we had NO per-client mappings AND nothing matched
    // the built-in regex library either.
    treatmentMappingMissing: mappings.length === 0 && !anyMatchedBeyondOther,
    leadAttributionUnavailable,
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

interface PipelineAttribution {
  byTreatment: Map<string, { leads: number; bookings: number; revenue: number }>;
  totalLeads: number;
  totalBookings: number;
  /** True when at least one booked opp carries a non-zero `monetary_value`
   *  — i.e. GHL is the revenue source of truth for this client. */
  monetaryPresent: boolean;
}

/**
 * Attribute GHL opportunities to treatments via their PIPELINE.
 *
 * GHL pipelines are named per service line, so an opportunity's pipeline IS
 * its treatment — far more reliable than parsing the free-text `source`
 * field (which often carries only a channel label like "Paid Social").
 * Two reads:
 *   - Leads: opps CREATED in the period (the true top-of-funnel count).
 *   - Bookings + revenue: opps at the "booked-or-beyond" stage whose stage
 *     last changed in the period (booking-rule scope), summing the real
 *     `monetary_value`.
 * Both are grouped by pipeline name and classified to a treatment label
 * with the same mappings → defaults → "Other" precedence used for spend.
 */
async function attributeByPipeline(
  clientId: number,
  range: DateRange,
  scope: BookingScope,
  mappings: CompiledMapping[],
): Promise<PipelineAttribution> {
  const startTs = range.current.start;
  const endTs = range.current.end + 'T23:59:59';

  const leadRows = await rows<{ pipeline_name: string | null; n: number }>(
    `SELECT p.name AS pipeline_name, COUNT(*) AS n
       FROM ghl_opportunities o
       LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
      WHERE o.location_id IN (
              SELECT external_id FROM client_source_mappings
               WHERE client_id = ? AND source = 'ghl'
            )
        AND o.created_at >= ? AND o.created_at <= ?
      GROUP BY p.name`,
    [clientId, startTs, endTs],
  );

  const predicate = bookingPredicate(scope);
  const bookingRows =
    predicate.clause === '1=0'
      ? []
      : await rows<{ pipeline_name: string | null; n: number; revenue: number }>(
          `SELECT p.name AS pipeline_name, COUNT(*) AS n,
                  COALESCE(SUM(o.monetary_value), 0) AS revenue
             FROM ghl_opportunities o
             LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
            WHERE ${predicate.clause}
              AND COALESCE(o.last_stage_change_at, o.updated_at) >= ?
              AND COALESCE(o.last_stage_change_at, o.updated_at) <= ?
            GROUP BY p.name`,
          [...predicate.params, startTs, endTs],
        );

  const byTreatment = new Map<string, { leads: number; bookings: number; revenue: number }>();
  const bump = (t: string) => {
    let e = byTreatment.get(t);
    if (!e) {
      e = { leads: 0, bookings: 0, revenue: 0 };
      byTreatment.set(t, e);
    }
    return e;
  };

  let totalLeads = 0;
  for (const r of leadRows) {
    bump(classifyTreatmentName(r.pipeline_name, mappings)).leads += r.n;
    totalLeads += r.n;
  }

  let totalBookings = 0;
  let monetaryPresent = false;
  for (const r of bookingRows) {
    const e = bump(classifyTreatmentName(r.pipeline_name, mappings));
    e.bookings += r.n;
    e.revenue += r.revenue || 0;
    totalBookings += r.n;
    if ((r.revenue || 0) > 0) monetaryPresent = true;
  }

  return { byTreatment, totalLeads, totalBookings, monetaryPresent };
}

/**
 * Classify a GHL pipeline name into a treatment label. Same precedence as
 * the campaign classifier — per-client mappings first (ignoring the
 * meta/google `applies_to` filter, which is about ad platforms not
 * pipelines), then built-in defaults, then "Other".
 */
function classifyTreatmentName(name: string | null, mappings: CompiledMapping[]): string {
  const n = (name || '').trim();
  if (!n) return 'Other';
  for (const m of mappings) {
    if (m.regex.test(n)) return m.treatment;
  }
  return classifyByDefaults(n) ?? 'Other';
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
