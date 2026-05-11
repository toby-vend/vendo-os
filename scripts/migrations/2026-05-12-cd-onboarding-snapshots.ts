/**
 * Create cd_onboarding_snapshots — local Turso mirror of
 * ClientDashboard's `questionnaire_submissions` for one-shot reads by
 * the client-knowledge briefing.
 *
 * Why a mirror: avoids a per-briefing call to CD's Postgres (which is
 * cross-cloud and adds latency), and isolates VendoOS from CD outages.
 * Refresh runs every 6h via /api/cron/pull-onboarding-from-portal.
 *
 * Safe to re-run. See plans/2026-05-08-clientdashboard-integration.md.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS cd_onboarding_snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    cd_submission_id    TEXT NOT NULL UNIQUE,
    template_name       TEXT,
    template_version    INTEGER,
    status              TEXT,
    completion_percent  INTEGER,
    section_status      TEXT,
    answers             TEXT NOT NULL,
    submitted_at        TEXT,
    cd_updated_at       TEXT NOT NULL,
    synced_at           TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cd_onb_client ON cd_onboarding_snapshots(client_id, synced_at)`,
];

(async () => {
  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log('  ok:', sql.split('\n')[0].trim().slice(0, 80));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(msg)) {
        console.log('  skip (already exists):', sql.split('\n')[0].trim().slice(0, 80));
      } else {
        console.error('  FAIL:', msg);
        process.exit(1);
      }
    }
  }
  console.log('\ncd_onboarding_snapshots table ready.');
  process.exit(0);
})();
