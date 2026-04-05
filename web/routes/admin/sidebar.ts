import type { FastifyPluginAsync } from 'fastify';
import { getSidebarConfig, saveSidebarConfig, DEFAULT_SIDEBAR_CONFIG, type SidebarConfig } from '../../lib/queries.js';

export const adminSidebarRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const config = await getSidebarConfig();
    reply.render('admin/sidebar', { config });
  });

  app.post('/', async (request, reply) => {
    const body = request.body as { config_json?: string };
    if (!body.config_json) { reply.code(400).send({ error: 'Missing config_json' }); return; }

    let config: SidebarConfig;
    try { config = JSON.parse(body.config_json); } catch { reply.code(400).send({ error: 'Invalid JSON' }); return; }

    if (!Array.isArray(config) || !config.every(g => g.id && Array.isArray(g.items))) {
      reply.code(400).send({ error: 'Invalid sidebar config structure' });
      return;
    }

    await saveSidebarConfig(config);
    reply.redirect('/admin/sidebar');
  });

  app.get('/api', async (_request, reply) => {
    reply.send(await getSidebarConfig());
  });

  app.post('/reset', async (_request, reply) => {
    await saveSidebarConfig(DEFAULT_SIDEBAR_CONFIG);
    reply.redirect('/admin/sidebar');
  });
};
