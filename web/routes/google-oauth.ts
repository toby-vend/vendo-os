import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import {
  upsertUserOAuthToken,
  deleteUserOAuthToken,
  getUserOAuthToken,
  getUserByEmail,
  getUserById,
  recordAccessRequest,
  resolveAccessRequestByEmail,
  getAdminUsers,
  logAuditEvent,
} from '../lib/queries.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import {
  parseCookies,
  getSessionSecret,
  verifySessionToken,
  createSessionToken,
  sessionCookie,
  type SessionUser,
} from '../lib/auth.js';
import { notifyAdminsOfAccessRequest } from '../lib/notifications.js';

// Full scopes for the *connect* flow (links Drive/Gmail/Calendar to a signed-in user).
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

// Identity-only scopes for the *login* flow — we only need to know who they are.
const LOGIN_SCOPES = ['openid', 'email', 'profile'].join(' ');

function getRedirectUri(request: { protocol: string; hostname: string; headers: Record<string, string | string[] | undefined> }): string {
  // In production behind a proxy, use x-forwarded-proto/host
  const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol || 'http';
  const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string) || request.hostname;
  return `${proto}://${host}/auth/google/callback`;
}

function generateState(seed: string): string {
  const timestamp = Date.now().toString();
  const secret = getSessionSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(seed + timestamp);
  return `${timestamp}.${hmac.digest('hex')}`;
}

function verifyState(state: string, cookieState: string): boolean {
  if (!state || !cookieState || state.length !== cookieState.length) return false;
  return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookieState));
}

function stateCookie(name: string, value: string): string {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

function clearStateCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const googleOAuthRoutes: FastifyPluginAsync = async (app) => {
  // ── Login: "Sign in with Google" (no session required) ──
  app.get('/auth/google/login', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      reply.code(500).send('Google sign-in is not configured');
      return;
    }

    const state = generateState('login:');
    const redirectUri = getRedirectUri(request);
    reply.header('Set-Cookie', stateCookie('google_login_state', state));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: LOGIN_SCOPES,
      prompt: 'select_account',
      state,
    });

    reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // ── Connect: link Drive/Gmail/Calendar to the signed-in user ──
  app.get('/auth/google/connect', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      reply.code(500).send('Google OAuth is not configured');
      return;
    }

    const state = generateState(user.id);
    const redirectUri = getRedirectUri(request);
    reply.header('Set-Cookie', stateCookie('google_oauth_state', state));

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

  // ── Callback — shared redirect URI for both flows ──
  app.get('/auth/google/callback', async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie || '');
    const query = request.query as Record<string, string>;

    // The presence of the login-state cookie distinguishes login from connect.
    if (cookies['google_login_state']) {
      await handleGoogleLogin(request, reply, query, cookies['google_login_state']);
      return;
    }

    await handleGoogleConnect(request, reply, query, cookies);
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

// ── Login handler ──────────────────────────────────────────

async function handleGoogleLogin(
  request: any,
  reply: any,
  query: Record<string, string>,
  loginState: string,
): Promise<void> {
  reply.header('Set-Cookie', clearStateCookie('google_login_state'));

  if (query.error) { reply.redirect('/login?error=google'); return; }
  if (!query.state || !verifyState(query.state, loginState)) {
    reply.redirect('/login?error=state');
    return;
  }

  const profile = await exchangeCodeForProfile(request, query.code);
  if (!profile?.email) { reply.redirect('/login?error=google'); return; }

  const email = profile.email.trim().toLowerCase();
  const user = await getUserByEmail(email);

  if (!user) {
    // No provisioned account — block, record, and alert admins.
    await recordAccessRequest({ email, name: profile.name, googleSub: profile.id }).catch(e =>
      console.error('[login] recordAccessRequest failed:', e),
    );
    logAuditEvent({ eventType: 'login_blocked_no_account', ipAddress: request.ip, details: `email: ${email}` }).catch(() => {});

    getAdminUsers()
      .then(admins => notifyAdminsOfAccessRequest({ requesterEmail: email, requesterName: profile.name, admins }))
      .catch(e => console.error('[notify] Access-request alert error:', e));

    reply.redirect('/login?flagged=1');
    return;
  }

  // Provisioned — issue a session. Clear any stale pending request for them.
  resolveAccessRequestByEmail(email, user.id).catch(() => {});
  logAuditEvent({ eventType: 'login_success', userId: user.id, ipAddress: request.ip, details: 'google' }).catch(() => {});

  const token = createSessionToken({ userId: user.id, role: user.role, iat: Date.now() });
  reply.header('Set-Cookie', sessionCookie(token));
  reply.redirect('/');
}

// ── Connect handler (existing behaviour; resolves its own session) ──

async function handleGoogleConnect(
  request: any,
  reply: any,
  query: Record<string, string>,
  cookies: Record<string, string>,
): Promise<void> {
  // This route is public (no auth hook), so resolve the session ourselves.
  const sessionToken = cookies['vendo_session'];
  const payload = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!payload) { reply.redirect('/login'); return; }
  const user = await getUserById(payload.userId);
  if (!user) { reply.redirect('/login'); return; }

  if (query.error) { reply.redirect('/settings?google=denied'); return; }

  const cookieState = cookies['google_oauth_state'];
  if (!query.state || !cookieState || !verifyState(query.state, cookieState)) {
    reply.code(400).send('Invalid OAuth state — please try connecting again');
    return;
  }
  reply.header('Set-Cookie', clearStateCookie('google_oauth_state'));

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();
  const redirectUri = getRedirectUri(request);

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
}

// ── Shared: exchange an auth code and fetch the Google profile ──

async function exchangeCodeForProfile(
  request: any,
  code: string,
): Promise<{ email?: string; name?: string; id?: string } | null> {
  if (!code) return null;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const redirectUri = getRedirectUri(request);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    console.error(`[Google login] Token exchange failed: ${await tokenRes.text()}`);
    return null;
  }
  const tokens = await tokenRes.json() as { access_token: string };

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return null;
  return profileRes.json() as Promise<{ email?: string; name?: string; id?: string }>;
}
