import { rows } from './base.js';

// --- Interfaces ---

export interface GSCSummary {
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
}

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// --- GSC summary ---

export async function getGSCSummary(clientId: number, days = 30): Promise<GSCSummary | null> {
  const result = await rows<GSCSummary>(`
    SELECT COALESCE(SUM(d.clicks), 0) as total_clicks,
           COALESCE(SUM(d.impressions), 0) as total_impressions,
           CASE WHEN SUM(d.impressions) > 0
             THEN ROUND(CAST(SUM(d.clicks) AS REAL) / SUM(d.impressions) * 100, 2)
             ELSE 0
           END as avg_ctr,
           CASE WHEN COUNT(*) > 0
             THEN ROUND(SUM(d.avg_position * d.impressions) / NULLIF(SUM(d.impressions), 0), 1)
             ELSE 0
           END as avg_position
    FROM gsc_daily d
    JOIN client_source_mappings csm ON csm.external_id = d.site_id AND csm.source ='gsc'
    WHERE csm.client_id = ?
      AND d.date >= date('now', '-' || ? || ' days')
  `, [clientId, days]);
  return result[0] ?? null;
}

// --- Top queries by clicks ---

export async function getTopQueries(clientId: number, days = 30, limit = 20): Promise<GSCQueryRow[]> {
  return rows<GSCQueryRow>(`
    SELECT q.query,
           SUM(q.clicks) as clicks,
           SUM(q.impressions) as impressions,
           CASE WHEN SUM(q.impressions) > 0
             THEN ROUND(CAST(SUM(q.clicks) AS REAL) / SUM(q.impressions) * 100, 2)
             ELSE 0
           END as ctr,
           CASE WHEN SUM(q.impressions) > 0
             THEN ROUND(SUM(q.position * q.impressions) / SUM(q.impressions), 1)
             ELSE 0
           END as position
    FROM gsc_queries q
    JOIN client_source_mappings csm ON csm.external_id = q.site_id AND csm.source ='gsc'
    WHERE csm.client_id = ?
      AND q.date >= date('now', '-' || ? || ' days')
    GROUP BY q.query
    ORDER BY clicks DESC
    LIMIT ?
  `, [clientId, days, limit]);
}

// --- Top pages by clicks ---

export async function getTopPages(clientId: number, days = 30, limit = 20): Promise<GSCPageRow[]> {
  return rows<GSCPageRow>(`
    SELECT p.page,
           SUM(p.clicks) as clicks,
           SUM(p.impressions) as impressions,
           CASE WHEN SUM(p.impressions) > 0
             THEN ROUND(CAST(SUM(p.clicks) AS REAL) / SUM(p.impressions) * 100, 2)
             ELSE 0
           END as ctr,
           CASE WHEN SUM(p.impressions) > 0
             THEN ROUND(SUM(p.position * p.impressions) / SUM(p.impressions), 1)
             ELSE 0
           END as position
    FROM gsc_pages p
    JOIN client_source_mappings csm ON csm.external_id = p.site_id AND csm.source ='gsc'
    WHERE csm.client_id = ?
      AND p.date >= date('now', '-' || ? || ' days')
    GROUP BY p.page
    ORDER BY clicks DESC
    LIMIT ?
  `, [clientId, days, limit]);
}
