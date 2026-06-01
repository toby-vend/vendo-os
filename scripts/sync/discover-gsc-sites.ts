/**
 * Google Search Console — property discovery.
 *
 * Lists EVERY Search Console property the authenticated Google account can
 * currently access (GSC `sites.list`), then proposes a mapping of each
 * property to a canonical client so we can populate client_account_map.
 *
 * Run: npm run discover:gsc
 *
 * Read-only against Google and the DB. Writes a proposed mapping to
 * data/gsc-site-map.proposed.json for review — it does NOT touch
 * client_account_map. Confirm/correct that file, then apply it with
 * npm run map:gsc (apply-gsc-map.ts).
 *
 * Requires the webmasters.readonly scope — re-run `npm run google-ads:auth`
 * if you authorised before that scope was added.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, initSchema, log, logError } from '../utils/db.js';
import { normaliseName } from '../matching/build-match-context.js';

const BASE_URL = 'https://www.googleapis.com/webmasters/v3';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const PROPOSAL_PATH = resolve(PROJECT_ROOT, 'data/gsc-site-map.proposed.json');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

let tokens: { access_token: string; refresh_token: string };
try {
  tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
} catch {
  logError('GSC', 'No tokens found — run: npm run google-ads:auth');
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('GSC', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

async function refreshAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  tokens.access_token = data.access_token;
  return data.access_token;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

async function listSites(): Promise<GscSite[]> {
  const accessToken = await refreshAccessToken();
  const res = await fetch(`${BASE_URL}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new Error(
        `GSC sites.list returned 403. The token is likely missing the ` +
          `webmasters.readonly scope — re-run: npm run google-ads:auth\n${body}`,
      );
    }
    throw new Error(`GSC sites.list error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return (data.siteEntry || []) as GscSite[];
}

/** Strip a GSC property URL down to a comparable lowercase alnum slug. */
function domainSlug(siteUrl: string): string {
  let host = siteUrl
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase();
  // Drop the public-suffix tail (co.uk, com, org, etc.) — keep the brand label(s).
  host = host.replace(/\.(co\.uk|org\.uk|ac\.uk|com|net|org|io|dental|clinic|uk|co)$/i, '');
  return host.replace(/[^a-z0-9]/g, '');
}

interface ClientRow {
  id: number;
  name: string;
}

function clientKey(name: string): string {
  return normaliseName(name).replace(/[^a-z0-9]/g, '');
}

/** Best-effort match of a property slug to a canonical client. */
function proposeClient(
  slug: string,
  clients: ClientRow[],
): { client: ClientRow; confidence: 'exact' | 'contains' | 'tokens' } | null {
  // 1. Exact slug equality.
  for (const c of clients) {
    if (clientKey(c.name) === slug) return { client: c, confidence: 'exact' };
  }
  // 2. One contains the other (e.g. "zenhouse" inside "zenhousedental").
  let best: { client: ClientRow; len: number } | null = null;
  for (const c of clients) {
    const key = clientKey(c.name);
    if (key.length < 4) continue;
    if (slug.includes(key) || key.includes(slug)) {
      const len = Math.min(slug.length, key.length);
      if (!best || len > best.len) best = { client: c, len };
    }
  }
  if (best) return { client: best.client, confidence: 'contains' };
  // 3. Token overlap — most client words (>2 chars) present in the slug.
  let tokenBest: { client: ClientRow; hits: number } | null = null;
  for (const c of clients) {
    const words = normaliseName(c.name).split(' ').filter(w => w.length > 2);
    if (words.length === 0) continue;
    const hits = words.filter(w => slug.includes(w)).length;
    if (hits >= 2 && (!tokenBest || hits > tokenBest.hits)) tokenBest = { client: c, hits };
  }
  if (tokenBest) return { client: tokenBest.client, confidence: 'tokens' };
  return null;
}

async function discover() {
  await initSchema();
  const db = await getDb();

  const sites = await listSites();
  if (sites.length === 0) {
    logError('GSC', 'No properties returned. The account has no Search Console access — add it as a user inside each client property first.');
    process.exit(1);
  }

  const res = db.exec("SELECT id, name FROM clients WHERE status = 'active' ORDER BY name");
  const clients: ClientRow[] = res.length && res[0].values.length
    ? res[0].values.map((r: unknown[]) => ({ id: r[0] as number, name: r[1] as string }))
    : [];

  log('GSC', `Discovered ${sites.length} Search Console propert${sites.length === 1 ? 'y' : 'ies'}:\n`);

  interface Proposal {
    siteUrl: string;
    permissionLevel: string;
    clientId: number | null;
    clientName: string | null;
    confidence: string;
  }
  const proposals: Proposal[] = [];
  const matchedClientIds = new Set<number>();

  for (const site of sites) {
    const slug = domainSlug(site.siteUrl);
    const match = proposeClient(slug, clients);
    if (match) matchedClientIds.add(match.client.id);
    proposals.push({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel,
      clientId: match?.client.id ?? null,
      clientName: match?.client.name ?? null,
      confidence: match?.confidence ?? 'none',
    });
    const tag = match ? `→ ${match.client.name} (${match.confidence})` : '→ UNMATCHED';
    log('GSC', `  ${site.siteUrl}  [${site.permissionLevel}]  ${tag}`);
  }

  const unmatchedProps = proposals.filter(p => !p.clientId);
  const gapClients = clients.filter(c => !matchedClientIds.has(c.id));

  log('GSC', '');
  log('GSC', `Matched: ${proposals.length - unmatchedProps.length}/${proposals.length} properties`);

  if (unmatchedProps.length) {
    log('GSC', `\nProperties with no confident client match (set "clientName" by hand in the proposal file):`);
    for (const p of unmatchedProps) log('GSC', `  ${p.siteUrl}`);
  }

  if (gapClients.length) {
    log('GSC', `\nClients with NO accessible property (grant ${process.env.GSC_GRANT_EMAIL || 'the connected Google account'} access in their Search Console):`);
    for (const c of gapClients) log('GSC', `  ${c.name}`);
  }

  writeFileSync(PROPOSAL_PATH, JSON.stringify(proposals, null, 2));
  log('GSC', `\nProposal written to ${PROPOSAL_PATH}`);
  log('GSC', 'Review/correct the clientName values, then run: npm run map:gsc');
}

discover().catch(err => {
  logError('GSC', 'Discovery failed', err);
  process.exit(1);
});
