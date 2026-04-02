import { rows } from './base.js';

// --- Interfaces ---

export interface GA4DailySummary {
  date: string;
  sessions: number;
  users: number;
  new_users: number;
  page_views: number;
  engaged_sessions: number;
  engagement_rate: number | null;
  avg_session_duration: number | null;
  bounce_rate: number | null;
  conversions: number;
}

export interface GA4TrafficSource {
  source: string | null;
  medium: string | null;
  sessions: number;
  users: number;
  conversions: number;
}

export interface GA4OrganicTrend {
  date: string;
  sessions: number;
  users: number;
  conversions: number;
}

// --- GA4 summary (daily breakdown) ---

export async function getGA4Summary(clientId: number, days = 30): Promise<GA4DailySummary[]> {
  return rows<GA4DailySummary>(`
    SELECT g.date,
           SUM(g.sessions) as sessions,
           SUM(g.users) as users,
           SUM(g.new_users) as new_users,
           SUM(g.page_views) as page_views,
           SUM(g.engaged_sessions) as engaged_sessions,
           CASE WHEN SUM(g.sessions) > 0
             THEN ROUND(CAST(SUM(g.engaged_sessions) AS REAL) / SUM(g.sessions), 4)
             ELSE NULL
           END as engagement_rate,
           CASE WHEN SUM(g.sessions) > 0
             THEN ROUND(SUM(g.avg_session_duration * g.sessions) / SUM(g.sessions), 2)
             ELSE NULL
           END as avg_session_duration,
           CASE WHEN SUM(g.sessions) > 0
             THEN ROUND(CAST(SUM(g.sessions) - SUM(g.engaged_sessions) AS REAL) / SUM(g.sessions), 4)
             ELSE NULL
           END as bounce_rate,
           SUM(g.conversions) as conversions
    FROM ga4_daily g
    JOIN client_account_map cam ON cam.platform_account_id = g.property_id AND cam.platform = 'ga4'
    WHERE cam.client_id = ?
      AND g.date >= date('now', '-' || ? || ' days')
    GROUP BY g.date
    ORDER BY g.date ASC
  `, [clientId, days]);
}

// --- Traffic sources breakdown ---

export async function getGA4TrafficSources(clientId: number, days = 30): Promise<GA4TrafficSource[]> {
  return rows<GA4TrafficSource>(`
    SELECT ts.source,
           ts.medium,
           SUM(ts.sessions) as sessions,
           SUM(ts.users) as users,
           SUM(ts.conversions) as conversions
    FROM ga4_traffic_sources ts
    JOIN client_account_map cam ON cam.platform_account_id = ts.property_id AND cam.platform = 'ga4'
    WHERE cam.client_id = ?
      AND ts.date >= date('now', '-' || ? || ' days')
    GROUP BY ts.source, ts.medium
    ORDER BY sessions DESC
  `, [clientId, days]);
}

// --- Organic sessions trend ---

export async function getOrganicTrend(clientId: number, days = 30): Promise<GA4OrganicTrend[]> {
  return rows<GA4OrganicTrend>(`
    SELECT ts.date,
           SUM(ts.sessions) as sessions,
           SUM(ts.users) as users,
           SUM(ts.conversions) as conversions
    FROM ga4_traffic_sources ts
    JOIN client_account_map cam ON cam.platform_account_id = ts.property_id AND cam.platform = 'ga4'
    WHERE cam.client_id = ?
      AND ts.date >= date('now', '-' || ? || ' days')
      AND ts.medium = 'organic'
    GROUP BY ts.date
    ORDER BY ts.date ASC
  `, [clientId, days]);
}
