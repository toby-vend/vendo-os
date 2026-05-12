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
