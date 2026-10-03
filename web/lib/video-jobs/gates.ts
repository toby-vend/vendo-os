import { db } from '../queries/base.js';
import { getResource, listAll, sendJson } from '../frameio/client.js';
import { ACCOUNT_ID, ancestorFolders, createComment } from '../frameio/media-io.js';
import { postSlackText } from '../frameio/slack.js';
import { ensureVideoJobsSchema, findJobByDelivered } from './store.js';

/**
 * The two human gates for AI-made videos, run on Frame.io's existing Status field
 * (plans/2026-10-03-frameio-native-ai-edits.md, step 3; status names and Lead Video Editor confirmed by Toby, 3 Oct 2026).
 *
 *   In Progress          set by the AI on every new version; the editor works on it
 *   Needs Review         editor: ready for Gate 1 (Creative Strategist)
 *   Approved             Gate 1 passed: message, claims, prices and offers checked
 *   Internally Approved  Gate 2 passed (Lead Video Editor): quality checked, cleared for the client
 *   Client Approved      the client signed off; the Lead Video Editor renames to Final
 *
 * The team shares one Frame.io login, so "who's next" is said in a Frame.io comment on the video and in Slack,
 * not with the Assignee field. Only videos the AI made (in video_jobs) are touched.
 */

export const STATUS = {
  inProgress: 'In Progress',
  needsReview: 'Needs Review',
  approved: 'Approved',
  internallyApproved: 'Internally Approved',
  clientApproved: 'Client Approved',
} as const;

/** People in each role. Faith confirmed as Lead Video Editor by Toby, 3 Oct 2026. */
export const ROLES = { leadVideoEditor: 'Faith', creativeStrategist: 'the Creative Strategist' };

/** After these the AI must not change the video. */
export const LOCKED = new Set<string>([STATUS.internallyApproved, STATUS.clientApproved]);

export interface GateReaction { comment: string; slack: string | null }

/**
 * What to say when an AI video's Status changes. `history` is every status this file has had, oldest first,
 * not including the new one. Returns null when there is nothing to say (including our own In Progress).
 */
export function gateReaction(status: string, history: string[], videoName: string): GateReaction | null {
  const lead = ROLES.leadVideoEditor;
  const cs = ROLES.creativeStrategist;
  switch (status) {
    case STATUS.needsReview:
      return {
        comment: `Gate 1: ready for ${cs}. Check the message matches the concept (hook, angle, offer) and every claim, price and offer on screen. ` +
          'Pass: set Status to Approved. Changes needed: comment, then set Status back to In Progress.',
        slack: `Gate 1: "${videoName}" is ready for ${cs} to review in Frame.io.`,
      };
    case STATUS.approved: {
      const skipped = !history.includes(STATUS.needsReview);
      return {
        comment: `Gate 1 passed${skipped ? ' (note: it went straight to Approved without Needs Review)' : ''}. Gate 2: ${lead} (Lead Video Editor) to check audio, captions, safe zones and brand. ` +
          'Pass: set Status to Internally Approved. Changes needed: comment, then set Status back to In Progress.',
        slack: `Gate 2: "${videoName}" passed Gate 1 and is ready for ${lead}'s quality check.`,
      };
    }
    case STATUS.internallyApproved:
      if (!history.includes(STATUS.approved)) {
        return {
          comment: `Internally Approved, but Gate 1 (${cs}: message, claims, prices and offers) was never passed. Please get Gate 1 done before this goes to the client.`,
          slack: `Gate skipped: "${videoName}" was set to Internally Approved without passing Gate 1. Please check before it goes to the client.`,
        };
      }
      return {
        comment: 'Gate 2 passed. Cleared for the client: rename to Client Review and share. The AI will not change this version any more.',
        slack: `Cleared for the client: "${videoName}" passed both gates.`,
      };
    case STATUS.clientApproved:
      return {
        comment: `Client approved. ${lead}: rename to Final (a person does this, never the AI).`,
        slack: `Client approved: "${videoName}". ${lead} to rename it to Final.`,
      };
    default:
      return null;
  }
}

// ---------- Frame.io status read / write ----------

interface FieldDef { id: string; name: string; field_type: string; mutable?: boolean; field_configuration?: { options?: Array<{ id: string; display_name?: string; name?: string }> } }
let statusDef: { id: string; options: Map<string, string> } | null = null;

async function statusField(): Promise<{ id: string; options: Map<string, string> }> {
  if (statusDef) return statusDef;
  const defs = await listAll<FieldDef>(`/accounts/${ACCOUNT_ID}/metadata/field_definitions`);
  const def = defs.find((d) => d.name === 'Status' && d.field_type === 'select' && d.mutable !== false
    && d.field_configuration?.options?.some((o) => (o.display_name ?? o.name) === STATUS.inProgress));
  if (!def) throw new Error('Frame.io Status field not found');
  statusDef = { id: def.id, options: new Map(def.field_configuration!.options!.map((o) => [o.display_name ?? o.name ?? '', o.id])) };
  return statusDef;
}

/** A file's Status in Frame.io right now, or null if unset. */
export async function getFileStatus(fileId: string): Promise<string | null> {
  const md = await getResource<{ metadata: Array<{ field_definition_name: string; value: Array<{ display_name?: string }> | null }> }>(
    `/accounts/${ACCOUNT_ID}/files/${fileId}/metadata`,
  );
  const entry = md?.metadata.find((m) => m.field_definition_name === 'Status');
  return entry?.value?.[0]?.display_name ?? null;
}

export async function setFileStatus(projectId: string, fileId: string, status: string): Promise<void> {
  const field = await statusField();
  const option = field.options.get(status);
  if (!option) throw new Error(`Frame.io Status has no "${status}" option`);
  await sendJson('PATCH', `/accounts/${ACCOUNT_ID}/projects/${projectId}/metadata/values`, {
    data: { file_ids: [fileId], values: [{ field_definition_id: field.id, value: [option] }] },
  });
}

// ---------- status history ----------

async function ensureStatusTable(): Promise<void> {
  await ensureVideoJobsSchema();
  await db.execute(`CREATE TABLE IF NOT EXISTS video_file_status (
    file_id TEXT PRIMARY KEY, chain_id INTEGER, status TEXT, history TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
  )`);
}

async function recordStatus(fileId: string, chainId: number | null, status: string): Promise<{ previous: string | null; history: string[] }> {
  await ensureStatusTable();
  const res = await db.execute({ sql: 'SELECT status, history FROM video_file_status WHERE file_id = ?', args: [fileId] });
  const previous = (res.rows[0]?.status as string | undefined) ?? null;
  const history = res.rows[0] ? (JSON.parse(String(res.rows[0].history)) as string[]) : [];
  if (previous !== status) {
    await db.execute({
      sql: `INSERT INTO video_file_status (file_id, chain_id, status, history, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(file_id) DO UPDATE SET status = excluded.status, history = excluded.history, updated_at = excluded.updated_at`,
      args: [fileId, chainId, status, JSON.stringify([...history, status]), new Date().toISOString()],
    });
  }
  return { previous, history };
}

// ---------- webhook event handlers (called from the Frame.io event processor) ----------

interface StatusEvent { metadata?: { field_name?: string; value?: string[] }; resource?: { id?: string; type?: string } }

/** metadata.value.updated on an AI video's Status: record it and say who's next. Returns an outcome label, or null if not ours. */
export async function handleStatusEvent(payload: StatusEvent): Promise<string | null> {
  if (payload.metadata?.field_name !== 'Status' || payload.resource?.type !== 'file' || !payload.resource.id) return null;
  const fileId = payload.resource.id;
  const job = await findJobByDelivered(fileId);
  if (!job) return null;
  const status = payload.metadata.value?.[0] ?? '';
  const { previous, history } = await recordStatus(fileId, job.chain_id, status);
  if (previous === status) return 'gate_duplicate';
  const name = (job.message ?? '').match(/"(.+)"/)?.[1]?.replace(/\.mp4$/, '') ?? `job ${job.id}`;
  const reaction = gateReaction(status, history, name);
  if (!reaction) return 'gate_recorded';
  await createComment(fileId, reaction.comment);
  if (reaction.slack) await postSlackText(`${reaction.slack}${job.result_view_url ? ` ${job.result_view_url}` : ''}`);
  return `gate_${status.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * share.created: if the share includes an AI video that hasn't passed both gates, alert Slack.
 * Shares can hold folders, so an AI video counts as shared when it, or a folder above it, is in the share.
 */
export async function handleShareEvent(payload: { resource?: { id?: string; type?: string } }): Promise<string | null> {
  if (payload.resource?.type !== 'share' || !payload.resource.id) return null;
  await ensureStatusTable();
  const shared = await listAll<{ id: string; type: string; name: string }>(`/accounts/${ACCOUNT_ID}/shares/${payload.resource.id}/assets`);
  if (!shared.length) return 'share_empty';
  const sharedIds = new Set(shared.map((a) => a.id));
  // Latest delivered version of each AI video.
  const latest = await db.execute(`SELECT j.* FROM video_jobs j JOIN (SELECT chain_id, MAX(id) AS id FROM video_jobs WHERE status = 'done' GROUP BY chain_id) m ON m.id = j.id`);
  const early: string[] = [];
  for (const row of latest.rows) {
    const fileId = String(row.result_file_id);
    const stackId = row.result_stack_id ? String(row.result_stack_id) : null;
    let inShare = sharedIds.has(fileId) || (stackId !== null && sharedIds.has(stackId));
    if (!inShare) {
      const ancestors = await ancestorFolders({ parent_id: await parentOf(fileId) });
      inShare = ancestors.some((a) => sharedIds.has(a.id));
    }
    if (!inShare) continue;
    const status = await getFileStatus(fileId);
    if (!status || !LOCKED.has(status)) early.push(`"${String(row.message ?? '').match(/"(.+)"/)?.[1] ?? fileId}" (Status: ${status ?? 'none'})`);
  }
  if (!early.length) return 'share_ok';
  await postSlackText(`Shared before both gates: ${early.join(', ')}. ${ROLES.leadVideoEditor}, please check before the client sees it.`);
  return 'share_alerted';
}

async function parentOf(fileId: string): Promise<string | null> {
  const f = await getResource<{ parent_id: string | null }>(`/accounts/${ACCOUNT_ID}/files/${fileId}`);
  return f?.parent_id ?? null;
}
