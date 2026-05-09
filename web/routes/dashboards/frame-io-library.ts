import type { FastifyPluginAsync } from 'fastify';
import {
  getProjectsOverview,
  getFolderChildren,
  getBreadcrumb,
  getLibraryStats,
  searchLibrary,
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

  /**
   * GET /search?q=… — HTMX-friendly substring search.
   * Returns an HTML fragment listing matching videos (and folders) with
   * their full project › folder path, suitable for inline swap into the
   * library index page.
   */
  app.get<{ Querystring: { q?: string } }>('/search', async (request, reply) => {
    const q = (request.query.q ?? '').trim();
    const hits = q.length >= 2 ? await searchLibrary(q, 30) : [];

    const escape = (s: string) => s.replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
    }[ch] as string));

    if (q.length < 2) {
      return reply.type('text/html').send('');
    }
    if (hits.length === 0) {
      return reply.type('text/html').send(
        `<div style="padding:0.75rem 1rem;color:#94A3B8;font-size:13px;">No matches for <code>${escape(q)}</code>.</div>`,
      );
    }
    const rows = hits.map((h) => {
      const icon = h.type === 'folder' ? '📂' : '🎬';
      const linkTarget = h.type === 'folder'
        ? `/dashboards/frame-io/library/folder/${h.id}`
        : (h.parentId ? `/dashboards/frame-io/library/folder/${h.parentId}` : '#');
      return `
        <a href="${linkTarget}" style="display:block;padding:0.5rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.04);text-decoration:none;color:#E2E8F0;">
          <div style="font-size:13px;"><span style="margin-right:6px;">${icon}</span>${escape(h.name)}</div>
          <div style="font-size:11px;color:#94A3B8;margin-top:2px;">${escape(h.projectName)}${h.path ? ' › ' + escape(h.path) : ''}</div>
        </a>`;
    }).join('');
    return reply.type('text/html').send(`
      <div style="border:1px solid rgba(255,255,255,0.10);border-radius:8px;background:#0B0B0B;max-height:480px;overflow-y:auto;">
        <div style="padding:0.5rem 0.75rem;font-size:11px;color:#94A3B8;border-bottom:1px solid rgba(255,255,255,0.08);text-transform:uppercase;letter-spacing:0.05em;">
          ${hits.length} result${hits.length === 1 ? '' : 's'}
        </div>
        ${rows}
      </div>
    `);
  });
};
