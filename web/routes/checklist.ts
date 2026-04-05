import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries.js';

interface ChecklistClient {
  id: number;
  name: string;
  display_name: string | null;
  label: string;
  am: string | null;
  cm: string | null;
  health_score: number | null;
  health_tier: string | null;
  last_meeting_date: string | null;
  days_since_meeting: number | null;
  overdue_invoices: number;
  open_actions: number;
  contract_end: string | null;
  contract_days_left: number | null;
  attention_reasons: string;
}

export const checklistRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const amFilter = query.am || '';

    // Get clients that need attention today, ordered by urgency
    const clients = await rows<ChecklistClient>(`
      SELECT c.id, c.name, c.display_name,
             COALESCE(c.display_name, c.name) as label,
             c.am, c.cm,
             ch.score as health_score,
             CASE
               WHEN ch.score IS NULL THEN NULL
               WHEN ch.score >= 70 THEN 'healthy'
               WHEN ch.score >= 40 THEN 'at-risk'
               ELSE 'critical'
             END as health_tier,
             c.last_meeting_date,
             CAST(julianday('now') - julianday(c.last_meeting_date) AS INTEGER) as days_since_meeting,
             COALESCE(inv.overdue_count, 0) as overdue_invoices,
             COALESCE(act.open_count, 0) as open_actions,
             c.contract_end,
             CASE WHEN c.contract_end IS NOT NULL
               THEN CAST(julianday(c.contract_end) - julianday('now') AS INTEGER)
               ELSE NULL
             END as contract_days_left,
             '' as attention_reasons
      FROM clients c
      LEFT JOIN (
        SELECT client_name, score
        FROM client_health
        WHERE period = (SELECT MAX(period) FROM client_health)
      ) ch ON ch.client_name = c.name
      LEFT JOIN (
        SELECT contact_name, COUNT(*) as overdue_count
        FROM xero_invoices
        WHERE status = 'AUTHORISED' AND due_date < datetime('now') AND amount_due > 0
        GROUP BY contact_name
      ) inv ON inv.contact_name = c.name
      LEFT JOIN (
        SELECT m.client_name, COUNT(*) as open_count
        FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id
        WHERE ai.completed = 0
        GROUP BY m.client_name
      ) act ON act.client_name = c.name
      WHERE c.status = 'active'
        ${amFilter ? 'AND c.am = ?' : ''}
      HAVING (
        ch.score < 40
        OR ch.score IS NULL
        OR COALESCE(inv.overdue_count, 0) > 0
        OR COALESCE(act.open_count, 0) > 3
        OR CAST(julianday('now') - julianday(c.last_meeting_date) AS INTEGER) > 21
        OR (c.contract_end IS NOT NULL AND CAST(julianday(c.contract_end) - julianday('now') AS INTEGER) <= 30)
      )
      ORDER BY
        CASE WHEN ch.score IS NOT NULL AND ch.score < 40 THEN 0 ELSE 1 END,
        COALESCE(inv.overdue_count, 0) DESC,
        ch.score ASC
    `, amFilter ? [amFilter] : []);

    // Build attention reasons for each client
    for (const c of clients) {
      const reasons: string[] = [];
      if (c.health_score !== null && c.health_score < 40) reasons.push('Critical health score');
      else if (c.health_score === null) reasons.push('No health score');
      if (c.overdue_invoices > 0) reasons.push(`${c.overdue_invoices} overdue invoice${c.overdue_invoices > 1 ? 's' : ''}`);
      if (c.open_actions > 3) reasons.push(`${c.open_actions} open actions`);
      if (c.days_since_meeting !== null && c.days_since_meeting > 21) reasons.push(`No meeting in ${c.days_since_meeting} days`);
      if (c.contract_days_left !== null && c.contract_days_left <= 0) reasons.push('Contract expired');
      else if (c.contract_days_left !== null && c.contract_days_left <= 30) reasons.push(`Contract renews in ${c.contract_days_left} days`);
      (c as any).attention_reasons = reasons.join(', ');
    }

    // Get AM list for filter
    const ams = await rows<{ am: string }>(`
      SELECT DISTINCT am FROM clients WHERE am IS NOT NULL AND am != '' ORDER BY am COLLATE NOCASE
    `);

    reply.render('checklist', {
      clients,
      ams: ams.map(a => a.am),
      amFilter,
    });
  });
};
