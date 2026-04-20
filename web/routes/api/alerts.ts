import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../lib/queries/base.js';

/**
 * Client-alert feedback endpoints.
 *
 * POST /api/alerts/:id/acknowledge
 *   Marks a traffic_light_alerts row as acknowledged. Future traffic-light
 *   runs will suppress the same trigger until the score drops further.
 *   Auth: relies on the app's session middleware having admitted the user;
 *   records session.email (or "system") as acknowledged_by.
 */

interface AckBody {
  resolution_type?: 'intervening' | 'waiting' | 'escalated' | 'resolved';
  resolution_notes?: string;
}

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string }; Body: AckBody }>(
    '/:id/acknowledge',
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body || {};

      // The auth hook in server.ts decorates request.user with the signed-in
      // user (see decorateRequest('user', null)). Fall back to 'system' if
      // the alert is being acknowledged by an automation path.
      const user = (request as unknown as { user?: { email?: string } }).user;
      const actorEmail = user?.email || 'system';

      const existing = await db.execute({
        sql: 'SELECT id, acknowledged_at FROM traffic_light_alerts WHERE id = ? LIMIT 1',
        args: [id],
      });
      if (!existing.rows.length) {
        return reply.code(404).send({ error: 'Alert not found' });
      }
      if (existing.rows[0].acknowledged_at) {
        return reply.code(409).send({ error: 'Already acknowledged', acknowledged_at: existing.rows[0].acknowledged_at });
      }

      await db.execute({
        sql: `UPDATE traffic_light_alerts
              SET acknowledged_at = datetime('now'),
                  acknowledged_by = ?,
                  resolution_type = ?,
                  resolution_notes = ?
              WHERE id = ?`,
        args: [actorEmail, body.resolution_type ?? null, body.resolution_notes ?? null, id],
      });

      return reply.send({ ok: true, id, acknowledged_by: actorEmail });
    },
  );

  app.post<{ Body: { ids: number[]; resolution_type?: AckBody['resolution_type']; resolution_notes?: string } }>(
    '/acknowledge-bulk',
    async (request, reply) => {
      const { ids = [], resolution_type, resolution_notes } = request.body || { ids: [] };
      if (!Array.isArray(ids) || !ids.length) {
        return reply.code(400).send({ error: 'ids[] required' });
      }
      const user = (request as unknown as { user?: { email?: string } }).user;
      const actorEmail = user?.email || 'system';

      const placeholders = ids.map(() => '?').join(',');
      await db.execute({
        sql: `UPDATE traffic_light_alerts
              SET acknowledged_at = datetime('now'),
                  acknowledged_by = ?,
                  resolution_type = ?,
                  resolution_notes = ?
              WHERE id IN (${placeholders}) AND acknowledged_at IS NULL`,
        args: [actorEmail, resolution_type ?? null, resolution_notes ?? null, ...ids.map(String)],
      });

      return reply.send({ ok: true, count: ids.length, acknowledged_by: actorEmail });
    },
  );
};
