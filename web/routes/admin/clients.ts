import type { FastifyPluginAsync } from 'fastify';
import {
  getAllClientsAdmin,
  getAdminClientDetail,
  updateClientDisplay,
  addSourceMapping,
  removeSourceMapping,
  getUnlinkedMetaAccounts,
  getUnlinkedGadsAccounts,
  getUnlinkedAsanaProjects,
  getUnlinkedGhlCompanies,
  getUnlinkedHarvestClients,
  getUnlinkedGa4Properties,
  getUnlinkedGscSites,
} from '../../lib/queries.js';

export const adminClientsRoutes: FastifyPluginAsync = async (app) => {
  // List all clients
  app.get('/', async (_request, reply) => {
    const clients = await getAllClientsAdmin();
    reply.render('admin/clients', { clients });
  });

  // Edit form for single client
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await getAdminClientDetail(Number(id));
    if (!data.client) { reply.code(404).send('Client not found'); return; }

    const [unlinkedMeta, unlinkedGads, unlinkedAsana, unlinkedGhl, unlinkedHarvest, unlinkedGa4, unlinkedGsc] = await Promise.all([
      getUnlinkedMetaAccounts(),
      getUnlinkedGadsAccounts(),
      getUnlinkedAsanaProjects(),
      getUnlinkedGhlCompanies(),
      getUnlinkedHarvestClients(),
      getUnlinkedGa4Properties(),
      getUnlinkedGscSites(),
    ]);

    reply.render('admin/client-edit', {
      ...data,
      unlinkedMeta,
      unlinkedGads,
      unlinkedAsana,
      unlinkedGhl,
      unlinkedHarvest,
      unlinkedGa4,
      unlinkedGsc,
    });
  });

  // Update client display fields
  app.post('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const display_name = (body.display_name || '').trim();
    const vertical = (body.vertical || '').trim();
    const status = body.status || 'active';
    const aliases = (body.aliases || '').trim();

    await updateClientDisplay(Number(id), { display_name, vertical, status, aliases });
    reply.redirect(`/admin/clients/${id}`);
  });

  // Add a source mapping
  app.post('/:id/mappings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const source = body.source;
    const external_id = body.external_id;
    const external_name = body.external_name || external_id;

    if (!source || !external_id) {
      reply.redirect(`/admin/clients/${id}`);
      return;
    }

    try {
      await addSourceMapping(Number(id), source, external_id, external_name);
    } catch {
      // UNIQUE constraint — already mapped
    }
    reply.redirect(`/admin/clients/${id}`);
  });

  // Remove a source mapping
  app.post('/:id/mappings/:mid/delete', async (request, reply) => {
    const { id, mid } = request.params as { id: string; mid: string };
    await removeSourceMapping(Number(mid));
    reply.redirect(`/admin/clients/${id}`);
  });
};
