/**
 * Slack request signing — shared helpers for inbound endpoints.
 *
 * Slack signs every request to your app with HMAC-SHA256 over
 * `v0:<timestamp>:<raw-body>`. The signature lands in
 * `X-Slack-Signature` and the timestamp in `X-Slack-Request-Timestamp`.
 *
 * Used by:
 *   - api/slack/events.ts        (Vercel-direct, raw bytes from req)
 *   - api/slack/commands.ts      (Vercel-direct, raw bytes from req)
 *   - web/routes/slack-interact.ts (Fastify, raw body via app.addContentTypeParser)
 *
 * Reject if the timestamp is older than 5 minutes (replay protection) or
 * the signature doesn't match a fresh recomputation.
 */
import crypto from 'crypto';
import type { IncomingMessage } from 'http';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface VerifySlackInput {
  signingSecret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
  /** Override the current time for testing. Seconds since epoch. */
  now?: number;
}

/**
 * Verify a Slack request signature. Returns true iff the signature is valid
 * AND the timestamp is within the tolerance window. Does not throw.
 */
export function verifySlackSignature(input: VerifySlackInput): boolean {
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;
  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const expected = 'v0=' + crypto.createHmac('sha256', input.signingSecret).update(base).digest('hex');
  return timingSafeEqualStr(expected, input.signature);
}

/**
 * Read the raw request body as a UTF-8 string. Vercel's @vercel/node
 * handlers have already pre-parsed `req.body` for known content types,
 * which destroys the bytes Slack signed over. We have to consume the
 * raw stream ourselves before any parser touches it. Call this *before*
 * reading req.body — the parsed body is no longer needed once we have
 * the raw text.
 *
 * Slack sends `application/json` for events/interactivity payloads and
 * `application/x-www-form-urlencoded` for slash commands. Both arrive as
 * a UTF-8 string here.
 */
export async function readRawBody(req: IncomingMessage): Promise<string> {
  // If the upstream framework has already buffered the body and assigned
  // it to req.rawBody (Fastify with the body parser configured this way
  // does), use that.
  const preBuffered = (req as unknown as { rawBody?: string | Buffer }).rawBody;
  if (typeof preBuffered === 'string') return preBuffered;
  if (Buffer.isBuffer(preBuffered)) return preBuffered.toString('utf-8');

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Convenience for slash-command bodies: parse the urlencoded text into a
 * flat record. Slack's slash command POST is always
 * `application/x-www-form-urlencoded`.
 */
export function parseSlackForm(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}
