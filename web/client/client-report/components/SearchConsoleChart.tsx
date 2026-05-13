/**
 * SearchConsoleChart — multi-series weekly trend chart for the SEO tab.
 *
 * Ports the mockup's `SearchConsoleChart` to TypeScript and to real
 * data. The mockup synthesised 104 weekly points; we drive the chart
 * from `payload.seo.searchConsoleSeries`:
 *
 *   weeks:        ISO date strings (week starts)
 *   clicks:       number[]
 *   impressions:  number[]
 *   ctr:          number[]   (0–100)
 *   position:     number[]
 *
 * When `searchConsoleSeries` is null the parent renders a Placeholder
 * card instead — this component assumes a valid, equal-length series.
 *
 * Visuals (line/area/grid/hover/tooltip/metric tabs) match the mockup
 * verbatim. Coordinates use the same padL/padR/padT/padB constants and
 * a single primary y-axis derived from the first active metric.
 */
import { useMemo, useRef, useState } from 'react';
import type { SeoSearchConsoleSeries } from '../types';
import { fmt } from '../lib/format';

type MetricKey = 'clicks' | 'impressions' | 'ctr' | 'position';

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  /** When true the metric is "lower is better" — affects tooltip only. */
  inverse?: boolean;
}

const METRICS: MetricDef[] = [
  { key: 'clicks',      label: 'Clicks',       color: 'oklch(0.55 0.13 250)' },
  { key: 'impressions', label: 'Impressions',  color: 'oklch(0.6 0.13 285)' },
  { key: 'ctr',         label: 'CTR',          color: 'oklch(0.62 0.13 145)' },
  { key: 'position',    label: 'Avg Position', color: 'oklch(0.65 0.12 60)', inverse: true },
];

interface SearchConsoleChartProps {
  series: SeoSearchConsoleSeries;
}

/** Format a metric value for tabs / tooltip in its native unit. */
function fmtVal(key: MetricKey, v: number): string {
  if (key === 'ctr') return v.toFixed(2) + '%';
  if (key === 'position') return v.toFixed(1);
  return fmt.number(v);
}

/**
 * Build ~12 evenly-spaced x-axis labels from the ISO weeks array.
 * Returns `[{ idx, label }, …]`. Each label is a short month — "Jan",
 * "Mar", etc — with the year tagged on January and on the first label.
 */
function buildMonthTicks(weeks: string[]): Array<{ idx: number; label: string }> {
  const n = weeks.length;
  if (n === 0) return [];
  const tickCount = Math.min(12, Math.max(2, n - 1));
  const result: Array<{ idx: number; label: string }> = [];
  let lastYear: number | null = null;
  for (let i = 0; i <= tickCount; i++) {
    const idx = Math.min(n - 1, Math.round((i * (n - 1)) / tickCount));
    const iso = weeks[idx];
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    // tag the year on the first label and on every January
    const tagYear = i === 0 || d.getMonth() === 0 || year !== lastYear;
    const label = tagYear ? `${month} ${String(year).slice(-2)}` : month;
    lastYear = year;
    result.push({ idx, label });
  }
  return result;
}

export function SearchConsoleChart({ series }: SearchConsoleChartProps) {
  // At most 2 metrics shown at once — primary + secondary line.
  const [active, setActive] = useState<MetricKey[]>(['clicks', 'impressions']);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const seriesByKey: Record<MetricKey, number[]> = useMemo(
    () => ({
      clicks: series.clicks,
      impressions: series.impressions,
      ctr: series.ctr,
      position: series.position,
    }),
    [series],
  );

  const n = series.weeks.length;

  // Chart geometry — mirrored from the mockup.
  const w = 1100;
  const h = 280;
  const padL = 56;
  const padR = 24;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xStep = n > 1 ? innerW / (n - 1) : 0;

  const monthTicks = useMemo(() => buildMonthTicks(series.weeks), [series.weeks]);

  // Layouts — y-scale per active metric so two metrics on different
  // scales can share the canvas. First metric drives the gridlines.
  const activeMetrics = METRICS.filter((m) => active.includes(m.key));
  const layouts = activeMetrics.map((m) => {
    const data = seriesByKey[m.key];
    const dataMax = data.length ? Math.max(...data) : 1;
    const dataMin = data.length ? Math.min(...data) : 0;
    // Position is lower-is-better; pad the lower bound so the line
    // doesn't slam against the axis when ranking improves.
    const max = m.key === 'position' ? dataMax * 1.05 : dataMax;
    const min = m.key === 'position' ? Math.max(1, dataMin * 0.9) : 0;
    const range = max - min || 1;
    const ny = (v: number) => padT + innerH - ((v - min) / range) * innerH;
    const pts = data.map((v, i) => `${padL + i * xStep},${ny(v)}`).join(' ');
    return { metric: m, data, max, min, ny, pts };
  });

  const primary = layouts[0];
  const ticks = 4;
  const tickVals: number[] = primary
    ? Array.from({ length: ticks + 1 }, (_, i) => primary.min + ((primary.max - primary.min) / ticks) * i)
    : [];

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || xStep === 0) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round((xPx - padL) / xStep);
    if (idx < 0 || idx >= n) {
      setHoverIdx(null);
      return;
    }
    setHoverIdx(idx);
  }

  function onLeave() {
    setHoverIdx(null);
  }

  function toggle(key: MetricKey) {
    setActive((cur) => {
      if (cur.includes(key)) {
        if (cur.length === 1) return cur; // keep at least one
        return cur.filter((k) => k !== key);
      }
      if (cur.length >= 2) return [cur[1]!, key]; // drop oldest, max 2
      return [...cur, key];
    });
  }

  /** Format the tooltip date from an ISO week-start string. */
  function weekDate(idx: number): string {
    const iso = series.weeks[idx];
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Totals shown in each metric tab (average for CTR / position; sum
  // otherwise — mirrors the mockup).
  function tabValue(key: MetricKey): number {
    const arr = seriesByKey[key];
    if (!arr.length) return 0;
    if (key === 'ctr' || key === 'position') {
      return arr.reduce((s, v) => s + v, 0) / arr.length;
    }
    return arr.reduce((s, v) => s + v, 0);
  }

  return (
    <div className="vr-gsc-chart">
      <div className="vr-gsc-tabs">
        {METRICS.map((m) => {
          const isActive = active.includes(m.key);
          const swatchBg = isActive ? m.color : 'transparent';
          const valueColor = isActive ? m.color : 'var(--vr-ink-3)';
          return (
            <button
              key={m.key}
              type="button"
              className={'vr-gsc-tab ' + (isActive ? 'is-active' : '')}
              onClick={() => toggle(m.key)}
            >
              <span
                className="vr-gsc-tab-swatch"
                style={{ background: swatchBg, borderColor: m.color }}
              />
              <span className="vr-gsc-tab-label">{m.label}</span>
              <span className="vr-gsc-tab-value" style={{ color: valueColor }}>
                {fmtVal(m.key, tabValue(m.key))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="vr-gsc-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          style={{ width: '100%', height: 280, display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          {/* Y-axis gridlines + labels (driven by the first active metric) */}
          {primary &&
            tickVals.map((tv, i) => {
              const y = primary.ny(tv);
              return (
                <g key={i}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={w - padR}
                    y2={y}
                    stroke="var(--vr-rule)"
                    strokeDasharray={i === 0 ? '' : '2 4'}
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fontFamily="var(--vr-mono)"
                    fill="var(--vr-ink-3)"
                  >
                    {fmtVal(primary.metric.key, tv)}
                  </text>
                </g>
              );
            })}

          {/* Lines + soft area under the primary line */}
          {layouts.map((l, i) => {
            const isFirst = i === 0;
            const areaPts = `${padL},${padT + innerH} ${l.pts} ${padL + (n - 1) * xStep},${padT + innerH}`;
            return (
              <g key={l.metric.key}>
                {isFirst && <polygon points={areaPts} fill={l.metric.color} opacity="0.1" />}
                <polyline
                  points={l.pts}
                  fill="none"
                  stroke={l.metric.color}
                  strokeWidth={isFirst ? 2 : 1.5}
                  strokeDasharray={isFirst ? '' : '5 3'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* X-axis month labels — derived from the real weeks[] array */}
          {monthTicks.map((t, i) => (
            <text
              key={i}
              x={padL + t.idx * xStep}
              y={h - 12}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--vr-mono)"
              fill="var(--vr-ink-3)"
            >
              {t.label}
            </text>
          ))}

          {/* Hover guide + point markers */}
          {hoverIdx != null && (
            <g>
              <line
                x1={padL + hoverIdx * xStep}
                y1={padT}
                x2={padL + hoverIdx * xStep}
                y2={padT + innerH}
                stroke="var(--vr-ink-3)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              {layouts.map((l) => (
                <circle
                  key={l.metric.key}
                  cx={padL + hoverIdx * xStep}
                  cy={l.ny(l.data[hoverIdx] ?? 0)}
                  r="4"
                  fill="var(--vr-surface)"
                  stroke={l.metric.color}
                  strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>

        {hoverIdx != null &&
          (() => {
            const xPos = padL + hoverIdx * xStep;
            const tipLeft = (xPos / w) * 100;
            const flip = tipLeft > 70;
            return (
              <div
                className="vr-gsc-tooltip"
                style={{
                  left: `calc(${tipLeft}% + ${flip ? '-8px' : '8px'})`,
                  transform: flip ? 'translateX(-100%)' : 'none',
                }}
              >
                <div className="vr-gsc-tooltip-date">Week of {weekDate(hoverIdx)}</div>
                {layouts.map((l) => (
                  <div key={l.metric.key} className="vr-gsc-tooltip-row">
                    <span
                      className="vr-gsc-tooltip-swatch"
                      style={{ background: l.metric.color }}
                    />
                    <span className="vr-gsc-tooltip-label">{l.metric.label}</span>
                    <span className="vr-gsc-tooltip-val">
                      {fmtVal(l.metric.key, l.data[hoverIdx] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
      </div>

      <div className="vr-gsc-foot">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }} aria-hidden>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span>Source: Google Search Console · weekly buckets</span>
      </div>
    </div>
  );
}
