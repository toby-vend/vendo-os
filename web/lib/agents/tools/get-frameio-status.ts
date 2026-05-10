import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  /** Project name to match (LIKE %name%). Optional — omit to summarise all projects. */
  project: z.string().optional(),
  /** Filter by media type (e.g. 'video', 'audio', 'image'). Optional. */
  mediaType: z.string().optional(),
  /** Filter by Frame.io status string. Optional. */
  status: z.string().optional(),
  /** Cap on returned project rows. Defaults to 25. */
  limit: z.number().int().min(1).max(100).default(25),
});

const outputSchema = z.object({
  projects: z.array(
    z.object({
      projectId: z.string(),
      name: z.string(),
      assetCount: z.number(),
      videoCount: z.number(),
      imageCount: z.number(),
      latestUpdate: z.string().nullable(),
      url: z.string().nullable(),
      statusBreakdown: z.record(z.string(), z.number()),
    }),
  ),
  totalAssets: z.number(),
});

export const getFrameioStatus = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getFrameioStatus',
      description:
        'Look up Frame.io project status — asset counts, latest activity, and status breakdown per project. Use for "video review status for X", "what is outstanding in Frame.io", "latest revision for client Y".',
      hasSideEffect: false,
      capability: CAPABILITIES.FRAMEIO_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const projectWhere: string[] = [];
        const projectParams: string[] = [];
        if (args.project) {
          projectWhere.push('p.name LIKE ?');
          projectParams.push(`%${args.project}%`);
        }
        const projectWhereSql = projectWhere.length
          ? `WHERE ${projectWhere.join(' AND ')}`
          : '';

        const projects = await rows<{
          project_id: string;
          name: string;
          view_url: string | null;
          last_seen_at: string | null;
        }>(
          `SELECT p.project_id, p.name, p.view_url, p.last_seen_at
             FROM frameio_projects p
             ${projectWhereSql}
             ORDER BY (p.last_seen_at IS NULL), p.last_seen_at DESC
             LIMIT ?`,
          [...projectParams, args.limit],
        );

        const out: z.infer<typeof outputSchema>['projects'] = [];
        let totalAssets = 0;

        for (const p of projects) {
          const where: string[] = ['project_id = ?', "deleted_at IS NULL"];
          const params: (string | number)[] = [p.project_id];
          if (args.mediaType) {
            where.push('media_type LIKE ?');
            params.push(`%${args.mediaType}%`);
          }
          if (args.status) {
            where.push('status LIKE ?');
            params.push(`%${args.status}%`);
          }
          const whereSql = `WHERE ${where.join(' AND ')}`;

          const counts = await rows<{
            asset_count: number;
            video_count: number;
            image_count: number;
            latest_update: string | null;
          }>(
            `SELECT
                COUNT(*) asset_count,
                SUM(CASE WHEN media_type LIKE 'video%' THEN 1 ELSE 0 END) video_count,
                SUM(CASE WHEN media_type LIKE 'image%' THEN 1 ELSE 0 END) image_count,
                MAX(updated_at) latest_update
              FROM frameio_assets ${whereSql}`,
            params,
          );
          const c = counts[0];
          if (!c || (c.asset_count ?? 0) === 0) continue;

          const breakdown = await rows<{ status: string | null; n: number }>(
            `SELECT status, COUNT(*) n
                FROM frameio_assets ${whereSql}
                GROUP BY status`,
            params,
          );
          const statusBreakdown: Record<string, number> = {};
          for (const b of breakdown) {
            statusBreakdown[b.status ?? '(none)'] = b.n;
          }

          out.push({
            projectId: p.project_id,
            name: p.name,
            assetCount: c.asset_count,
            videoCount: c.video_count ?? 0,
            imageCount: c.image_count ?? 0,
            latestUpdate: c.latest_update,
            url: p.view_url ?? null,
            statusBreakdown,
          });
          totalAssets += c.asset_count;
        }

        return { projects: out, totalAssets };
      },
    },
    ctx,
  );
