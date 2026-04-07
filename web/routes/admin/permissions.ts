import type { FastifyPluginAsync } from 'fastify';
import { getChannels, getAllPermissions, setAllPermissions } from '../../lib/queries.js';

export const ROUTE_SLUGS = [
  { slug: 'dashboard', label: 'Dashboard' },
  { slug: 'clients', label: 'Clients' },
  { slug: 'pipeline', label: 'Pipeline' },
  { slug: 'dashboards', label: 'Dashboards' },
  { slug: 'ads', label: 'Ads' },
  { slug: 'action-items', label: 'Actions' },
  { slug: 'asana-tasks', label: 'Asana Tasks' },
  { slug: 'tasks', label: 'Content Tasks' },
  { slug: 'video-production', label: 'Video Production' },
  { slug: 'deliverables', label: 'Deliverables' },
  { slug: 'time-tracking', label: 'Time Tracking' },
  { slug: 'capacity', label: 'Capacity' },
  { slug: 'meetings', label: 'Meetings' },
  { slug: 'skills', label: 'Skills' },
  { slug: 'chat', label: 'Chat' },
  { slug: 'briefs', label: 'Briefs' },
  { slug: 'growth', label: 'Growth' },
  { slug: 'drive', label: 'Drive' },
  { slug: 'operations', label: 'Operations' },
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
