/**
 * invokeAgent — synchronous delegation from one agent to another.
 *
 * The orchestrator (atlas, atlas-brief, atlas-monitor) calls this tool to
 * hand a specific question off to a specialist (atlas-am, atlas-paid-social,
 * atlas-paid-search, atlas-creative, atlas-seo) and get back its final
 * text. The specialist runs as a normal background agent with its own
 * agent_runs row, but with `parent_run_id` pointing at the orchestrator's
 * run and `depth` incremented — which feeds the /admin/agents/run/:id
 * tree view and the recursion-cap check below.
 *
 * Capability propagation: child inherits ctx.user. resolveAgentByName
 * applies its usual access rules (admin or explicit route grant), so a
 * standard-tier user invoking atlas-paid-social transparently falls back
 * to atlas-staff — graceful degradation, no error.
 *
 * Recursion is capped at MAX_AGENT_DEPTH. Each child increments depth by
 * one; the tool refuses to spawn another child if depth would exceed the
 * cap. Three levels (orchestrator → specialist → sub-specialist) is the
 * deepest sensible chain — anything deeper is almost certainly a loop.
 *
 * Cycle break: this module would otherwise pull in agents/index.ts and
 * runtime.ts at module-load time, but those modules transitively import
 * the tool registry. The `await import(...)` calls inside execute() break
 * the cycle without introducing dynamic-import boilerplate elsewhere.
 */
import { defineTool, z } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import type { ToolCtx } from '../types.js';

const MAX_AGENT_DEPTH = 3;

const INVOKABLE = [
  'atlas-am',
  'atlas-paid-social',
  'atlas-paid-search',
  'atlas-creative',
  'atlas-seo',
] as const;

const inputSchema = z.object({
  agentName: z.enum(INVOKABLE).describe(
    'Specialist to delegate to. Pick the one whose domain matches the question.',
  ),
  prompt: z
    .string()
    .min(10)
    .max(2000)
    .describe(
      'What the specialist should do. Be concrete: name the client, the metric, ' +
        'the date range. The specialist receives this verbatim with its own ' +
        'system prompt — no extra context is forwarded.',
    ),
});

const outputSchema = z.object({
  runId: z.string().nullable(),
  text: z.string(),
  status: z.enum(['completed', 'errored', 'running', 'depth_exceeded', 'unresolved']),
  costUsd: z.number().nullable(),
  error: z.string().nullable(),
});

export const invokeAgent = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'invokeAgent',
      description:
        'Delegate to a specialist agent (paid social, paid search, SEO, creative, account-management) ' +
        'and get back its analysis. Use when you need depth on a domain the specialist owns. Be concrete ' +
        'in the prompt — name the client, the metric, the date range. The specialist returns its final text.',
      hasSideEffect: false,
      capability: CAPABILITIES.AGENTS_INVOKE,
      input: inputSchema,
      output: outputSchema,
      run: async (args, ctx) => {
        // Recursion cap. Counted at the *spawn* site so the model gets a
        // clean structured response rather than discovering the cap
        // mid-chain.
        const depth = ctx.depth ?? 0;
        if (depth >= MAX_AGENT_DEPTH) {
          return {
            runId: null,
            text: '',
            status: 'depth_exceeded' as const,
            costUsd: null,
            error: `agent depth limit reached (${depth}). Cannot invoke another agent from here.`,
          };
        }

        // Lazy imports break the agents/index.ts ↔ tools/index.ts cycle.
        const { resolveAgentByName } = await import('../agents/index.js');
        const { runAgentBackground } = await import('../runtime.js');

        const target = resolveAgentByName(args.agentName, ctx.user);
        // resolveAgentByName falls back to atlas-staff for non-admins on
        // specialist names — we'd rather surface that to the model than
        // silently route to a different agent.
        if (!target || target.name !== args.agentName) {
          return {
            runId: null,
            text: '',
            status: 'unresolved' as const,
            costUsd: null,
            error: `cannot resolve specialist '${args.agentName}' for ${ctx.user.email} ` +
              `(role: ${ctx.user.role}). Specialist agents require admin role or an explicit route grant.`,
          };
        }

        const childCtx: ToolCtx = {
          ...ctx,
          runId: '', // runtime stamps a fresh runId
          agent: target.name,
          depth: depth + 1,
          parentRunId: ctx.runId,
        };

        const result = await runAgentBackground({
          agent: target,
          ctx: childCtx,
          prompt: args.prompt,
          trigger: `delegation:${ctx.agent}`,
          conversationId: ctx.conversationId,
        });

        return {
          runId: result.runId,
          text: result.text,
          status: result.status,
          costUsd: result.costUsd,
          error: result.error,
        };
      },
    },
    ctx,
  );
