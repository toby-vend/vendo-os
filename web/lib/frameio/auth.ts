import { db } from '../queries/base.js';
import { encryptToken, decryptToken } from '../crypto.js';

/**
 * Frame.io OAuth via Adobe IMS.
 *
 * Flow (one-off admin setup):
 *   1. Admin opens /api/frameio/oauth/start.
 *   2. We redirect to Adobe IMS authorize endpoint with our ADOBE_CLIENT_ID.
 *   3. Admin signs in to their Frame.io / Adobe account.
 *   4. Adobe redirects to /api/frameio/oauth/callback?code=… .
 *   5. We exchange the code for an access_token + refresh_token.
 *   6. Tokens are encrypted and stored as a singleton row in `frameio_oauth`.
 *
 * Runtime (every webhook fan-out / cron tick):
 *   - getValidAccessToken() reads the singleton row, returns the access token
 *     if still valid (≥ 60s remaining), otherwise refreshes via Adobe IMS,
 *     persists the new token, and returns it.
 *
 * Required env:
 *   ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET, ADOBE_SCOPES, TOKEN_ENCRYPTION_KEY.
 */

const IMS_AUTHORIZE_URL = 'https://ims-na1.adobelogin.com/ims/authorize/v2';
const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_oauth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      token_expiry INTEGER NOT NULL,
      scopes TEXT NOT NULL,
      connected_user_email TEXT,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  schemaEnsured = true;
}

function requireEnv(): { clientId: string; clientSecret: string; scopes: string } {
  const clientId = process.env.ADOBE_CLIENT_ID;
  const clientSecret = process.env.ADOBE_CLIENT_SECRET;
  const scopes = process.env.ADOBE_SCOPES;
  if (!clientId || !clientSecret || !scopes) {
    throw new Error('Adobe OAuth env not configured (ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET / ADOBE_SCOPES)');
  }
  return { clientId, clientSecret, scopes };
}

export function buildAuthorizeUrl(opts: { redirectUri: string; state: string }): string {
  const { clientId, scopes } = requireEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    state: opts.state,
  });
  return `${IMS_AUTHORIZE_URL}?${params.toString()}`;
}

interface ImsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  email?: string;
  error?: string;
  error_description?: string;
}

async function imsExchange(body: Record<string, string>): Promise<ImsTokenResponse> {
  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as ImsTokenResponse;
  if (!res.ok || json.error) {
    throw new Error(
      `Adobe IMS token exchange failed (${res.status}): ${json.error ?? 'unknown'} — ${json.error_description ?? ''}`,
    );
  }
  return json;
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const { clientId, clientSecret } = requireEnv();
  const tok = await imsExchange({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });

  if (!tok.refresh_token) {
    // offline_access scope must have been requested. If we got here without
    // one, the admin can't auto-refresh.
    throw new Error('Adobe IMS did not return a refresh_token — check that ADOBE_SCOPES includes "offline_access"');
  }

  // Adobe doesn't reliably return the user email in the token response, so
  // we resolve it via the IMS userinfo endpoint when available, falling back
  // to whatever Adobe sent (or null).
  let email = tok.email ?? null;
  try {
    const ui = await fetch('https://ims-na1.adobelogin.com/ims/userinfo/v2', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (ui.ok) {
      const u = (await ui.json()) as { email?: string; name?: string };
      email = u.email ?? email;
    }
  } catch {
    /* best-effort */
  }

  await ensureSchema();
  const now = new Date().toISOString();
  const expiry = Math.floor(Date.now() / 1000) + tok.expires_in;

  await db.execute({
    sql: `INSERT INTO frameio_oauth
            (id, access_token_enc, refresh_token_enc, token_expiry, scopes, connected_user_email, connected_at, updated_at)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            access_token_enc = excluded.access_token_enc,
            refresh_token_enc = excluded.refresh_token_enc,
            token_expiry = excluded.token_expiry,
            scopes = excluded.scopes,
            connected_user_email = excluded.connected_user_email,
            updated_at = excluded.updated_at`,
    args: [
      encryptToken(tok.access_token),
      encryptToken(tok.refresh_token),
      expiry,
      tok.scope ?? requireEnv().scopes,
      email,
      now,
      now,
    ],
  });
}

interface OAuthRow {
  access_token_enc: string;
  refresh_token_enc: string;
  token_expiry: number;
  connected_user_email: string | null;
  scopes: string;
  connected_at: string;
}

async function readToken(): Promise<OAuthRow | null> {
  await ensureSchema();
  const r = await db.execute('SELECT * FROM frameio_oauth WHERE id = 1');
  return (r.rows[0] as unknown as OAuthRow) ?? null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiry: number; refreshToken: string }> {
  const { clientId, clientSecret } = requireEnv();
  const tok = await imsExchange({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  return {
    accessToken: tok.access_token,
    expiry: Math.floor(Date.now() / 1000) + tok.expires_in,
    // Adobe sometimes rotates the refresh token; fall back to the old one if not.
    refreshToken: tok.refresh_token ?? refreshToken,
  };
}

/**
 * Returns a valid access token, refreshing via Adobe IMS if the stored one
 * has expired (or is within the refresh buffer). Throws if no admin has
 * connected Frame.io yet.
 */
export async function getValidAccessToken(): Promise<string> {
  const row = await readToken();
  if (!row) {
    throw new Error('Frame.io is not connected. An admin must visit /api/frameio/oauth/start to authorise.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (row.token_expiry > now + TOKEN_REFRESH_BUFFER_SECONDS) {
    return decryptToken(row.access_token_enc);
  }

  const refreshed = await refreshAccessToken(decryptToken(row.refresh_token_enc));
  await db.execute({
    sql: `UPDATE frameio_oauth SET
            access_token_enc = ?,
            refresh_token_enc = ?,
            token_expiry = ?,
            updated_at = ?
          WHERE id = 1`,
    args: [encryptToken(refreshed.accessToken), encryptToken(refreshed.refreshToken), refreshed.expiry, new Date().toISOString()],
  });
  return refreshed.accessToken;
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  connectedUserEmail: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
}> {
  const row = await readToken();
  if (!row) return { connected: false, connectedUserEmail: null, connectedAt: null, tokenExpiresAt: null };
  return {
    connected: true,
    connectedUserEmail: row.connected_user_email,
    connectedAt: row.connected_at,
    tokenExpiresAt: new Date(row.token_expiry * 1000).toISOString(),
  };
}

export async function disconnectFrameio(): Promise<void> {
  await ensureSchema();
  await db.execute('DELETE FROM frameio_oauth WHERE id = 1');
}
