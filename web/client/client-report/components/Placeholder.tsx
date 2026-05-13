/**
 * Placeholder — dashed-border box used for chart areas, GBP + GeoGrid
 * "coming soon" cards, and empty states.
 */
interface PlaceholderProps {
  label: string;
  height?: number;
  /** Optional secondary line, smaller text. */
  sub?: string;
}

export function Placeholder({ label, height = 120, sub }: PlaceholderProps) {
  return (
    <div className="vr-placeholder" style={{ minHeight: height }}>
      <div className="vr-placeholder-label">{label}</div>
      {sub && <div className="vr-placeholder-sub">{sub}</div>}
    </div>
  );
}
