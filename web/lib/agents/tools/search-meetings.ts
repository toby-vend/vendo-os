import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { searchMeetings as searchMeetingsHelper } from '../../queries/meetings.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  query: z.string().min(2).describe('FTS query — wildcard expanded'),
  client: z.string().optional().describe('Client name fragment (LIKE)'),
  sinceDays: z.number().int().min(1).max(365).default(60),
  limit: z.number().int().min(1).max(20).default(10),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      date: z.string(),
      url: z.string().nullable(),
      clientName: z.string().nullable(),
      excerpt: z.string(),
    }),
  ),
  total: z.number(),
});

export const searchMeetings = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'searchMeetings',
      description:
        'Search Fathom meeting summaries and transcripts. Returns up to 20 hits with id, title, date, url, client name and a short excerpt. Use when the user asks about something said in a meeting or about meetings with a particular client.',
      hasSideEffect: false,
      capability: CAPABILITIES.MEETINGS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        // Convert sinceDays to ISO date (YYYY-MM-DD).
        const fromDate = new Date(Date.now() - args.sinceDays * 24 * 60 * 60 * 1000);
        const from = fromDate.toISOString().slice(0, 10);

        const { meetings, total } = await searchMeetingsHelper({
          search: args.query,
          client: args.client,
          from,
          limit: args.limit,
        });

        const hits = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          url: m.url ?? null,
          clientName: m.client_name ?? null,
          excerpt: m.excerpt ?? (m.summary ?? '').slice(0, 200),
        }));

        return { hits, total };
      },
    },
    ctx,
  );
