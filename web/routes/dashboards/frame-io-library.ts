import type { FastifyPluginAsync } from 'fastify';
import {
  getProjectsOverview,
  getFolderChildren,
  getBreadcrumb,
  getLibraryStats,
} from '../../lib/queries/frameio-library.js';
import { syncFrameioLibrary } from '../../lib/frameio/sync-library.js';
import { db } from '../../lib/queries/base.js';

/**
 * /dashboards/frame-io/library — mirrored Frame.io tree.
 *
 *   GET  /                  — workspace overview (project cards)
 *   GET  /folder/:folderId  — folder browser (breadcrumb + immediate children)
 *   POST /sync              — admin-only ad-hoc sync trigger
 *
 * Data is mirrored by the cron at /api/cron/sync-frameio (nightly 03:30 UTC)
 * and by `npm run sync:frameio` for the initial backfill.
 */
export const frameIoLibraryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [stats, projects] = await Promise.all([
      getLibraryStats(),
      getProjectsOverview(),
    ]);
    reply.render('dashboards/frame-io-library', {
      view: 'index',
      stats,
      projects,
    });
  });

  app.get<{ Params: { folderId: string } }>('/folder/:folderId', async (request, reply) => {
    const { folderId } = request.params;

    // Resolve the row first so we can show the right title (project vs folder).
    const r = await db.execute({
      sql: 'SELECT id, name, type, project_id, view_url FROM frameio_assets WHERE id = ? LIMIT 1',
      args: [folderId],
    });
    const node = r.rows[0] as unknown as { id: string; name: string; type: string; project_id: string; view_url: string | null } | undefined;

    if (!node) {
      return reply.code(404).type('text/html').send('Folder or project not found in library mirror.');
    }

    // For 'project' rows, navigate to the root folder if one exists.
    let effectiveFolderId = folderId;
    if (node.type === 'project') {
      const rootRow = await db.execute({
        sql: `SELECT id FROM frameio_assets
               WHERE project_id = ? AND type = 'folder' AND parent_id IS NULL
                 AND deleted_at IS NULL
              LIMIT 1`,
        args: [node.project_id],
      });
      const root = rootRow.rows[0] as unknown as { id: string } | undefined;
      if (root) effectiveFolderId = root.id;
    }

    const [stats, breadcrumb, children, projectRow] = await Promise.all([
      getLibraryStats(),
      getBreadcrumb(effectiveFolderId),
      getFolderChildren(effectiveFolderId),
      db.execute({
        sql: 'SELECT name FROM frameio_assets WHERE id = ? LIMIT 1',
        args: [node.project_id],
      }),
    ]);
    const projectName = (projectRow.rows[0] as unknown as { name: string } | undefined)?.name ?? null;

    reply.render('dashboards/frame-io-library', {
      view: 'folder',
      stats,
      breadcrumb,
      children,
      currentFolder: node,
      projectName,
      projectId: node.project_id,
    });
  });

  app.post('/sync', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    const result = await syncFrameioLibrary();
    return reply.send({ ok: true, ...result });
  });
};
