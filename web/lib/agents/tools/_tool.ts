/**
 * defineTool — the contract every agent tool flows through.
 *
 * Wraps ai SDK 6's `tool()` with five guarantees, in order:
 *
 *   1. Zod input schema (typed for the model + parsed at boundary)
 *   2. Zod output schema (parsed before return — model never sees malformed)
 *   3. Permission gate     — ctx.user must hold the tool's `capability` slug
 *      (channels OR allowedRoutes). Failure returns a structured error to
 *      the model so it can apologise rather than crash.
 *   4. Graduation gate     — for tools with side effects, the runtime coerces
 *      `mode: 'execute'` → `'dry-run'` unless `(agent, tool)` is in
 *      ctx.graduations. This is the structural enforcement of cautious
 *      autonomy: nothing graduates by convention, only by an explicit
 *      agent_graduations row.
 *   5. Audit emit          — agent_tool_calls rows written for start, end,
 *      and error phases via web/lib/agents/trace.ts.
 *
 * Tools are constructed via factory functions that close over `ToolCtx` —
 * this keeps the per-call user, runId, channel, and graduations available
 * to the run() body without going through ai SDK's experimental_context.
 *
 * Write tools MUST include the `mode` field in their input schema. Use
 * `modeField()` for the canonical shape:
 *
 *   import { defineTool, modeField, z } from './_tool.js';
 *
 *   export const draftAsanaTask = (ctx: ToolCtx) => defineTool({
 *     name: 'draftAsanaTask',
 *     hasSideEffect: true,
 *     capability: 'asana:write',
 *     input: z.object({
 *       mode: modeField(),
 *       project: z.enum([...]),
 *       title: z.string(),
 *     }),
 *     output: z.object({ ... }),
 *     run: async (args, ctx) => { ... },
 *   }, ctx);
 */
import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { generateId } from '../../auth.js';
import { recordToolCall } from '../trace.js';
import { hasCapability } from '../permissions.js';
import { create as createRecommendation, getById as getRecById } from '../recommendations.js';
import { getChannel, recToCard, isDeliveryChannel } from '../channels/index.js';
import type { ToolCtx, ToolMode } from '../types.js';

// ---------------------------------------------------------------------------
// Mode field helper — write tools include this in their input schema.
// Default is 'dry-run' so a model that omits the field is automatically safe.
// ---------------------------------------------------------------------------

export function modeField() {
  return z.enum(['dry-run', 'execute']).default('dry-run');
}

// ---------------------------------------------------------------------------
// Result shape returned to the model when the tool short-circuits.
// These are NOT thrown — the model needs structured feedback so it can adapt.
// ---------------------------------------------------------------------------

export interface ToolErrorResult {
  ok: false;
  error: 'permission_denied' | 'invalid_input' | 'execution_error';
  message: string;
  capability?: string;
}

// ---------------------------------------------------------------------------
// Spec passed to defineTool().
// ---------------------------------------------------------------------------

export interface DefineToolSpec<TIn, TOut> {
  /** Tool name — surfaced to the model and used as registry key. */
  name: string;
  /** Description — the model uses this to decide when to call. */
  description: string;
  /** Whether this tool changes external state (Asana, Slack, push, email, etc.). */
  hasSideEffect: boolean;
  /** Permission slug, e.g. 'meetings:read', 'asana:write'. */
  capability: string;
  /**
   * User-supplied Zod input schema. Write tools must include `mode: modeField()`
   * in their object shape — the runtime coerces `'execute'` → `'dry-run'` when
   * the (agent, tool) pair is not in ctx.graduations.
   */
  input: z.ZodType<TIn>;
  /** User-supplied output schema. Parsed before return. */
  output: z.ZodType<TOut>;
  /**
   * Implementation. For write tools, args.mode reflects the *coerced* value
   * (post-graduation gate) — when run() sees mode='execute' it is authorised
   * to commit the side effect.
   */
  run: (args: TIn, ctx: ToolCtx) => Promise<TOut>;
}

// ---------------------------------------------------------------------------
// defineTool — returns an ai SDK Tool that the model can call.
// The factory pattern (closing over ctx) is intentional: each agent run
// builds its own toolset against a fresh ctx; tools cannot leak across runs.
// ---------------------------------------------------------------------------

export function defineTool<TIn, TOut>(
  spec: DefineToolSpec<TIn, TOut>,
  ctx: ToolCtx,
) {
  type Output = TOut | ToolErrorResult;
  // The SDK's discriminated `Tool<INPUT, OUTPUT>` shape unifies execute and
  // outputSchema via NeverOptional<>, which doesn't narrow cleanly when
  // OUTPUT is a union (TOut | ToolErrorResult). The shape is correct at
  // runtime — verified by the smoke test — so we annotate the boundary.
  // @ts-expect-error — see comment above; SDK NeverOptional<> + union OUTPUT
  return tool<TIn, Output>({
    description: spec.description,
    inputSchema: zodSchema<TIn>(spec.input),
    execute: async (raw: TIn, options): Promise<Output> => {
      const callId = options.toolCallId || generateId();
      const startedAt = Date.now();

      // -- 1. Permission gate ---------------------------------------------
      if (!hasCapability(ctx.user, spec.capability)) {
        await recordToolCall({
          runId: ctx.runId,
          callId,
          step: 0,
          toolName: spec.name,
          mode: 'dry-run',
          phase: 'error',
          input: raw,
          error: `permission_denied: ${spec.capability}`,
        });
        const result: ToolErrorResult = {
          ok: false,
          error: 'permission_denied',
          message: `User ${ctx.user.email} does not hold capability '${spec.capability}'.`,
          capability: spec.capability,
        };
        return result;
      }

      // -- 2. Input is already validated by ai SDK against spec.input
      //       before execute fires, so we can trust raw is TIn-shaped.
      const parsed = raw as TIn;

      // -- 3. Mode coercion (graduation gate) -----------------------------
      // Only meaningful for write tools, which include `mode` in their schema.
      // Read tools have no `mode` field, so this branch is a no-op.
      //
      // Semantics:
      //   - ungraduated pair: always dry-run (regardless of what model asked)
      //   - graduated pair:   always execute (this is the *point* of grad —
      //                       the admin has explicitly said this combo is
      //                       trusted; we don't second-guess via the model's
      //                       default)
      //
      // The /inbox approval flow re-runs the tool with a synthetic single-
      // entry graduations set, which lands here as "graduated" and
      // executes — that's how human approval triggers the real call.
      let effectiveMode: ToolMode = 'execute';
      if (spec.hasSideEffect) {
        const argsRecord = parsed as Record<string, unknown>;
        const graduated = ctx.graduations.has(spec.name);
        effectiveMode = graduated ? 'execute' : 'dry-run';
        // Reflect the coerced value back so run() sees the truth.
        argsRecord.mode = effectiveMode;
      }

      // -- 4. Audit: phase=start ------------------------------------------
      await recordToolCall({
        runId: ctx.runId,
        callId,
        step: 0,
        toolName: spec.name,
        mode: effectiveMode,
        phase: 'start',
        input: parsed,
      });

      // -- 5. Execute -----------------------------------------------------
      try {
        const rawOutput = await spec.run(parsed, ctx);
        const output = spec.output.parse(rawOutput) as TOut;

        await recordToolCall({
          runId: ctx.runId,
          callId,
          step: 0,
          toolName: spec.name,
          mode: effectiveMode,
          phase: 'end',
          output,
          durationMs: Date.now() - startedAt,
        });

        // -- 5a. Persist recommendation + post approval card -------------
        // Write tools running in dry-run mode produce a draft for human
        // review. Persist a recommendation row, then if the run is from a
        // delivery channel (slack / web / telegram) push the approval card
        // so the user sees Approve / Edit / Reject buttons. Best-effort —
        // if either step fails we log and continue rather than fail the
        // tool itself, since the model's reply still describes the draft.
        if (spec.hasSideEffect && effectiveMode === 'dry-run') {
          await persistAndDeliverDraft({ ctx, spec, parsed }).catch((err) =>
            console.error(
              '[defineTool] persistAndDeliverDraft failed:',
              err instanceof Error ? err.message : String(err),
            ),
          );
        }

        return output;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await recordToolCall({
          runId: ctx.runId,
          callId,
          step: 0,
          toolName: spec.name,
          mode: effectiveMode,
          phase: 'error',
          input: parsed,
          error: message,
          durationMs: Date.now() - startedAt,
        });
        const result: ToolErrorResult = {
          ok: false,
          error: 'execution_error',
          message,
        };
        return result;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Persist recommendation + push Block Kit / push / web card.
// Called from defineTool's wrapper after a successful dry-run of any write
// tool. Title and reasoning fall back to common input fields so all four
// existing draft tools (slack, asana, push, email) get reasonable cards
// without needing per-tool customisation.
// ---------------------------------------------------------------------------

async function persistAndDeliverDraft<TIn>(opts: {
  ctx: ToolCtx;
  spec: { name: string };
  parsed: TIn;
}): Promise<void> {
  const { ctx, spec, parsed } = opts;
  const args = parsed as Record<string, unknown>;
  const title =
    pickString(args, 'title') ||
    pickString(args, 'subject') ||
    `${spec.name}`;
  const reasoning =
    pickString(args, 'body') ||
    pickString(args, 'notes') ||
    `${spec.name} draft from ${ctx.agent}`;

  const recId = await createRecommendation({
    runId: ctx.runId,
    agent: ctx.agent,
    userId: ctx.user.id,
    title,
    reasoning,
    toolName: spec.name,
    payload: args,
  });

  if (!isDeliveryChannel(ctx.channel)) return;

  const rec = await getRecById(recId);
  if (!rec) return;

  try {
    await getChannel(ctx.channel).requestApproval(ctx.user.id, recToCard(rec));
  } catch (err: unknown) {
    console.error(
      `[defineTool] ${ctx.channel}.requestApproval failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

function pickString(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

// Re-export types most consumers will need.
export type { ToolCtx } from '../types.js';
export { z };
