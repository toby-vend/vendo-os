/**
 * Google Drive OAuth 2.0 authorisation flow (upload scope).
 *
 * Run: npm run drive:auth
 *
 * Separate from the Sheets and Ads flows for the same reason those are separate
 * from each other: re-consenting an existing token with an extra scope forces a
 * re-consent on the syncs that depend on it. This mints a third token for the
 * Drive scope alone.
 *
 * Scope is drive.file, not drive. That grants access only to files this client
 * creates, which is all the creative uploads need, and leaves the rest of the
 * account's Drive untouched. The pre-existing .gdrive-server-credentials.json
 * (drive.readonly, used by the gdrive MCP server) is left alone.
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
  logError('DRIVE', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const scopes = ['https://www.googleapis.com/auth/drive.file'];

// Must be 3457. GOOGLE_CLIENT_ID is a Web OAuth client, so Google only accepts
// redirect URIs registered against it, and http://localhost:3457/callback is
// the only loopback URI registered. Any other port fails with
// "Error 400: redirect_uri_mismatch". No two auth flows are ever run at once.
const PORT = 3457;
const TOKEN_PATH = '.secrets/google-drive-tokens.json';

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
    logError('DRIVE', `Authorisation denied: ${error}`);
    shutdown(1);
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch</h1><p>Possible CSRF attack. Try again.</p>');
    logError('DRIVE', 'State mismatch — aborting');
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
    log('DRIVE', 'Exchanging code for tokens...');

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
          <h1>Google Drive connected</h1>
          <p>Token saved. You can close this tab.</p>
        </body>
      </html>
    `);

    log('DRIVE', '');
    log('DRIVE', `Authorisation complete — tokens saved to ${TOKEN_PATH}`);
    if (!tokens.refresh_token) {
      logError('DRIVE', 'No refresh token returned — re-run (prompt=consent is already set)');
    }
    shutdown(tokens.refresh_token ? 0 : 1);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${err instanceof Error ? err.message : err}</p>`);
    logError('DRIVE', 'Token exchange failed', err);
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

  log('DRIVE', 'Starting authorisation flow...');
  log('DRIVE', `Listening on port ${PORT}`);
  log('DRIVE', 'Opening browser — sign in as toby@vendodigital.co.uk');

  exec(`open "${authUrl.toString()}"`);
});

setTimeout(() => {
  logError('DRIVE', 'Timed out waiting for authorisation (3 min)');
  shutdown(1);
}, 180_000);
