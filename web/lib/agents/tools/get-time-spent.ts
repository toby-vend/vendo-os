import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

interface AggRow {
  client_name: string | null;
  project_name: string | null;
  user_name: string | null;
  total_hours: number;
  billable_hours: number;
  entry_count: number;
}

const inputSchema = z.object({
  /** Inclusive start date YYYY-MM-DD. Defaults to 30 days ago. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Inclusive end date YYYY-MM-DD. Defaults to today. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Filter by client name (LIKE %client%). Optional. */
  client: z.string().optional(),
  /** Filter by project name (LIKE %project%). Optional. */
  project: z.string().optional(),
  /** Filter by user name or email (LIKE %user%). Optional. */
  user: z.string().optional(),
  /** How to slice the totals. Defaults to 'client'. */
  groupBy: z.enum(['client', 'project', 'user', 'none']).default('client'),
  /** Cap on returned rows. Defaults to 25. */
  limit: z.number().int().min(1).max(100).default(25),
});

const outputSchema = z.object({
  windowFrom: z.string(),
  windowTo: z.string(),
  totalHours: z.number(),
  billableHours: z.number(),
  groups: z.array(
    z.object({
      label: z.string(),
      hours: z.number(),
      billableHours: z.number(),
      entries: z.number(),
    }),
  ),
});

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getTimeSpent = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getTimeSpent',
      description:
        'Aggregate Harvest time entries over a date range, grouped by client, project, or user. Use for "hours on client X this month", "team utilisation last week", "how much time on project Y". Defaults to the last 30 days.',
      hasSideEffect: false,
      capability: CAPABILITIES.TIME_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const from = args.from ?? defaultFrom();
        const to = args.to ?? defaultTo();
        const where: string[] = ['spent_date >= ?', 'spent_date <= ?'];
        const params: (string | number)[] = [from, to];

        if (args.client) {
          where.push('client_name LIKE ?');
          params.push(`%${args.client}%`);
        }
        if (args.project) {
          where.push('project_name LIKE ?');
          params.push(`%${args.project}%`);
        }
        if (args.user) {
          where.push('user_name LIKE ?');
          params.push(`%${args.user}%`);
        }

        const whereSql = `WHERE ${where.join(' AND ')}`;
        const groupCol =
          args.groupBy === 'client' ? 'client_name'
            : args.groupBy === 'project' ? 'project_name'
              : args.groupBy === 'user' ? 'user_name'
                : null;

        // Always compute the overall window totals.
        const totals = await rows<{
          total_hours: number;
          billable_hours: number;
        }>(
          `SELECT
              COALESCE(SUM(hours), 0) as total_hours,
              COALESCE(SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END), 0) as billable_hours
            FROM harvest_time_entries
            ${whereSql}`,
          params,
        );

        const totalHours = Math.round((totals[0]?.total_hours ?? 0) * 10) / 10;
        const billableHours = Math.round((totals[0]?.billable_hours ?? 0) * 10) / 10;

        if (!groupCol) {
          return {
            windowFrom: from,
            windowTo: to,
            totalHours,
            billableHours,
            groups: [],
          };
        }

        const grouped = await rows<AggRow>(
          `SELECT
              ${groupCol} as ${groupCol},
              SUM(hours) as total_hours,
              SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) as billable_hours,
              COUNT(*) as entry_count
            FROM harvest_time_entries
            ${whereSql}
            GROUP BY ${groupCol}
            ORDER BY total_hours DESC
            LIMIT ?`,
          [...params, args.limit],
        );

        const groups = grouped.map((g) => ({
          label: (g[groupCol as keyof AggRow] as string | null) ?? '(unknown)',
          hours: Math.round((g.total_hours ?? 0) * 10) / 10,
          billableHours: Math.round((g.billable_hours ?? 0) * 10) / 10,
          entries: g.entry_count ?? 0,
        }));

        return {
          windowFrom: from,
          windowTo: to,
          totalHours,
          billableHours,
          groups,
        };
      },
    },
    ctx,
  );
