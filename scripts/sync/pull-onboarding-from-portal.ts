/**
 * CLI wrapper around the CD-onboarding-pull job. See
 * web/lib/jobs/pull-onboarding-from-portal.ts.
 *
 * Usage:
 *   npm run sync:onboarding
 *
 * Required env (in .env.local):
 *   PORTAL_SUPABASE_URL
 *   PORTAL_SUPABASE_SERVICE_ROLE_KEY
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { pullOnboardingFromPortal } from '../../web/lib/jobs/pull-onboarding-from-portal.js';

async function main(): Promise<void> {
  console.log('pull-onboarding-from-portal: starting');
  const result = await pullOnboardingFromPortal();
  console.log(`  loaded ${result.loaded} CD submission(s)`);
  console.log(`  upserted ${result.upserted}`);
  console.log(`  skipped ${result.skipped}`);
  for (const w of result.warnings) console.warn(`  ! ${w}`);
}

main().catch((err: Error) => {
  console.error('pull-onboarding-from-portal failed:', err.message);
  process.exit(1);
});
