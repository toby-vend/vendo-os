import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

interface AsanaTaskRow {
  gid: string;
  name: string;
  assignee_name: string | null;
  due_on: string | null;
  completed: number;
  completed_at: string | null;
  section_name: string | null;
  project_name: string | null;
  notes: string | null;
  permalink_url: string | null;
  modified_at: string | null;
}

const inputSchema = z.object({
  /** Free-text match against task name OR notes (LIKE %query%). Optional. */
  query: z.string().optional(),
  /** Filter by assignee display name (LIKE %assignee%). Optional. */
  assignee: z.string().optional(),
  /** Filter by project name (LIKE %project%). Optional. */
  project: z.string().optional(),
  /** Status filter. 'open' (default) excludes completed tasks. */
  status: z.enum(['open', 'completed', 'any']).default('open'),
  /** Only tasks due on or before this YYYY-MM-DD (inclusive). Optional. */
  dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Only tasks due on or after this YYYY-MM-DD (inclusive). Optional. */
  dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Cap returned hits. Defaults to 25, max 100. */
  limit: z.number().int().min(1).max(100).default(25),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      gid: z.string(),
      name: z.string(),
      assignee: z.string().nullable(),
      project: z.string().nullable(),
      section: z.string().nullable(),
      dueOn: z.string().nullable(),
      completed: z.boolean(),
      completedAt: z.string().nullable(),
      url: z.string().nullable(),
      notesExcerpt: z.string().nullable(),
    }),
  ),
  totalMatched: z.number(),
});

export const searchAsanaTasks = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'searchAsanaTasks',
      description:
        'Search Asana tasks across all synced projects. Filter by free-text (name or notes), assignee, project, status (open/completed/any), and due date range. Use for "what is on my plate", "what is overdue", "open tasks for X", "tasks due this week".',
      hasSideEffect: false,
      capability: CAPABILITIES.ASANA_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const where: string[] = [];
        const params: (string | number)[] = [];

        if (args.query) {
          where.push('(name LIKE ? OR notes LIKE ?)');
          const p = `%${args.query}%`;
          params.push(p, p);
        }
        if (args.assignee) {
          where.push('assignee_name LIKE ?');
          params.push(`%${args.assignee}%`);
        }
        if (args.project) {
          where.push('project_name LIKE ?');
          params.push(`%${args.project}%`);
        }
        if (args.status === 'open') where.push('completed = 0');
        else if (args.status === 'completed') where.push('completed = 1');
        if (args.dueBefore) {
          where.push('due_on IS NOT NULL AND due_on <= ?');
          params.push(args.dueBefore);
        }
        if (args.dueAfter) {
          where.push('due_on IS NOT NULL AND due_on >= ?');
          params.push(args.dueAfter);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const limit = args.limit;

        const result = await rows<AsanaTaskRow>(
          `SELECT gid, name, assignee_name, due_on, completed, completed_at,
                  section_name, project_name, notes, permalink_url, modified_at
             FROM asana_tasks
             ${whereSql}
             ORDER BY
               CASE WHEN due_on IS NULL THEN 1 ELSE 0 END,
               due_on ASC,
               modified_at DESC
             LIMIT ?`,
          [...params, limit],
        );

        // A second small query for total count so the model can decide
        // whether to refine.
        const countResult = await rows<{ n: number }>(
          `SELECT COUNT(*) as n FROM asana_tasks ${whereSql}`,
          params,
        );
        const total = countResult[0]?.n ?? result.length;

        const hits = result.map((r) => ({
          gid: r.gid,
          name: r.name,
          assignee: r.assignee_name ?? null,
          project: r.project_name ?? null,
          section: r.section_name ?? null,
          dueOn: r.due_on ?? null,
          completed: r.completed === 1,
          completedAt: r.completed_at ?? null,
          url: r.permalink_url ?? null,
          notesExcerpt: r.notes ? r.notes.slice(0, 240) : null,
        }));

        return { hits, totalMatched: total };
      },
    },
    ctx,
  );
