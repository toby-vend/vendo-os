/**
 * Google Ads OAuth 2.0 authorisation flow (Desktop client).
 *
 * Run: npm run google-ads:auth
 *
 * Uses the loopback redirect (http://localhost) which Desktop-type
 * OAuth clients support without needing to register redirect URIs.
 * Opens a browser, captures the callback, saves the refresh token.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer } from 'http';
import { URL } from 'url';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { log, logError } from '../utils/db.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('GADS', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const scopes = ['https://www.googleapis.com/auth/adwords'];

// Desktop clients use the loopback redirect — bind to an available port
const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (!code && !error) {
    res.writeHead(200);
    res.end('Waiting for callback...');
    return;
  }

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorisation failed</h1><p>${error}</p>`);
    logError('GADS', `Authorisation denied: ${error}`);
    shutdown(1);
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch</h1><p>Possible CSRF attack. Try again.</p>');
    logError('GADS', 'State mismatch — aborting');
    shutdown(1);
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>No authorisation code received</h1>');
    shutdown(1);
    return;
  }

  const redirectUri = `http://localhost:${PORT}/callback`;

  try {
    log('GADS', 'Exchanging code for tokens...');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
    }

    const tokens = await tokenRes.json();

    mkdirSync('.secrets', { recursive: true });
    writeFileSync('.secrets/google-ads-tokens.json', JSON.stringify(tokens, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;">
          <h1>Google Ads connected</h1>
          <p>Tokens saved. You can close this tab.</p>
        </body>
      </html>
    `);

    log('GADS', '');
    log('GADS', 'Authorisation complete — tokens saved to .secrets/google-ads-tokens.json');
    log('GADS', `Refresh token: ${tokens.refresh_token ? 'YES' : 'NO (re-run with prompt=consent)'}`);
    shutdown(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${err instanceof Error ? err.message : err}</p>`);
    logError('GADS', 'Token exchange failed', err);
    shutdown(1);
  }
});

function shutdown(code: number) {
  setTimeout(() => {
    server.close();
    process.exit(code);
  }, 500);
}

const PORT = 3457;
server.listen(PORT, () => {
  const redirectUri = `http://localhost:${PORT}/callback`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  log('GADS', 'Starting authorisation flow...');
  log('GADS', `Listening on port ${PORT}`);
  log('GADS', 'Opening browser...');

  exec(`open "${authUrl.toString()}"`);
});

// Timeout after 2 minutes
setTimeout(() => {
  logError('GADS', 'Timed out waiting for authorisation (2 min)');
  shutdown(1);
}, 120_000);
