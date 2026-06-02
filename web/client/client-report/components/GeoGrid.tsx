/**
 * GeoGrid — local map-pack rank grid for the SEO tab, projected onto a
 * to-scale dark basemap.
 *
 * Each tracked keyword renders as an NxN grid of Google Maps ranks. Node
 * positions are computed from the scan's real centre coordinate + node
 * spacing (Local Viking), so they sit at their true geographic locations on
 * a CARTO dark raster basemap (Leaflet handles the Web Mercator projection,
 * so the grid is correctly to scale). Better ranks render as larger, greener
 * nodes; not-found nodes (>20) are hollow rings. Everything is driven by the
 * payload — nothing here is hard-coded to a specific client.
 *
 * CSP note: CARTO tiles load as <img> (img-src https: is allowed); Leaflet
 * JS is bundled and its CSS is inlined into client-report.css, so no external
 * script/style is needed.
 */
import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import type { GeoGridBlock, GeoGridKeyword } from '../types';

const TIER_HEX: Record<number, string> = {
  1: '#16A34A', 2: '#5BAE52', 3: '#E0B53A', 4: '#E8823A', 5: '#D63B36', 6: '#5f6b66',
};
/** Tier 2/3 (light green, amber) read better with dark numerals. */
const DARK_TEXT_TIERS = new Set([2, 3]);

function tierOf(v: number | null): number {
  if (v == null) return 6;
  if (v <= 3) return 1;
  if (v <= 6) return 2;
  if (v <= 10) return 3;
  if (v <= 15) return 4;
  if (v <= 20) return 5;
  return 6;
}

const METRES_PER_DEG_LAT = 111_320;

/** Geographic lat/lng of every node, from the scan's centre + spacing. */
function nodeLatLngs(block: GeoGridBlock, gridSize: number): L.LatLngTuple[][] {
  const mid = Math.floor(gridSize / 2);
  const spacingM =
    block.gridPointDistance * (block.gridDistanceMeasure === 'meters' ? 1 : 1609.344);
  const latRad = (block.gridCenterLat * Math.PI) / 180;
  const grid: L.LatLngTuple[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: L.LatLngTuple[] = [];
    for (let c = 0; c < gridSize; c++) {
      const east = (c - mid) * spacingM; // +east
      const north = (mid - r) * spacingM; // row 0 = northernmost
      const lat = block.gridCenterLat + north / METRES_PER_DEG_LAT;
      const lng = block.gridCenterLng + east / (METRES_PER_DEG_LAT * Math.cos(latRad));
      row.push([lat, lng]);
    }
    grid.push(row);
  }
  return grid;
}

interface Projected {
  pts: { x: number; y: number }[][];
  /** Pixel distance between adjacent nodes — scales node radii to the map. */
  stepPx: number;
  width: number;
  height: number;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function topThreeCoverage(kw: GeoGridKeyword): number {
  const cells = kw.ranks.flat();
  if (cells.length === 0) return 0;
  return cells.filter((r) => r != null && r <= 3).length / cells.length;
}

function signed(n: number, dp: number): string {
  const s = n.toFixed(dp);
  return n > 0 ? '+' + s : s;
}

// ── SVG node overlay ─────────────────────────────────────────────────────

function NodeOverlay({ kw, proj }: { kw: GeoGridKeyword; proj: Projected }) {
  const scale = proj.stepPx / 70; // design baseline: 70px node spacing
  const mid = Math.floor(kw.gridSize / 2);
  const pts = proj.pts;

  const baseRad = (v: number) => Math.max(9, 26 - (v - 1) * 0.9);

  // Faint lattice connecting adjacent grid points (rows + columns).
  const lines: JSX.Element[] = [];
  for (let r = 0; r < kw.gridSize; r++) {
    for (let c = 0; c < kw.gridSize; c++) {
      const p = pts[r]?.[c];
      if (!p) continue;
      const right = pts[r]?.[c + 1];
      const down = pts[r + 1]?.[c];
      if (right) lines.push(<line key={`h${r}-${c}`} x1={p.x} y1={p.y} x2={right.x} y2={right.y} stroke="rgba(255,255,255,0.06)" />);
      if (down) lines.push(<line key={`v${r}-${c}`} x1={p.x} y1={p.y} x2={down.x} y2={down.y} stroke="rgba(255,255,255,0.06)" />);
    }
  }

  const nodes: JSX.Element[] = [];
  kw.ranks.forEach((row, r) => {
    row.forEach((v, c) => {
      const p = pts[r]?.[c];
      if (!p) return;
      const isCentre = r === mid && c === mid;
      if (v == null) {
        nodes.push(
          <circle key={`n${r}-${c}`} cx={p.x} cy={p.y} r={6 * scale} fill="none"
            stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />,
        );
        return;
      }
      const t = tierOf(v);
      const rad = baseRad(v) * scale;
      const fontSize = Math.max(8, Math.round(rad * (rad > 14 ? 0.5 : 0.62)));
      nodes.push(
        <g key={`n${r}-${c}`}>
          <circle cx={p.x} cy={p.y} r={rad + 5 * scale} fill={TIER_HEX[t]} opacity={0.16} />
          <circle cx={p.x} cy={p.y} r={rad} fill={TIER_HEX[t]}
            stroke={isCentre ? '#fff' : 'none'} strokeWidth={isCentre ? 2.5 : 0} />
          <text x={p.x} y={p.y + fontSize * 0.35} textAnchor="middle" fontSize={fontSize}
            fontFamily="var(--vr-mono)" fontWeight={600}
            fill={DARK_TEXT_TIERS.has(t) ? '#0a1f12' : '#fff'}>
            {v}
          </text>
        </g>,
      );
    });
  });

  // Dashed focus ring around the practice (centre node).
  const centre = pts[mid]?.[mid];
  const ring = centre ? (
    <circle cx={centre.x} cy={centre.y} r={32 * scale} fill="none" stroke="#fff"
      strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 4" />
  ) : null;

  return (
    <svg className="vr-geogrid-overlay" width={proj.width} height={proj.height}
      viewBox={`0 0 ${proj.width} ${proj.height}`}>
      {lines}
      {ring}
      {nodes}
    </svg>
  );
}

// ── Metric tile ────────────────────────────────────────────────────────────

function Metric({ label, value, deltaText, tone }: {
  label: string; value: string; deltaText: string | null; tone: string;
}) {
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
  const [proj, setProj] = useState<Projected | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const kw = block.keywords[idx] ?? block.keywords[0];
  const gridSize = kw?.gridSize ?? 9;

  // Initialise the basemap once, then project node positions. Reprojects on
  // resize and whenever the grid geometry (size) changes.
  useEffect(() => {
    const div = mapDivRef.current;
    if (!div || !kw) return;

    if (!mapRef.current) {
      mapRef.current = L.map(div, {
        zoomControl: false, attributionControl: false, dragging: false,
        scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
        keyboard: false, touchZoom: false, zoomSnap: 0, fadeAnimation: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', detectRetina: true, maxZoom: 20,
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;

    const project = () => {
      const grid = nodeLatLngs(block, gridSize);
      const corners: L.LatLngTuple[] = [
        grid[0][0], grid[0][gridSize - 1], grid[gridSize - 1][0], grid[gridSize - 1][gridSize - 1],
      ];
      map.invalidateSize({ animate: false });
      map.fitBounds(L.latLngBounds(corners), { padding: [28, 28], animate: false });
      const pts = grid.map((row) => row.map((ll) => {
        const pt = map.latLngToContainerPoint(L.latLng(ll[0], ll[1]));
        return { x: pt.x, y: pt.y };
      }));
      const a = pts[Math.floor(gridSize / 2)][Math.floor(gridSize / 2)];
      const b = pts[Math.floor(gridSize / 2)][Math.floor(gridSize / 2) + 1] ?? pts[0][1] ?? a;
      const stepPx = Math.hypot(b.x - a.x, b.y - a.y) || 70;
      const size = div.getBoundingClientRect();
      setProj({ pts, stepPx, width: size.width, height: size.height });
    };

    // Defer one frame so the container has its final layout size.
    const raf = requestAnimationFrame(project);
    const ro = new ResizeObserver(() => project());
    ro.observe(div);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, gridSize]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (!kw) return null;

  const agrDelta = kw.agrPrev != null ? round2(kw.agr - kw.agrPrev) : null;
  const solvDelta = kw.solvPrev != null ? round2(kw.solv - kw.solvPrev) : null;
  const cov = topThreeCoverage(kw);
  const radius = ((gridSize - 1) / 2) * block.gridPointDistance;
  const unit = block.gridDistanceMeasure === 'meters' ? 'm' : 'mi';

  return (
    <div className="vr-geogrid">
      {/* Keyword selector */}
      <div className="vr-geogrid-kw" role="tablist" aria-label="Tracked keywords">
        {block.keywords.map((k, i) => (
          <button key={k.term} type="button" role="tab" aria-selected={i === idx}
            className={'vr-geogrid-kw-btn ' + (i === idx ? 'is-active' : '')}
            onClick={() => setIdx(i)}>
            <span className="vr-geogrid-kw-term">{titleCase(k.term)}</span>
            <span className="vr-geogrid-kw-solv">{Math.round(k.solv * 100)}% visibility</span>
          </button>
        ))}
      </div>

      <div className="vr-geogrid-body">
        <div className="vr-geogrid-plot">
          <div className="vr-geogrid-map-shell">
            <div ref={mapDivRef} className="vr-geogrid-map" />
            {proj && <NodeOverlay kw={kw} proj={proj} />}
          </div>
          <div className="vr-geogrid-legend">
            <span><i style={{ background: TIER_HEX[1] }} />1–3</span>
            <span><i style={{ background: TIER_HEX[2] }} />4–6</span>
            <span><i style={{ background: TIER_HEX[3] }} />7–10</span>
            <span><i style={{ background: TIER_HEX[4] }} />11–15</span>
            <span><i style={{ background: TIER_HEX[5] }} />16–20</span>
            <span><i style={{ background: TIER_HEX[6] }} />20+</span>
            <span className="vr-geogrid-attr">© OpenStreetMap · © CARTO</span>
          </div>
        </div>

        <div className="vr-geogrid-side">
          <div className="vr-geogrid-metrics">
            <Metric label="Avg map rank" value={kw.agr.toFixed(1)}
              deltaText={agrDelta != null ? signed(agrDelta, 1) : null}
              tone={agrDelta == null || agrDelta === 0 ? 'is-flat' : agrDelta < 0 ? 'is-good' : 'is-bad'} />
            <Metric label="Share of local voice" value={Math.round(kw.solv * 100) + '%'}
              deltaText={solvDelta != null ? signed(solvDelta * 100, 0) + 'pp' : null}
              tone={solvDelta == null || solvDelta === 0 ? 'is-flat' : solvDelta > 0 ? 'is-good' : 'is-bad'} />
            <Metric label="Grid in top 3" value={Math.round(cov * 100) + '%'} deltaText={null} tone="is-flat" />
          </div>
          <div className="vr-geogrid-caption">
            <strong>{block.businessName}</strong>
            <span>{gridSize}×{gridSize} grid · ≈{radius.toFixed(radius < 10 ? 1 : 0)} {unit} radius</span>
            <span>Scanned {shortDate(block.scannedAt)}</span>
            {block.previousScannedAt && (
              <span className="vr-geogrid-caption-muted">Change vs {shortDate(block.previousScannedAt)}</span>
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
