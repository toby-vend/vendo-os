/**
 * Xero OAuth 2.0 authorisation flow.
 *
 * Run: npm run xero:auth
 *
 * Opens a browser for you to grant access, then captures the callback
 * and stores tokens in .secrets/xero-tokens.json.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServer } from 'http';
import { URL } from 'url';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { getAuthUrl, exchangeCodeForTokens } from '../utils/xero-client.js';
import { log, logError } from '../utils/db.js';

const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const CLIENT_ID = process.env.XERO_CLIENT_ID;
const CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('XERO', 'XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl = getAuthUrl(CLIENT_ID, REDIRECT_URI, state);

log('XERO', 'Starting authorisation flow...');
log('XERO', `Redirect URI: ${REDIRECT_URI}`);

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

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorisation failed</h1><p>${error}</p>`);
    logError('XERO', `Authorisation denied: ${error}`);
    shutdown(1);
    return;
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch</h1><p>Possible CSRF attack. Try again.</p>');
    logError('XERO', 'State mismatch — aborting');
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
    log('XERO', 'Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code, CLIENT_ID!, CLIENT_SECRET!, REDIRECT_URI);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;">
          <h1>Xero connected</h1>
          <p>Tokens saved. You can close this tab.</p>
          <p style="color: #666; font-size: 14px;">Tenant: ${tokens.tenant_id}</p>
        </body>
      </html>
    `);

    log('XERO', 'Authorisation complete — tokens saved to .secrets/xero-tokens.json');
    shutdown(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${err instanceof Error ? err.message : err}</p>`);
    logError('XERO', 'Token exchange failed', err);
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
  log('XERO', `Listening on port ${PORT}`);
  log('XERO', 'Opening browser...');

  // Open browser (macOS)
  exec(`open "${authUrl}"`);
});

// Timeout after 2 minutes
setTimeout(() => {
  logError('XERO', 'Timed out waiting for authorisation (2 min)');
  shutdown(1);
}, 120_000);
