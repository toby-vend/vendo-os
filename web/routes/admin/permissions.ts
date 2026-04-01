import type { FastifyPluginAsync } from 'fastify';
import { getChannels, getAllPermissions, setAllPermissions } from '../../lib/queries.js';

const ROUTE_SLUGS = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'meetings', label: 'Meetings' },
  { slug: 'action-items', label: 'Actions' },
  { slug: 'clients', label: 'Clients' },
  { slug: 'pipeline', label: 'Pipeline' },
  { slug: 'ads', label: 'Ads' },
  { slug: 'briefs', label: 'Briefs' },
  { slug: 'drive', label: 'Drive' },
  { slug: 'sync-status', label: 'Sync Status' },
];

export const adminPermissionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const [channels, permissions] = await Promise.all([getChannels(), getAllPermissions()]);
    const permissionSet = new Set(permissions.map(p => `${p.channel_id}:${p.route_slug}`));

    reply.render('admin/permissions', {
      channels,
      routes: ROUTE_SLUGS,
      permissionSet: Object.fromEntries([...permissionSet].map(k => [k, true])),
    });
  });

  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, string | string[]>;
    const permValues = body.perm;
    const permArray = Array.isArray(permValues) ? permValues : (permValues ? [permValues] : []);

    const permissions: { channelId: string; routeSlug: string }[] = [];
    for (const val of permArray) {
      const [channelId, routeSlug] = (val as string).split(':');
      if (channelId && routeSlug) {
        permissions.push({ channelId, routeSlug });
      }
    }

    await setAllPermissions(permissions);
    reply.redirect('/admin/permissions');
  });
};
