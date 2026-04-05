import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db, rows } from '../lib/queries/base.js';

/**
 * Fathom Webhook Handler
 *
 * Receives POST notifications from Fathom when a recording is complete.
 * Fetches the meeting data + transcript from the Fathom API and upserts
 * it directly into Turso so the web app sees it immediately.
 *
 * Env vars:
 *   FATHOM_WEBHOOK_SECRET — shared secret for request validation
 *   FATHOM_API_KEY        — API key for fetching meeting data
 */

const FATHOM_API = 'https://api.fathom.ai/external/v1';

interface FathomWebhookPayload {
  event: string;
  recording_id: number;
  [key: string]: unknown;
}

interface FathomMeeting {
  title: string;
  meeting_title: string;
  url: string;
  created_at: string;
  recording_id: number;
  recording_start_time: string | null;
  recording_end_time: string | null;
  calendar_invitees_domains_type: string;
  default_summary: {
    template_name: string | null;
    markdown_formatted: string | null;
  } | null;
  action_items: Array<{
    description: string;
    user_generated: boolean;
    completed: boolean;
    recording_timestamp: string;
    recording_playback_url: string;
    assignee: {
      name: string;
      email: string;
      team: string;
    } | null;
  }> | null;
}

interface TranscriptEntry {
  speaker: { display_name: string; matched_calendar_invitee_email: string | null };
  text: string;
  timestamp: string;
}

async function fathomGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${FATHOM_API}${path}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fathom API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const fathomWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook', async (request, reply) => {
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    if (!secret) {
      request.log.error('FATHOM_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook not configured' });
    }

    // Validate shared secret via Authorization header
    const auth = request.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : (auth ?? '');
    if (
      !token ||
      token.length !== secret.length ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    ) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const apiKey = process.env.FATHOM_API_KEY;
    if (!apiKey) {
      request.log.error('FATHOM_API_KEY not configured');
      return reply.code(500).send({ error: 'API key not configured' });
    }

    const payload = request.body as FathomWebhookPayload;
    const recordingId = payload?.recording_id;

    if (!recordingId) {
      return reply.code(400).send({ error: 'Missing recording_id' });
    }

    request.log.info({ recordingId, event: payload.event }, 'Fathom webhook received');

    // Acknowledge immediately, process in background
    reply.code(200).send({ ok: true });

    // Process asynchronously so we don't block the webhook response
    processRecording(recordingId, apiKey, request.log).catch((err) => {
      request.log.error({ err, recordingId }, 'Failed to process Fathom recording');
    });
  });
};

async function processRecording(
  recordingId: number,
  apiKey: string,
  log: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
): Promise<void> {
  // Fetch meeting metadata (summary + action items)
  const meetings = await fathomGet<{ items: FathomMeeting[] }>(
    `/meetings?include_summary=true&include_action_items=true`,
    apiKey,
  );

  // The list endpoint doesn't filter by ID, so find our recording
  // If not on the first page, page through
  let meeting: FathomMeeting | undefined;
  let cursor: string | null = null;
  let response = meetings;

  while (!meeting) {
    meeting = response.items.find((m) => m.recording_id === recordingId);
    cursor = (response as any).next_cursor ?? null;
    if (meeting || !cursor) break;
    response = await fathomGet<{ items: FathomMeeting[]; next_cursor: string | null }>(
      `/meetings?include_summary=true&include_action_items=true&cursor=${cursor}`,
      apiKey,
    );
  }

  if (!meeting) {
    log.error({ recordingId }, 'Recording not found in Fathom meeting list');
    return;
  }

  // Fetch transcript
  let transcriptText = '';
  const invitees: Array<{ name: string; email: string | null; domain: string | null }> = [];
  const seenEmails = new Set<string>();

  try {
    const data = await fathomGet<{ transcript: TranscriptEntry[] }>(
      `/recordings/${recordingId}/transcript`,
      apiKey,
    );
    if (data.transcript && Array.isArray(data.transcript)) {
      transcriptText = data.transcript
        .map((e) => `[${e.timestamp}] ${e.speaker.display_name}: ${e.text}`)
        .join('\n');

      // Extract speaker emails
      for (const entry of data.transcript) {
        const email = entry.speaker.matched_calendar_invitee_email;
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          const domain = email.split('@')[1]?.toLowerCase() || null;
          invitees.push({ name: entry.speaker.display_name, email, domain });
        }
      }
    }
  } catch (err) {
    log.error({ err, recordingId }, 'Failed to fetch transcript — saving meeting without it');
  }

  // Also extract invitees from action items
  if (meeting.action_items) {
    for (const item of meeting.action_items) {
      if (item.assignee?.email && !seenEmails.has(item.assignee.email)) {
        seenEmails.add(item.assignee.email);
        const domain = item.assignee.email.split('@')[1]?.toLowerCase() || null;
        invitees.push({ name: item.assignee.name, email: item.assignee.email, domain });
      }
    }
  }

  // Calculate duration
  let durationSeconds: number | null = null;
  if (meeting.recording_start_time && meeting.recording_end_time) {
    const start = new Date(meeting.recording_start_time).getTime();
    const end = new Date(meeting.recording_end_time).getTime();
    durationSeconds = Math.round((end - start) / 1000);
    if (durationSeconds < 0 || durationSeconds > 18000) durationSeconds = null;
  }

  const id = String(recordingId);
  const now = new Date().toISOString();
  const summary = meeting.default_summary?.markdown_formatted || null;
  const actionItems = meeting.action_items ? JSON.stringify(meeting.action_items) : null;
  const inviteesJson = invitees.length > 0 ? JSON.stringify(invitees) : null;

  // Upsert into Turso
  await db.execute({
    sql: `INSERT INTO meetings (id, title, date, duration_seconds, url, summary, transcript,
            raw_action_items, synced_at, calendar_invitees, invitee_domains_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            summary = excluded.summary,
            transcript = COALESCE(excluded.transcript, meetings.transcript),
            raw_action_items = excluded.raw_action_items,
            synced_at = excluded.synced_at,
            calendar_invitees = COALESCE(excluded.calendar_invitees, meetings.calendar_invitees),
            invitee_domains_type = COALESCE(excluded.invitee_domains_type, meetings.invitee_domains_type),
            duration_seconds = COALESCE(excluded.duration_seconds, meetings.duration_seconds)`,
    args: [
      id,
      meeting.title || meeting.meeting_title || 'Untitled',
      meeting.created_at,
      durationSeconds,
      meeting.url || null,
      summary,
      transcriptText || null,
      actionItems,
      now,
      inviteesJson,
      meeting.calendar_invitees_domains_type || null,
    ],
  });

  // Rebuild FTS for this meeting
  await db.execute({ sql: 'DELETE FROM meetings_fts WHERE rowid = (SELECT rowid FROM meetings WHERE id = ?)', args: [id] });
  await db.execute({
    sql: `INSERT INTO meetings_fts (rowid, title, summary, transcript)
          SELECT rowid, title, summary, transcript FROM meetings WHERE id = ?`,
    args: [id],
  });

  log.info({ recordingId, title: meeting.title || meeting.meeting_title }, 'Meeting synced from Fathom webhook');
}
