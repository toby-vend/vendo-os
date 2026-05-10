/**
 * CLI wrapper around the bridge-sync job.
 *
 * Usage:
 *   npm run sync:portal -- --dry-run        # plan only, no writes
 *   npm run sync:portal                      # live run, all clients
 *   npm run sync:portal -- --client 42       # single VendoOS client id
 *
 * The actual logic lives in web/lib/jobs/push-clients-to-portal.ts so it
 * can also be invoked from the Vercel cron route in web/routes/api/cron.ts.
 *
 * Required env (in .env.local):
 *   PORTAL_SUPABASE_URL                      # https://<ref>.supabase.co
 *   PORTAL_SUPABASE_SERVICE_ROLE_KEY         # service_role secret
 *   TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN   # already used by VendoOS
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { pushClientsToPortal } from '../../web/lib/jobs/push-clients-to-portal.js';

const DRY_RUN = process.argv.includes('--dry-run');
const CLIENT_FLAG = process.argv.indexOf('--client');
const SINGLE_CLIENT_ID =
  CLIENT_FLAG > -1 && process.argv[CLIENT_FLAG + 1]
    ? Number(process.argv[CLIENT_FLAG + 1])
    : null;

async function main(): Promise<void> {
  console.log(
    `push-clients-to-portal: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SINGLE_CLIENT_ID ? ` (client ${SINGLE_CLIENT_ID})` : ''}`,
  );

  const result = await pushClientsToPortal({
    dryRun: DRY_RUN,
    singleClientId: SINGLE_CLIENT_ID,
  });

  console.log(`  loaded ${result.loaded} client(s) from VendoOS`);
  console.log(`  prepared ${result.prepared} upsert(s) (${result.collisions} slug collision(s) resolved)`);
  for (const w of result.warnings) console.warn(`  ! ${w}`);

  if (result.dryRun) {
    console.log('  --dry-run set; no writes performed');
    if (result.sample) console.log('  sample row:', result.sample);
  } else {
    console.log(`  done: ${result.written} row(s) written to organisations`);
  }
}

main().catch((err: Error) => {
  console.error('push-clients-to-portal failed:', err.message);
  process.exit(1);
});
