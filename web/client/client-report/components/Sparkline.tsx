/**
 * Sparkline — clean SVG line with optional area fill and a dot on the
 * last point. Mirrors the mockup's Sparkline. Used inside KpiCards and
 * the ToplineTile (Meta / Google tabs).
 */
interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  area?: boolean;
}

export function Sparkline({
  data,
  w = 120,
  h = 32,
  color = 'var(--vr-accent)',
  area = true,
}: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = 2;
  const xStep = (w - pad * 2) / (data.length - 1);
  const norm = (v: number): number => {
    if (max === min) return h / 2;
    return h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  };
  const pts = data.map((v, i) => `${pad + i * xStep},${norm(v)}`).join(' ');
  const areaPts = `${pad},${h - pad} ${pts} ${pad + (data.length - 1) * xStep},${h - pad}`;
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {area && <polygon points={areaPts} fill={color} opacity="0.08" />}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pad + (data.length - 1) * xStep}
        cy={norm(data[data.length - 1])}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}
