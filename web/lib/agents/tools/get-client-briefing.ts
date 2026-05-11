import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { generateBriefing } from '../../client-knowledge/briefing.js';
import { renderBriefingMarkdown } from '../../client-knowledge/render.js';
import type { ToolCtx } from '../types.js';

/**
 * Returns a Markdown briefing for one client. The briefing aggregates every
 * existing data source (meetings, action items, Asana tasks, ad spend, GHL
 * pipeline, brand-hub presence, client_notes) into a single human-readable
 * summary suitable for grounding a Claude response.
 *
 * Callers should resolve the client ID first via `searchClients`.
 */

const inputSchema = z.object({
  clientId: z.number().int().positive(),
});

const outputSchema = z.object({
  found: z.boolean(),
  clientName: z.string().nullable(),
  briefing: z.string().nullable(),
});

export const getClientBriefing = (_ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getClientBriefing',
      description:
        'Fetch a Markdown briefing for one client containing health score, last meeting, open action items, Asana tasks, 30-day ad performance, open pipeline, brand-doc count and any free-text notes. Call searchClients first to resolve the clientId from a name.',
      hasSideEffect: false,
      capability: CAPABILITIES.CLIENTS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async ({ clientId }) => {
        const briefing = await generateBriefing(clientId);
        if (!briefing) {
          return { found: false, clientName: null, briefing: null };
        }
        return {
          found: true,
          clientName: briefing.meta.displayName || briefing.meta.name,
          briefing: renderBriefingMarkdown(briefing),
        };
      },
    },
  );
