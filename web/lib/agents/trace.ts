/**
 * Agent trace store — startRun, endRun, recordMessage, recordToolCall.
 *
 * Every agent invocation (web turn, Slack DM, Telegram, cron, webhook)
 * goes through these. The trace is append-only with one exception: endRun
 * updates the originating row to close it (status, ended_at, usage, cost).
 *
 * All functions return promises. Callers that want fire-and-forget should
 * `.catch(...)` themselves — we never silently swallow errors here. The two
 * exceptions are recordMessage and recordToolCall, which log and continue
 * because losing one trace row should never break a live agent turn.
 */
import { db } from '../queries/base.js';
import { generateId } from '../auth.js';
import type {
  EndRunInput,
  RecordMessageInput,
  RecordToolCallInput,
  StartRunInput,
} from './types.js';

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function startRun(input: StartRunInput): Promise<string> {
  const id = generateId();
  await db.execute({
    sql: `INSERT INTO agent_runs
      (id, agent, user_id, channel, conversation_id, trigger, model, status,
       parent_run_id, depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
    args: [
      id,
      input.agent,
      input.user_id,
      input.channel,
      input.conversation_id,
      input.trigger,
      input.model,
      input.parent_run_id ?? null,
      input.depth ?? 0,
    ],
  });
  return id;
}

export async function endRun(input: EndRunInput): Promise<void> {
  await db.execute({
    sql: `UPDATE agent_runs SET
            status = ?,
            ended_at = datetime('now'),
            input_tokens = ?,
            output_tokens = ?,
            cost_usd = ?,
            error = ?
          WHERE id = ?`,
    args: [
      input.status,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      input.costUsd ?? null,
      input.error ?? null,
      input.runId,
    ],
  });
}

// ---------------------------------------------------------------------------
// Messages — one row per UIMessage step. Errors logged, not thrown, because
// losing a single message row should not abort a live agent turn.
// ---------------------------------------------------------------------------

export async function recordMessage(input: RecordMessageInput): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO agent_messages (id, run_id, step, role, parts)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        generateId(),
        input.runId,
        input.step,
        input.role,
        JSON.stringify(input.parts),
      ],
    });
  } catch (err: unknown) {
    console.error(
      '[agent-trace] recordMessage failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// Tool calls — append-only with phase ('start' | 'end' | 'error').
// callId is the model's tool_call id; one logical call produces 2–3 rows.
// ---------------------------------------------------------------------------

export async function recordToolCall(input: RecordToolCallInput): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO agent_tool_calls
        (id, run_id, call_id, step, tool_name, mode, phase, input, output, error, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        generateId(),
        input.runId,
        input.callId,
        input.step,
        input.toolName,
        input.mode,
        input.phase,
        input.input === undefined ? null : JSON.stringify(input.input),
        input.output === undefined ? null : JSON.stringify(input.output),
        input.error ?? null,
        input.durationMs ?? null,
      ],
    });
  } catch (err: unknown) {
    console.error(
      '[agent-trace] recordToolCall failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// Read helpers — used by /inbox/<id>/trace viewer.
// ---------------------------------------------------------------------------

export async function getRun(runId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM agent_runs WHERE id = ?`,
    args: [runId],
  });
  return result.rows[0] ?? null;
}

export async function getRunMessages(runId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM agent_messages WHERE run_id = ? ORDER BY step ASC, created_at ASC`,
    args: [runId],
  });
  return result.rows;
}

export async function getRunToolCalls(runId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM agent_tool_calls WHERE run_id = ? ORDER BY step ASC, created_at ASC`,
    args: [runId],
  });
  return result.rows;
}

// ---------------------------------------------------------------------------
// Conversation reconstruction — joins agent_messages back into a UIMessage[]
// for any conversation_id (Slack DM channel id, app_mention thread_ts, web
// /chat conversation id, etc). Returns oldest-first.
//
// Used by Slack inbound handlers to rebuild context across messages — Slack
// doesn't echo previous turns to us, so we have to reload them ourselves.
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  step: number;
  runStartedAt: string;
}

export async function loadConversation(
  conversationId: string,
  limit = 40,
): Promise<ConversationMessage[]> {
  const result = await db.execute({
    sql: `SELECT m.role, m.parts, m.step, r.started_at
            FROM agent_messages m
            JOIN agent_runs r ON m.run_id = r.id
           WHERE r.conversation_id = ?
             AND m.role IN ('user','assistant')
           ORDER BY r.started_at ASC, m.step ASC
           LIMIT ?`,
    args: [conversationId, limit],
  });
  const out: ConversationMessage[] = [];
  for (const row of result.rows as unknown as {
    role: 'user' | 'assistant';
    parts: string;
    step: number;
    started_at: string;
  }[]) {
    let text = '';
    try {
      const parts = JSON.parse(row.parts) as { text?: string };
      text = parts.text ?? '';
    } catch {
      text = '';
    }
    if (!text.trim()) continue; // skip empty steps (tool-only)
    out.push({
      role: row.role,
      text,
      step: row.step,
      runStartedAt: row.started_at,
    });
  }
  return out;
}
