/**
 * Agent runtime foundation — Block 1 of the Agentic OS conversion.
 *
 * Creates the trace + decision store that every agent run, message, tool call,
 * and recommendation is written into. This is the substrate the Decision Engine
 * reads from and the structural enforcement of cautious autonomy lives in:
 *
 *   - agent_runs / agent_messages / agent_tool_calls   trace store
 *   - agent_recommendations                            human-in-the-loop drafts
 *   - agent_outcomes                                   30-day review ratings
 *   - agent_graduations                                which (agent, tool) may execute
 *   - notification_preferences                         per-user channel routing
 *   - telegram_users                                   manual user→chat-id mapping
 *
 * Schema is intentionally append-only and idempotent. No code path mutates rows
 * after the trace is closed except for explicit decision/outcome updates on
 * agent_recommendations.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-15-agent-runtime.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements: string[] = [
  // ----------------------------------------------------------------------
  // agent_runs — one row per invocation of any agent (web turn, cron, webhook).
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id              TEXT PRIMARY KEY,
    agent           TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    channel         TEXT NOT NULL,
    conversation_id TEXT,
    trigger         TEXT NOT NULL,
    model           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'running',
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at        TEXT,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    cost_usd        REAL,
    error           TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_user
     ON agent_runs(user_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_agent
     ON agent_runs(agent, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation
     ON agent_runs(conversation_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_status
     ON agent_runs(status, started_at DESC)`,

  // ----------------------------------------------------------------------
  // agent_messages — UIMessage parts, one row per turn step.
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_messages (
    id         TEXT PRIMARY KEY,
    run_id     TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    step       INTEGER NOT NULL,
    role       TEXT NOT NULL,
    parts      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_messages_run
     ON agent_messages(run_id, step)`,

  // ----------------------------------------------------------------------
  // agent_tool_calls — every tool invocation, dry-run and execute, plus errors.
  //   mode: 'dry-run' | 'execute'
  //   phase: 'start' | 'end' | 'error' (rows are append-only; phase indicates
  //   the lifecycle event captured)
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    call_id     TEXT NOT NULL,
    step        INTEGER NOT NULL,
    tool_name   TEXT NOT NULL,
    mode        TEXT NOT NULL,
    phase       TEXT NOT NULL,
    input       TEXT,
    output      TEXT,
    error       TEXT,
    duration_ms INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run
     ON agent_tool_calls(run_id, step)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_call
     ON agent_tool_calls(call_id, phase)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_name
     ON agent_tool_calls(tool_name, created_at DESC)`,

  // ----------------------------------------------------------------------
  // agent_recommendations — drafted actions awaiting human approval.
  //   status: 'pending' | 'approved' | 'rejected' | 'edited' | 'expired'
  //   tool_name: the write-tool that would (or did) run
  //   payload: the dry-run preview as JSON
  //   edit_diff: changes the human made before approving (JSON)
  //   execute_result: returned data from the underlying tool on execute (JSON)
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_recommendations (
    id             TEXT PRIMARY KEY,
    run_id         TEXT NOT NULL REFERENCES agent_runs(id),
    agent          TEXT NOT NULL,
    user_id        TEXT NOT NULL,
    title          TEXT NOT NULL,
    reasoning      TEXT NOT NULL,
    tool_name      TEXT NOT NULL,
    payload        TEXT NOT NULL,
    source_links   TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    decided_by     TEXT,
    decided_at     TEXT,
    edit_diff      TEXT,
    executed_at    TEXT,
    execute_result TEXT,
    expires_at     TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_recs_inbox
     ON agent_recommendations(user_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_recs_agent_status
     ON agent_recommendations(agent, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_recs_run
     ON agent_recommendations(run_id)`,

  // ----------------------------------------------------------------------
  // agent_outcomes — 30-day review ratings.
  //   outcome: 'success' | 'neutral' | 'failure' | 'reversed'
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_outcomes (
    id                TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL REFERENCES agent_recommendations(id) ON DELETE CASCADE,
    outcome           TEXT NOT NULL,
    notes             TEXT,
    reviewed_by       TEXT NOT NULL,
    reviewed_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_outcomes_rec
     ON agent_outcomes(recommendation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_outcomes_reviewer
     ON agent_outcomes(reviewed_by, reviewed_at DESC)`,

  // ----------------------------------------------------------------------
  // agent_graduations — which (agent, tool) pairs may run in execute mode.
  // Until a row exists, the runtime structurally coerces 'execute' → 'dry-run'.
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_graduations (
    agent         TEXT NOT NULL,
    tool_name     TEXT NOT NULL,
    graduated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    graduated_by  TEXT NOT NULL,
    notes         TEXT,
    PRIMARY KEY (agent, tool_name)
  )`,

  // ----------------------------------------------------------------------
  // notification_preferences — per-user channel routing for recommendations.
  //   channels: JSON array of 'web' | 'slack' | 'telegram'
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id    TEXT PRIMARY KEY,
    channels   TEXT NOT NULL DEFAULT '["web"]',
    quiet_from TEXT,
    quiet_to   TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ----------------------------------------------------------------------
  // telegram_users — manual user→Telegram chat_id mapping.
  // Seeded by admin in v1; self-service /start flow comes later.
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS telegram_users (
    user_id    TEXT NOT NULL,
    chat_id    TEXT NOT NULL,
    username   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, chat_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_users_chat
     ON telegram_users(chat_id)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running agent-runtime migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ agent_runs, agent_messages, agent_tool_calls created.');
  console.log('✓ agent_recommendations, agent_outcomes, agent_graduations created.');
  console.log('✓ notification_preferences, telegram_users created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
