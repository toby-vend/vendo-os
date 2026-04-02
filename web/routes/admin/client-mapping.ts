import type { FastifyPluginAsync } from 'fastify';
import {
  getAllClientMappings,
  addClientMapping,
  removeClientMapping,
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
    const client_name = (body.client_name || '').trim();
    const platform = (body.platform || '').trim();
    const platform_account_id = (body.platform_account_id || '').trim();
    const platform_account_name = (body.platform_account_name || '').trim();
    const crm_type = (body.crm_type || 'ghl').trim();

    if (!client_id || !platform || !platform_account_id) {
      reply.redirect('/admin/client-mapping');
      return;
    }

    try {
      await addClientMapping({
        client_id,
        client_name: client_name || `Client ${client_id}`,
        platform,
        platform_account_id,
        platform_account_name: platform_account_name || platform_account_id,
        crm_type,
      });
    } catch {
      // UNIQUE constraint — already mapped
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
