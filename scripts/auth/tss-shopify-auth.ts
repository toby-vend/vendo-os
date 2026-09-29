/**
 * Sword Stall (TSS) Shopify OAuth authorisation flow.
 *
 * Run: npm run tss-shopify:auth
 *
 * Opens the Shopify install/grant screen, captures the callback, verifies
 * the HMAC and stores the offline access token in .secrets/tss-shopify-token.json.
 *
 * The app's allowed redirection URLs must include http://localhost:3456/callback.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer } from 'http';
import { URL } from 'url';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { exec } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { log, logError } from '../utils/db.js';

const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SHOP = process.env.TSS_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.TSS_SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.TSS_SHOPIFY_CLIENT_SECRET;
const TOKEN_PATH = '.secrets/tss-shopify-token.json';

// Read-only reporting scopes
const SCOPES = [
  'read_orders',
  'read_products',
  'read_customers',
  'read_inventory',
  'read_analytics',
  'read_reports',
  'read_marketing_events',
].join(',');

if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
  logError('TSS-SHOPIFY', 'TSS_SHOPIFY_STORE_DOMAIN, TSS_SHOPIFY_CLIENT_ID and TSS_SHOPIFY_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl =
  `https://${SHOP}/admin/oauth/authorize?` +
  new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES, redirect_uri: REDIRECT_URI, state }).toString();

function validHmac(params: URLSearchParams): boolean {
  const hmac = params.get('hmac');
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const digest = createHmac('sha256', CLIENT_SECRET!).update(message).digest('hex');
  return digest.length === hmac.length && timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

function page(title: string, body = ''): string {
  return `<html><body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;"><h1>${title}</h1>${body}</body></html>`;
}

log('TSS-SHOPIFY', 'Starting authorisation flow...');
log('TSS-SHOPIFY', `Redirect URI: ${REDIRECT_URI}`);

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const params = url.searchParams;
  const code = params.get('code');
  const shop = params.get('shop');

  if (params.get('state') !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(page('State mismatch', '<p>Try again.</p>'));
    logError('TSS-SHOPIFY', 'State mismatch — aborting');
    shutdown(1);
    return;
  }

  if (!validHmac(params) || shop !== SHOP || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(page('Invalid callback'));
    logError('TSS-SHOPIFY', `Invalid callback (hmac/shop/code check failed, shop=${shop})`);
    shutdown(1);
    return;
  }

  try {
    log('TSS-SHOPIFY', 'Exchanging code for access token...');
    const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    });
    if (!tokenRes.ok) throw new Error(`${tokenRes.status} ${await tokenRes.text()}`);
    const data = (await tokenRes.json()) as { access_token: string; scope: string };

    mkdirSync('.secrets', { recursive: true });
    writeFileSync(
      TOKEN_PATH,
      JSON.stringify({ shop: SHOP, access_token: data.access_token, scope: data.scope, created_at: new Date().toISOString() }, null, 2),
    );

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Sword Stall Shopify connected', `<p>Token saved. You can close this tab.</p><p style="color: #666; font-size: 14px;">Scopes: ${data.scope}</p>`));
    log('TSS-SHOPIFY', `Authorisation complete — token saved to ${TOKEN_PATH} (scopes: ${data.scope})`);
    shutdown(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(page('Token exchange failed', `<p>${err instanceof Error ? err.message : err}</p>`));
    logError('TSS-SHOPIFY', 'Token exchange failed', err);
    shutdown(1);
  }
});

function shutdown(code: number) {
  setTimeout(() => {
    server.close();
    process.exit(code);
  }, 500);
}

server.listen(PORT, () => {
  log('TSS-SHOPIFY', `Listening on port ${PORT}`);
  log('TSS-SHOPIFY', 'Opening browser...');
  exec(`open "${authUrl}"`);
});

// Timeout after 5 minutes
setTimeout(() => {
  logError('TSS-SHOPIFY', 'Timed out waiting for authorisation (5 min)');
  shutdown(1);
}, 300_000);
