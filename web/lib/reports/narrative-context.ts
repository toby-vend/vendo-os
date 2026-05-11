/**
 * Narrative auto-pull for the monthly client reports module.
 *
 * Gathers context for the "What we worked on" section of a client report
 * from three sources:
 *
 *   1. Asana tasks completed in the period (via client_source_mappings)
 *   2. Meeting action items from Fathom — strictly gated to actions whose
 *      assignee appears on the call with a @vendodigital.co.uk email
 *      (see auto-task assignee gate rule)
 *   3. The previous month's report `focus_next_md` so the AM can review
 *      whether last month's plan was actually delivered
 *
 * Output: a `NarrativeContext` object with raw rows + an assembled markdown
 * draft (`suggested_worked_on_md`) that the team can paste into
 * `client_reports.worked_on_md` with one click.
 *
 * Persistence: `saveNarrativeDraft()` writes the draft to
 * `client_reports.narrative_draft_md` (column added by the
 * 2026-05-11 Google Ads autonomous reporting migration).
 */
import { db, rows, scalar } from '../queries/base.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NarrativeContext {
  asana_tasks_completed: Array<{ name: string; completed_at: string; project: string | null }>;
  meeting_actions: Array<{ summary: string; assignee: string | null; meeting_date: string }>;
  last_focus_next_md: string | null;
  suggested_worked_on_md: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VENDO_TEAM_DOMAIN = 'vendodigital.co.uk';
const MAX_ASANA_TASKS = 50;
const MAX_MEETING_ACTIONS = 50;
const VISIBLE_LIST_LIMIT = 10;

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface AsanaTaskRow {
  name: string;
  completed_at: string;
  project_name: string | null;
}

interface MeetingActionRow {
  description: string;
  assignee: string | null;
  meeting_id: string;
  meeting_date: string;
  calendar_invitees: string | null;
}

interface InviteeShape {
  name?: string | null;
  email?: string | null;
  domain?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp to YYYY-MM-DD for display. */
function shortDate(value: string): string {
  return (value || '').slice(0, 10);
}

/** Parse a meetings.calendar_invitees JSON blob — tolerant of malformed data. */
function parseInvitees(raw: string | null): InviteeShape[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as InviteeShape[] : [];
  } catch {
    return [];
  }
}

/**
 * Normalise a name for comparison: lowercase, trim, collapse whitespace.
 * Used to match `action_items.assignee` against names in the
 * `calendar_invitees` list.
 */
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build the set of Vendo team member names present on a given call.
 * Returns lowercase normalised names whose corresponding email ends in
 * `@vendodigital.co.uk`.
 */
function vendoNamesOnCall(invitees: InviteeShape[]): Set<string> {
  const out = new Set<string>();
  for (const inv of invitees) {
    const email = (inv?.email || '').toLowerCase().trim();
    const name = (inv?.name || '').trim();
    if (!email || !name) continue;
    if (email.endsWith(`@${VENDO_TEAM_DOMAIN}`)) {
      out.add(normaliseName(name));
    }
  }
  return out;
}

/**
 * Strict assignee gate per the auto-task rule: the action's assignee must
 * appear in the calendar_invitees list of the *same meeting* and must have
 * a @vendodigital.co.uk email. No fuzzy fallbacks — first-name-only matches
 * against full invitee names are allowed only when the first name is
 * unambiguous (length >= 3).
 */
function assigneeOnCall(assignee: string | null, invitees: InviteeShape[]): boolean {
  if (!assignee) return false;
  const names = vendoNamesOnCall(invitees);
  if (!names.size) return false;

  const norm = normaliseName(assignee);
  if (names.has(norm)) return true;

  // First-name-only match: only if the assignee is a single token (length >= 3)
  // and exactly one invitee's first name matches. Guards against e.g. two
  // Bens on the call.
  if (!norm.includes(' ') && norm.length >= 3) {
    const matches: string[] = [];
    for (const full of names) {
      const firstName = full.split(' ')[0];
      if (firstName === norm) matches.push(full);
    }
    if (matches.length === 1) return true;
  }

  return false;
}

/** Truncate a list to N visible items, appending "_+N more_" if truncated. */
function truncateMd<T>(items: T[], render: (item: T) => string): string {
  if (!items.length) return '_(none)_';
  const visible = items.slice(0, VISIBLE_LIST_LIMIT);
  const lines = visible.map(item => `- ${render(item)}`);
  if (items.length > VISIBLE_LIST_LIMIT) {
    lines.push(`- _+${items.length - VISIBLE_LIST_LIMIT} more_`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch Asana tasks completed within the period for the given client.
 *
 * Asana → client linkage is via `client_source_mappings` (source='asana',
 * external_id = project_gid). A single client may map to multiple Asana
 * projects.
 */
async function fetchAsanaTasks(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<AsanaTaskRow[]> {
  // Period bounds are YYYY-MM-DD. `completed_at` is an ISO timestamp.
  // Use < (periodEnd + 1 day) so the last day of the month is included.
  const periodEndExclusive = nextDay(periodEnd);

  return rows<AsanaTaskRow>(
    `
    SELECT at.name, at.completed_at, at.project_name
    FROM asana_tasks at
    JOIN client_source_mappings csm
      ON csm.source = 'asana'
     AND csm.external_id = at.project_gid
    WHERE csm.client_id = ?
      AND at.completed = 1
      AND at.completed_at IS NOT NULL
      AND at.completed_at >= ?
      AND at.completed_at < ?
    ORDER BY at.completed_at DESC
    LIMIT ?
    `,
    [clientId, periodStart, periodEndExclusive, MAX_ASANA_TASKS],
  );
}

/**
 * Fetch meeting action items in the period for the given client, after
 * applying the @vendodigital.co.uk-on-the-call assignee gate.
 *
 * Meetings link to clients by `meetings.client_name` (the canonical
 * `clients.name` set by the waterfall matcher). We over-fetch by 3x
 * the visible cap because the gate will drop a meaningful fraction.
 */
async function fetchMeetingActions(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<Array<{ summary: string; assignee: string | null; meeting_date: string }>> {
  const periodEndExclusive = nextDay(periodEnd);

  // Resolve clientId -> canonical name. meetings.client_name is set from
  // clients.name (see scripts/matching/build-match-context.ts).
  const clientName = await scalar<string>(
    'SELECT name FROM clients WHERE id = ? LIMIT 1',
    [clientId],
  );
  if (!clientName) return [];

  // Over-fetch — gate filters aggressively.
  const fetchLimit = MAX_MEETING_ACTIONS * 4;

  const raw = await rows<MeetingActionRow>(
    `
    SELECT ai.description, ai.assignee, m.id AS meeting_id, m.date AS meeting_date,
           m.calendar_invitees
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.client_name = ?
      AND m.date >= ?
      AND m.date < ?
    ORDER BY m.date DESC, ai.id DESC
    LIMIT ?
    `,
    [clientName, periodStart, periodEndExclusive, fetchLimit],
  );

  // Cache parsed invitees per meeting_id to avoid repeated JSON.parse.
  const inviteeCache = new Map<string, InviteeShape[]>();
  const gated: Array<{ summary: string; assignee: string | null; meeting_date: string }> = [];

  for (const row of raw) {
    let invitees = inviteeCache.get(row.meeting_id);
    if (invitees === undefined) {
      invitees = parseInvitees(row.calendar_invitees);
      inviteeCache.set(row.meeting_id, invitees);
    }
    if (!assigneeOnCall(row.assignee, invitees)) continue;

    gated.push({
      summary: row.description,
      assignee: row.assignee,
      meeting_date: shortDate(row.meeting_date),
    });
    if (gated.length >= MAX_MEETING_ACTIONS) break;
  }

  return gated;
}

/**
 * Fetch the previous month's `focus_next_md` for this client — the most
 * recent `client_reports` row whose period ended before this report's
 * period started.
 */
async function fetchLastFocusNext(
  clientId: number,
  periodStart: string,
): Promise<string | null> {
  const value = await scalar<string>(
    `
    SELECT focus_next_md
    FROM client_reports
    WHERE client_id = ?
      AND period_end < ?
    ORDER BY period_end DESC
    LIMIT 1
    `,
    [clientId, periodStart],
  );
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Markdown assembly
// ---------------------------------------------------------------------------

function assembleMarkdown(ctx: Omit<NarrativeContext, 'suggested_worked_on_md'>): string {
  const sections: string[] = [];

  sections.push('## Last month\'s focus');
  sections.push(ctx.last_focus_next_md ?? '_(no prior report)_');

  sections.push('\n## Work delivered this month');

  sections.push('\n### From Asana');
  sections.push(truncateMd(
    ctx.asana_tasks_completed,
    t => {
      const date = shortDate(t.completed_at);
      const proj = t.project ? ` _(${t.project})_` : '';
      return `${t.name}${proj} — ${date}`;
    },
  ));

  sections.push('\n### From meeting actions');
  sections.push(truncateMd(
    ctx.meeting_actions,
    a => {
      const who = a.assignee ? ` — ${a.assignee}` : '';
      return `${a.summary}${who} (${a.meeting_date})`;
    },
  ));

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Date helper
// ---------------------------------------------------------------------------

/** Add one day to a YYYY-MM-DD string (UTC). */
function nextDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build narrative context for a client report.
 *
 * @param clientId    Local clients.id
 * @param periodStart YYYY-MM-DD inclusive
 * @param periodEnd   YYYY-MM-DD inclusive
 */
export async function buildNarrativeContext(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<NarrativeContext> {
  const [asanaTasks, meetingActions, lastFocus] = await Promise.all([
    fetchAsanaTasks(clientId, periodStart, periodEnd),
    fetchMeetingActions(clientId, periodStart, periodEnd),
    fetchLastFocusNext(clientId, periodStart),
  ]);

  const partial = {
    asana_tasks_completed: asanaTasks.map(t => ({
      name: t.name,
      completed_at: t.completed_at,
      project: t.project_name,
    })),
    meeting_actions: meetingActions,
    last_focus_next_md: lastFocus,
  };

  return {
    ...partial,
    suggested_worked_on_md: assembleMarkdown(partial),
  };
}

/**
 * Persist a suggested narrative draft against a client_reports row.
 *
 * The `narrative_draft_md` column is created by the
 * `2026-05-11-gads-autonomous-reports` migration. This helper is
 * intentionally minimal — it does not touch `worked_on_md`. The "Use this
 * draft" action (in `web/routes/reports.ts`, owned by A4) is responsible
 * for copying `narrative_draft_md` into `worked_on_md` on user confirmation.
 */
export async function saveNarrativeDraft(reportId: number, draftMd: string): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports
            SET narrative_draft_md = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [draftMd, reportId],
  });
}
