/**
 * Currency display helpers.
 *
 * LLM token costs are computed in USD (Anthropic + provider tariffs are
 * USD-denominated, and we keep agent_runs.cost_usd in USD for that reason).
 * The admin UI displays the same values in GBP for Toby's convenience —
 * Vendo operates in £.
 *
 * Conversion rate via the USD_TO_GBP env var (default 0.79 — refresh
 * occasionally as the rate drifts). This is a display-only conversion;
 * the underlying database column stays USD so historical comparisons
 * against Anthropic invoices stay clean.
 */

function rate(): number {
  const raw = process.env.USD_TO_GBP;
  if (!raw) return 0.79;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0.79;
}

/**
 * Convert a USD value to a GBP display string with the £ symbol.
 *
 *   formatGbp(0.0123, 4) → "£0.0097"
 *   formatGbp(null)      → "—"
 */
export function formatGbp(
  usd: number | null | undefined,
  decimals = 3,
): string {
  if (usd == null || !Number.isFinite(usd)) return '—';
  const gbp = Number(usd) * rate();
  return `£${gbp.toFixed(decimals)}`;
}
