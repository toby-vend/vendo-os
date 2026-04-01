import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// --- Types ---

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'standard';
  mustChangePassword: boolean;
  channels: string[];       // channel slugs
  allowedRoutes: string[];  // route slugs
  googleConnected: boolean;
}

export interface SessionPayload {
  userId: string;
  role: 'admin' | 'standard';
  iat: number;
}

// --- Password hashing ---

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// --- Session tokens ---

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || 'vendo-dev';
}

export function createSessionToken(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(b64);
  const sig = hmac.digest('hex');
  return `${b64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;

  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(b64);
  const expected = hmac.digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }

  try {
    const json = Buffer.from(b64, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as SessionPayload;

    // Check expiry
    if (Date.now() - payload.iat > SESSION_DURATION) return null;

    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_DURATION / 1000);
  return `vendo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return 'vendo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

// --- Route slug mapping ---

const ROUTE_MAP: [string, string][] = [
  ['/meetings', 'meetings'],
  ['/action-items', 'action-items'],
  ['/clients', 'clients'],
  ['/pipeline', 'pipeline'],
  ['/ads', 'ads'],
  ['/briefs', 'briefs'],
  ['/sync-status', 'sync-status'],
  ['/drive', 'drive'],
  ['/settings', 'settings'],
];

export function getRouteSlug(url: string): string | null {
  const path = url.split('?')[0];

  if (path === '/') return 'dashboard';

  for (const [prefix, slug] of ROUTE_MAP) {
    if (path === prefix || path.startsWith(prefix + '/')) return slug;
  }

  if (path.startsWith('/admin')) return null; // admin routes handled separately

  return null;
}

// --- Cookie parsing ---

export function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieStr.split(';').forEach(pair => {
    const [key, val] = pair.trim().split('=');
    if (key && val) cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

// --- UUID helper ---

export function generateId(): string {
  return crypto.randomUUID();
}
