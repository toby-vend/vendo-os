import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

interface ConcernRow {
  id: number;
  meeting_id: string;
  severity: string | null;
  category: string | null;
  ai_summary: string | null;
  excerpts: string | null;
  created_at: string | null;
  meeting_title: string | null;
  meeting_url: string | null;
  client_name: string | null;
  recorded_at: string | null;
}

const inputSchema = z.object({
  /** Filter by client name (LIKE %client%) — looks up via meetings table. Optional. */
  client: z.string().optional(),
  /** Filter by severity. Optional. */
  severity: z.enum(['low', 'medium', 'high', 'critical', 'any']).default('any'),
  /** Filter by category text (LIKE %category%). Optional. */
  category: z.string().optional(),
  /** Inclusive YYYY-MM-DD start date for the meeting date. Defaults to 60 days ago. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Inclusive YYYY-MM-DD end date. Defaults to today. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Cap on returned hits. Defaults to 25. */
  limit: z.number().int().min(1).max(100).default(25),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      id: z.number(),
      meetingId: z.string(),
      meetingTitle: z.string().nullable(),
      meetingUrl: z.string().nullable(),
      clientName: z.string().nullable(),
      recordedAt: z.string().nullable(),
      severity: z.string().nullable(),
      category: z.string().nullable(),
      summary: z.string().nullable(),
      excerpt: z.string().nullable(),
      createdAt: z.string().nullable(),
    }),
  ),
  totalMatched: z.number(),
});

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 60);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export const searchMeetingConcerns = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'searchMeetingConcerns',
      description:
        'Search flagged concerns from past meetings — risks, pacing issues, things needing attention. Filter by client, severity, category, and date window. Defaults to the last 60 days. Returns concerns with the meeting context attached.',
      hasSideEffect: false,
      capability: CAPABILITIES.CONCERNS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const from = args.from ?? defaultFrom();
        const to = args.to ?? defaultTo();
        const where: string[] = [
          'mc.concern_detected = 1',
          'substr(m.date, 1, 10) >= ?',
          'substr(m.date, 1, 10) <= ?',
        ];
        const params: (string | number)[] = [from, to];

        if (args.client) {
          where.push('m.client_name LIKE ?');
          params.push(`%${args.client}%`);
        }
        if (args.severity !== 'any') {
          where.push('mc.severity = ?');
          params.push(args.severity);
        }
        if (args.category) {
          where.push('mc.category LIKE ?');
          params.push(`%${args.category}%`);
        }

        const whereSql = `WHERE ${where.join(' AND ')}`;

        const result = await rows<ConcernRow>(
          `SELECT mc.id, mc.meeting_id, mc.severity, mc.category, mc.ai_summary,
                  mc.excerpts, mc.created_at,
                  m.title as meeting_title, m.url as meeting_url,
                  m.client_name, m.date as recorded_at
            FROM meeting_concerns mc
            JOIN meetings m ON mc.meeting_id = m.id
            ${whereSql}
            ORDER BY m.date DESC, mc.id DESC
            LIMIT ?`,
          [...params, args.limit],
        );

        const countResult = await rows<{ n: number }>(
          `SELECT COUNT(*) as n
            FROM meeting_concerns mc
            JOIN meetings m ON mc.meeting_id = m.id
            ${whereSql}`,
          params,
        );
        const total = countResult[0]?.n ?? result.length;

        const hits = result.map((r) => {
          let excerpt: string | null = null;
          if (r.excerpts) {
            try {
              const parsed = JSON.parse(r.excerpts) as unknown;
              if (Array.isArray(parsed) && parsed.length > 0) {
                excerpt = String(parsed[0]).slice(0, 300);
              } else if (typeof parsed === 'string') {
                excerpt = parsed.slice(0, 300);
              } else {
                excerpt = r.excerpts.slice(0, 300);
              }
            } catch {
              excerpt = r.excerpts.slice(0, 300);
            }
          }
          return {
            id: r.id,
            meetingId: r.meeting_id,
            meetingTitle: r.meeting_title,
            meetingUrl: r.meeting_url,
            clientName: r.client_name,
            recordedAt: r.recorded_at,
            severity: r.severity,
            category: r.category,
            summary: r.ai_summary,
            excerpt,
          createdAt: r.created_at,
          };
        });

        return { hits, totalMatched: total };
      },
    },
    ctx,
  );
