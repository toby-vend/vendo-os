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

// --- GSC daily trend ---

export interface GSCDailyTrend {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avg_position: number;
}

export async function getGSCDailyTrend(clientId: number, days = 30): Promise<GSCDailyTrend[]> {
  return rows<GSCDailyTrend>(`
    SELECT d.date,
           SUM(d.clicks) as clicks,
           SUM(d.impressions) as impressions,
           CASE WHEN SUM(d.impressions) > 0
             THEN ROUND(CAST(SUM(d.clicks) AS REAL) / SUM(d.impressions) * 100, 2)
             ELSE 0
           END as ctr,
           CASE WHEN SUM(d.impressions) > 0
             THEN ROUND(SUM(d.avg_position * d.impressions) / SUM(d.impressions), 1)
             ELSE 0
           END as avg_position
    FROM gsc_daily d
    JOIN client_source_mappings csm ON csm.external_id = d.site_id AND csm.source ='gsc'
    WHERE csm.client_id = ?
      AND d.date >= date('now', '-' || ? || ' days')
    GROUP BY d.date
    ORDER BY d.date ASC
  `, [clientId, days]);
}

// --- Prior-period comparison ---

export async function getGSCSummaryPrior(clientId: number, days = 30): Promise<GSCSummary | null> {
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
      AND d.date >= date('now', '-' || (? * 2) || ' days')
      AND d.date < date('now', '-' || ? || ' days')
  `, [clientId, days, days]);
  return result[0] ?? null;
}

// --- Position distribution ---

export interface PositionBucket {
  bucket: string;
  count: number;
}

export async function getPositionDistribution(clientId: number, days = 30): Promise<PositionBucket[]> {
  return rows<PositionBucket>(`
    SELECT
      CASE
        WHEN pos <= 3 THEN '1-3'
        WHEN pos <= 10 THEN '4-10'
        WHEN pos <= 20 THEN '11-20'
        ELSE '20+'
      END as bucket,
      COUNT(*) as count
    FROM (
      SELECT
        ROUND(SUM(q.position * q.impressions) / NULLIF(SUM(q.impressions), 0), 1) as pos
      FROM gsc_queries q
      JOIN client_source_mappings csm ON csm.external_id = q.site_id AND csm.source ='gsc'
      WHERE csm.client_id = ?
        AND q.date >= date('now', '-' || ? || ' days')
      GROUP BY q.query
      HAVING SUM(q.impressions) > 0
    )
    GROUP BY bucket
    ORDER BY
      CASE bucket
        WHEN '1-3' THEN 1
        WHEN '4-10' THEN 2
        WHEN '11-20' THEN 3
        ELSE 4
      END
  `, [clientId, days]);
}

// --- CTR opportunities (high impressions, low CTR, rankable position) ---

export interface CTROpportunity {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getCTROpportunities(clientId: number, days = 30, limit = 10): Promise<CTROpportunity[]> {
  return rows<CTROpportunity>(`
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
    HAVING SUM(q.impressions) >= 50
      AND ROUND(CAST(SUM(q.clicks) AS REAL) / SUM(q.impressions) * 100, 2) < 5
      AND ROUND(SUM(q.position * q.impressions) / SUM(q.impressions), 1) BETWEEN 4 AND 20
    ORDER BY impressions DESC
    LIMIT ?
  `, [clientId, days, limit]);
}

// --- Position movers (queries that improved or dropped vs prior period) ---

export interface PositionMover {
  query: string;
  current_position: number;
  previous_position: number;
  change: number;
  clicks: number;
  impressions: number;
}

export async function getPositionMovers(clientId: number, days = 30, limit = 10): Promise<{ improved: PositionMover[]; declined: PositionMover[] }> {
  const all = await rows<PositionMover>(`
    SELECT
      cur.query,
      cur.current_position,
      prev.previous_position,
      ROUND(prev.previous_position - cur.current_position, 1) as change,
      cur.clicks,
      cur.impressions
    FROM (
      SELECT q.query,
             ROUND(SUM(q.position * q.impressions) / NULLIF(SUM(q.impressions), 0), 1) as current_position,
             SUM(q.clicks) as clicks,
             SUM(q.impressions) as impressions
      FROM gsc_queries q
      JOIN client_source_mappings csm ON csm.external_id = q.site_id AND csm.source ='gsc'
      WHERE csm.client_id = ?
        AND q.date >= date('now', '-' || ? || ' days')
      GROUP BY q.query
      HAVING SUM(q.impressions) >= 10
    ) cur
    JOIN (
      SELECT q.query,
             ROUND(SUM(q.position * q.impressions) / NULLIF(SUM(q.impressions), 0), 1) as previous_position
      FROM gsc_queries q
      JOIN client_source_mappings csm ON csm.external_id = q.site_id AND csm.source ='gsc'
      WHERE csm.client_id = ?
        AND q.date >= date('now', '-' || (? * 2) || ' days')
        AND q.date < date('now', '-' || ? || ' days')
      GROUP BY q.query
      HAVING SUM(q.impressions) >= 10
    ) prev ON cur.query = prev.query
    WHERE ABS(prev.previous_position - cur.current_position) >= 1
    ORDER BY change DESC
  `, [clientId, days, clientId, days, days]);

  return {
    improved: all.filter(m => m.change > 0).slice(0, limit),
    declined: all.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, limit),
  };
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
