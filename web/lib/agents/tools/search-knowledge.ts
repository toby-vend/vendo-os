import { z } from 'zod';
import { defineTool } from './_tool';
import { CAPABILITIES } from '../permissions';
import type { ToolCtx } from '../types';

// TODO(Block 5): wire to vector store + embedding pipeline.
// This stub exists so agents and the registry can declare the tool now;
// it always returns an empty hit list until the knowledge base is built.

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
      run: async () => {
        // TODO(Block 5): perform an embedding lookup against the knowledge
        // store and return ranked hits. Until then, agents that call this
        // tool will see no results and should fall back to other tools.
        return { hits: [] };
      },
    },
    ctx,
  );
