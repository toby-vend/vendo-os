import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';

/**
 * Frame.io Webhook Handler — Phase 1
 *
 * Receives every event Frame.io fires (file/folder/comment/share/etc.) and
 * archives it verbatim into `frameio_events`. Phase 2 will fan these events
 * out to creative_reviews, Slack alerts, and the Frame.io dashboard once we
 * have observed real deliveries and confirmed Frame.io's signing scheme.
 *
 * Auth (Phase 1): shared random token in the URL query string.
 *   Frame.io's V4 webhook UI exposes only Name / Events / URL / Workspace —
 *   no signing-secret field is shown today. We therefore embed a long random
 *   secret in the URL (`?token=…`) and check it on every request. When the
 *   first delivery arrives we will inspect headers and switch to HMAC
 *   verification using the `secret` Frame.io shows once at webhook creation.
 *
 * Env vars:
 *   FRAMEIO_WEBHOOK_TOKEN — required. Random 32+ byte secret matching the
 *                           token in the configured Frame.io webhook URL.
 *   FRAMEIO_WEBHOOK_SECRET — optional. If set, we additionally verify the
 *                            `frameio-signature` / `x-frameio-signature`
 *                            header (HMAC-SHA256 over the raw body) and only
 *                            accept the request if it matches.
 */

interface FrameioPayload {
  // Frame.io V4 envelopes events with `type` + `resource` + `account_id`.
  // We do not depend on the exact shape — we just persist whatever arrives.
  type?: string;
  event?: string;
  resource?: { type?: string; id?: string } | null;
  account?: { id?: string } | null;
  workspace?: { id?: string } | null;
  project?: { id?: string } | null;
  account_id?: string;
  workspace_id?: string;
  project_id?: string;
  id?: string;
  event_id?: string;
  data?: Record<string, unknown>;
}

let schemaEnsured = false;

/**
 * Idempotently create the `frameio_events` table on the production DB.
 * `scripts/utils/db.ts` declares it for local dev, but production Turso is
 * provisioned by `push-to-turso.ts` snapshots — we run the same DDL here so
 * the webhook works even before the next push.
 */
async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  // Phase 1 ships INSERT OR IGNORE inserts which don't require a named
  // ON CONFLICT target — any UNIQUE-violating row is skipped silently.
  // The column-level UNIQUE on event_id provides the dedup; SQLite/libSQL
  // both allow multiple NULLs through a UNIQUE column, so events without an
  // event_id will all land as separate rows (which is fine for archive use).
  const stmts = [
    `CREATE TABLE IF NOT EXISTS frameio_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      event_type TEXT,
      resource_type TEXT,
      resource_id TEXT,
      account_id TEXT,
      workspace_id TEXT,
      project_id TEXT,
      payload TEXT NOT NULL,
      headers TEXT NOT NULL,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      processing_status TEXT NOT NULL DEFAULT 'received',
      processing_error TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_frameio_events_type ON frameio_events(event_type)',
    'CREATE INDEX IF NOT EXISTS idx_frameio_events_received ON frameio_events(received_at)',
    'CREATE INDEX IF NOT EXISTS idx_frameio_events_resource ON frameio_events(resource_type, resource_id)',
  ];
  for (const sql of stmts) {
    try {
      await db.execute(sql);
    } catch (err) {
      // Surface the failing statement so we can diagnose Turso DDL quirks.
      throw new Error(`frameio_events DDL failed: ${(err as Error).message} | sql: ${sql.slice(0, 80)}`);
    }
  }

  // The table may have been created by an earlier deploy without the UNIQUE
  // constraint on event_id. Detect that case and rebuild — Phase 1 has no
  // real data to preserve. Idempotent: safe to call on every cold start.
  try {
    const probe = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='frameio_events'");
    const ddl = (probe.rows?.[0]?.sql as string | undefined) ?? '';
    const hasUnique = /event_id\s+TEXT\s+UNIQUE/i.test(ddl);
    if (!hasUnique) {
      const count = await db.execute('SELECT COUNT(*) AS n FROM frameio_events');
      const n = Number((count.rows?.[0]?.n as number | bigint | undefined) ?? 0);
      if (n === 0) {
        await db.execute('DROP TABLE frameio_events');
        await db.execute(stmts[0]);
        await db.execute(stmts[1]);
        await db.execute(stmts[2]);
        await db.execute(stmts[3]);
      }
      // If n > 0 we leave it alone — operator can decide later. INSERT OR
      // IGNORE will still work; dedup just won't apply for the legacy rows.
    }
  } catch (err) {
    throw new Error(`frameio_events probe failed: ${(err as Error).message}`);
  }

  schemaEnsured = true;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Optional Phase-1.5 HMAC check — only runs if `FRAMEIO_WEBHOOK_SECRET` is
 * set. Tries the most common header / format combinations Frame.io is
 * likely to emit, since the public docs don't pin one down. Any single
 * match passes.
 */
function verifyOptionalSignature(opts: {
  secret: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
}): boolean {
  const candidates = [
    opts.headers['frameio-signature'],
    opts.headers['x-frameio-signature'],
    opts.headers['frame-io-signature'],
    opts.headers['x-frame-io-signature'],
  ].filter((h): h is string => Boolean(h));

  if (candidates.length === 0) return false;

  const macHex = crypto.createHmac('sha256', opts.secret).update(opts.rawBody).digest('hex');
  const macB64 = crypto.createHmac('sha256', opts.secret).update(opts.rawBody).digest('base64');

  for (const header of candidates) {
    // Bare hex / base64
    if (timingSafeEqualString(header.trim(), macHex)) return true;
    if (timingSafeEqualString(header.trim(), macB64)) return true;

    // `t=…,v0=…` or `sha256=…` framings
    for (const part of header.split(/[,\s]+/)) {
      const [, value] = part.includes('=') ? part.split('=', 2) : ['', part];
      if (!value) continue;
      if (timingSafeEqualString(value, macHex)) return true;
      if (timingSafeEqualString(value, macB64)) return true;
    }
  }
  return false;
}

function pickResourceType(p: FrameioPayload): string | null {
  return p.resource?.type ?? null;
}

function pickResourceId(p: FrameioPayload): string | null {
  return p.resource?.id ?? null;
}

function pickEventType(p: FrameioPayload): string | null {
  return p.type ?? p.event ?? null;
}

function pickEventId(p: FrameioPayload): string | null {
  return p.event_id ?? p.id ?? null;
}

export const frameioWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Scoped JSON parser that preserves the raw body — required for any
  // future HMAC verification.
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
    const expectedToken = process.env.FRAMEIO_WEBHOOK_TOKEN;
    if (!expectedToken) {
      request.log.error('FRAMEIO_WEBHOOK_TOKEN not configured');
      return reply.code(500).send({ error: 'Webhook not configured' });
    }

    // Token check — accept either ?token=… in the URL or an Authorization: Bearer header.
    const query = request.query as Record<string, string | undefined> | undefined;
    const urlToken = query?.token ?? '';
    const authHeader = (request.headers['authorization'] as string | undefined) ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const presented = urlToken || bearerToken;

    if (!presented || presented.length !== expectedToken.length ||
        !crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expectedToken))) {
      request.log.warn({ ip: request.ip }, 'Frame.io webhook auth failed');
      return reply.code(403).send({ error: 'Invalid token' });
    }

    // Optional HMAC verification (only if secret is configured).
    const optionalSecret = process.env.FRAMEIO_WEBHOOK_SECRET;
    if (optionalSecret) {
      const rawBody = (request as { rawBody?: string }).rawBody ?? '';
      const verified = verifyOptionalSignature({
        secret: optionalSecret,
        rawBody,
        headers: request.headers as Record<string, string | undefined>,
      });
      if (!verified) {
        request.log.warn('Frame.io webhook signature verification failed');
        return reply.code(403).send({ error: 'Invalid signature' });
      }
    }

    try {
      await ensureSchema();
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      request.log.error({ err }, 'Failed to ensure frameio_events schema');
      console.error('[frameio] ensureSchema failed:', msg);
      // Don't 5xx — Frame.io will retry forever. Better to ack and lose
      // visibility temporarily than hammer the DB. The error is echoed back
      // (token-gated endpoint, so this leaks nothing meaningful).
      return reply.code(200).send({ ok: true, persisted: false, reason: 'schema', detail: msg });
    }

    const payload = (request.body ?? {}) as FrameioPayload;
    const rawBody = (request as { rawBody?: string }).rawBody ?? JSON.stringify(payload);

    // Persist headers (lowercased keys) so we can later confirm Frame.io's
    // actual signing scheme. Strip the auth header to avoid logging the token.
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers)) {
      if (k.toLowerCase() === 'authorization') continue;
      if (Array.isArray(v)) headers[k] = v.join(', ');
      else if (v != null) headers[k] = String(v);
    }

    const eventId = pickEventId(payload);
    const eventType = pickEventType(payload);
    const resourceType = pickResourceType(payload);
    const resourceId = pickResourceId(payload);
    const accountId = payload.account?.id ?? payload.account_id ?? null;
    const workspaceId = payload.workspace?.id ?? payload.workspace_id ?? null;
    const projectId = payload.project?.id ?? payload.project_id ?? null;
    const receivedAt = new Date().toISOString();

    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO frameio_events
                (event_id, event_type, resource_type, resource_id, account_id,
                 workspace_id, project_id, payload, headers, received_at, processing_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
        args: [
          eventId,
          eventType,
          resourceType,
          resourceId,
          accountId,
          workspaceId,
          projectId,
          rawBody,
          JSON.stringify(headers),
          receivedAt,
        ],
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      request.log.error({ err, eventId, eventType }, 'Failed to insert frameio_event');
      console.error('[frameio] insert failed:', msg);
      // 200 anyway — we don't want Frame.io to retry indefinitely.
      return reply.code(200).send({ ok: true, persisted: false, reason: 'insert', detail: msg });
    }

    request.log.info(
      { eventId, eventType, resourceType, resourceId },
      'Frame.io event archived',
    );
    return reply.code(200).send({ ok: true });
  });
};
