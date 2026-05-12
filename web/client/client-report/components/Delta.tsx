/**
 * Delta — coloured chip showing the percentage change between current
 * and previous values. `inverse` flips the colour logic (e.g. CPL —
 * lower is better).
 */
import { computeDelta } from '../lib/format';

interface DeltaProps {
  curr: number;
  prev: number;
  inverse?: boolean;
  /** mini variant — text only, no chip background or arrow */
  mini?: boolean;
}

export function Delta({ curr, prev, inverse, mini }: DeltaProps) {
  const d = computeDelta(curr, prev, inverse);
  if (!d) return null;
  const sign = d.pct > 0 ? '+' : '';
  const color = d.good ? 'var(--vr-good)' : 'var(--vr-bad)';

  if (mini) {
    return (
      <span
        style={{
          color,
          fontSize: 11,
          fontFamily: 'var(--vr-mono)',
          fontWeight: 500,
        }}
      >
        {sign}
        {d.pct.toFixed(1)}%
      </span>
    );
  }

  return (
    <span
      className="vr-delta"
      style={{ color, background: d.good ? 'var(--vr-good-bg)' : 'var(--vr-bad-bg)' }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        {d.pct > 0 ? (
          <path
            d="M2 7L5 3L8 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M2 3L5 7L8 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {sign}
      {d.pct.toFixed(1)}%
    </span>
  );
}
