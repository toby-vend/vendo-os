/**
 * Built-in treatment classification regex library.
 *
 * Tier 2 of the 3-tier campaign-name → treatment classifier described in
 * plan §4.3:
 *
 *   1. Per-client overrides from `client_treatment_mappings` (matched in
 *      ascending `priority` order; first match wins).
 *   2. Built-in defaults from this file (matched in array order).
 *   3. Fallback bucket: any campaign that matched nothing rolls into
 *      "Other" so totals always balance.
 *
 * Each entry is `(treatmentName, pattern)`. Patterns are case-insensitive
 * regexes — they only ever run against campaign-name strings, so they
 * stay deliberately simple.
 *
 * UK English in comments. Treatment names are the canonical, human-
 * facing labels that show up in the dashboard's treatment table.
 *
 * Vertical hint columns let us keep the array compact while still being
 * explicit about which vertical each row was added for. The classifier
 * does NOT filter by vertical (a client's campaign for "Botox" should
 * match even if their `clients.vertical` is set to `medical`) — vertical
 * only matters for the `treatment_value_defaults` lookup.
 */

export interface TreatmentDefault {
  /** Canonical treatment label shown in the dashboard. */
  treatment: string;
  /** Regex applied to the campaign name (case-insensitive). */
  pattern: RegExp;
  /** Vertical this default was authored for — purely informational. */
  vertical: 'dental' | 'aesthetics' | 'medical' | 'home-services' | 'other';
}

/**
 * Order matters: more specific patterns first so they win over generic
 * ones (e.g. "Smile Makeover" must match before "General Dentistry").
 */
export const TREATMENT_DEFAULTS: TreatmentDefault[] = [
  // ── Dental ──────────────────────────────────────────────────────────
  { treatment: 'Invisalign & Ortho',  pattern: /invis|invisalign|ortho|brace|aligner/i,                vertical: 'dental' },
  { treatment: 'Dental Implants',     pattern: /implant/i,                                              vertical: 'dental' },
  { treatment: 'Emergency Dentistry', pattern: /emergency|urgent/i,                                     vertical: 'dental' },
  { treatment: 'Smile Makeover',      pattern: /smile\s*makeover|makeover|veneer/i,                     vertical: 'dental' },
  { treatment: 'Teeth Whitening',     pattern: /whiten|bleach/i,                                        vertical: 'dental' },
  { treatment: 'Composite Bonding',   pattern: /bonding|composite/i,                                    vertical: 'dental' },
  { treatment: 'General Dentistry',   pattern: /general|check[\s-]?up|hygien|cleaning|dental(?!\s*implant)/i, vertical: 'dental' },

  // ── Aesthetics ──────────────────────────────────────────────────────
  { treatment: 'Botox',               pattern: /botox|wrinkle|anti[\s-]?wrinkle|toxin/i,                vertical: 'aesthetics' },
  { treatment: 'Fillers',             pattern: /filler|lip\s*enhancement|dermal/i,                      vertical: 'aesthetics' },
  { treatment: 'Skin',                pattern: /skin|peel|microneedl|hydrafacial|facial/i,              vertical: 'aesthetics' },

  // ── Home services (minimal stubs) ───────────────────────────────────
  { treatment: 'Quote',               pattern: /quote|estimate|free\s*survey/i,                         vertical: 'home-services' },
];

/**
 * Try every built-in pattern against a campaign name. Returns the
 * canonical treatment label, or `null` if nothing matched.
 *
 * First match wins — patterns are ordered specific → generic above.
 */
export function classifyByDefaults(campaignName: string): string | null {
  if (!campaignName) return null;
  for (const row of TREATMENT_DEFAULTS) {
    if (row.pattern.test(campaignName)) return row.treatment;
  }
  return null;
}
