/**
 * One-off migration: copy Xero OAuth tokens from the local .secrets file
 * into the Turso `integration_tokens` table so the in-process Vercel cron
 * (web/lib/jobs/sync-xero.ts) can authenticate and refresh in production.
 *
 * Run once locally after generating tokens via `npm run xero:auth`:
 *
 *   npx tsx scripts/migrations/seed-xero-tokens.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { saveXeroTokens, getXeroTokens } from '../../web/lib/integrations/xero-tokens.js';

const TOKEN_PATH = resolve(process.cwd(), '.secrets/xero-tokens.json');

async function main() {
  if (!existsSync(TOKEN_PATH)) {
    console.error(`No tokens at ${TOKEN_PATH}`);
    console.error('Run `npm run xero:auth` first.');
    process.exit(1);
  }

  if (!process.env.TURSO_DATABASE_URL) {
    console.error('TURSO_DATABASE_URL not set — this migration must target production Turso, not local sqlite.');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    tenant_id: string;
  };

  if (!raw.access_token || !raw.refresh_token || !raw.tenant_id) {
    console.error('Token file is missing required fields (access_token, refresh_token, tenant_id)');
    process.exit(1);
  }

  await saveXeroTokens({
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: raw.expires_at,
    tenant_id: raw.tenant_id,
  });

  const persisted = await getXeroTokens();
  if (!persisted) {
    console.error('Verification failed — tokens did not persist to Turso');
    process.exit(1);
  }

  console.log('✓ Xero tokens seeded to Turso integration_tokens');
  console.log(`  tenant_id: ${persisted.tenant_id}`);
  console.log(`  expires_at: ${new Date(persisted.expires_at).toISOString()}`);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
