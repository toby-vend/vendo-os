import { db } from '../queries/base.js';

/**
 * Turso-backed token storage for Xero. Replaces the local
 * scripts/utils/xero-client.ts file-based token store so the sync can run
 * inside a Vercel serverless function.
 *
 * Xero access tokens expire every 30 minutes and refresh tokens rotate on
 * each refresh, so we MUST persist tokens back after every refresh. The
 * integration_tokens table is designed to be reused by other providers
 * (e.g. google_ads) — keyed by `provider`.
 */

export interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  tenant_id: string;
}

let _tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (_tableEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS integration_tokens (
      provider TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      tenant_id TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  _tableEnsured = true;
}

export async function ensureIntegrationTokensTable(): Promise<void> {
  await ensureTable();
}

export async function getXeroTokens(): Promise<XeroTokens | null> {
  await ensureTable();
  const r = await db.execute({
    sql: 'SELECT access_token, refresh_token, expires_at, tenant_id FROM integration_tokens WHERE provider = ?',
    args: ['xero'],
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string,
    expires_at: Number(row.expires_at),
    tenant_id: (row.tenant_id as string) || '',
  };
}

export async function saveXeroTokens(tokens: XeroTokens): Promise<void> {
  await ensureTable();
  await db.execute({
    sql: `INSERT INTO integration_tokens (provider, access_token, refresh_token, expires_at, tenant_id, updated_at)
          VALUES ('xero', ?, ?, ?, ?, ?)
          ON CONFLICT(provider) DO UPDATE SET
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            tenant_id = excluded.tenant_id,
            updated_at = excluded.updated_at`,
    args: [tokens.access_token, tokens.refresh_token, tokens.expires_at, tokens.tenant_id || null, new Date().toISOString()],
  });
}
