/**
 * GeoGrid — local map-pack rank grid for the SEO tab.
 *
 * Renders one keyword at a time as an NxN grid of Google Maps ranks across
 * points centred on the practice (data from Local Viking via geogrid_scans).
 * A keyword selector switches grids; metric tiles show Average Grid Rank,
 * Share of Local Voice, and top-3 coverage, each with its change vs the
 * previous scan. Lower ranks are greener; not-found nodes (>20) are grey.
 */
import { useState } from 'react';
import type { GeoGridBlock, GeoGridKeyword } from '../types';

/** Local-SEO convention: green = top of pack, red = bottom, grey = absent. */
function rankColor(rank: number | null): string {
  if (rank == null) return '#e3e5e8';
  if (rank <= 3) return '#1a9850';
  if (rank <= 6) return '#66bd63';
  if (rank <= 10) return '#f6c244';
  if (rank <= 15) return '#f08a3c';
  return '#d73027';
}

function cellText(rank: number | null): string {
  return rank == null ? '' : String(rank);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "1 Jun 2026" from an ISO timestamp. */
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Share of grid points ranking in the top 3 (0-1). */
function topThreeCoverage(kw: GeoGridKeyword): number {
  const cells = kw.ranks.flat();
  if (cells.length === 0) return 0;
  const top = cells.filter((r) => r != null && r <= 3).length;
  return top / cells.length;
}

interface MetricProps {
  label: string;
  value: string;
  /** Raw change for the arrow; sign interpreted by `lowerIsBetter`. */
  delta: number | null;
  deltaText: string | null;
  lowerIsBetter?: boolean;
}

function Metric({ label, value, delta, deltaText, lowerIsBetter }: MetricProps) {
  let tone = 'is-flat';
  if (delta != null && delta !== 0) {
    const improved = lowerIsBetter ? delta < 0 : delta > 0;
    tone = improved ? 'is-good' : 'is-bad';
  }
  return (
    <div className="vr-geogrid-metric">
      <div className="vr-geogrid-metric-label">{label}</div>
      <div className="vr-geogrid-metric-value">{value}</div>
      {deltaText != null && <div className={'vr-geogrid-metric-delta ' + tone}>{deltaText}</div>}
    </div>
  );
}

export function GeoGrid({ block }: { block: GeoGridBlock }) {
  const [idx, setIdx] = useState(0);
  const kw = block.keywords[idx] ?? block.keywords[0];
  if (!kw) return null;

  const centreIndex = Math.floor((kw.gridSize * kw.gridSize) / 2);
  const cells = kw.ranks.flat();

  const agrDelta = kw.agrPrev != null ? round2(kw.agr - kw.agrPrev) : null;
  const solvDelta = kw.solvPrev != null ? round2(kw.solv - kw.solvPrev) : null;
  const cov = topThreeCoverage(kw);

  const radius = ((kw.gridSize - 1) / 2) * block.gridPointDistance;
  const unit = block.gridDistanceMeasure === 'meters' ? 'm' : 'mi';

  return (
    <div className="vr-geogrid">
      {/* Keyword selector */}
      <div className="vr-geogrid-kw" role="tablist" aria-label="Tracked keywords">
        {block.keywords.map((k, i) => (
          <button
            key={k.term}
            type="button"
            role="tab"
            aria-selected={i === idx}
            className={'vr-geogrid-kw-btn ' + (i === idx ? 'is-active' : '')}
            onClick={() => setIdx(i)}
          >
            <span className="vr-geogrid-kw-term">{titleCase(k.term)}</span>
            <span className="vr-geogrid-kw-solv">{Math.round(k.solv * 100)}% visibility</span>
          </button>
        ))}
      </div>

      <div className="vr-geogrid-body">
        {/* The grid */}
        <div className="vr-geogrid-plot">
          <div
            className="vr-geogrid-grid"
            style={{ gridTemplateColumns: `repeat(${kw.gridSize}, 1fr)` }}
          >
            {cells.map((r, i) => (
              <div
                key={i}
                className={'vr-geogrid-cell ' + (i === centreIndex ? 'is-centre' : '')}
                style={{ background: rankColor(r), color: r == null ? 'var(--vr-ink-3)' : '#fff' }}
                title={r == null ? 'Not in top 20' : `Rank ${r}`}
              >
                {cellText(r)}
              </div>
            ))}
          </div>
          <div className="vr-geogrid-legend">
            <span><i style={{ background: '#1a9850' }} />1–3</span>
            <span><i style={{ background: '#66bd63' }} />4–6</span>
            <span><i style={{ background: '#f6c244' }} />7–10</span>
            <span><i style={{ background: '#f08a3c' }} />11–15</span>
            <span><i style={{ background: '#d73027' }} />16–20</span>
            <span><i style={{ background: '#e3e5e8' }} />20+</span>
          </div>
        </div>

        {/* Metrics + caption */}
        <div className="vr-geogrid-side">
          <div className="vr-geogrid-metrics">
            <Metric
              label="Avg map rank"
              value={kw.agr.toFixed(1)}
              delta={agrDelta}
              deltaText={agrDelta != null ? signed(agrDelta, 1) : null}
              lowerIsBetter
            />
            <Metric
              label="Share of local voice"
              value={Math.round(kw.solv * 100) + '%'}
              delta={solvDelta}
              deltaText={solvDelta != null ? signed(solvDelta * 100, 0) + 'pp' : null}
            />
            <Metric
              label="Grid in top 3"
              value={Math.round(cov * 100) + '%'}
              delta={null}
              deltaText={null}
            />
          </div>
          <div className="vr-geogrid-caption">
            <strong>{block.businessName}</strong>
            <span>
              {kw.gridSize}×{kw.gridSize} grid · ≈{radius.toFixed(radius < 10 ? 1 : 0)} {unit} radius
            </span>
            <span>Scanned {shortDate(block.scannedAt)}</span>
            {block.previousScannedAt && (
              <span className="vr-geogrid-caption-muted">
                Change vs {shortDate(block.previousScannedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function signed(n: number, dp: number): string {
  const s = n.toFixed(dp);
  return n > 0 ? '+' + s : s;
}
