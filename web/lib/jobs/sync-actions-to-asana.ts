import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';
import { getClientAM as sharedGetClientAM, resolveAssignee as sharedResolveAssignee } from '../asana/assignee.js';
import { getRejectionReason } from '../queries/auto-tasks.js';

/**
 * Turso-native port of scripts/automation/fathom-to-asana.ts. Runs from the
 * daily Vercel cron (/api/cron/sync-actions-to-asana) to create Asana tasks
 * for:
 *   1. Fathom meeting action items from the last 24 hours
 *   2. Open escalations (tier = critical/high/medium)
 *   3. NPS detractors that haven't had follow-up logged
 *
 * Deduplicated via the fathom_asana_synced table (source_type + source_id).
 */

const ASANA_API_KEY = process.env.ASANA_API_KEY || process.env.ASANA_PAT || '';
const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || process.env.ASANA_WORKSPACE_ID || '';
const ASANA_DEFAULT_PROJECT_GID = process.env.ASANA_DEFAULT_PROJECT_GID || '';
const ASANA_SENIOR_LEADER_PROJECT_GID = process.env.ASANA_SENIOR_LEADER_PROJECT_GID || '';
const ASANA_VENDO_OS_PROJECT_GID = process.env.ASANA_VENDO_OS_PROJECT_GID || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';
const LOG_SOURCE = 'sync-actions-to-asana';
const AFTER_HOUR_CUTOFF = 15; // meetings starting ≥ 15:00 Europe/London → due next day

interface Invitee {
  name?: string | null;
  email?: string | null;
  is_external?: boolean;
}

/**
 * Senior Leadership team. Meetings without an external invitee but with one
 * of these attendees route to the Senior Leader Tasks project. Update this
 * list when SLT membership changes.
 */
const SLT_NAMES: Set<string> = new Set([
  'toby raeburn',
  'max rivens',
  'alfie wakelin',
  'rhiannon larkman',
]);

/** Signal used to abort task creation when a QA rejection matches. */
class TaskRejectedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Task rejected: ${reason}`);
    this.name = 'TaskRejectedError';
    this.reason = reason;
  }
}

interface ActionItem {
  description: string;
  assignee?: string;
  assigneeEmail?: string;
  dueDate?: string;
  /** Fathom deep link to the exact moment this action item was captured. */
  playbackUrl?: string;
}

// ---------------------------------------------------------------------------
// UK English normalisation
// ---------------------------------------------------------------------------

const US_UK: Array<[string, string]> = [
  // -ize → -ise family
  ['organize', 'organise'], ['organizes', 'organises'], ['organized', 'organised'], ['organizing', 'organising'], ['organization', 'organisation'], ['organizations', 'organisations'], ['organizational', 'organisational'],
  ['analyze', 'analyse'], ['analyzes', 'analyses'], ['analyzed', 'analysed'], ['analyzing', 'analysing'], ['analyzer', 'analyser'],
  ['prioritize', 'prioritise'], ['prioritizes', 'prioritises'], ['prioritized', 'prioritised'], ['prioritizing', 'prioritising'], ['prioritization', 'prioritisation'],
  ['optimize', 'optimise'], ['optimizes', 'optimises'], ['optimized', 'optimised'], ['optimizing', 'optimising'], ['optimization', 'optimisation'], ['optimizations', 'optimisations'],
  ['realize', 'realise'], ['realizes', 'realises'], ['realized', 'realised'], ['realizing', 'realising'],
  ['summarize', 'summarise'], ['summarizes', 'summarises'], ['summarized', 'summarised'], ['summarizing', 'summarising'],
  ['recognize', 'recognise'], ['recognizes', 'recognises'], ['recognized', 'recognised'], ['recognizing', 'recognising'],
  ['utilize', 'utilise'], ['utilizes', 'utilises'], ['utilized', 'utilised'], ['utilizing', 'utilising'], ['utilization', 'utilisation'],
  ['finalize', 'finalise'], ['finalizes', 'finalises'], ['finalized', 'finalised'], ['finalizing', 'finalising'],
  ['maximize', 'maximise'], ['maximizes', 'maximises'], ['maximized', 'maximised'], ['maximizing', 'maximising'],
  ['minimize', 'minimise'], ['minimizes', 'minimises'], ['minimized', 'minimised'], ['minimizing', 'minimising'],
  ['standardize', 'standardise'], ['standardizes', 'standardises'], ['standardized', 'standardised'], ['standardizing', 'standardising'],
  ['categorize', 'categorise'], ['categorizes', 'categorises'], ['categorized', 'categorised'], ['categorizing', 'categorising'],
  ['customize', 'customise'], ['customizes', 'customises'], ['customized', 'customised'], ['customizing', 'customising'],
  ['specialize', 'specialise'], ['specializes', 'specialises'], ['specialized', 'specialised'], ['specializing', 'specialising'],
  ['emphasize', 'emphasise'], ['emphasizes', 'emphasises'], ['emphasized', 'emphasised'], ['emphasizing', 'emphasising'],
  ['apologize', 'apologise'], ['apologizes', 'apologises'], ['apologized', 'apologised'], ['apologizing', 'apologising'],
  ['memorize', 'memorise'], ['memorizes', 'memorises'], ['memorized', 'memorised'], ['memorizing', 'memorising'],
  ['sanitize', 'sanitise'], ['sanitized', 'sanitised'], ['sanitizing', 'sanitising'],
  ['modernize', 'modernise'], ['modernized', 'modernised'], ['modernizing', 'modernising'],
  ['initialize', 'initialise'], ['initialized', 'initialised'], ['initializing', 'initialising'],
  ['familiarize', 'familiarise'], ['familiarized', 'familiarised'], ['familiarizing', 'familiarising'],
  ['synchronize', 'synchronise'], ['synchronized', 'synchronised'], ['synchronizing', 'synchronising'],
  ['mobilize', 'mobilise'], ['mobilized', 'mobilised'], ['mobilizing', 'mobilising'],
  ['monetize', 'monetise'], ['monetized', 'monetised'], ['monetizing', 'monetising'], ['monetization', 'monetisation'],
  ['strategize', 'strategise'], ['strategized', 'strategised'], ['strategizing', 'strategising'],
  // -or → -our
  ['color', 'colour'], ['colors', 'colours'], ['colored', 'coloured'], ['coloring', 'colouring'],
  ['favor', 'favour'], ['favors', 'favours'], ['favored', 'favoured'], ['favoring', 'favouring'], ['favorite', 'favourite'], ['favorites', 'favourites'],
  ['flavor', 'flavour'], ['flavors', 'flavours'], ['flavored', 'flavoured'], ['flavoring', 'flavouring'],
  ['honor', 'honour'], ['honors', 'honours'], ['honored', 'honoured'], ['honoring', 'honouring'],
  ['labor', 'labour'], ['labors', 'labours'], ['labored', 'laboured'], ['laboring', 'labouring'],
  ['behavior', 'behaviour'], ['behaviors', 'behaviours'], ['behavioral', 'behavioural'],
  ['neighbor', 'neighbour'], ['neighbors', 'neighbours'], ['neighboring', 'neighbouring'], ['neighborhood', 'neighbourhood'],
  ['rumor', 'rumour'], ['rumors', 'rumours'],
  ['humor', 'humour'], ['humors', 'humours'],
  ['vigor', 'vigour'],
  ['vapor', 'vapour'], ['vapors', 'vapours'],
  ['harbor', 'harbour'], ['harbors', 'harbours'],
  ['endeavor', 'endeavour'], ['endeavors', 'endeavours'],
  // -er → -re
  ['center', 'centre'], ['centers', 'centres'], ['centered', 'centred'], ['centering', 'centring'],
  ['meter', 'metre'], ['meters', 'metres'],
  ['theater', 'theatre'], ['theaters', 'theatres'],
  ['liter', 'litre'], ['liters', 'litres'],
  ['fiber', 'fibre'], ['fibers', 'fibres'],
  // -eled/-elled
  ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'], ['travelers', 'travellers'],
  ['canceled', 'cancelled'], ['canceling', 'cancelling'],
  ['labeled', 'labelled'], ['labeling', 'labelling'],
  ['modeled', 'modelled'], ['modeling', 'modelling'],
  ['signaled', 'signalled'], ['signaling', 'signalling'],
  // -ense → -ence
  ['defense', 'defence'], ['defenses', 'defences'],
  ['offense', 'offence'], ['offenses', 'offences'],
  ['pretense', 'pretence'],
  // misc
  ['gray', 'grey'], ['grays', 'greys'],
  ['fulfill', 'fulfil'], ['fulfillment', 'fulfilment'],
  ['enroll', 'enrol'], ['enrollment', 'enrolment'],
  ['skillful', 'skilful'],
  ['aluminum', 'aluminium'],
  ['mustache', 'moustache'],
  ['plow', 'plough'],
  ['dialog', 'dialogue'], ['dialogs', 'dialogues'],
  ['catalog', 'catalogue'], ['catalogs', 'catalogues'],
];

const UK_MAP: Map<string, string> = new Map(US_UK.map(([us, uk]) => [us, uk]));
const UK_REGEX = new RegExp(`\\b(${US_UK.map(([us]) => us).join('|')})\\b`, 'gi');

function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return target[0].toUpperCase() + target.slice(1);
  return target;
}

function toUkEnglish(text: string): string {
  if (!text) return text;
  return text.replace(UK_REGEX, (match) => {
    const uk = UK_MAP.get(match.toLowerCase());
    return uk ? matchCase(match, uk) : match;
  });
}

// ---------------------------------------------------------------------------
// Due-date computation — meeting day, or next day if call ≥ 15:00 Europe/London
// ---------------------------------------------------------------------------

function computeMeetingDueDate(meetingIso: string | null | undefined): string {
  if (!meetingIso) return defaultDueDate();
  const d = new Date(meetingIso);
  if (Number.isNaN(d.getTime())) return defaultDueDate();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = parseInt(get('hour'), 10);
  const base = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number.isNaN(hour) && hour >= AFTER_HOUR_CUTOFF) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  return base.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Layer B dedupe — pre-check Asana for an existing task with the same name
// ---------------------------------------------------------------------------

const _projectTaskIndex: Map<string, Map<string, string>> = new Map();

function normaliseForMatch(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getProjectTaskIndex(projectGid: string): Promise<Map<string, string>> {
  const cached = _projectTaskIndex.get(projectGid);
  if (cached) return cached;
  const index = new Map<string, string>();
  let offset: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({
      project: projectGid,
      opt_fields: 'name',
      limit: '100',
    });
    if (offset) qs.set('offset', offset);
    try {
      const res = await fetch(`${ASANA_BASE_URL}/tasks?${qs}`, {
        headers: { Authorization: `Bearer ${ASANA_API_KEY}`, Accept: 'application/json' },
      });
      if (!res.ok) break;
      const json = (await res.json()) as {
        data: Array<{ gid: string; name: string }>;
        next_page?: { offset: string } | null;
      };
      for (const t of json.data || []) {
        const key = normaliseForMatch(t.name);
        if (key && !index.has(key)) index.set(key, t.gid);
      }
      if (!json.next_page) break;
      offset = json.next_page.offset;
    } catch {
      break;
    }
  }
  _projectTaskIndex.set(projectGid, index);
  return index;
}

/** Reset the per-container project task cache. Exposed for tests. */
export function resetAsanaDedupeCache(): void {
  _projectTaskIndex.clear();
}

async function asanaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ASANA_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ASANA_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// User/AM resolution is now in web/lib/asana/assignee.ts (shared with the
// traffic-light job). The local shims below keep call sites unchanged.
const resolveAssignee = sharedResolveAssignee;

function parseActionLine(line: string): ActionItem {
  let text = line.replace(/^[-*\d+.)\]]+\s*/, '').trim();
  let assignee: string | undefined;
  const assigneeMatch =
    text.match(/\((?:Assignee|Owner|Assigned to)[:\s]+([^)]+)\)/i) ||
    text.match(/\[([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\]\s*/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1].trim();
    text = text.replace(assigneeMatch[0], '').trim();
  }
  let dueDate: string | undefined;
  const dueDateMatch = text.match(/\((?:Due|By|Deadline)[:\s]+(\d{4}-\d{2}-\d{2})\)/i);
  if (dueDateMatch) {
    dueDate = dueDateMatch[1];
    text = text.replace(dueDateMatch[0], '').trim();
  }
  return { description: text, assignee, dueDate };
}

function parseActionItems(raw: string | null): ActionItem[] {
  if (!raw) return [];
  const items: ActionItem[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          items.push(parseActionLine(item));
        } else if (item?.description || item?.text) {
          items.push({
            description: item.description || item.text,
            assignee: item.assignee?.name || (typeof item.assignee === 'string' ? item.assignee : undefined) || item.owner,
            assigneeEmail: item.assignee?.email || item.assigneeEmail,
            dueDate: item.due_date || item.dueDate,
            playbackUrl: item.recording_playback_url || item.playback_url || item.playbackUrl,
          });
        }
      }
      return items;
    }
  } catch {
    /* fall through to text */
  }
  for (const line of raw.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith('#') || line.startsWith('Action Items') || line.startsWith('---')) continue;
    items.push(parseActionLine(line));
  }
  return items;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function ensureSyncTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS fathom_asana_synced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      action_description TEXT NOT NULL,
      asana_task_gid TEXT NOT NULL,
      assignee TEXT,
      created_at TEXT NOT NULL,
      source_type TEXT DEFAULT 'meeting',
      source_id TEXT,
      UNIQUE(meeting_id, action_description)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_fas_meeting ON fathom_asana_synced(meeting_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_fas_source ON fathom_asana_synced(source_type, source_id)');
}

async function alreadySynced(sourceType: string, sourceId: string): Promise<boolean> {
  const r = await db.execute({
    sql: 'SELECT 1 FROM fathom_asana_synced WHERE source_type = ? AND source_id = ? LIMIT 1',
    args: [sourceType, sourceId],
  });
  return r.rows.length > 0;
}

async function recordSync(
  meetingId: string,
  description: string,
  taskGid: string,
  assignee: string | null,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO fathom_asana_synced
            (meeting_id, action_description, asana_task_gid, assignee, created_at, source_type, source_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [meetingId, description, taskGid, assignee, new Date().toISOString(), sourceType, sourceId],
  });
}

// AM resolution moved to web/lib/asana/assignee.ts — re-exported here for
// historic call sites in this module.
const getClientAM = sharedGetClientAM;

async function getAsanaProjectForClient(clientName: string | null): Promise<string | undefined> {
  if (!clientName) return undefined;
  try {
    const r = await db.execute({
      sql: `SELECT csm.external_id FROM client_source_mappings csm
            JOIN clients c ON c.id = csm.client_id
            WHERE csm.source = 'asana' AND (c.name = ? OR c.display_name = ?)
            LIMIT 1`,
      args: [clientName, clientName],
    });
    return (r.rows[0]?.external_id as string) || undefined;
  } catch {
    return undefined;
  }
}

function hasExternalInvitee(invitees?: Invitee[] | null): boolean {
  return !!invitees?.some((i) => i?.is_external === true);
}

/** Check whether any Senior Leadership team member is on the meeting. */
function isSltOnMeeting(invitees?: Invitee[] | null): boolean {
  if (!invitees?.length) return false;
  for (const inv of invitees) {
    const n = (inv.name || '').toLowerCase().trim();
    if (n && SLT_NAMES.has(n)) return true;
  }
  return false;
}

/**
 * Resolve the list of Asana project GIDs a task should be attached to.
 *
 *  - Primary project:
 *      1. Client project — only if the client is actually on the meeting
 *         (external invitee present AND clientName resolved).
 *      2. Senior Leader Tasks — if an SLT member is on the meeting.
 *      3. Default project fallback.
 *  - Always also appends the Vendo OS oversight project so everything is
 *    visible in one place.
 */
async function resolveProjects(input: {
  clientName: string | null;
  invitees?: Invitee[] | null;
  /**
   * When true, the client project is preferred even if we have no external
   * invitee (e.g. escalations / NPS follow-ups that are *about* a client but
   * didn't happen in a client meeting).
   */
  forceClientProject?: boolean;
}): Promise<string[]> {
  const projects: string[] = [];
  const shouldTryClient = input.forceClientProject || hasExternalInvitee(input.invitees);

  if (shouldTryClient && input.clientName) {
    const clientProject = await getAsanaProjectForClient(input.clientName);
    if (clientProject) projects.push(clientProject);
  }

  if (projects.length === 0) {
    if (ASANA_SENIOR_LEADER_PROJECT_GID && isSltOnMeeting(input.invitees)) {
      projects.push(ASANA_SENIOR_LEADER_PROJECT_GID);
    } else if (ASANA_DEFAULT_PROJECT_GID) {
      projects.push(ASANA_DEFAULT_PROJECT_GID);
    }
  }

  if (ASANA_VENDO_OS_PROJECT_GID && !projects.includes(ASANA_VENDO_OS_PROJECT_GID)) {
    projects.push(ASANA_VENDO_OS_PROJECT_GID);
  }

  return projects;
}

function parseInvitees(raw: unknown): Invitee[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Invitee[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Invitee[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface CreateTaskOptions {
  /** Meeting start ISO — used to derive due-on (same day, or next day if ≥ 15:00 London). */
  meetingDate?: string | null;
  /** Override the derived due date (used by escalations/NPS where "today"/"+3 days" wins). */
  forceDueDate?: string;
  /** Fallback Fathom meeting URL (when the action item itself has no deep link). */
  meetingUrl?: string | null;
}

async function createAsanaTaskFromAction(
  source: string,
  item: ActionItem,
  clientName: string | null,
  projects: string[],
  options: CreateTaskOptions = {},
): Promise<string> {
  // Resolution order:
  //   1. Explicit assignee from Fathom (name + email, tried in every case variant)
  //   2. Deliverables-module AM for this client (initials → full name)
  //   3. Leave unassigned — human triage in the Vendo OS Alerts project
  let assigneeGid = await resolveAssignee(item.assignee, item.assigneeEmail);
  if (!assigneeGid && clientName) {
    const am = await getClientAM(clientName);
    if (am) assigneeGid = await resolveAssignee(am);
  }

  const ukName = toUkEnglish(item.description).slice(0, 200);
  // Prefer the per-action playback URL (jumps to the exact moment) and fall
  // back to the meeting URL for sources without one (escalations / NPS).
  const fathomUrl = item.playbackUrl || options.meetingUrl || null;
  const notesLines = [
    `Source: ${source}`,
    '',
    `Original: ${item.description}`,
  ];
  if (fathomUrl) {
    notesLines.push('');
    notesLines.push(item.playbackUrl ? `Fathom — jump to moment: ${fathomUrl}` : `Fathom recording: ${fathomUrl}`);
  }
  const ukNotes = toUkEnglish(notesLines.join('\n'));

  const nameKey = normaliseForMatch(ukName);

  // QA rejection: skip if a rule for this task text matches this task's
  // client/assignee scope. More specific rules (client + assignee) win over
  // wildcards. Signalled via TaskRejectedError — the caller counts it as
  // skipped, not an error.
  const rejectionReason = await getRejectionReason(nameKey, clientName, item.assignee || null);
  if (rejectionReason) {
    throw new TaskRejectedError(rejectionReason);
  }

  // Layer B dedupe: if a task with the same normalised name exists in ANY of
  // the target projects, reuse it instead of creating a duplicate.
  for (const p of projects) {
    const index = await getProjectTaskIndex(p);
    const existing = index.get(nameKey);
    if (existing) return existing;
  }

  const dueOn = options.forceDueDate
    || computeMeetingDueDate(options.meetingDate)
    || item.dueDate
    || defaultDueDate();

  const taskData: Record<string, unknown> = {
    name: ukName,
    notes: ukNotes,
    due_on: dueOn,
    workspace: ASANA_WORKSPACE_GID,
  };
  if (assigneeGid) taskData.assignee = assigneeGid;
  if (projects.length) taskData.projects = projects;

  const result = await asanaFetch<{ gid: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });

  // Update every project's in-memory index so follow-up items in this run match.
  for (const p of projects) {
    const index = _projectTaskIndex.get(p);
    if (index) index.set(nameKey, result.gid);
  }
  return result.gid;
}

interface SyncCount {
  created: number;
  skipped: number;
}

/**
 * Create Asana tasks for a single meeting's action items. Called in
 * real-time from the Fathom webhook so tasks appear as soon as the
 * meeting finishes processing. Idempotent — re-sending the same webhook
 * won't duplicate tasks thanks to the fathom_asana_synced dedupe table.
 *
 * Returns counts so the webhook can log, but never throws — task creation
 * failures should not fail the webhook.
 */
export async function createTasksForMeeting(input: {
  meetingId: string;
  title: string;
  rawActionItems: string | null;
  clientName: string | null;
  /** Meeting start time (ISO) — drives the due-on rule (meeting day / next day after 3pm London). */
  meetingDate?: string | null;
  /** Fathom recording URL — used as a fallback when an action item has no per-timestamp link. */
  meetingUrl?: string | null;
  /** Calendar invitees (from Fathom or from meetings.calendar_invitees). Drives project routing. */
  invitees?: Invitee[] | string | null;
}): Promise<SyncCount> {
  if (!ASANA_API_KEY || !input.rawActionItems) return { created: 0, skipped: 0 };
  await ensureSyncTable();

  const items = parseActionItems(input.rawActionItems);
  if (!items.length) return { created: 0, skipped: 0 };

  const invitees = parseInvitees(input.invitees);
  const projects = await resolveProjects({ clientName: input.clientName, invitees });
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.description || item.description.length < 5) continue;
    const sourceId = `meeting-${input.meetingId}-${item.description.slice(0, 50)}`;
    if (await alreadySynced('meeting', sourceId)) { skipped++; continue; }
    const legacy = await db.execute({
      sql: 'SELECT 1 FROM fathom_asana_synced WHERE meeting_id = ? AND action_description = ? LIMIT 1',
      args: [input.meetingId, item.description],
    });
    if (legacy.rows.length) { skipped++; continue; }

    try {
      const taskGid = await createAsanaTaskFromAction(
        `Meeting: ${input.title}`,
        item,
        input.clientName,
        projects,
        { meetingDate: input.meetingDate, meetingUrl: input.meetingUrl },
      );
      await recordSync(input.meetingId, item.description, taskGid, item.assignee || null, 'meeting', sourceId);
      created++;
    } catch (err) {
      if (err instanceof TaskRejectedError) {
        skipped++;
        consoleLog(LOG_SOURCE, `Skipped (rejected): "${item.description.slice(0, 80)}" — ${err.reason}`);
        continue;
      }
      consoleLog(LOG_SOURCE, `Meeting task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

async function syncMeetingActions(): Promise<SyncCount> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let created = 0;
  let skipped = 0;
  const { rows } = await db.execute({
    sql: `SELECT id, title, raw_action_items, client_name, date, url, calendar_invitees
          FROM meetings
          WHERE date >= ? AND raw_action_items IS NOT NULL AND raw_action_items != ''
          ORDER BY date DESC`,
    args: [twentyFourHoursAgo],
  });
  if (!rows.length) return { created, skipped };

  for (const row of rows) {
    const result = await createTasksForMeeting({
      meetingId: row.id as string,
      title: row.title as string,
      rawActionItems: row.raw_action_items as string,
      clientName: (row.client_name as string) || null,
      meetingDate: (row.date as string) || null,
      meetingUrl: (row.url as string) || null,
      invitees: (row.calendar_invitees as string) || null,
    });
    created += result.created;
    skipped += result.skipped;
  }
  return { created, skipped };
}

async function syncEscalations(): Promise<SyncCount> {
  let created = 0;
  let skipped = 0;
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await db.execute("SELECT id, client_name, tier, description FROM escalations WHERE status = 'open'");
    rows = r.rows as Array<Record<string, unknown>>;
  } catch {
    return { created, skipped };
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    const id = row.id as number;
    const clientName = (row.client_name as string) || null;
    const tier = (row.tier as string) || 'unknown';
    const description = (row.description as string) || '';
    const sourceId = `escalation-${id}`;
    if (await alreadySynced('escalation', sourceId)) { skipped++; continue; }
    // No invitees here — force the client project when we know the client.
    const projects = await resolveProjects({ clientName, forceClientProject: true });
    const taskName = `[ESCALATION] ${clientName ?? 'Unknown'} — ${description}`.slice(0, 200);
    try {
      const taskGid = await createAsanaTaskFromAction(
        `Escalation (${tier.toUpperCase()})`,
        { description: taskName },
        clientName,
        projects,
        { forceDueDate: today },
      );
      await recordSync(sourceId, taskName, taskGid, null, 'escalation', sourceId);
      created++;
    } catch (err) {
      if (err instanceof TaskRejectedError) {
        skipped++;
        consoleLog(LOG_SOURCE, `Skipped escalation (rejected): ${err.reason}`);
        continue;
      }
      consoleLog(LOG_SOURCE, `Escalation task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

async function syncNpsDetractors(): Promise<SyncCount> {
  let created = 0;
  let skipped = 0;
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await db.execute('SELECT id, client_name, score, feedback FROM nps_responses WHERE score < 7 AND follow_up_done = 0');
    rows = r.rows as Array<Record<string, unknown>>;
  } catch {
    return { created, skipped };
  }
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const row of rows) {
    const id = row.id as number;
    const clientName = (row.client_name as string) || null;
    const score = row.score as number;
    const sourceId = `nps-${id}`;
    if (await alreadySynced('nps', sourceId)) { skipped++; continue; }
    const projects = await resolveProjects({ clientName, forceClientProject: true });
    const taskName = `[NPS] ${clientName ?? 'Unknown'} scored ${score}/10 — follow up required`;
    try {
      const taskGid = await createAsanaTaskFromAction(
        `NPS detractor (${score}/10)`,
        { description: taskName },
        clientName,
        projects,
        { forceDueDate: threeDays },
      );
      await recordSync(sourceId, taskName, taskGid, null, 'nps', sourceId);
      created++;
    } catch (err) {
      if (err instanceof TaskRejectedError) {
        skipped++;
        consoleLog(LOG_SOURCE, `Skipped NPS (rejected): ${err.reason}`);
        continue;
      }
      consoleLog(LOG_SOURCE, `NPS task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

export interface SyncActionsResult {
  meetings: SyncCount;
  escalations: SyncCount;
  nps: SyncCount;
  durationMs: number;
}

export async function syncActionsToAsana(): Promise<SyncActionsResult> {
  if (!ASANA_API_KEY) {
    consoleLog(LOG_SOURCE, 'ASANA_API_KEY not configured — skipping');
    return { meetings: { created: 0, skipped: 0 }, escalations: { created: 0, skipped: 0 }, nps: { created: 0, skipped: 0 }, durationMs: 0 };
  }
  const start = Date.now();
  await ensureSyncTable();
  const meetings = await syncMeetingActions();
  const escalations = await syncEscalations();
  const nps = await syncNpsDetractors();
  const durationMs = Date.now() - start;
  consoleLog(
    LOG_SOURCE,
    `Done: meetings ${meetings.created}/${meetings.skipped}, escalations ${escalations.created}/${escalations.skipped}, nps ${nps.created}/${nps.skipped} (${durationMs}ms)`,
  );
  return { meetings, escalations, nps, durationMs };
}
