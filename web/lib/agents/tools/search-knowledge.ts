import { z } from 'zod';
import { defineTool } from './_tool';
import { CAPABILITIES } from '../permissions';
import { searchSimilar } from '../memory/long-term';
import type { ToolCtx } from '../types';

// Wired to the libSQL native vector store via web/lib/agents/memory/long-term.
// Returns up to `limit` chunks ordered by cosine distance to the embedded
// query. `similarity` is reported as `1 - distance` so callers can use the
// natural "higher is better" convention.

const inputSchema = z.object({
  query: z.string().min(2),
  scope: z
    .enum(['meeting', 'decision', 'recommendation', 'client-doc', 'all'])
    .default('all'),
  limit: z.number().int().min(1).max(20).default(8),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      id: z.string(),
      scope: z.string(),
      scopeId: z.string(),
      content: z.string(),
      similarity: z.number(),
    }),
  ),
});

export const searchKnowledge = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'searchKnowledge',
      description:
        'Search the vector knowledge store of meeting summaries, decisions, and approved recommendations. Returns up to 8 semantically-relevant hits.',
      hasSideEffect: false,
      capability: CAPABILITIES.KNOWLEDGE_READ,
      input: inputSchema,
      output: outputSchema,
      run: async ({ query, scope, limit }) => {
        const memHits = await searchSimilar({ query, scope, limit });
        return {
          hits: memHits.map(h => ({
            id: h.id,
            scope: h.scope,
            scopeId: h.scope_id,
            content: h.content,
            similarity: 1 - h.distance,
          })),
        };
      },
    },
    ctx,
  );
