/**
 * Boxly (EnquiryBox) lead payload — types + normalisation.
 *
 * Leads reach us via Zapier's "New Lead" trigger → "Webhooks by Zapier" POST.
 * The exact field NAMES in that POST depend on how each client's Zap is mapped
 * and on the custom fields configured in their Boxly account, so we extract
 * tolerantly: each logical field is pulled from a list of likely key variants
 * (case-insensitive, snake_case / spaced / camelCase). Capture one real payload
 * per client and, if needed, extend the candidate lists below.
 *
 * See plans/2026-05-31-boxly-integration.md §3.
 */

export type BoxlyChannel = 'google' | 'meta' | 'organic' | 'direct' | 'other';

/** Raw inbound body — arbitrary JSON object from Zapier. */
export type BoxlyRawPayload = Record<string, unknown>;

export interface BoxlyLead {
  boxlyLeadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  entryPointUrl: string | null;
  channel: BoxlyChannel;
  sourceLabel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  gclid: string | null;
  fbclid: string | null;
  box: string | null;
  stage: string | null;
  /** ISO string. Lead creation time if supplied, else the receipt time. */
  createdAt: string;
  /** Stable key for dedup within a client (Zapier retries, re-sends). */
  dedupKey: string;
}

/** Case-insensitive lookup across a list of candidate keys. Returns first non-empty string. */
function pick(obj: BoxlyRawPayload, candidates: string[]): string | null {
  // Build a lowercased key index once per call.
  const index = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) index.set(k.toLowerCase(), v);
  for (const cand of candidates) {
    const v = index.get(cand.toLowerCase());
    if (v == null) continue;
    const s = typeof v === 'string' ? v : String(v);
    const trimmed = s.trim();
    if (trimmed.length) return trimmed;
  }
  return null;
}

/** Parse a query-string value out of a URL (case-insensitive param name). */
function paramFromUrl(url: string | null, param: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams.entries()) {
      if (k.toLowerCase() === param.toLowerCase() && v.trim().length) return v.trim();
    }
    return null;
  } catch {
    // Not a parseable URL — fall back to a loose regex so we still catch
    // gclid/fbclid/utm embedded in a non-standard string.
    const m = new RegExp(`[?&]${param}=([^&\\s]+)`, 'i').exec(url);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

/**
 * Classify the acquisition channel. Precedence:
 *  1. gclid present            → google
 *  2. fbclid present           → meta
 *  3. utm_medium = paid + utm_source platform → google/meta
 *  4. utm_source platform name → google/meta
 *  5. utm_medium = organic     → organic
 *  6. any utm present          → other
 *  7. nothing                  → direct
 */
export function classifyChannel(opts: {
  gclid: string | null;
  fbclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  sourceLabel: string | null;
}): BoxlyChannel {
  if (opts.gclid) return 'google';
  if (opts.fbclid) return 'meta';

  const src = (opts.utmSource ?? '').toLowerCase();
  const med = (opts.utmMedium ?? '').toLowerCase();
  const label = (opts.sourceLabel ?? '').toLowerCase();

  const isGoogle = /google|adwords|gads/.test(src) || /google|adwords/.test(label);
  const isMeta = /facebook|instagram|meta|\bfb\b|\big\b/.test(src) || /facebook|instagram|meta/.test(label);
  const isPaid = /cpc|ppc|paid|paidsearch|paid_search|paidsocial|paid_social/.test(med);

  if (isPaid && isGoogle) return 'google';
  if (isPaid && isMeta) return 'meta';
  if (isGoogle) return 'google';
  if (isMeta) return 'meta';

  if (/organic|seo/.test(med) || /organic|seo/.test(label)) return 'organic';

  if (src || med || opts.sourceLabel) return 'other';
  return 'direct';
}

/** Build a stable dedup key: prefer Boxly's lead id, else email/phone+created. */
function buildDedupKey(parts: {
  boxlyLeadId: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}): string {
  if (parts.boxlyLeadId) return `id:${parts.boxlyLeadId}`;
  const who = (parts.email ?? parts.phone ?? 'anon').toLowerCase();
  return `${who}|${parts.createdAt}`;
}

/**
 * Normalise a raw Zapier/Boxly payload into a typed lead.
 * `receivedAt` is the ISO timestamp the webhook handler stamps on arrival.
 */
export function normaliseBoxlyLead(raw: BoxlyRawPayload, receivedAt: string): BoxlyLead {
  const boxlyLeadId = pick(raw, ['lead_id', 'leadId', 'id', 'boxly_lead_id', 'enquiry_id']);
  const nameFromParts = [pick(raw, ['first_name', 'firstName']), pick(raw, ['last_name', 'lastName'])]
    .filter(Boolean).join(' ').trim();
  const contactName = pick(raw, ['full_name', 'fullName', 'name', 'contact_name', 'first_name'])
    ?? (nameFromParts.length ? nameFromParts : null);
  const contactEmail = pick(raw, ['email', 'email_address', 'emailAddress', 'contact_email']);
  const contactPhone = pick(raw, ['phone', 'phone_number', 'phoneNumber', 'mobile', 'contact_phone', 'telephone']);
  const message = pick(raw, ['message', 'enquiry', 'note', 'notes', 'body', 'comments']);
  const box = pick(raw, ['box', 'box_name', 'boxName', 'pipeline']);
  const stage = pick(raw, ['stage', 'stage_name', 'stageName', 'status']);
  const sourceLabel = pick(raw, ['lead_source', 'leadSource', 'source', 'channel', 'source_label']);

  const entryPointUrl = pick(raw, [
    'entry_point_url', 'entryPointUrl', 'entry_point', 'entryPoint',
    'submission_url', 'submissionUrl', 'url', 'page_url', 'pageUrl', 'referrer',
  ]);

  // UTM / click ids: prefer an explicit field, else parse from the entry URL.
  const utmSource = pick(raw, ['utm_source', 'utmSource']) ?? paramFromUrl(entryPointUrl, 'utm_source');
  const utmMedium = pick(raw, ['utm_medium', 'utmMedium']) ?? paramFromUrl(entryPointUrl, 'utm_medium');
  const utmCampaign = pick(raw, ['utm_campaign', 'utmCampaign']) ?? paramFromUrl(entryPointUrl, 'utm_campaign');
  const gclid = pick(raw, ['gclid']) ?? paramFromUrl(entryPointUrl, 'gclid');
  const fbclid = pick(raw, ['fbclid']) ?? paramFromUrl(entryPointUrl, 'fbclid');

  const channel = classifyChannel({ gclid, fbclid, utmSource, utmMedium, sourceLabel });

  const createdAtRaw = pick(raw, ['created_at', 'createdAt', 'created', 'timestamp', 'date', 'received_at']);
  const createdAt = normaliseTimestamp(createdAtRaw) ?? receivedAt;

  const dedupKey = buildDedupKey({ boxlyLeadId, email: contactEmail, phone: contactPhone, createdAt });

  return {
    boxlyLeadId, contactName, contactEmail, contactPhone, message,
    entryPointUrl, channel, sourceLabel,
    utmSource, utmMedium, utmCampaign, gclid, fbclid,
    box, stage, createdAt, dedupKey,
  };
}

/** Best-effort ISO normalisation; returns null if unparseable. */
function normaliseTimestamp(value: string | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}
