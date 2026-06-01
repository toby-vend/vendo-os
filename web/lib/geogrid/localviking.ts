/**
 * Local Viking geo-grid API client.
 *
 * Local Viking exposes a small REST API for geo-grid rank tracking at
 * https://api.localviking.com. Auth is a single API key passed in the
 * `Authorization` header verbatim (NOT `Bearer <key>` — confirmed by live
 * probe; the `authorizationToken` header documented by third parties
 * returns 401).
 *
 * We only read here — `GET /geogrids?page=N` returns finished scans newest
 * first, 20 per page. The sync script (scripts/sync/sync-geogrid.ts) is the
 * only caller; it paginates, maps businesses to clients, and caches finished
 * scans in geogrid_scans.
 */

const BASE = 'https://api.localviking.com';
const PAGE_SIZE = 20;

/** One geo-grid scan as returned by Local Viking. */
export interface LvGeogrid {
  id: string;
  state: string; // 'finished' | 'processing' | ...
  /** NxN matrix; each cell is a rank string ("1".."20") or "X" (not found). */
  ranks: string[][];
  search_term: string;
  /** Average grid rank. */
  agr: number;
  /** Average total grid rank (counts not-found nodes as worst). */
  atgr: number;
  /** Share of local voice, 0-1. */
  solv: number;
  grid_size: number;
  grid_center_lat: number;
  grid_center_lng: number;
  grid_point_distance: number;
  grid_distance_measure: string; // 'miles' | 'meters'
  business_name: string;
  business_place_id: string;
  business_address: string | null;
  business_country: string | null;
  location_id: string;
  gbp_id: string | null;
  created_at: string;
  finished_at: string | null;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: apiKey };
}

/**
 * Fetch a single page of geo-grids (newest first). Returns [] past the end.
 */
export async function fetchGeogridPage(apiKey: string, page: number): Promise<LvGeogrid[]> {
  const res = await fetch(`${BASE}/geogrids?page=${page}`, { headers: authHeaders(apiKey) });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Local Viking auth failed (${res.status}). Check LOCALVIKING_API_KEY.`);
  }
  if (!res.ok) {
    throw new Error(`Local Viking GET /geogrids?page=${page} -> ${res.status}`);
  }
  const json = (await res.json()) as LvGeogrid[];
  return Array.isArray(json) ? json : [];
}

/**
 * Paginate the full geo-grid history. `maxPages` is a safety stop.
 */
export async function fetchAllGeogrids(apiKey: string, maxPages = 50): Promise<LvGeogrid[]> {
  const all: LvGeogrid[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchGeogridPage(apiKey, page);
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}
