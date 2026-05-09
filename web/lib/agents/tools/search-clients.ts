import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

interface ClientSearchRow {
  id: number;
  name: string;
  display_name: string | null;
  email: string | null;
  aliases: string | null;
  vertical: string | null;
  status: string | null;
  meeting_count: number | null;
}

const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      displayName: z.string().nullable(),
      vertical: z.string().nullable(),
      status: z.string().nullable(),
      meetingCount: z.number().nullable(),
    }),
  ),
});

export const searchClients = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'searchClients',
      description:
        'Search clients by name, display name, or alias. Returns up to 15 hits with id, name, display name, vertical, status, and meeting count.',
      hasSideEffect: false,
      capability: CAPABILITIES.CLIENTS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const pattern = `%${args.query}%`;
        const result = await rows<ClientSearchRow>(
          `SELECT id, name, display_name, email, aliases, vertical, status, meeting_count
           FROM clients
           WHERE name LIKE ? OR display_name LIKE ? OR aliases LIKE ?
           ORDER BY display_name COLLATE NOCASE
           LIMIT 15`,
          [pattern, pattern, pattern],
        );

        const hits = result.map((r) => ({
          id: r.id,
          name: r.name,
          displayName: r.display_name ?? null,
          vertical: r.vertical ?? null,
          status: r.status ?? null,
          meetingCount: r.meeting_count ?? null,
        }));

        return { hits };
      },
    },
    ctx,
  );
