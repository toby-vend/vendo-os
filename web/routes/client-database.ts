import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries.js';

interface ClientDatabaseRow {
  id: number;
  name: string;
  display_name: string | null;
  label: string;
  status: string;
  vertical: string | null;
  am: string | null;
  cm: string | null;
  services: string | null;
  mrr: number | null;
  contract_end: string | null;
  last_meeting_date: string | null;
  health_score: number | null;
  health_tier: string | null;
  health_prev_score: number | null;
  health_trend: 'up' | 'down' | 'flat' | null;
  overdue_invoices: number;
}

export const clientDatabaseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const statusFilter = query.status || '';
    const tierFilter = query.tier || '';
    const amFilter = query.am || '';
    const searchTerm = query.q || '';

    // Build dynamic WHERE clauses
    const conditions: string[] = [];
    const args: (string | number | null)[] = [];

    if (statusFilter === 'all') {
      // No filter — show everything
    } else if (statusFilter) {
      conditions.push('c.status = ?');
      args.push(statusFilter);
    } else {
      // Default: show only active (canonical) clients
      conditions.push("c.status = 'active'");
    }

    if (tierFilter) {
      if (tierFilter === 'healthy') {
        conditions.push('ch.score >= 70');
      } else if (tierFilter === 'at-risk') {
        conditions.push('ch.score >= 40 AND ch.score < 70');
      } else if (tierFilter === 'critical') {
        conditions.push('ch.score < 40');
      } else if (tierFilter === 'no-score') {
        conditions.push('ch.score IS NULL');
      }
    }

    if (amFilter) {
      conditions.push('c.vertical = ?');
      args.push(amFilter);
    }

    if (searchTerm) {
      conditions.push('(COALESCE(c.display_name, c.name) LIKE ? OR c.name LIKE ?)');
      args.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const clients = await rows<ClientDatabaseRow>(`
      SELECT c.id, c.name, c.display_name,
             COALESCE(c.display_name, c.name) as label,
             COALESCE(c.status, 'active') as status,
             c.vertical,
             NULL as am,
             NULL as cm,
             NULL as services,
             c.total_invoiced as mrr,
             NULL as contract_end,
             c.last_meeting_date,
             ch.score as health_score,
             CASE
               WHEN ch.score IS NULL THEN NULL
               WHEN ch.score >= 70 THEN 'healthy'
               WHEN ch.score >= 40 THEN 'at-risk'
               ELSE 'critical'
             END as health_tier,
             prev.score as health_prev_score,
             CASE
               WHEN ch.score IS NULL OR prev.score IS NULL THEN NULL
               WHEN ch.score > prev.score + 5 THEN 'up'
               WHEN ch.score < prev.score - 5 THEN 'down'
               ELSE 'flat'
             END as health_trend,
             COALESCE(inv.overdue_count, 0) as overdue_invoices
      FROM clients c
      LEFT JOIN (
        SELECT client_name, score
        FROM client_health
        WHERE period = (SELECT MAX(period) FROM client_health)
      ) ch ON ch.client_name = c.name
      LEFT JOIN (
        SELECT client_name, score
        FROM client_health
        WHERE period = (
          SELECT MAX(period) FROM client_health
          WHERE period < (SELECT MAX(period) FROM client_health)
        )
      ) prev ON prev.client_name = c.name
      LEFT JOIN (
        SELECT contact_name, COUNT(*) as overdue_count
        FROM xero_invoices
        WHERE status = 'AUTHORISED' AND due_date < datetime('now') AND amount_due > 0
        GROUP BY contact_name
      ) inv ON inv.contact_name = c.name
      ${whereClause}
      ORDER BY COALESCE(c.display_name, c.name) COLLATE NOCASE
    `, args);

    // Get distinct verticals for filter dropdown
    const ams = await rows<{ am: string }>(`
      SELECT DISTINCT vertical as am FROM clients WHERE vertical IS NOT NULL AND vertical != '' ORDER BY vertical COLLATE NOCASE
    `);

    const isPartial = request.headers['hx-request'] === 'true';

    if (isPartial) {
      reply.render('client-database-table', {
        clients,
        statusFilter,
        tierFilter,
        amFilter,
        searchTerm,
      });
    } else {
      reply.render('client-database', {
        clients,
        ams: ams.map(a => a.am),
        statusFilter,
        tierFilter,
        amFilter,
        searchTerm,
      });
    }
  });
};
