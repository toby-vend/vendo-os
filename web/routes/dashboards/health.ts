import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../../lib/queries/base.js';
import { tierCaseSql, type HealthTier } from '../../lib/health/tiers.js';
import { ensureAlertTable } from '../../lib/jobs/traffic-light.js';

interface HealthRow {
  client_name: string;
  score: number | null;
  prev_score: number | null;
  tier: HealthTier | null;
  mrr: number;
  priority: number | null;
  grace_period: number;
  performance_score: number;
  relationship_score: number;
  financial_score: number;
  breakdown: string | null;
  am: string | null;
  overdue_invoices: number;
  last_meeting_date: string | null;
  days_since_meeting: number | null;
  has_mapping: number;
  latest_alert_id: number | null;
  latest_alert_trigger: string | null;
  latest_alert_acknowledged_at: string | null;
  asana_task_gid: string | null;
}

type FilterSlug = 'trending-down' | 'dropped-tier' | 'overdue' | 'no-recent-meeting' | 'unmapped' | 'grace' | 'all';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { filter?: FilterSlug; tier?: HealthTier | 'all' } }>(
    '/',
    async (request, reply) => {
      const filter: FilterSlug = request.query.filter || 'all';
      const tierFilter = request.query.tier || 'all';

      // Make sure the alerts table is there before we try to LEFT JOIN it
      // — new environments won't have it until the cron fires for the first
      // time, and the dashboard shouldn't 500 in that state.
      await ensureAlertTable();

      // One query, four CTEs — avoids the N+1 correlated-subquery pattern
      // that made the dashboard render slow (and 500 on missing tables).
      const clients = await rows<HealthRow>(`
        WITH latest AS (
          SELECT MAX(period) AS p FROM client_health
        ),
        prev AS (
          SELECT MAX(period) AS p FROM client_health
          WHERE period < (SELECT p FROM latest)
        ),
        last_meeting AS (
          SELECT client_name, MAX(date) AS d FROM meetings GROUP BY client_name
        ),
        overdue AS (
          SELECT
            COALESCE(c.xero_contact_id, c.name) AS key_xero,
            c.name AS key_name,
            c.id AS client_id,
            COUNT(*) AS n
          FROM xero_invoices xi
          JOIN clients c
            ON (xi.contact_id = c.xero_contact_id AND c.xero_contact_id IS NOT NULL)
            OR (xi.contact_name = c.name AND c.xero_contact_id IS NULL)
          WHERE xi.status = 'AUTHORISED' AND xi.due_date < date('now') AND xi.amount_due > 0
          GROUP BY c.id
        ),
        mapped AS (
          SELECT client_id FROM client_source_mappings
          WHERE source IN ('meta','gads','ga4','gsc')
          GROUP BY client_id
        ),
        latest_alert AS (
          SELECT tla.*
          FROM traffic_light_alerts tla
          JOIN (
            SELECT client_name, MAX(id) AS id FROM traffic_light_alerts GROUP BY client_name
          ) m ON m.id = tla.id
        )
        SELECT
          c.name AS client_name,
          ch.score,
          ch.performance_score,
          ch.relationship_score,
          ch.financial_score,
          ch.breakdown,
          COALESCE(ch.grace_period, 0) AS grace_period,
          COALESCE(ch.mrr, c.mrr, 0) AS mrr,
          ch.priority,
          ${tierCaseSql('ch.score')} AS tier,
          prev.score AS prev_score,
          c.am,
          COALESCE(overdue.n, 0) AS overdue_invoices,
          last_meeting.d AS last_meeting_date,
          CASE WHEN last_meeting.d IS NOT NULL
               THEN CAST(julianday('now') - julianday(last_meeting.d) AS INTEGER)
               ELSE NULL
          END AS days_since_meeting,
          CASE WHEN mapped.client_id IS NOT NULL THEN 1 ELSE 0 END AS has_mapping,
          latest_alert.id AS latest_alert_id,
          latest_alert.trigger AS latest_alert_trigger,
          latest_alert.acknowledged_at AS latest_alert_acknowledged_at,
          latest_alert.asana_task_gid AS asana_task_gid
        FROM clients c
        LEFT JOIN client_health ch
          ON ch.client_name = c.name AND ch.period = (SELECT p FROM latest)
        LEFT JOIN client_health prev
          ON prev.client_name = c.name AND prev.period = (SELECT p FROM prev)
        LEFT JOIN last_meeting ON last_meeting.client_name = c.name
        LEFT JOIN overdue ON overdue.client_id = c.id
        LEFT JOIN mapped ON mapped.client_id = c.id
        LEFT JOIN latest_alert ON latest_alert.client_name = c.name
        WHERE c.status = 'active'
        ORDER BY COALESCE(ch.priority, 0) DESC, ch.score ASC
      `);

      const filtered = clients.filter((c) => applyFilter(c, filter, tierFilter));

      const counts = {
        total: clients.length,
        healthy: clients.filter((c) => c.tier === 'healthy').length,
        amber: clients.filter((c) => c.tier === 'amber').length,
        orange: clients.filter((c) => c.tier === 'orange').length,
        red: clients.filter((c) => c.tier === 'red').length,
        trendingDown: clients.filter((c) => hasTrendDown(c)).length,
        droppedTier: clients.filter((c) => hasTierDrop(c)).length,
        overdue: clients.filter((c) => c.overdue_invoices > 0).length,
        noRecentMeeting: clients.filter((c) => !c.days_since_meeting || c.days_since_meeting > 45).length,
        unmapped: clients.filter((c) => !c.has_mapping).length,
        grace: clients.filter((c) => c.grace_period).length,
      };

      reply.render('dashboards/health', {
        clients: filtered.map(enrichForView),
        counts,
        filter,
        tierFilter,
      });
    },
  );
};

function applyFilter(c: HealthRow, filter: FilterSlug, tierFilter: string): boolean {
  if (tierFilter && tierFilter !== 'all' && c.tier !== tierFilter) return false;
  switch (filter) {
    case 'trending-down': return hasTrendDown(c);
    case 'dropped-tier': return hasTierDrop(c);
    case 'overdue': return c.overdue_invoices > 0;
    case 'no-recent-meeting': return !c.days_since_meeting || c.days_since_meeting > 45;
    case 'unmapped': return !c.has_mapping;
    case 'grace': return !!c.grace_period;
    case 'all':
    default: return true;
  }
}

function hasTrendDown(c: HealthRow): boolean {
  if (c.score == null || c.prev_score == null) return false;
  return c.score < c.prev_score - 5;
}

function hasTierDrop(c: HealthRow): boolean {
  if (c.score == null || c.prev_score == null) return false;
  // Simple tier drop check using same boundaries as health/tiers.ts
  const prev = scoreToTierSimple(c.prev_score);
  const cur = scoreToTierSimple(c.score);
  const rank: Record<string, number> = { healthy: 0, amber: 1, orange: 2, red: 3 };
  return rank[cur] > rank[prev];
}

function scoreToTierSimple(s: number): 'healthy' | 'amber' | 'orange' | 'red' {
  if (s >= 70) return 'healthy';
  if (s >= 55) return 'amber';
  if (s >= 40) return 'orange';
  return 'red';
}

function enrichForView(c: HealthRow) {
  let topDriver: string | null = null;
  if (c.breakdown) {
    try {
      const parsed = JSON.parse(c.breakdown) as { topDrivers?: string[] };
      topDriver = parsed.topDrivers?.[0] ?? null;
    } catch { /* ignore */ }
  }

  let trendArrow: '↑' | '↓' | '→' | '' = '';
  if (c.score != null && c.prev_score != null) {
    if (c.score > c.prev_score + 5) trendArrow = '↑';
    else if (c.score < c.prev_score - 5) trendArrow = '↓';
    else trendArrow = '→';
  }

  const alertStatus = c.latest_alert_id
    ? c.latest_alert_acknowledged_at ? 'acknowledged' : 'open'
    : 'none';

  const asanaUrl = c.asana_task_gid ? `https://app.asana.com/0/0/${c.asana_task_gid}` : null;

  return {
    ...c,
    top_driver: topDriver,
    trend_arrow: trendArrow,
    alert_status: alertStatus,
    asana_url: asanaUrl,
  };
}
