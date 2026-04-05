import type { FastifyPluginAsync } from 'fastify';
import { getSidebarConfig, saveSidebarConfig, DEFAULT_SIDEBAR_CONFIG, type SidebarConfig, type SidebarGroup } from '../../lib/queries.js';

export const adminSidebarRoutes: FastifyPluginAsync = async (app) => {
  // Render the sidebar customisation page
  app.get('/', async (_request, reply) => {
    const config = await getSidebarConfig();
    reply.render('admin/sidebar', { config });
  });

  // Save updated config
  app.post('/', async (request, reply) => {
    const body = request.body as { config_json?: string };
    if (!body.config_json) {
      reply.code(400).send({ error: 'Missing config_json' });
      return;
    }

    let config: SidebarConfig;
    try {
      config = JSON.parse(body.config_json);
    } catch {
      reply.code(400).send({ error: 'Invalid JSON' });
      return;
    }

    // Basic validation: must be array of groups with id + items
    if (!Array.isArray(config) || !config.every(g => g.id && Array.isArray(g.items))) {
      reply.code(400).send({ error: 'Invalid sidebar config structure' });
      return;
    }

    await saveSidebarConfig(config);
    reply.redirect('/admin/sidebar');
  });

  // API endpoint — returns current config as JSON
  app.get('/api', async (_request, reply) => {
    const config = await getSidebarConfig();
    reply.send(config);
  });

  // Reset to default
  app.post('/reset', async (_request, reply) => {
    await saveSidebarConfig(DEFAULT_SIDEBAR_CONFIG);
    reply.redirect('/admin/sidebar');
  });
};
