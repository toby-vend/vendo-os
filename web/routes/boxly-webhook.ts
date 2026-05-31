import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';
import { normaliseBoxlyLead, type BoxlyRawPayload } from '../lib/boxly/payload.js';

/**
 * Boxly Webhook Handler
 *
 * Boxly (boxly.ai, formerly EnquiryBox) has no public API and no native
 * outbound webhook. Leads leave Boxly only via Zapier's "New Lead" trigger,
 * which we forward with a "Webhooks by Zapier" POST action to this endpoint.
 *
 * Flow:
 *   1. Validate the shared token (?token=… or Authorization: Bearer).
 *   2. Identify the client from ?client=<client_id> (hardcoded per client in
 *      the Zap's webhook URL — mirrors Leadsie's customUserId pattern).
 *   3. Archive the raw payload to `boxly_events` (replayable).
 *   4. Normalise → upsert into `boxly_leads` (dedup on client_id + dedup_key).
 *
 * Auth: no HMAC from Zapier, so we use a long random shared token, identical to
 * the Frame.io Phase-1 scheme. Configure the Zap URL as
 *   https://<host>/api/boxly/webhook?token=<BOXLY_WEBHOOK_TOKEN>&client=<id>
 *
 * Env vars:
 *   BOXLY_WEBHOOK_TOKEN — required. Random 32+ byte secret matching ?token=.
 *
 * See plans/2026-05-31-boxly-integration.md.
 */

let schemaEnsured = false;

/**
 * Idempotently create boxly_events + boxly_leads. Mirrors the Frame.io handler:
 * production Turso is normally provisioned by push-to-turso snapshots, but we
 * run the same DDL here so the webhook works even before the next push.
 */
async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS boxly_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      client_id INTEGER,
      box TEXT,
      stage TEXT,
      payload TEXT NOT NULL,
      headers TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processing_status TEXT NOT NULL DEFAULT 'received',
      processing_error TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_boxly_events_received ON boxly_events(received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_boxly_events_client ON boxly_events(client_id, received_at)`,
    `CREATE TABLE IF NOT EXISTS boxly_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      dedup_key TEXT NOT NULL,
      boxly_lead_id TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      message TEXT,
      entry_point_url TEXT,
      channel TEXT,
      source_label TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      gclid TEXT,
      fbclid TEXT,
      box TEXT,
      stage TEXT,
      booked_at TEXT,
      created_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      UNIQUE(client_id, dedup_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_boxly_leads_client ON boxly_leads(client_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_boxly_leads_channel ON boxly_leads(client_id, channel, created_at)`,
  ];
  for (const sql of stmts) {
    try {
      await db.execute(sql);
    } catch (err) {
      throw new Error(`boxly DDL failed: ${(err as Error).message} | sql: ${sql.slice(0, 80)}`);
    }
  }
  schemaEnsured = true;
}

export const boxlyWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook', async (request, reply) => {
    const expectedToken = process.env.BOXLY_WEBHOOK_TOKEN;
    if (!expectedToken) {
      request.log.error('BOXLY_WEBHOOK_TOKEN not configured');
      return reply.code(500).send({ error: 'Webhook not configured' });
    }

    // Token check — ?token=… or Authorization: Bearer.
    const query = request.query as Record<string, string | undefined> | undefined;
    const urlToken = query?.token ?? '';
    const authHeader = (request.headers['authorization'] as string | undefined) ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const presented = urlToken || bearerToken;

    if (!presented || presented.length !== expectedToken.length ||
        !crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expectedToken))) {
      request.log.warn({ ip: request.ip }, 'Boxly webhook auth failed');
      return reply.code(403).send({ error: 'Invalid token' });
    }

    // Client id from the URL (hardcoded per client in their Zap).
    const clientIdRaw = query?.client ?? '';
    const clientId = Number(clientIdRaw);
    if (!clientIdRaw || !Number.isInteger(clientId) || clientId <= 0) {
      request.log.warn({ clientIdRaw }, 'Boxly webhook missing/invalid client id');
      return reply.code(400).send({ error: 'Missing or invalid client id' });
    }

    try {
      await ensureSchema();
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      request.log.error({ err }, 'Failed to ensure boxly schema');
      // Don't 5xx — Zapier would retry indefinitely. Ack and lose visibility.
      return reply.code(200).send({ ok: true, persisted: false, reason: 'schema', detail: msg });
    }

    const payload = (request.body ?? {}) as BoxlyRawPayload;
    const rawBody = JSON.stringify(payload);
    const receivedAt = new Date().toISOString();

    // Persist headers (lowercased, auth stripped) for debugging.
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers)) {
      if (k.toLowerCase() === 'authorization') continue;
      if (Array.isArray(v)) headers[k] = v.join(', ');
      else if (v != null) headers[k] = String(v);
    }

    const lead = normaliseBoxlyLead(payload, receivedAt);

    // 1. Archive raw event first — never lose a lead to a parsing bug.
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO boxly_events
                (event_id, client_id, box, stage, payload, headers, received_at, processing_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          lead.boxlyLeadId,
          clientId,
          lead.box,
          lead.stage,
          rawBody,
          JSON.stringify(headers),
          receivedAt,
          'received',
        ],
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      request.log.error({ err }, 'Failed to insert boxly_event');
      return reply.code(200).send({ ok: true, persisted: false, reason: 'archive', detail: msg });
    }

    // 2. Upsert normalised lead. Dedup via UNIQUE(client_id, dedup_key);
    //    INSERT OR IGNORE so Zapier retries collapse to one row.
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO boxly_leads
                (client_id, dedup_key, boxly_lead_id, contact_name, contact_email,
                 contact_phone, message, entry_point_url, channel, source_label,
                 utm_source, utm_medium, utm_campaign, gclid, fbclid, box, stage,
                 created_at, received_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          clientId,
          lead.dedupKey,
          lead.boxlyLeadId,
          lead.contactName,
          lead.contactEmail,
          lead.contactPhone,
          lead.message,
          lead.entryPointUrl,
          lead.channel,
          lead.sourceLabel,
          lead.utmSource,
          lead.utmMedium,
          lead.utmCampaign,
          lead.gclid,
          lead.fbclid,
          lead.box,
          lead.stage,
          lead.createdAt,
          receivedAt,
        ],
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      request.log.error({ err, clientId }, 'Failed to insert boxly_lead');
      return reply.code(200).send({ ok: true, persisted: 'event-only', reason: 'lead', detail: msg });
    }

    request.log.info(
      { clientId, channel: lead.channel, hasEmail: !!lead.contactEmail, stage: lead.stage },
      'Boxly lead archived',
    );
    return reply.code(200).send({ ok: true, channel: lead.channel });
  });
};
