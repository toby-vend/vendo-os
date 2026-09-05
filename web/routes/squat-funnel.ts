import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';

/**
 * Squat Success book funnel → GoHighLevel
 *
 * Two public endpoints used by the Squat Success Shopify theme
 * (toby-vend/squat-success-shopify) and the Shopify store's order webhook:
 *
 *   POST /api/squat/claim?token=<SQUAT_CLAIM_TOKEN>
 *     Called by the "Where shall we post your copy?" modal, just before the
 *     buyer is sent to the pre-filled checkout. Upserts the GHL contact and
 *     creates an opportunity in the "Book Interest Pipeline" at stage "Lead".
 *
 *   POST /api/squat/shopify-order
 *     Shopify "Order creation" webhook (HMAC-verified). Upserts the contact from
 *     the order, moves their opportunity to "Book Received" (creating one if the
 *     form was skipped) and adds the `book received` tag that the client's
 *     nurture/fulfilment sequences key off.
 *
 * Env vars:
 *   GHL_SQUAT_TOKEN                 Private Integration token for the Squat Success sub-account
 *   GHL_SQUAT_LOCATION_ID           defaults to wkKBHG1GWvDSMTiNKVSO
 *   SQUAT_CLAIM_TOKEN               shared token in the theme's webhook URL (anti-spam)
 *   SQUAT_SHOPIFY_WEBHOOK_SECRET    Shopify webhook signing secret
 *   SQUAT_PIPELINE_NAME             defaults to "Book Interest Pipeline"
 *
 * Every call is archived to `squat_funnel_events` so failures can be replayed.
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const LOCATION_ID = process.env.GHL_SQUAT_LOCATION_ID || 'wkKBHG1GWvDSMTiNKVSO';
const PIPELINE_NAME = process.env.SQUAT_PIPELINE_NAME || 'Book Interest Pipeline';
const STAGE_LEAD = 'Lead';
const STAGE_RECEIVED = 'Book Received';
const TAG_FORM = 'book-form-started';
const TAG_RECEIVED = 'book received';
const ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)?squatsuccess\.co\.uk$/i,
  /^https:\/\/([a-z0-9-]+\.)?squatsuccess\.com$/i,
  /^https:\/\/[a-z0-9-]+\.myshopify\.com$/i,
];

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let schemaEnsured = false;
async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`CREATE TABLE IF NOT EXISTS squat_funnel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    email TEXT,
    external_id TEXT,
    payload TEXT NOT NULL,
    result TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    error TEXT,
    received_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_squat_funnel_received ON squat_funnel_events(received_at)`);
  schemaEnsured = true;
}

async function logEvent(kind: string, email: string | null, externalId: string | null, payload: unknown): Promise<number> {
  await ensureSchema();
  const r = await db.execute({
    sql: `INSERT INTO squat_funnel_events (kind, email, external_id, payload, received_at) VALUES (?, ?, ?, ?, ?)`,
    args: [kind, email, externalId, JSON.stringify(payload).slice(0, 60000), new Date().toISOString()],
  });
  return Number(r.lastInsertRowid ?? 0);
}

async function finishEvent(id: number, status: 'ok' | 'error', result?: unknown, error?: string): Promise<void> {
  if (!id) return;
  await db.execute({
    sql: `UPDATE squat_funnel_events SET status = ?, result = ?, error = ? WHERE id = ?`,
    args: [status, result ? JSON.stringify(result).slice(0, 4000) : null, error ?? null, id],
  });
}

// ---------------------------------------------------------------------------
// GHL client
// ---------------------------------------------------------------------------

function ghlHeaders(): Record<string, string> {
  const token = process.env.GHL_SQUAT_TOKEN;
  if (!token) throw new Error('GHL_SQUAT_TOKEN not configured');
  return { Authorization: `Bearer ${token}`, Version: GHL_VERSION, 'Content-Type': 'application/json', Accept: 'application/json' };
}

async function ghl<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${GHL_BASE}${path}`, { method, headers: ghlHeaders(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(`GHL ${method} ${path} → ${res.status}: ${(json && (json.message || json.error)) || text.slice(0, 200)}`);
  return json as T;
}

interface Stage { id: string; name: string }
interface Pipeline { id: string; name: string; stages: Stage[] }

let pipelineCache: { at: number; pipelines: Pipeline[] } | null = null;
async function getPipeline(): Promise<Pipeline> {
  if (!pipelineCache || Date.now() - pipelineCache.at > 10 * 60 * 1000) {
    const data = await ghl<{ pipelines: Pipeline[] }>('GET', `/opportunities/pipelines?locationId=${LOCATION_ID}`);
    pipelineCache = { at: Date.now(), pipelines: data.pipelines || [] };
  }
  const p = pipelineCache.pipelines.find((x) => x.name.trim().toLowerCase() === PIPELINE_NAME.toLowerCase());
  if (!p) throw new Error(`Pipeline "${PIPELINE_NAME}" not found in location ${LOCATION_ID}`);
  return p;
}

function stageId(p: Pipeline, name: string): string {
  const s = p.stages.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
  if (!s) throw new Error(`Stage "${name}" not found in pipeline "${p.name}"`);
  return s.id;
}

interface Attribution {
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string;
  gclid?: string; fbclid?: string; landing_page?: string; referrer?: string;
}
const ATTR_KEYS: Array<keyof Attribution> = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'landing_page', 'referrer'];

interface ContactInput {
  email: string; firstName: string; lastName: string; phone?: string;
  address1?: string; city?: string; postalCode?: string; source: string; tags: string[];
  attribution?: Attribution;
}

/**
 * Channel label for the Source field on the contact and opportunity.
 * GHL sources are channel-only in Vendo reporting ("Paid Social", not "fb_ads / cpc / campaign");
 * the raw UTMs live in the contact's custom fields.
 */
function sourceLabel(a: Attribution | undefined, fallback: string): string {
  if (!a) return fallback;
  const src = (a.utm_source || '').toLowerCase().trim();
  const med = (a.utm_medium || '').toLowerCase().trim();
  const paidMedium = /^(paid|cpc|ppc|paid[-_ ]?social|paidsocial|social[-_ ]?paid|ads?|display)$/.test(med);
  if (/^(fb[-_ ]?ads?|facebook|fb|meta|meta[-_ ]?ads?|instagram|ig|ig[-_ ]?ads?|tiktok|linkedin)$/.test(src) || a.fbclid) return 'Paid Social';
  if (/^(google|google[-_ ]?ads?|gads|adwords|bing|microsoft)$/.test(src) || a.gclid) return 'Paid Search';
  if (/^(email|newsletter|ghl|gohighlevel|mailchimp|klaviyo)$/.test(src) || med === 'email') return 'Email';
  if (/^(youtube|yt)$/.test(src)) return 'YouTube';
  if (paidMedium && src) return 'Paid Social';
  if (src) return src.charAt(0).toUpperCase() + src.slice(1).slice(0, 40);
  return fallback;
}

/** Contact custom fields for attribution, created on first use (needs locations/customFields.write).
 *  GHL reserves some names as standard fields (e.g. "gclid"), so click ids get their own names. */
const ATTR_FIELD_NAME: Record<keyof Attribution, string> = {
  utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', utm_content: 'utm_content', utm_term: 'utm_term',
  gclid: 'gclid_click_id', fbclid: 'fbclid_click_id', landing_page: 'landing_page', referrer: 'referrer',
};
let customFieldCache: { at: number; byKey: Partial<Record<keyof Attribution, string>> } | null = null;
async function attributionFieldIds(): Promise<Partial<Record<keyof Attribution, string>>> {
  if (customFieldCache && Date.now() - customFieldCache.at < 60 * 60 * 1000) return customFieldCache.byKey;
  const byKey: Partial<Record<keyof Attribution, string>> = {};
  try {
    const data = await ghl<{ customFields: Array<{ id: string; name: string; fieldKey?: string }> }>('GET', `/locations/${LOCATION_ID}/customFields?model=contact`);
    const existing: Record<string, string> = {};
    for (const f of data.customFields || []) {
      const key = String(f.fieldKey || '').replace(/^contact\./, '').toLowerCase() || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      existing[key] = f.id;
    }
    for (const k of ATTR_KEYS) {
      const name = ATTR_FIELD_NAME[k];
      if (existing[name]) { byKey[k] = existing[name]; continue; }
      try {
        const created = await ghl<{ customField: { id: string } }>('POST', `/locations/${LOCATION_ID}/customFields`, { name, dataType: 'TEXT', model: 'contact' });
        byKey[k] = created.customField.id;
      } catch (err) {
        console.warn(`[squat] could not create custom field ${name}:`, (err as Error).message);
      }
    }
    customFieldCache = { at: Date.now(), byKey };
  } catch (err) {
    console.warn('[squat] attribution custom fields unavailable:', (err as Error).message);
  }
  return byKey;
}

async function upsertContact(c: ContactInput): Promise<string> {
  const body: Record<string, unknown> = {
    locationId: LOCATION_ID,
    email: c.email,
    firstName: c.firstName || undefined,
    lastName: c.lastName || undefined,
    phone: c.phone || undefined,
    address1: c.address1 || undefined,
    city: c.city || undefined,
    postalCode: c.postalCode || undefined,
    country: 'GB',
    source: c.source,
  };
  const attr = c.attribution;
  if (attr && ATTR_KEYS.some((k) => attr[k])) {
    const ids = await attributionFieldIds();
    const cf = ATTR_KEYS.filter((k) => attr[k] && ids[k]).map((k) => ({ id: ids[k] as string, value: String(attr[k]).slice(0, 250) }));
    if (cf.length) body.customFields = cf;
  }
  const data = await ghl<{ contact: { id: string } }>('POST', '/contacts/upsert', body);
  const id = data?.contact?.id;
  if (!id) throw new Error('GHL upsert returned no contact id');
  // Tags are added separately: passing them to upsert REPLACES the contact's tags.
  await ghl('POST', `/contacts/${id}/tags`, { tags: c.tags });
  return id;
}

interface Opportunity { id: string; pipelineStageId: string; status: string; name?: string }

async function searchOpportunity(contactId: string, pipelineId: string): Promise<Opportunity | null> {
  const data = await ghl<{ opportunities: Opportunity[] }>(
    'GET', `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&contact_id=${contactId}&limit=20`,
  );
  const list = data.opportunities || [];
  return list.find((o) => o.status === 'open') || list[0] || null;
}

async function getOpportunity(id: string): Promise<Opportunity | null> {
  try {
    const data = await ghl<{ opportunity: Opportunity & { pipelineId?: string; contactId?: string; contact?: { id: string } } }>('GET', `/opportunities/${id}`);
    return data.opportunity || null;
  } catch { return null; }
}

/**
 * GHL's opportunity search is index-backed and lags a few seconds behind writes —
 * exactly the window between "form submitted" and "order placed". So: first try the
 * id we recorded for this email, then the search, then (if a create is refused as a
 * duplicate) retry the search with back-off.
 */
async function findOpportunity(contactId: string, pipelineId: string, email: string | null): Promise<Opportunity | null> {
  if (email) {
    try {
      await ensureSchema();
      const r = await db.execute({
        sql: `SELECT result FROM squat_funnel_events WHERE email = ? AND status = 'ok' AND result IS NOT NULL ORDER BY id DESC LIMIT 5`,
        args: [email],
      });
      for (const row of r.rows as unknown as Array<{ result: string }>) {
        const parsed = JSON.parse(String(row.result)) as { opportunityId?: string };
        if (!parsed.opportunityId) continue;
        const opp = await getOpportunity(parsed.opportunityId);
        if (opp && opp.status === 'open') return opp;
      }
    } catch { /* fall through to search */ }
  }
  return searchOpportunity(contactId, pipelineId);
}

async function findOpportunityWithRetry(contactId: string, pipelineId: string, email: string | null): Promise<Opportunity | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    const opp = await findOpportunity(contactId, pipelineId, email);
    if (opp) return opp;
  }
  return null;
}

async function createOpportunity(contactId: string, pipeline: Pipeline, stage: string, name: string, value: number, source: string): Promise<Opportunity> {
  const data = await ghl<{ opportunity: Opportunity }>('POST', '/opportunities/', {
    pipelineId: pipeline.id,
    locationId: LOCATION_ID,
    name,
    pipelineStageId: stageId(pipeline, stage),
    status: 'open',
    contactId,
    monetaryValue: value,
    source,
  });
  return data.opportunity;
}

async function moveOpportunity(id: string, pipeline: Pipeline, stage: string): Promise<void> {
  await ghl('PUT', `/opportunities/${id}`, { pipelineStageId: stageId(pipeline, stage), status: 'open' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(v: unknown, max = 200): string { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function isEmail(v: string): boolean { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function corsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  return ALLOWED_ORIGINS.some((re) => re.test(origin)) ? origin : null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const squatFunnelRoutes: FastifyPluginAsync = async (app) => {
  // Keep the raw JSON body (Shopify HMAC is computed over the exact bytes).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as unknown as { rawBody?: string }).rawBody = String(body);
    try { done(null, body ? JSON.parse(String(body)) : {}); } catch (err) { done(err as Error, undefined); }
  });
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
    (req as unknown as { rawBody?: string }).rawBody = String(body);
    try { done(null, body ? JSON.parse(String(body)) : {}); } catch { done(null, {}); }
  });

  // --- Claim form ---------------------------------------------------------
  app.options('/claim', async (request, reply) => {
    const origin = corsOrigin(request.headers.origin as string | undefined);
    if (!origin) return reply.code(403).send();
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.header('Access-Control-Max-Age', '86400');
    return reply.code(204).send();
  });

  app.post('/claim', async (request, reply) => {
    const origin = corsOrigin(request.headers.origin as string | undefined);
    if (origin) reply.header('Access-Control-Allow-Origin', origin);

    const expected = process.env.SQUAT_CLAIM_TOKEN || '';
    const query = (request.query || {}) as Record<string, string | undefined>;
    if (!expected || !safeEqual(query.token || '', expected)) {
      return reply.code(403).send({ error: 'Invalid token' });
    }

    const b = (request.body || {}) as Record<string, unknown>;
    const email = str(b.email).toLowerCase();
    if (!isEmail(email)) return reply.code(400).send({ error: 'Valid email required' });

    const first = str(b.first_name, 80);
    const last = str(b.last_name, 80);
    const contactInput: ContactInput = {
      email,
      firstName: first || str(b.full_name, 80).split(/\s+/)[0] || '',
      lastName: last,
      phone: str(b.phone, 40),
      address1: str(b.address1, 60),
      city: str(b.city, 60),
      postalCode: str(b.postal_code, 12).toUpperCase(),
      source: 'book.squatsuccess.co.uk',
      tags: [TAG_FORM],
    };
    const attribution: Attribution = {};
    for (const k of ATTR_KEYS) { const v = str(b[k], 500); if (v) attribution[k] = v; }
    contactInput.source = sourceLabel(attribution, 'Website');
    contactInput.attribution = attribution;

    const eventId = await logEvent('claim', email, null, b).catch(() => 0);
    try {
      const pipeline = await getPipeline();
      const contactId = await upsertContact(contactInput);
      let opp = await findOpportunity(contactId, pipeline.id, email);
      let created = false;
      if (!opp) {
        const name = [contactInput.firstName, contactInput.lastName].filter(Boolean).join(' ') || email;
        try {
          opp = await createOpportunity(contactId, pipeline, STAGE_LEAD, name, 4.95, contactInput.source);
          created = true;
        } catch (err) {
          if (!/duplicate/i.test((err as Error).message)) throw err;
          opp = await findOpportunityWithRetry(contactId, pipeline.id, email);
          if (!opp) throw err;
        }
      }
      const result = { contactId, opportunityId: opp.id, created };
      await finishEvent(eventId, 'ok', result);
      request.log.info(result, 'squat claim → GHL');
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = (err as Error).message;
      await finishEvent(eventId, 'error', undefined, msg);
      request.log.error({ err: msg }, 'squat claim → GHL failed');
      return reply.code(502).send({ ok: false, error: msg });
    }
  });

  // --- Shopify order webhook ----------------------------------------------
  app.post('/shopify-order', async (request, reply) => {
    const secret = process.env.SQUAT_SHOPIFY_WEBHOOK_SECRET || '';
    const raw = (request as unknown as { rawBody?: string }).rawBody || '';
    const sig = (request.headers['x-shopify-hmac-sha256'] as string | undefined) || '';
    if (!secret) return reply.code(500).send({ error: 'Webhook secret not configured' });
    const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
    if (!safeEqual(digest, sig)) {
      request.log.warn({ ip: request.ip }, 'Shopify webhook HMAC mismatch');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const order = (request.body || {}) as Record<string, any>;
    const email = str(order.email || order.contact_email || order.customer?.email).toLowerCase();
    const ship = order.shipping_address || order.billing_address || {};
    const orderId = String(order.id ?? '');
    const orderName = str(order.name) || orderId;

    const eventId = await logEvent('shopify-order', email || null, orderId || null, order).catch(() => 0);

    // Always acknowledge fast; Shopify retries on non-2xx for up to 48h, which
    // is what we want if GHL is down, so return 502 only on real failure.
    if (!isEmail(email)) {
      await finishEvent(eventId, 'error', undefined, 'order has no email');
      return reply.code(200).send({ ok: false, skipped: 'no email' });
    }

    const contactInput: ContactInput = {
      email,
      firstName: str(ship.first_name || order.customer?.first_name, 80),
      lastName: str(ship.last_name || order.customer?.last_name, 80),
      phone: str(ship.phone || order.phone || order.customer?.phone, 40),
      address1: str(ship.address1, 60),
      city: str(ship.city, 60),
      postalCode: str(ship.zip, 12).toUpperCase(),
      source: 'shopify-order',
      tags: [TAG_RECEIVED],
    };
    {
      const attribution: Attribution = {};
      const landing = str(order.landing_site, 500);
      if (landing) {
        attribution.landing_page = landing;
        try {
          const qs = new URL(landing, 'https://book.squatsuccess.co.uk').searchParams;
          for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'] as const) {
            const v = qs.get(k); if (v) attribution[k] = v.slice(0, 250);
          }
        } catch { /* ignore */ }
      }
      const ref = str(order.referring_site, 500); if (ref) attribution.referrer = ref;
      for (const na of (order.note_attributes || []) as Array<{ name: string; value: string }>) {
        const k = String(na.name || '').toLowerCase(); if ((ATTR_KEYS as string[]).includes(k) && na.value) (attribution as any)[k] = String(na.value).slice(0, 250);
      }
      contactInput.attribution = attribution;
      contactInput.source = sourceLabel(attribution, 'Website');
    }

    try {
      const pipeline = await getPipeline();
      const contactId = await upsertContact(contactInput);
      let opp = await findOpportunity(contactId, pipeline.id, email);
      let created = false;
      if (!opp) {
        const name = [contactInput.firstName, contactInput.lastName].filter(Boolean).join(' ') || email;
        try {
          opp = await createOpportunity(contactId, pipeline, STAGE_RECEIVED, name, Number(order.total_price) || 4.95, contactInput.source);
          created = true;
        } catch (err) {
          if (!/duplicate/i.test((err as Error).message)) throw err;
          opp = await findOpportunityWithRetry(contactId, pipeline.id, email);
          if (!opp) throw err;
        }
      }
      if (!created) await moveOpportunity(opp.id, pipeline, STAGE_RECEIVED);
      const result = { contactId, opportunityId: opp.id, created, order: orderName };
      await finishEvent(eventId, 'ok', result);
      request.log.info(result, 'squat order → GHL');
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const msg = (err as Error).message;
      await finishEvent(eventId, 'error', undefined, msg);
      request.log.error({ err: msg, order: orderName }, 'squat order → GHL failed');
      return reply.code(502).send({ ok: false, error: msg });
    }
  });

  // --- Health ---------------------------------------------------------------
  app.get('/health', async (_request, reply) => {
    const configured = {
      ghlToken: Boolean(process.env.GHL_SQUAT_TOKEN),
      claimToken: Boolean(process.env.SQUAT_CLAIM_TOKEN),
      shopifySecret: Boolean(process.env.SQUAT_SHOPIFY_WEBHOOK_SECRET),
      locationId: LOCATION_ID,
      pipeline: PIPELINE_NAME,
    };
    let pipelineOk: string | null = null;
    if (configured.ghlToken) {
      try { const p = await getPipeline(); pipelineOk = `${p.name}: ${p.stages.map((s) => s.name).join(' → ')}`; }
      catch (err) { pipelineOk = `error: ${(err as Error).message}`; }
    }
    return reply.send({ ok: true, configured, pipelineOk });
  });
};
