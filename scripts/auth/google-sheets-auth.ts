/**
 * Google Sheets OAuth 2.0 authorisation flow.
 *
 * Run: npm run sheets:auth
 *
 * Deliberately separate from scripts/auth/google-ads-auth.ts. Re-running the
 * Ads flow with an extra scope would force a re-consent on the token the
 * Google Ads and Search Console syncs depend on; minting a second token for
 * the Sheets scope alone keeps those untouched.
 *
 * Uses the same OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) and
 * the same loopback redirect as the Ads flow. That client is a Web client,
 * so the redirect URI must match one registered in the Google Cloud console
 * exactly — see the PORT constant below.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer } from 'http';
import { URL } from 'url';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { log, logError } from '../utils/db.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('SHEETS', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
// Read + write on spreadsheets the account can already reach. Deliberately
// not drive.file — the deliverables sheet already exists and is shared with
// this account, so no Drive-level access is needed to open or edit it.
const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

// Must be 3457. GOOGLE_CLIENT_ID is a Web OAuth client, not a Desktop one,
// so Google only accepts redirect URIs registered against it — and
// http://localhost:3457/callback is the only loopback URI registered (it is
// what scripts/auth/google-ads-auth.ts uses). Any other port fails with
// "Error 400: redirect_uri_mismatch". The two flows are never run at once.
const PORT = 3457;
const TOKEN_PATH = '.secrets/google-sheets-tokens.json';

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
    logError('SHEETS', `Authorisation denied: ${error}`);
    shutdown(1);
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch</h1><p>Possible CSRF attack. Try again.</p>');
    logError('SHEETS', 'State mismatch — aborting');
    shutdown(1);
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>No authorisation code received</h1>');
    shutdown(1);
    return;
  }

  try {
    log('SHEETS', 'Exchanging code for tokens...');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: `http://localhost:${PORT}/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
    }

    const tokens = (await tokenRes.json()) as { refresh_token?: string };

    mkdirSync('.secrets', { recursive: true });
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;">
          <h1>Google Sheets connected</h1>
          <p>Token saved. You can close this tab.</p>
        </body>
      </html>
    `);

    log('SHEETS', '');
    log('SHEETS', `Authorisation complete — tokens saved to ${TOKEN_PATH}`);
    if (tokens.refresh_token) {
      log('SHEETS', 'Add this to .env.local and Vercel as GOOGLE_SHEETS_REFRESH_TOKEN:');
      log('SHEETS', '');
      log('SHEETS', `  ${tokens.refresh_token}`);
      log('SHEETS', '');
    } else {
      logError('SHEETS', 'No refresh token returned — re-run (prompt=consent is already set)');
    }
    shutdown(tokens.refresh_token ? 0 : 1);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${err instanceof Error ? err.message : err}</p>`);
    logError('SHEETS', 'Token exchange failed', err);
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
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', `http://localhost:${PORT}/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  log('SHEETS', 'Starting authorisation flow...');
  log('SHEETS', `Listening on port ${PORT}`);
  log('SHEETS', 'Opening browser — sign in as toby@vendodigital.co.uk');

  exec(`open "${authUrl.toString()}"`);
});

setTimeout(() => {
  logError('SHEETS', 'Timed out waiting for authorisation (2 min)');
  shutdown(1);
}, 120_000);
