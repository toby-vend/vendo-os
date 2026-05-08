import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../lib/queries/base.js';
import { linkProjectToClient } from '../../lib/frameio/projects.js';
import { getConnectionStatus } from '../../lib/frameio/auth.js';
import { findBestClientMatch } from '../../lib/frameio/match.js';

/**
 * Admin UI for the Frame.io project → VendoOS client mapping queue.
 *
 *   GET  /admin/frameio-mapping          — page
 *   POST /admin/frameio-mapping/link     — confirm a mapping (project → client)
 *   POST /admin/frameio-mapping/dismiss  — drop a project from the queue
 *   POST /admin/frameio-mapping/replay   — flip skipped events back to received
 *
 * All routes are admin-gated by the global server.ts auth hook.
 */

export const adminFrameioMappingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') {
      return reply.code(403).send('Admin only');
    }

    const connection = await getConnectionStatus();

    // Queue: projects awaiting mapping
    const queueRows = await db.execute(`
      SELECT q.project_id, q.best_client_id, q.best_client_name, q.best_confidence, q.best_method,
             p.name AS project_name, p.view_url, p.workspace_id, p.last_seen_at,
             (SELECT COUNT(*) FROM frameio_events e WHERE e.project_id = q.project_id) AS event_count,
             (SELECT COUNT(*) FROM frameio_events e WHERE e.project_id = q.project_id
                AND e.processing_status = 'skipped') AS skipped_count
        FROM frameio_project_match_queue q
        JOIN frameio_projects p ON p.project_id = q.project_id
       WHERE q.dismissed_at IS NULL AND q.reviewed_at IS NULL
       ORDER BY q.created_at DESC
    `);

    // Mapped projects (so admin can override)
    const mappedRows = await db.execute(`
      SELECT csm.external_id AS project_id, csm.external_name AS project_name,
             csm.client_id, c.name AS client_name,
             p.view_url, p.last_seen_at,
             (SELECT COUNT(*) FROM frameio_events e WHERE e.project_id = csm.external_id
                AND e.processing_status = 'processed') AS processed_count
        FROM client_source_mappings csm
        JOIN clients c ON c.id = csm.client_id
        LEFT JOIN frameio_projects p ON p.project_id = csm.external_id
       WHERE csm.source = 'frameio'
       ORDER BY p.last_seen_at DESC NULLS LAST
    `);

    // 24h event stats
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const stats = await db.execute({
      sql: `SELECT processing_status, COUNT(*) AS n FROM frameio_events
              WHERE received_at >= ? GROUP BY processing_status`,
      args: [since],
    });

    // All clients for the override dropdown
    const clients = await db.execute('SELECT id, name FROM clients ORDER BY name');

    reply.render('admin/frameio-mapping', {
      connection,
      queue: queueRows.rows,
      mapped: mappedRows.rows,
      stats: stats.rows,
      clients: clients.rows,
    });
  });

  // Confirm or override a mapping
  app.post('/link', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send('Admin only');

    const body = request.body as { project_id?: string; client_id?: string };
    if (!body.project_id || !body.client_id) {
      return reply.code(400).send('Missing project_id or client_id');
    }
    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return reply.code(400).send('Invalid client_id');
    }
    try {
      await linkProjectToClient({ projectId: body.project_id, clientId });
      // Replay any events that were skipped because of awaiting_mapping
      await db.execute({
        sql: `UPDATE frameio_events
                SET processing_status = 'received', processed_at = NULL, processing_error = NULL
              WHERE project_id = ?
                AND processing_status = 'skipped'
                AND (processing_error IS NULL OR processing_error = '')`,
        args: [body.project_id],
      });
      reply.redirect('/admin/frameio-mapping');
    } catch (err) {
      const msg = (err as Error).message;
      reply.code(500).type('text/html').send(
        `<p>Link failed: ${msg.replace(/[<>]/g, '')}</p><p><a href="/admin/frameio-mapping">Back</a></p>`,
      );
    }
  });

  // Dismiss a queue entry (e.g. junk project we don't want to map)
  app.post('/dismiss', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send('Admin only');
    const body = request.body as { project_id?: string };
    if (!body.project_id) return reply.code(400).send('Missing project_id');
    await db.execute({
      sql: 'UPDATE frameio_project_match_queue SET dismissed_at = ? WHERE project_id = ?',
      args: [new Date().toISOString(), body.project_id],
    });
    reply.redirect('/admin/frameio-mapping');
  });

  // Suggest the best match for an arbitrary project name (used by the form to
  // pre-fill the override dropdown when admin types a different name)
  app.get('/suggest', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    const q = request.query as { name?: string };
    if (!q.name) return reply.send({ match: null });
    const match = await findBestClientMatch(q.name);
    reply.send({ match });
  });
};
