/**
 * Shared types for the agent runtime.
 *
 * The DB row types mirror the schema in scripts/migrations/2026-05-15-agent-runtime.ts
 * exactly — when the schema changes, update both. JSON columns (parts, payload,
 * source_links, edit_diff, execute_result, metadata) are stored as TEXT and
 * parsed at the boundary; the typed shape is enforced in helper modules.
 */
import type { SessionUser } from '../auth.js';

// ---------------------------------------------------------------------------
// String literal unions matching the schema CHECK conventions.
// ---------------------------------------------------------------------------

export type ChannelName = 'web' | 'slack' | 'telegram' | 'cron';
export type ToolMode = 'dry-run' | 'execute';
export type ToolPhase = 'start' | 'end' | 'error';
export type RunStatus = 'running' | 'completed' | 'errored';
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type RecommendationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'expired';
export type OutcomeRating = 'success' | 'neutral' | 'failure' | 'reversed';

// ---------------------------------------------------------------------------
// Runtime context — the per-call envelope agents and tools see.
// `graduations` is the set of `<agent>:<tool_name>` pairs that may execute;
// the runtime coerces `mode: 'execute'` to `'dry-run'` when the pair is absent.
// ---------------------------------------------------------------------------

export interface ToolCtx {
  runId: string;
  /**
   * Agent name (e.g. 'atlas', 'atlas-staff'). Set by the runtime; tools
   * use it to attribute recommendations and acceptance metrics correctly.
   */
  agent: string;
  user: SessionUser;
  channel: ChannelName;
  conversationId: string | null;
  graduations: Set<string>;
  /**
   * Distance from the root invocation (0 for a user-initiated or cron-
   * initiated run, 1 for a child invoked via invokeAgent, etc.). Capped
   * by the invokeAgent tool to MAX_AGENT_DEPTH to prevent runaway chains.
   * Optional at the construction site — the runtime defaults to 0.
   */
  depth?: number;
  /**
   * agent_runs.id of the parent run that invoked this one, or null for
   * a root run. Persisted on the child's agent_runs row so the
   * /admin/agents/run/:id tree view can reconstruct the call hierarchy.
   */
  parentRunId?: string | null;
}

// ---------------------------------------------------------------------------
// Agent definition — declared per agent in web/lib/agents/agents/<name>.ts.
// `tools` is a list of tool names from the registry (web/lib/agents/tools/index.ts).
// ---------------------------------------------------------------------------

export interface AgentDef {
  name: string;
  model: string; // gateway slug, e.g. 'anthropic/claude-sonnet-4.6'
  maxSteps?: number;
  tools: string[];
  systemPrompt: (ctx: ToolCtx) => string;
}

// ---------------------------------------------------------------------------
// DB row types. Field order and naming follow the migration verbatim.
// ---------------------------------------------------------------------------

export interface AgentRunRow {
  id: string;
  agent: string;
  user_id: string;
  channel: ChannelName;
  conversation_id: string | null;
  trigger: string;
  model: string;
  status: RunStatus;
  started_at: string;
  ended_at: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
  parent_run_id: string | null;
  depth: number;
}

export interface AgentMessageRow {
  id: string;
  run_id: string;
  step: number;
  role: MessageRole;
  parts: string; // JSON
  created_at: string;
}

export interface AgentToolCallRow {
  id: string;
  run_id: string;
  call_id: string;
  step: number;
  tool_name: string;
  mode: ToolMode;
  phase: ToolPhase;
  input: string | null; // JSON
  output: string | null; // JSON
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface RecommendationRow {
  id: string;
  run_id: string;
  agent: string;
  user_id: string;
  title: string;
  reasoning: string;
  tool_name: string;
  payload: string; // JSON
  source_links: string | null; // JSON array
  status: RecommendationStatus;
  decided_by: string | null;
  decided_at: string | null;
  edit_diff: string | null; // JSON
  executed_at: string | null;
  execute_result: string | null; // JSON
  expires_at: string | null;
  created_at: string;
}

export interface OutcomeRow {
  id: string;
  recommendation_id: string;
  outcome: OutcomeRating;
  notes: string | null;
  reviewed_by: string;
  reviewed_at: string;
}

export interface GraduationRow {
  agent: string;
  tool_name: string;
  graduated_at: string;
  graduated_by: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Channel-facing types.
// ApprovalCard is the unified payload web/Slack/Telegram render. `id` matches
// agent_recommendations.id so the channel callback can call recommendations.decide().
// ---------------------------------------------------------------------------

export interface ApprovalCardField {
  label: string;
  value: string;
}

export interface ApprovalCard {
  id: string;
  title: string;
  reasoning: string;
  fields: ApprovalCardField[];
  sourceLinks?: { label: string; url: string }[];
  expiresAt?: string;
}

export interface Channel {
  name: 'web' | 'slack' | 'telegram';
  sendMessage(conversationId: string, text: string): Promise<void>;
  requestApproval(userId: string, card: ApprovalCard): Promise<void>;
  deliverProactive(
    userId: string,
    payload: { title: string; body: string; url?: string },
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers used at the trace boundary to construct rows.
// ---------------------------------------------------------------------------

export type StartRunInput = Pick<
  AgentRunRow,
  'agent' | 'user_id' | 'channel' | 'conversation_id' | 'trigger' | 'model'
> & {
  /** Parent agent_runs.id when this run was spawned via invokeAgent. */
  parent_run_id?: string | null;
  /** Recursion distance from root. Defaults to 0 in startRun. */
  depth?: number;
};

export type EndRunInput = {
  runId: string;
  status: RunStatus;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
};

export type RecordMessageInput = {
  runId: string;
  step: number;
  role: MessageRole;
  parts: unknown; // serialised to JSON before write
};

export type RecordToolCallInput = {
  runId: string;
  callId: string;
  step: number;
  toolName: string;
  mode: ToolMode;
  phase: ToolPhase;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
};

export type CreateRecommendationInput = {
  runId: string;
  agent: string;
  userId: string;
  title: string;
  reasoning: string;
  toolName: string;
  payload: unknown;
  sourceLinks?: { label: string; url: string }[];
  expiresAt?: string;
};

export type DecideRecommendationInput = {
  id: string;
  decidedBy: string;
  decision: 'approved' | 'rejected' | 'edited';
  editDiff?: unknown;
};

export type RecordOutcomeInput = {
  recommendationId: string;
  outcome: OutcomeRating;
  notes?: string;
  reviewedBy: string;
};
