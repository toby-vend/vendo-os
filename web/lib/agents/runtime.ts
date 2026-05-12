/**
 * Agent runtime — the wrapper every agent invocation flows through.
 *
 * Two entry points:
 *
 *   streamAgent({ agent, ctx, uiMessages })
 *     For the conversational surfaces (web /chat, Slack DM, Telegram).
 *     Wraps ai SDK 6's streamText, returns a Web `Response` whose body is a
 *     UIMessage stream (consumed by `useChat` on the client). The model
 *     decides when to call tools; defineTool's permission and graduation
 *     gates are still enforced inside each tool call.
 *
 *   runAgentBackground({ agent, ctx, prompt })
 *     For cron-triggered agents (Phase 2: Daily Brief, Monitor, Concern,
 *     Frame.io review, Onboarding). Wraps generateText with the same wiring.
 *     Returns the final text plus a list of recommendation IDs created by
 *     write tools during the run, so the cron handler can decide where to
 *     deliver them.
 *
 * Both entry points:
 *   - open an agent_runs row via startRun() before any tokens flow
 *   - stamp the run id onto ctx (as a fresh copy — caller's ctx is not
 *     mutated) so tools can attribute their audit rows correctly
 *   - persist each step's UIMessage parts via recordMessage()
 *   - close the run with endRun() carrying status, usage, cost, error
 *
 * Cost accounting: input/output tokens come from the SDK's `totalUsage` on
 * the final event. Cost is computed in this file using a simple per-token
 * tariff so we don't depend on the gateway returning a price; if the
 * gateway eventually exposes it, switch to that. Failures here are
 * non-fatal — we log and write null.
 */
import {
  streamText,
  generateText,
  stepCountIs,
  convertToModelMessages,
  type LanguageModel,
  type LanguageModelUsage,
  type StopCondition,
  type ToolSet,
  type UIMessage,
} from 'ai';
import { startRun, endRun, recordMessage } from './trace.js';
import { buildToolset } from './tools/index.js';
import { create as createRecommendation } from './recommendations.js';
import type { AgentDef, ChannelName, RunStatus, ToolCtx } from './types.js';

// ---------------------------------------------------------------------------
// Per-tier rough cost tariff in USD per 1M tokens. Keep these conservative;
// the daily-cost alert threshold (£20/day in the plan) provides the real
// circuit breaker. If the gateway starts returning usage cost directly,
// replace this with that value.
// ---------------------------------------------------------------------------

const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  // Anthropic — list prices as of 2026-Q2 (verify before renegotiating)
  'anthropic/claude-haiku-4.5': { input: 1, output: 5 },
  'anthropic/claude-sonnet-4.6': { input: 3, output: 15 },
  'anthropic/claude-opus-4.6': { input: 15, output: 75 },
};

function estimateCostUsd(model: string, usage: LanguageModelUsage): number | null {
  const tariff = COST_PER_M_TOKENS[model];
  if (!tariff) return null;
  const inT = usage.inputTokens ?? 0;
  const outT = usage.outputTokens ?? 0;
  return (inT * tariff.input + outT * tariff.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Build a fresh per-run ctx so the caller's ctx (which has runId='') stays
// pristine. The runtime is the only place the runId is known authoritatively.
// ---------------------------------------------------------------------------

function withRunId(base: ToolCtx, runId: string, agent: string): ToolCtx {
  return { ...base, runId, agent };
}

// ---------------------------------------------------------------------------
// streamAgent — for /api/agent/chat and channel adapters that want a
// streaming Response. The caller is responsible for shipping the Response
// (Web Response) to the client; we don't write to a Node res object here.
// ---------------------------------------------------------------------------

export interface StreamAgentInput {
  agent: AgentDef;
  ctx: ToolCtx; // runId is ignored on input; the runtime stamps a fresh one
  uiMessages: UIMessage[];
  conversationId?: string | null;
  trigger?: string; // e.g. 'user-message', 'app_mention', defaults to 'user-message'
}

export async function streamAgent(input: StreamAgentInput): Promise<Response> {
  const trigger = input.trigger ?? 'user-message';
  const conversationId = input.conversationId ?? input.ctx.conversationId ?? null;

  const runId = await startRun({
    agent: input.agent.name,
    user_id: input.ctx.user.id,
    channel: input.ctx.channel,
    conversation_id: conversationId,
    trigger,
    model: input.agent.model,
    parent_run_id: input.ctx.parentRunId ?? null,
    depth: input.ctx.depth ?? 0,
  });

  const runCtx = withRunId(input.ctx, runId, input.agent.name);
  const tools = buildToolset(input.agent, runCtx) as ToolSet;
  const model = input.agent.model as LanguageModel;
  const stopWhen = stepCountIs(input.agent.maxSteps ?? 8) as StopCondition<typeof tools>;
  const startedAt = Date.now();
  const modelMessages = await convertToModelMessages(input.uiMessages);

  const result = streamText({
    model,
    system: input.agent.systemPrompt(runCtx),
    messages: modelMessages,
    tools,
    stopWhen,
    onStepFinish: async (step) => {
      // Serialise this step's content into agent_messages. We persist the
      // assistant's text + tool-call shapes; the per-call detail lives in
      // agent_tool_calls (written from inside defineTool).
      try {
        await recordMessage({
          runId,
          step: step.stepNumber ?? 0,
          role: 'assistant',
          parts: {
            text: step.text ?? '',
            toolCalls: step.toolCalls ?? [],
            finishReason: step.finishReason ?? null,
          },
        });
      } catch (err: unknown) {
        console.error(
          '[agent-runtime] streamAgent.onStepFinish recordMessage failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    onFinish: async (event) => {
      const totalUsage = event.totalUsage;
      const costUsd = estimateCostUsd(input.agent.model, totalUsage);
      try {
        await endRun({
          runId,
          status: 'completed',
          inputTokens: totalUsage.inputTokens ?? undefined,
          outputTokens: totalUsage.outputTokens ?? undefined,
          costUsd: costUsd ?? undefined,
        });
      } catch (err: unknown) {
        console.error(
          '[agent-runtime] streamAgent.onFinish endRun failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
      // Light per-run console line for tail-watching
      const ms = Date.now() - startedAt;
      console.log(
        `[agent-runtime] ${input.agent.name} done — ${ms}ms · ${totalUsage.inputTokens ?? '?'}+${totalUsage.outputTokens ?? '?'} tok · $${costUsd?.toFixed(4) ?? '—'}`,
      );
    },
    onError: async ({ error }) => {
      try {
        await endRun({
          runId,
          status: 'errored' as RunStatus,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (e) {
        // already logging; swallow secondary failure
      }
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
  });
}

// ---------------------------------------------------------------------------
// runAgentBackground — for cron-triggered agents. Returns the final text
// plus the agent_recommendations IDs produced by write tools during the run.
// ---------------------------------------------------------------------------

export interface RunAgentBackgroundInput {
  agent: AgentDef;
  ctx: ToolCtx;
  /** Single-shot prompt. Mutually exclusive with `history`. */
  prompt?: string;
  /**
   * Multi-turn history reconstructed from agent_messages. The runtime turns
   * this into AI SDK ModelMessages and persists the latest user message
   * before calling the model so it shows up in the next turn's reload.
   */
  history?: { role: 'user' | 'assistant'; text: string }[];
  trigger: string; // e.g. 'cron:daily-brief', 'webhook:fathom'
  conversationId?: string | null;
}

export interface RunAgentBackgroundResult {
  runId: string;
  text: string;
  status: RunStatus;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  error: string | null;
}

export async function runAgentBackground(
  input: RunAgentBackgroundInput,
): Promise<RunAgentBackgroundResult> {
  const runId = await startRun({
    agent: input.agent.name,
    user_id: input.ctx.user.id,
    channel: input.ctx.channel,
    conversation_id: input.conversationId ?? null,
    trigger: input.trigger,
    model: input.agent.model,
    parent_run_id: input.ctx.parentRunId ?? null,
    depth: input.ctx.depth ?? 0,
  });

  const runCtx = withRunId(input.ctx, runId, input.agent.name);
  const tools = buildToolset(input.agent, runCtx) as ToolSet;
  const model = input.agent.model as LanguageModel;
  const stopWhen = stepCountIs(input.agent.maxSteps ?? 8) as StopCondition<typeof tools>;
  const startedAt = Date.now();

  // Build the model input. Either `history` (multi-turn, with latest user
  // message at the end) or `prompt` (single-shot, no history). For history
  // mode, persist the latest user turn before the model call so it'll be
  // visible to the next reload.
  const useHistory = Array.isArray(input.history) && input.history.length > 0;
  const modelMessages = useHistory
    ? input.history!.map(m => ({ role: m.role, content: m.text }))
    : undefined;

  if (useHistory) {
    const latest = input.history![input.history!.length - 1];
    if (latest.role === 'user') {
      try {
        await recordMessage({
          runId,
          step: 0,
          role: 'user',
          parts: { text: latest.text, toolCalls: [], finishReason: null },
        });
      } catch (err) {
        console.error('[agent-runtime] failed to record user message:', err);
      }
    }
  }

  try {
    const result = await generateText({
      model,
      system: input.agent.systemPrompt(runCtx),
      ...(useHistory
        ? { messages: modelMessages as never }
        : { prompt: input.prompt ?? '' }),
      tools,
      stopWhen,
      onStepFinish: async (step) => {
        try {
          await recordMessage({
            runId,
            step: step.stepNumber ?? 0,
            role: 'assistant',
            parts: {
              text: step.text ?? '',
              toolCalls: step.toolCalls ?? [],
              finishReason: step.finishReason ?? null,
            },
          });
        } catch (err: unknown) {
          console.error(
            '[agent-runtime] runAgentBackground.onStepFinish recordMessage failed:',
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    });

    const totalUsage = result.totalUsage;
    const costUsd = estimateCostUsd(input.agent.model, totalUsage);

    await endRun({
      runId,
      status: 'completed',
      inputTokens: totalUsage.inputTokens ?? undefined,
      outputTokens: totalUsage.outputTokens ?? undefined,
      costUsd: costUsd ?? undefined,
    });

    const ms = Date.now() - startedAt;
    console.log(
      `[agent-runtime] ${input.agent.name} (bg) done — ${ms}ms · ${totalUsage.inputTokens ?? '?'}+${totalUsage.outputTokens ?? '?'} tok · $${costUsd?.toFixed(4) ?? '—'}`,
    );

    return {
      runId,
      text: result.text,
      status: 'completed',
      inputTokens: totalUsage.inputTokens ?? null,
      outputTokens: totalUsage.outputTokens ?? null,
      costUsd,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await endRun({
      runId,
      status: 'errored',
      error: message,
    });
    console.error(`[agent-runtime] ${input.agent.name} (bg) errored:`, message);
    return {
      runId,
      text: '',
      status: 'errored',
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Re-export commonly used types so route handlers don't need ai SDK imports.
// ---------------------------------------------------------------------------

export type { UIMessage } from 'ai';
export { createRecommendation };
