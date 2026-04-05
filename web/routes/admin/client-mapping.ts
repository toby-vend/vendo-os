import type { FastifyPluginAsync } from 'fastify';
import {
  getAllClientMappings,
  addClientMapping,
  removeClientMapping,
  removeExistingMapping,
  getGhlLocations,
  getAllClientsAdmin,
} from '../../lib/queries.js';

export const adminClientMappingRoutes: FastifyPluginAsync = async (app) => {
  // List all client-account mappings
  app.get('/', async (_request, reply) => {
    const [mappings, ghlLocations, clients] = await Promise.all([
      getAllClientMappings(),
      getGhlLocations(),
      getAllClientsAdmin(),
    ]);
    reply.render('admin/client-mapping', { mappings, ghlLocations, clients });
  });

  // Add a mapping
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const client_id = Number(body.client_id);
    const source = (body.platform || body.source || '').trim();
    const external_id = (body.platform_account_id || body.external_id || '').trim();
    const external_name = (body.platform_account_name || body.external_name || '').trim();

    if (!client_id || !source || !external_id) {
      reply.redirect('/admin/client-mapping');
      return;
    }

    try {
      await removeExistingMapping(source, external_id);
      await addClientMapping({
        client_id,
        source,
        external_id,
        external_name: external_name || external_id,
      });
    } catch {
      // Write may be blocked by Turso plan limits
    }
    reply.redirect('/admin/client-mapping');
  });

  // Delete a mapping
  app.post('/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    await removeClientMapping(Number(id));
    reply.redirect('/admin/client-mapping');
  });
};
