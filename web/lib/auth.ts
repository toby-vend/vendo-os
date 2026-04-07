import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// --- Types ---

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'standard' | 'client';
  mustChangePassword: boolean;
  channels: string[];       // channel slugs
  allowedRoutes: string[];  // route slugs
  googleConnected: boolean;
  clientId: number | null;  // set when role === 'client'
  clientName: string | null;
}

export interface SessionPayload {
  userId: string;
  role: 'admin' | 'standard' | 'client';
  iat: number;
}

// --- Password hashing ---

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// --- Session tokens ---

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    console.warn('[SECURITY] Using hardcoded session secret — set SESSION_SECRET in .env.local');
    return 'vendo-dev';
  }
  return secret;
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
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `vendo_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `vendo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
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
  ['/chat', 'chat'],
  ['/tasks', 'tasks'],
  ['/growth', 'growth'],
  ['/deliverables', 'deliverables'],
  ['/dashboards/time-tracking', 'time-tracking'],
  ['/dashboards/capacity', 'capacity'],
  ['/dashboards', 'dashboards'],
  ['/skills', 'skills'],
  ['/asana-tasks', 'asana-tasks'],
  ['/operations', 'operations'],
  ['/onboarding', 'clients'],
  ['/video-production', 'video-production'],
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

// --- CSRF token ---

export function generateCsrfToken(sessionToken: string): string {
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update('csrf:' + sessionToken);
  return hmac.digest('hex');
}

export function verifyCsrfToken(sessionToken: string, csrfToken: string): boolean {
  const expected = generateCsrfToken(sessionToken);
  if (expected.length !== csrfToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(csrfToken, 'hex'));
}

// --- Password complexity ---

export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit';
  return null;
}

// --- UUID helper ---

export function generateId(): string {
  return crypto.randomUUID();
}
