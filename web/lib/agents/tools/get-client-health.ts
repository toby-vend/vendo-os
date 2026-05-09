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
  financialScore: z.number().nullable(),
  period: z.string().nullable(),
  trend: z.enum(['up', 'down', 'flat']).nullable(),
  prevScore: z.number().nullable(),
});

export const getClientHealth = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getClientHealth',
      description:
        'Get the latest health score for a client (overall, performance, relationship, financial) plus trend vs previous period.',
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
            financialScore: null,
            period: null,
            trend: null,
            prevScore: null,
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
            financialScore: null,
            period: null,
            trend: null,
            prevScore: null,
          };
        }

        return {
          found: true,
          clientName: resolvedName,
          score: detail.score,
          performanceScore: detail.performance_score,
          relationshipScore: detail.relationship_score,
          financialScore: detail.financial_score,
          period: detail.period,
          trend: detail.trend,
          prevScore: detail.prev_score,
        };
      },
    },
    ctx,
  );
