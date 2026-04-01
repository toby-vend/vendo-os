import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { upsertUserOAuthToken, deleteUserOAuthToken, getUserOAuthToken } from '../lib/queries.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { parseCookies, type SessionUser } from '../lib/auth.js';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

function getRedirectUri(request: { protocol: string; hostname: string; headers: Record<string, string | string[] | undefined> }): string {
  // In production behind a proxy, use x-forwarded-proto/host
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'http';
  const host = (request.headers['x-forwarded-host'] as string) || request.hostname;
  return `${proto}://${host}/auth/google/callback`;
}

function generateState(userId: string): string {
  const timestamp = Date.now().toString();
  const secret = process.env.SESSION_SECRET || 'vendo-dev';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(userId + timestamp);
  return `${timestamp}.${hmac.digest('hex')}`;
}

function verifyState(state: string, cookieState: string): boolean {
  if (!state || !cookieState) return false;
  return crypto.timingSafeEqual(
    Buffer.from(state),
    Buffer.from(cookieState),
  );
}

export const googleOAuthRoutes: FastifyPluginAsync = async (app) => {
  // Initiate Google OAuth flow
  app.get('/auth/google/connect', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      reply.code(500).send('Google OAuth is not configured');
      return;
    }

    const state = generateState(user.id);
    const redirectUri = getRedirectUri(request);

    // Store state in a short-lived cookie for CSRF validation
    reply.header('Set-Cookie', `google_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Handle Google OAuth callback
  app.get('/auth/google/callback', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    const query = request.query as Record<string, string>;

    // Check for error (user denied)
    if (query.error) {
      reply.redirect('/settings?google=denied');
      return;
    }

    // Validate CSRF state
    const cookies = parseCookies(request.headers.cookie || '');
    const cookieState = cookies['google_oauth_state'];
    if (!query.state || !cookieState || !verifyState(query.state, cookieState)) {
      reply.code(400).send('Invalid OAuth state — please try connecting again');
      return;
    }

    // Clear state cookie
    reply.header('Set-Cookie', 'google_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = getRedirectUri(request);

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[Google OAuth] Token exchange failed: ${errBody}`);
      reply.redirect('/settings?google=error');
      return;
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    // Fetch Google user profile
    let providerEmail: string | undefined;
    let providerName: string | undefined;
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json() as { email?: string; name?: string };
        providerEmail = profile.email;
        providerName = profile.name;
      }
    } catch {
      // Non-critical — continue without profile info
    }

    // Encrypt and store tokens
    await upsertUserOAuthToken({
      userId: user.id,
      provider: 'google',
      accessTokenEnc: encryptToken(tokens.access_token),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      tokenExpiry: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope,
      providerEmail,
      providerName,
    });

    reply.redirect('/settings?google=connected');
  });

  // Disconnect Google account
  app.post('/auth/google/disconnect', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    // Best-effort token revocation
    try {
      const row = await getUserOAuthToken(user.id, 'google');
      if (row) {
        const accessToken = decryptToken(row.access_token_enc);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST' });
      }
    } catch {
      // Revocation is best-effort
    }

    await deleteUserOAuthToken(user.id, 'google');
    reply.redirect('/settings');
  });
};
