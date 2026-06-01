/**
 * Geo-grid aggregator.
 *
 * Reads cached Local Viking scans (geogrid_scans, populated by
 * scripts/sync/sync-geogrid.ts) and shapes them into the GeoGridBlock the
 * SEO tab renders. For each tracked keyword we surface the most recent scan
 * plus AGR / SoLV deltas against that keyword's previous scan.
 *
 * Returns null when the client has no finished scans — the SEO tab then
 * falls back to the "coming soon" placeholder.
 */
import { rows } from '../../queries/base.js';
import type { GeoGridBlock, GeoGridKeyword } from '../dashboard-types.js';

interface ScanRow {
  search_term: string;
  grid_size: number;
  grid_point_distance: number | null;
  grid_distance_measure: string | null;
  grid_center_lat: number | null;
  grid_center_lng: number | null;
  agr: number | null;
  atgr: number | null;
  solv: number | null;
  ranks_json: string;
  scanned_at: string | null;
  business_name: string | null;
}

/** Parse Local Viking's rank matrix; "X" / non-numeric → null (>20 / absent). */
function parseRanks(json: string): (number | null)[][] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[][]).map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => {
      const n = Number(cell);
      return Number.isFinite(n) && /^\d+$/.test(String(cell).trim()) ? n : null;
    }),
  );
}

export async function buildGeoGrid(clientId: number): Promise<GeoGridBlock | null> {
  const scans = await rows<ScanRow>(
    `SELECT search_term, grid_size, grid_point_distance, grid_distance_measure,
            grid_center_lat, grid_center_lng, agr, atgr, solv, ranks_json,
            scanned_at, business_name
       FROM geogrid_scans
      WHERE client_id = ? AND state = 'finished'
      ORDER BY search_term ASC, scanned_at DESC`,
    [clientId],
  );
  if (scans.length === 0) return null;

  // Group by (term + grid size) so deltas only ever compare like-for-like
  // scans — a one-off 13×13 sweep must not be diffed against the weekly 9×9.
  const byCohort = new Map<string, ScanRow[]>();
  for (const s of scans) {
    const key = `${s.search_term.trim().toLowerCase()}|${s.grid_size}`;
    const list = byCohort.get(key) ?? [];
    list.push(s);
    byCohort.set(key, list);
  }

  // The client's dominant grid size — the one most of their scans use. We
  // pin every keyword to this so a single report doesn't mix a 9×9 and a
  // one-off 13×13 sweep (different dimensions + radius read as inconsistent).
  const sizeCounts = new Map<number, number>();
  for (const s of scans) sizeCounts.set(s.grid_size, (sizeCounts.get(s.grid_size) ?? 0) + 1);
  const dominantSize = [...sizeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Collapse to one cohort per keyword: prefer the cohort at the dominant
  // grid size; otherwise the cohort with the most scan history, tie-broken
  // by the freshest scan.
  const byTerm = new Map<string, ScanRow[]>();
  for (const list of byCohort.values()) {
    const term = list[0].search_term.trim().toLowerCase();
    const existing = byTerm.get(term);
    if (!existing) {
      byTerm.set(term, list);
      continue;
    }
    const isDom = list[0].grid_size === dominantSize;
    const existingDom = existing[0].grid_size === dominantSize;
    const fresher = (existing[0].scanned_at ?? '') < (list[0].scanned_at ?? '');
    const better =
      (isDom && !existingDom) ||
      (isDom === existingDom && list.length > existing.length) ||
      (isDom === existingDom && list.length === existing.length && fresher);
    if (better) byTerm.set(term, list);
  }

  const keywords: GeoGridKeyword[] = [];
  let latestScannedAt = '';
  let latestPrevScannedAt = '';
  let centerLat = 0;
  let centerLng = 0;
  let pointDistance = 0;
  let measure = 'miles';
  let businessName = '';

  for (const list of byTerm.values()) {
    const current = list[0];
    const previous = list[1] ?? null;
    keywords.push({
      term: current.search_term.trim(),
      gridSize: current.grid_size,
      ranks: parseRanks(current.ranks_json),
      agr: round2(current.agr ?? 0),
      atgr: round2(current.atgr ?? 0),
      solv: round2(current.solv ?? 0),
      agrPrev: previous?.agr != null ? round2(previous.agr) : null,
      solvPrev: previous?.solv != null ? round2(previous.solv) : null,
    });
    // Track block-level metadata from the freshest current scan.
    if ((current.scanned_at ?? '') > latestScannedAt) {
      latestScannedAt = current.scanned_at ?? '';
      centerLat = current.grid_center_lat ?? 0;
      centerLng = current.grid_center_lng ?? 0;
      pointDistance = current.grid_point_distance ?? 0;
      measure = current.grid_distance_measure ?? 'miles';
      businessName = current.business_name ?? '';
    }
    if (previous?.scanned_at && previous.scanned_at > latestPrevScannedAt) {
      latestPrevScannedAt = previous.scanned_at;
    }
  }

  // Most visible keywords first (highest Share of Local Voice).
  keywords.sort((a, b) => b.solv - a.solv);

  return {
    provider: 'localviking',
    businessName,
    gridCenterLat: centerLat,
    gridCenterLng: centerLng,
    gridPointDistance: pointDistance,
    gridDistanceMeasure: measure,
    scannedAt: latestScannedAt,
    previousScannedAt: latestPrevScannedAt || null,
    keywords,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
