/**
 * Number / currency / date formatters used across the dashboard.
 *
 * Mirrors components.jsx `fmt` from the design zip. Currency is GBP and
 * locale is en-GB throughout (Vendo convention).
 */

export type FormatKind = 'currency' | 'number' | 'percent' | 'multiple' | 'decimal';

export const fmt = {
  currency(v: number | null | undefined): string {
    if (v == null) return '—';
    if (Math.abs(v) >= 1000) return '£' + Math.round(v).toLocaleString('en-GB');
    return '£' + v.toFixed(2);
  },
  number(v: number | null | undefined): string {
    if (v == null) return '—';
    return Math.round(v).toLocaleString('en-GB');
  },
  percent(v: number | null | undefined): string {
    if (v == null) return '—';
    return (v * (v < 1 ? 100 : 1)).toFixed(2) + '%';
  },
  multiple(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toFixed(2) + '×';
  },
  decimal(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toFixed(1);
  },
  by(kind: FormatKind): (v: number | null | undefined) => string {
    return fmt[kind] ?? fmt.number;
  },
};

export interface DeltaInfo {
  /** Percentage change, e.g. +12.3 or -4.5. */
  pct: number;
  /** True when the change is favourable (accounts for `inverse`). */
  good: boolean;
}

/**
 * Compute the percentage delta between current and previous. Returns
 * null when previous is null/zero so callers can suppress the chip.
 * `inverse=true` flips the good/bad logic (e.g. CPL — lower is better).
 */
export function computeDelta(
  curr: number | null | undefined,
  prev: number | null | undefined,
  inverse?: boolean,
): DeltaInfo | null {
  if (curr == null || prev == null || prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  const good = inverse ? pct < 0 : pct > 0;
  return { pct, good };
}
