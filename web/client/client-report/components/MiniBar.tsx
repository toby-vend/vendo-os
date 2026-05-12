/**
 * MiniBar — inline horizontal progress bar for share-of-revenue, share
 * of leads, audience share, etc.
 */
interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  w?: number | string;
  h?: number;
}

export function MiniBar({
  value,
  max,
  color = 'var(--vr-accent)',
  w = 80,
  h = 6,
}: MiniBarProps) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span
      style={{
        display: 'inline-block',
        width: typeof w === 'number' ? `${w}px` : w,
        height: h,
        background: 'var(--vr-rule)',
        borderRadius: 999,
        overflow: 'hidden',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'width 400ms ease',
        }}
      />
    </span>
  );
}
