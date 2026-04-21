import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';
import { analyseAndAlert } from '../lib/concern-detection.js';
import { enrichMeeting } from '../lib/meeting-enrichment.js';
import { createTasksForMeeting } from '../lib/jobs/sync-actions-to-asana.js';
import { classifyMeeting } from '../lib/classification/meeting-classifier.js';
import { logRoutingDecision } from '../lib/classification/router.js';
import { postDirectorActionItems, dmTobyFailsafe } from '../lib/classification/slack.js';
import { parseActionItems } from '../lib/jobs/sync-actions-to-asana.js';

/**
 * Fathom Webhook Handler
 *
 * Receives the "New meeting content ready" webhook from Fathom whenever a
 * recording finishes processing. The payload contains the full meeting
 * (transcript, summary, action items, invitees) so we upsert directly —
 * no secondary Fathom API call is required.
 *
 * Auth follows the Standard Webhooks spec (standardwebhooks.com):
 *   webhook-id          unique message identifier
 *   webhook-timestamp   unix seconds
 *   webhook-signature   one or more "<version>,<base64 HMAC-SHA256>" tokens,
 *                       space-separated
 *
 * Env vars:
 *   FATHOM_WEBHOOK_SECRET — Fathom-generated secret (starts `whsec_…`)
 */

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

interface TranscriptItem {
  speaker: { display_name: string; matched_calendar_invitee_email: string | null };
  text: string;
  timestamp: string;
}

interface ActionItemAssignee {
  name: string;
  email: string;
  team: string | null;
}

interface ActionItem {
  description: string;
  user_generated: boolean;
  completed: boolean;
  recording_timestamp: string;
  recording_playback_url: string;
  assignee: ActionItemAssignee | null;
}

interface Invitee {
  name: string | null;
  matched_speaker_display_name?: string | null;
  email: string;
  email_domain: string;
  is_external: boolean;
}

interface CrmMatches {
  contacts?: Array<{ name: string; email: string; record_url?: string | null }>;
  companies?: Array<{ name: string; record_url?: string | null }>;
  deals?: Array<{ name: string; amount?: number | null; record_url?: string | null }>;
  error?: string | null;
}

interface MeetingPayload {
  title: string;
  meeting_title: string | null;
  recording_id: number;
  url: string;
  share_url: string;
  created_at: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  recording_start_time: string;
  recording_end_time: string;
  calendar_invitees_domains_type: string;
  transcript_language?: string;
  transcript?: TranscriptItem[] | null;
  default_summary?: { template_name: string | null; markdown_formatted: string | null } | null;
  action_items?: ActionItem[] | null;
  calendar_invitees: Invitee[];
  crm_matches?: CrmMatches | null;
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  try {
    return Buffer.from(raw, 'base64');
  } catch {
    return Buffer.from(raw, 'utf8');
  }
}

function verifySignature(opts: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
}): boolean {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const key = decodeSecret(opts.secret);
  const toSign = `${opts.id}.${opts.timestamp}.${opts.body}`;
  const expected = crypto.createHmac('sha256', key).update(toSign).digest('base64');

  const tokens = opts.signatureHeader.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const [, sig] = token.split(',', 2);
    if (!sig) continue;
    const received = Buffer.from(sig, 'base64');
    const expectedBuf = Buffer.from(expected, 'base64');
    if (received.length !== expectedBuf.length) continue;
    if (crypto.timingSafeEqual(received, expectedBuf)) return true;
  }
  return false;
}

export const fathomWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Scoped JSON parser that preserves the raw body string — required to
  // compute a matching HMAC signature.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      (req as { rawBody?: string }).rawBody = body;
      try {
        done(null, body.length ? JSON.parse(body) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post('/webhook', async (request, reply) => {
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    if (!secret) {
      request.log.error('FATHOM_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook not configured' });
    }

    const headers = request.headers;
    const id = (headers['webhook-id'] as string) || '';
    const timestamp = (headers['webhook-timestamp'] as string) || '';
    const signatureHeader = (headers['webhook-signature'] as string) || '';
    const rawBody = (request as { rawBody?: string }).rawBody ?? '';

    if (!id || !timestamp || !signatureHeader) {
      return reply.code(400).send({ error: 'Missing webhook headers' });
    }

    if (!verifySignature({ secret, id, timestamp, body: rawBody, signatureHeader })) {
      request.log.warn({ id }, 'Fathom webhook signature failed verification');
      return reply.code(403).send({ error: 'Invalid signature' });
    }

    const meeting = request.body as MeetingPayload;
    if (!meeting?.recording_id) {
      return reply.code(400).send({ error: 'Missing recording_id in payload' });
    }

    try {
      await upsertMeeting(meeting);
      request.log.info(
        { recordingId: meeting.recording_id, title: meeting.title },
        'Fathom meeting synced from webhook',
      );
    } catch (err) {
      request.log.error(
        { err, recordingId: meeting.recording_id },
        'Failed to upsert Fathom meeting',
      );
      // 5xx so Fathom retries. A persistent DB issue will burn retries but
      // that's the right signal — better than silently dropping meetings.
      return reply.code(500).send({ error: 'Upsert failed' });
    }

    // Enrichment + concern detection run after the upsert. Neither should
    // fail the webhook — the meeting is already safely stored, and Fathom
    // shouldn't retry for an AI timeout or context build error.
    const transcriptText = (meeting.transcript ?? [])
      .map((e) => `[${e.timestamp}] ${e.speaker.display_name}: ${e.text}`)
      .join('\n') || null;
    const summary = meeting.default_summary?.markdown_formatted || null;
    const inviteesJson = meeting.calendar_invitees?.length
      ? JSON.stringify(
          meeting.calendar_invitees.map((i) => ({
            name: i.name,
            email: i.email,
            domain: i.email_domain,
          })),
        )
      : null;
    const actionItemsJson = meeting.action_items?.length
      ? JSON.stringify(meeting.action_items)
      : null;

    let enrichedClientName: string | null = null;
    try {
      const enriched = await enrichMeeting(
        {
          meetingId: String(meeting.recording_id),
          title: meeting.title || meeting.meeting_title || 'Untitled',
          summary,
          transcript: transcriptText,
          calendarInviteesJson: inviteesJson,
          rawActionItemsJson: actionItemsJson,
          inviteeDomainsType: meeting.calendar_invitees_domains_type || null,
        },
        request.log,
      );
      enrichedClientName = enriched.clientName;
    } catch (err) {
      request.log.error({ err, recordingId: meeting.recording_id }, 'Meeting enrichment threw');
    }

    // --- Classification gates everything below ---
    // Routes the meeting into one of DIRECTOR / SLT / STANDARD / FAILSAFE
    // and branches accordingly. Phase 2 will add the Slack side-effects;
    // right now we just gate task creation + concern analysis.
    const classification = classifyMeeting(
      meeting.title || meeting.meeting_title,
      (meeting.calendar_invitees ?? []).map((i) => ({
        name: i.name,
        email: i.email,
        is_external: i.is_external,
      })),
    );
    const routedTo: string[] = [];

    // STANDARD: run concern detection as today. DIRECTOR / SLT / FAILSAFE
    // all suppress public concern alerts (SLT + DIRECTOR are private;
    // FAILSAFE needs manual review first).
    if (classification.type === 'STANDARD') {
      try {
        const outcome = await analyseAndAlert(
          {
            meetingId: String(meeting.recording_id),
            title: meeting.title || meeting.meeting_title || 'Untitled',
            date: meeting.created_at,
            clientName: enrichedClientName,
            fathomUrl: meeting.url || meeting.share_url || null,
            shareUrl: meeting.share_url || null,
            transcript: transcriptText,
            summary,
            domainsType: meeting.calendar_invitees_domains_type || null,
            crmMatches: meeting.crm_matches ?? null,
          },
          request.log,
        );
        if (outcome.alerted) routedTo.push('slack_concern_alert');
        request.log.info({ recordingId: meeting.recording_id, outcome }, 'Concern detection complete');
      } catch (err) {
        request.log.error({ err, recordingId: meeting.recording_id }, 'Concern detection threw');
      }
    }

    // Asana task creation:
    //   STANDARD → normal multi-project routing
    //   SLT      → SLT project only (forceProjectMode)
    //   DIRECTOR → no tasks (Phase 2 adds Slack summary with buttons)
    //   FAILSAFE → no tasks (Phase 2 adds DM-Toby)
    if (actionItemsJson && (classification.type === 'STANDARD' || classification.type === 'SLT')) {
      try {
        const result = await createTasksForMeeting({
          meetingId: String(meeting.recording_id),
          title: meeting.title || meeting.meeting_title || 'Untitled',
          rawActionItems: actionItemsJson,
          clientName: enrichedClientName,
          meetingDate: meeting.recording_start_time || meeting.created_at || null,
          meetingUrl: meeting.share_url || meeting.url || null,
          invitees: meeting.calendar_invitees || null,
          forceProjectMode: classification.type === 'SLT' ? 'slt_only' : undefined,
        });
        if (result.created > 0) {
          routedTo.push(classification.type === 'SLT' ? 'asana_slt_only' : 'asana_standard');
        }
        request.log.info(
          { recordingId: meeting.recording_id, classification: classification.type, asanaResult: result },
          'Asana tasks created from meeting action items',
        );
      } catch (err) {
        request.log.error({ err, recordingId: meeting.recording_id }, 'Asana task creation threw');
      }
    }

    // DIRECTOR: one Slack message per action item to #claude-director-meetings.
    // Button on each message lets the viewer copy it to their own Asana.
    if (classification.type === 'DIRECTOR' && actionItemsJson) {
      try {
        const actionItems = parseActionItems(actionItemsJson);
        const { posted } = await postDirectorActionItems({
          meetingId: String(meeting.recording_id),
          meetingTitle: meeting.title || meeting.meeting_title || 'Untitled',
          meetingUrl: meeting.share_url || meeting.url || null,
          actionItems,
        });
        if (posted > 0) routedTo.push(`slack_director_${posted}_actions`);
      } catch (err) {
        request.log.error({ err, recordingId: meeting.recording_id }, 'Director Slack post failed');
      }
    }

    // FAILSAFE: DM Toby so he can review the unparseable meeting manually.
    if (classification.type === 'FAILSAFE') {
      try {
        const sent = await dmTobyFailsafe({
          meetingTitle: meeting.title || meeting.meeting_title || 'Untitled',
          meetingUrl: meeting.share_url || meeting.url || null,
          reason: classification.reason,
        });
        if (sent) routedTo.push('dm_toby_failsafe');
      } catch (err) {
        request.log.error({ err, recordingId: meeting.recording_id }, 'Fail-safe DM failed');
      }
    }

    await logRoutingDecision({
      meetingId: String(meeting.recording_id),
      classification: classification.type,
      reason: classification.reason,
      routedTo,
    });

    request.log.info(
      { recordingId: meeting.recording_id, classification: classification.type, reason: classification.reason, routedTo },
      'Meeting routed',
    );

    return reply.code(200).send({ ok: true, classification: classification.type });
  });
};

async function upsertMeeting(meeting: MeetingPayload): Promise<void> {
  const id = String(meeting.recording_id);
  const now = new Date().toISOString();

  const transcriptText = (meeting.transcript ?? [])
    .map((e) => `[${e.timestamp}] ${e.speaker.display_name}: ${e.text}`)
    .join('\n') || null;

  const summary = meeting.default_summary?.markdown_formatted || null;
  const actionItems = meeting.action_items?.length ? JSON.stringify(meeting.action_items) : null;

  const inviteesForStorage = (meeting.calendar_invitees ?? []).map((i) => ({
    name: i.name,
    email: i.email,
    domain: i.email_domain,
  }));
  const inviteesJson = inviteesForStorage.length ? JSON.stringify(inviteesForStorage) : null;

  let durationSeconds: number | null = null;
  if (meeting.recording_start_time && meeting.recording_end_time) {
    const d = Math.round(
      (new Date(meeting.recording_end_time).getTime() -
        new Date(meeting.recording_start_time).getTime()) /
        1000,
    );
    if (d >= 0 && d <= 18_000) durationSeconds = d;
  }

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
      transcriptText,
      actionItems,
      now,
      inviteesJson,
      meeting.calendar_invitees_domains_type || null,
    ],
  });

  await db.execute({
    sql: 'DELETE FROM meetings_fts WHERE rowid = (SELECT rowid FROM meetings WHERE id = ?)',
    args: [id],
  });
  await db.execute({
    sql: `INSERT INTO meetings_fts (rowid, title, summary, transcript)
          SELECT rowid, title, summary, transcript FROM meetings WHERE id = ?`,
    args: [id],
  });
}
