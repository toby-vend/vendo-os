/**
 * Client Knowledge route — staff-only briefing per client.
 *
 *   GET /clients/:name/knowledge — Eta page rendering the briefing
 *
 * Phase B will add:
 *   POST /clients/:name/notes          — create a note
 *   POST /clients/:name/notes/:id      — edit a note
 *   POST /clients/:name/notes/:id/archive — soft-delete a note
 *
 * Auth piggy-backs on the global onRequest hook in server.ts (vendo_session
 * cookie). No additional auth check needed here.
 */
import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries/base.js';
import { generateBriefing } from '../lib/client-knowledge/briefing.js';

interface ClientLookupRow {
  id: number;
  name: string;
  display_name: string | null;
}

export const clientKnowledgeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /clients/:name/knowledge
   */
  app.get('/:name/knowledge', async (request, reply) => {
    const { name } = request.params as { name: string };
    const decoded = decodeURIComponent(name);

    const clients = await rows<ClientLookupRow>(
      'SELECT id, name, display_name FROM clients WHERE name = ? LIMIT 1',
      [decoded],
    );
    const client = clients[0];
    if (!client) {
      reply.code(404).send('Client not found');
      return;
    }

    const briefing = await generateBriefing(client.id);
    if (!briefing) {
      reply.code(404).send('Briefing unavailable');
      return;
    }

    reply.render('clients/knowledge', { briefing });
  });
};
