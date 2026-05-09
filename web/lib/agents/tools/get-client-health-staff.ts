/**
 * Staff-tier variant of getClientHealth.
 *
 * Identical resolution path (clientId or clientName) but the output
 * deliberately excludes Vendo's internal financial assessment of the
 * client relationship — staff don't see `financialScore` or `prevScore`.
 * The agent that surfaces this tool is told plainly that the financial
 * scoring is admin-only territory.
 *
 * The tool name is shortened to `getClientHealth` — the same name as the
 * admin variant — so the model and prompt stay consistent across tiers.
 * Tier separation lives at the agent's tool list, not at the model
 * surface. atlasStaff registers this factory, atlasAdmin registers the
 * full one; one of the two is in scope at a time.
 */
import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { scalar } from '../../queries/base.js';
import { getClientHealth as getClientHealthHelper } from '../../queries/clients.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z
  .object({
    clientId: z.number().int().optional(),
    clientName: z.string().optional(),
  })
  .refine((v) => !!v.clientId || !!v.clientName, {
    message: 'one of clientId or clientName required',
  });

const outputSchema = z.object({
  found: z.boolean(),
  clientName: z.string().nullable(),
  score: z.number().nullable(),
  performanceScore: z.number().nullable(),
  relationshipScore: z.number().nullable(),
  period: z.string().nullable(),
  trend: z.enum(['up', 'down', 'flat']).nullable(),
});

export const getClientHealthStaff = (ctx: ToolCtx) =>
  defineTool(
    {
      // Distinct internal name so the audit trail (agent_tool_calls.tool_name)
      // tells which variant ran. The model just sees this name and a
      // tier-appropriate description — function works the same.
      name: 'getClientHealthStaff',
      description:
        "Get the latest client health score (overall, performance, relationship) plus trend vs previous period. Financial scoring isn't included at this tier.",
      hasSideEffect: false,
      capability: CAPABILITIES.HEALTH_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        let resolvedName: string | null = args.clientName ?? null;
        if (!resolvedName && args.clientId) {
          resolvedName = await scalar<string>(
            'SELECT name FROM clients WHERE id = ?',
            [args.clientId],
          );
        }
        if (!resolvedName) {
          return {
            found: false,
            clientName: null,
            score: null,
            performanceScore: null,
            relationshipScore: null,
            period: null,
            trend: null,
          };
        }
        const detail = await getClientHealthHelper(resolvedName);
        if (!detail) {
          return {
            found: false,
            clientName: resolvedName,
            score: null,
            performanceScore: null,
            relationshipScore: null,
            period: null,
            trend: null,
          };
        }
        return {
          found: true,
          clientName: resolvedName,
          score: detail.score,
          performanceScore: detail.performance_score,
          relationshipScore: detail.relationship_score,
          period: detail.period,
          trend: detail.trend,
        };
      },
    },
    ctx,
  );
