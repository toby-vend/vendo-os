import { db } from '../queries/base.js';
import { isVendoEmail, type InviteeLike } from './assignee.js';

/**
 * Pre-Asana review of meeting action items, backed by Jev (TypeSafe's
 * decision model). For each Fathom action item it decides:
 *
 *   - kind  — is this Vendo work, a small admin follow-up, something the
 *             client must do, or not a task at all?
 *   - owner — which Vendo person on the call should own it (used only when
 *             the deterministic resolver can't pick one).
 *
 * Jev decides, the caller acts: an item is only dropped when Jev is at least
 * DROP_CONFIDENCE sure it is a client action or not a task. Any API error
 * fails open (the item is kept) so a hiccup never loses a real task.
 *
 * Dropped items are logged to `auto_task_filtered` so they can be reviewed
 * and so the daily cron doesn't re-review them.
 */

const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || '';
const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = 'jev-latest';
const DROP_CONFIDENCE = 0.8;
const OWNER_CONFIDENCE = 0.7;
const MAX_SUMMARY_CHARS = 6000;

export type ItemKind = 'vendo_work' | 'small_admin' | 'client_action' | 'not_a_task' | 'unclear';

export interface ItemReview {
  keep: boolean;
  kind: ItemKind | null;
  kindConfidence: number | null;
  /** Name of the on-call Vendo person Jev picked, when confident. */
  suggestedOwner: string | null;
  /** Why the item was dropped (only set when keep = false). */
  reason?: string;
}

export interface ReviewContext {
  title: string;
  clientName: string | null;
  summary: string | null;
  invitees: InviteeLike[];
}

const KIND_CRITERIA: Record<ItemKind, string> = {
  vendo_work:
    'Substantive work a Vendo staff member must do: build, fix, launch, change, write, analyse, design, or send a real deliverable such as a report, plan, creative, landing page or proposal.',
  small_admin:
    'A quick follow-up a Vendo staff member must do: book or schedule a call, send a recording, link or recap email, grant access, pass on contact details.',
  client_action:
    'Something the client, someone on the client side, or another outside party must do rather than Vendo, e.g. the client sending Vendo photos, prices, logins, contact details or approval. Phrasing like "Email Alfie your X" or "Send X to Ben", where the named person is Vendo staff, means the client is the doer.',
  not_a_task:
    'Not a real action: a comment, an idea, a vague "explore / consider / look into" with no clear output, something the summary shows was already done during the call, or a description of what happened.',
  unclear: 'Cannot tell from the information given; a human should judge.',
};

function namesOnCall(invitees: InviteeLike[]): { vendo: string[]; external: string[] } {
  const vendo: string[] = [];
  const external: string[] = [];
  for (const inv of invitees) {
    const label = inv.name || (inv.email ? inv.email.split('@')[0] : '');
    if (!label) continue;
    if (isVendoEmail(inv.email)) vendo.push(label);
    else external.push(label);
  }
  return { vendo, external };
}

/**
 * True when the note-taker's suggested owner is someone outside Vendo: either
 * their email is on a non-Vendo domain, or their name matches an external
 * invitee and no Vendo invitee.
 */
export function isClientSideOwner(
  invitees: InviteeLike[],
  name: string | undefined,
  email: string | undefined,
): boolean {
  if (email) return !isVendoEmail(email);
  if (!name) return false;
  const n = name.toLowerCase().trim();
  let external = false;
  for (const inv of invitees) {
    if ((inv.name || '').toLowerCase().trim() !== n) continue;
    if (isVendoEmail(inv.email)) return false;
    external = true;
  }
  return external;
}

/** Strip emails and phone numbers before the text leaves our systems. */
function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s]{8,}\d/g, '[phone]');
}

export function buildState(
  ctx: ReviewContext,
  description: string,
  fathomAssignee: string | undefined,
): string {
  const { vendo, external } = namesOnCall(ctx.invitees);
  const summary = (ctx.summary || '').slice(0, MAX_SUMMARY_CHARS);
  return scrub(
    [
      'An AI note-taker pulled this action item from a meeting for Vendo Digital, a marketing agency. Decide whether it should become an Asana task for Vendo staff.',
      `ACTION ITEM: ${description}`,
      `NOTE-TAKER'S SUGGESTED OWNER: ${fathomAssignee || '(none)'}`,
      `MEETING: ${ctx.title}`,
      `CLIENT: ${ctx.clientName || '(internal / none)'}`,
      `VENDO PEOPLE ON CALL: ${vendo.join(', ') || '(none listed)'}`,
      `CLIENT / EXTERNAL PEOPLE ON CALL: ${external.join(', ') || '(none - internal meeting)'}`,
      summary ? `MEETING SUMMARY:\n${summary}` : 'MEETING SUMMARY: (not available)',
    ].join('\n'),
  );
}

interface JevChoice {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

/** Owner option keys must be simple identifiers; map them back to names. */
function ownerOptions(vendoNames: string[]): { criteria: Record<string, string>; byKey: Map<string, string> } {
  const criteria: Record<string, string> = {};
  const byKey = new Map<string, string>();
  vendoNames.forEach((name, i) => {
    const key = `p${i}_${name.toLowerCase().replace(/[^a-z]+/g, '_')}`.slice(0, 40);
    criteria[key] = `${name} should do it`;
    byKey.set(key, name);
  });
  criteria.nobody_clear = 'No single Vendo person on the call is clearly the owner';
  return { criteria, byKey };
}

type DecideFn = (state: string, questions: Record<string, unknown>) => Promise<Record<string, JevChoice>>;

async function jevDecide(state: string, questions: Record<string, unknown>): Promise<Record<string, JevChoice>> {
  const res = await fetch(JEV_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { answers: Record<string, JevChoice> };
  return json.answers;
}

/**
 * Review one action item. `decide` is injectable for tests; production uses
 * the live Jev call. Never throws.
 */
export async function reviewActionItem(
  ctx: ReviewContext,
  description: string,
  fathomAssignee: string | undefined,
  decide: DecideFn = jevDecide,
  fathomAssigneeEmail?: string,
): Promise<ItemReview> {
  const keepByDefault: ItemReview = { keep: true, kind: null, kindConfidence: null, suggestedOwner: null };

  // Free, deterministic check first: when the note-taker says a client-side
  // person owns the action, it's the client's to-do, not ours.
  if (isClientSideOwner(ctx.invitees, fathomAssignee, fathomAssigneeEmail)) {
    return {
      keep: false,
      kind: 'client_action',
      kindConfidence: 1,
      suggestedOwner: null,
      reason: 'Owner is on the client side',
    };
  }

  if (decide === jevDecide && !TYPESAFE_API_KEY) return keepByDefault;

  const { vendo } = namesOnCall(ctx.invitees);
  const owners = ownerOptions(vendo);
  const questions: Record<string, unknown> = {
    kind: { type: 'choice', instructions: 'What kind of item is this?', criteria: KIND_CRITERIA },
  };
  if (vendo.length > 0) {
    questions.owner = {
      type: 'choice',
      instructions: 'Which Vendo person on the call should own this action?',
      criteria: owners.criteria,
    };
  }

  let answers: Record<string, JevChoice>;
  try {
    answers = await decide(buildState(ctx, description, fathomAssignee), questions);
  } catch (err) {
    console.warn('[task-filter] Jev call failed, keeping item:', err instanceof Error ? err.message : err);
    return keepByDefault;
  }

  const kind = (answers.kind?.choice as ItemKind) ?? null;
  const kindConfidence = answers.kind?.confidence ?? null;
  const ownerAnswer = answers.owner;
  const suggestedOwner =
    ownerAnswer && ownerAnswer.confidence >= OWNER_CONFIDENCE
      ? owners.byKey.get(ownerAnswer.choice) ?? null
      : null;

  const droppable = kind === 'client_action' || kind === 'not_a_task';
  if (droppable && (kindConfidence ?? 0) >= DROP_CONFIDENCE) {
    return {
      keep: false,
      kind,
      kindConfidence,
      suggestedOwner,
      reason: kind === 'client_action' ? 'Client or third-party action' : 'Not a real task',
    };
  }
  return { keep: true, kind, kindConfidence, suggestedOwner };
}

// ---------------------------------------------------------------------------
// Dropped-item log
// ---------------------------------------------------------------------------

let _schemaReady = false;

async function ensureFilteredSchema(): Promise<void> {
  if (_schemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS auto_task_filtered (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      meeting_title TEXT,
      client_name TEXT,
      action_description TEXT NOT NULL,
      fathom_assignee TEXT,
      reason TEXT NOT NULL,
      kind TEXT,
      confidence REAL,
      created_at TEXT NOT NULL,
      UNIQUE(meeting_id, action_description)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_atf_created ON auto_task_filtered(created_at)');
  _schemaReady = true;
}

export async function recordFiltered(input: {
  meetingId: string;
  meetingTitle: string;
  clientName: string | null;
  description: string;
  fathomAssignee: string | null;
  reason: string;
  kind: string | null;
  confidence: number | null;
}): Promise<void> {
  try {
    await ensureFilteredSchema();
    await db.execute({
      sql: `INSERT OR IGNORE INTO auto_task_filtered
              (meeting_id, meeting_title, client_name, action_description, fathom_assignee, reason, kind, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.meetingId, input.meetingTitle, input.clientName, input.description,
        input.fathomAssignee, input.reason, input.kind, input.confidence, new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.warn('[task-filter] Failed to record filtered item:', err instanceof Error ? err.message : err);
  }
}

export async function wasFiltered(meetingId: string, description: string): Promise<boolean> {
  try {
    await ensureFilteredSchema();
    const r = await db.execute({
      sql: 'SELECT 1 FROM auto_task_filtered WHERE meeting_id = ? AND action_description = ? LIMIT 1',
      args: [meetingId, description],
    });
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

export interface FilteredRow {
  meeting_title: string | null;
  client_name: string | null;
  action_description: string;
  reason: string;
}

export async function getFilteredSince(sinceIso: string): Promise<FilteredRow[]> {
  try {
    await ensureFilteredSchema();
    const r = await db.execute({
      sql: `SELECT meeting_title, client_name, action_description, reason
              FROM auto_task_filtered WHERE created_at >= ? ORDER BY created_at`,
      args: [sinceIso],
    });
    return r.rows as unknown as FilteredRow[];
  } catch {
    return [];
  }
}
