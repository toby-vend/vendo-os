import Anthropic from '@anthropic-ai/sdk';
import { db, scalar } from '../queries/base.js';
import { trackUsage } from '../usage-tracker.js';
import { ensureRejectionSchema } from '../queries/auto-tasks.js';

/**
 * LLM-backed QA for auto-created Asana tasks.
 *
 * Runs AFTER the cheap exact-match check in the sync job. A Haiku call
 * compares the proposed task against past rejection rules (with scope) and
 * decides whether to approve or block. The goal is to catch semantically
 * similar duplicates that the exact-match check misses — e.g. "send the
 * monthly report" vs "send monthly reporting".
 *
 * Bootstrap: when there are no rejections yet, validation is a no-op —
 * nothing to learn from so we never block. Fails open on API or parse
 * errors so a model hiccup can't stop the whole pipeline.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ROWS = 500;      // upper bound on rules loaded into memory
const MAX_RULES_IN_PROMPT = 40;  // upper bound on rules actually sent to Haiku

interface RejectionRule {
  name_normalised: string;
  client_name: string | null;
  assignee: string | null;
  reason: string;
}

interface QaInput {
  taskName: string;
  clientName: string | null;
  assignee: string | null;
  source: string;
}

export interface QaResult {
  approve: boolean;
  reason?: string;
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

// --- Rules cache ---

let _rulesCache: RejectionRule[] | null = null;
let _rulesLoadedAt = 0;

async function loadRules(): Promise<RejectionRule[]> {
  if (_rulesCache && Date.now() - _rulesLoadedAt < CACHE_TTL_MS) return _rulesCache;
  try {
    await ensureRejectionSchema();
    const r = await db.execute({
      sql: `SELECT name_normalised, client_name, assignee, reason
              FROM asana_task_rejections
          ORDER BY rejected_at DESC
             LIMIT ?`,
      args: [MAX_CACHE_ROWS],
    });
    _rulesCache = r.rows.map((row) => ({
      name_normalised: (row.name_normalised as string) || '',
      client_name: (row.client_name as string | null) || null,
      assignee: (row.assignee as string | null) || null,
      reason: (row.reason as string) || '',
    }));
    _rulesLoadedAt = Date.now();
    return _rulesCache;
  } catch {
    return [];
  }
}

/**
 * Keep only rules whose scope could apply to the proposed task:
 *  - wildcard rules (no client, no assignee) → apply to everything
 *  - client-scoped rules → only when the proposed task shares that client
 *  - assignee-scoped rules → only when the proposed task shares that assignee
 *  - both-scoped rules → both must match
 * Filtered in-memory so the cache stays single-shape.
 */
function filterRelevantRules(
  rules: RejectionRule[],
  clientName: string | null,
  assignee: string | null,
): RejectionRule[] {
  return rules.filter((r) => {
    const clientOk = !r.client_name || r.client_name === clientName;
    const assigneeOk = !r.assignee || r.assignee === assignee;
    return clientOk && assigneeOk;
  });
}

export function resetQaCache(): void {
  _rulesCache = null;
  _rulesLoadedAt = 0;
}

// --- Prompting ---

const SYSTEM_PROMPT = `You are a QA reviewer for Vendo Digital's auto-task system. Your job is to stop irrelevant or duplicate tasks being created in Asana.

You are given a PROPOSED TASK and a list of PAST REJECTIONS. Each rejection has a reason and an optional scope (a specific client and/or assignee it applies to).

APPROVE the task unless it is substantively similar to a past rejection that would apply — respecting scope:
- A wildcard rejection (scope=wildcard) applies to every task.
- A client-scoped rejection only applies when the proposed task is for the same client.
- An assignee-scoped rejection only applies when the proposed task is for the same assignee.
- Both-scoped: all conditions must match.

"Substantively similar" means the same action or work item. Small wording/punctuation changes, pluralisation, or verb tense do NOT make tasks different.

Respond with ONLY valid JSON, no markdown fences:
{"approve": true}
or
{"approve": false, "reason": "Matches past rejection: <concise quote of the matching reason>"}

Bias toward APPROVE when uncertain — only reject on clear semantic match.`;

function buildUserMessage(input: QaInput, rules: RejectionRule[]): string {
  const rulesBlock = rules
    .map((r, i) => {
      const scopeParts: string[] = [];
      if (r.client_name) scopeParts.push(`client=${r.client_name}`);
      if (r.assignee) scopeParts.push(`assignee=${r.assignee}`);
      const scope = scopeParts.length ? scopeParts.join(', ') : 'wildcard';
      return `${i + 1}. [${scope}] "${r.name_normalised}" — ${r.reason}`;
    })
    .join('\n');

  return [
    '## Proposed task',
    `- Name: ${input.taskName}`,
    `- Client: ${input.clientName || '(none)'}`,
    `- Assignee: ${input.assignee || '(none)'}`,
    `- Source: ${input.source}`,
    '',
    `## Past rejections (${rules.length})`,
    rulesBlock || '(none)',
  ].join('\n');
}

function parseResult(text: string): QaResult {
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as QaResult;
    if (typeof parsed.approve !== 'boolean') throw new Error('bad shape');
    return parsed;
  } catch {
    return { approve: true }; // fail open
  }
}

// --- Public API ---

/**
 * Check a proposed task against past rejection patterns. Returns the QA
 * verdict — safe to call from hot paths, fails open on any error.
 */
export async function validateTaskWithQa(input: QaInput): Promise<QaResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { approve: true };
  const allRules = await loadRules();
  if (!allRules.length) return { approve: true }; // no baseline — nothing to enforce yet

  // Only send rules that could possibly apply to this task. Trims noise,
  // shortens prompt, and sharpens the match signal.
  const relevant = filterRelevantRules(allRules, input.clientName, input.assignee)
    .slice(0, MAX_RULES_IN_PROMPT);
  if (!relevant.length) return { approve: true };

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(input, relevant) }],
      max_tokens: 200,
      temperature: 0,
    });
    void trackUsage({
      userId: null,
      model: MODEL,
      feature: 'auto_task_qa',
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    });
    const block = response.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? block.text : '';
    return parseResult(raw);
  } catch {
    return { approve: true };
  }
}

// --- Audit trail ---

let _skipSchemaReady = false;
async function ensureSkipSchema(): Promise<void> {
  if (_skipSchemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS auto_task_qa_skipped (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      client_name TEXT,
      assignee TEXT,
      source TEXT,
      reason TEXT NOT NULL,
      skipped_at TEXT NOT NULL
    )
  `);
  _skipSchemaReady = true;
}

/** Log a task that the QA agent blocked so the admin can review and override. */
export async function recordQaSkip(input: {
  taskName: string;
  clientName: string | null;
  assignee: string | null;
  source: string;
  reason: string;
}): Promise<void> {
  try {
    await ensureSkipSchema();
    await db.execute({
      sql: `INSERT INTO auto_task_qa_skipped
              (task_name, client_name, assignee, source, reason, skipped_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        input.taskName,
        input.clientName,
        input.assignee,
        input.source,
        input.reason,
        new Date().toISOString(),
      ],
    });
  } catch {
    /* non-critical — silent */
  }
}

export interface QaSkipSummary {
  totalSkipped: number;
  thisMonth: number;
}

export async function getQaSkipSummary(): Promise<QaSkipSummary> {
  try {
    await ensureSkipSchema();
    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const totalSkipped = (await scalar<number>('SELECT COUNT(*) FROM auto_task_qa_skipped')) ?? 0;
    const thisMonth = (await scalar<number>(
      'SELECT COUNT(*) FROM auto_task_qa_skipped WHERE skipped_at >= ?',
      [monthStart],
    )) ?? 0;
    return { totalSkipped, thisMonth };
  } catch {
    return { totalSkipped: 0, thisMonth: 0 };
  }
}
