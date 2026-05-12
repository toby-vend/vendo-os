/**
 * growth_findings — unified store for every growth-agent output.
 *
 * Each cooperating growth agent (atlas-churn-risk, atlas-upsell,
 * atlas-lead-quality, atlas-case-study, atlas-profitability,
 * atlas-feature-prioritiser, atlas-growth) calls the `recordGrowthFinding`
 * tool, which upserts into this table by fingerprint. Re-runs dedup
 * automatically; mark-acted / mark-dismissed are permanent.
 *
 * The /admin/growth dashboard pivots on (agent, finding_type, severity,
 * status) and surfaces the top open items with linked reasoning and
 * proposed actions.
 *
 * Idempotent: re-running this migration is safe.
 *
 * Usage: npx tsx scripts/migrations/2026-05-13-growth-findings.ts
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
  // ----------------------------------------------------------------------
  // growth_findings — one row per distinct (agent, finding_type, subject,
  // title) tuple. Fingerprint hashes that tuple so re-scans dedup. Status
  // moves through open → acted | dismissed | stale.
  //
  // severity rubric:
  //   P0 — needs action today (e.g. critical churn risk, P0 lead)
  //   P1 — needs action this week (e.g. upsell ripe, P1 lead)
  //   P2 — opportunity to track (e.g. case-study candidate)
  //   P3 — informational
  //
  // finding_type values used today:
  //   churn-risk | upsell | lead-score | profit-alert |
  //   feature-priority | case-study-candidate | growth-prescription
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS growth_findings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint     TEXT NOT NULL UNIQUE,
    agent           TEXT NOT NULL,
    finding_type    TEXT NOT NULL,
    subject_type    TEXT,
    subject_id      TEXT,
    subject_label   TEXT,
    severity        TEXT NOT NULL DEFAULT 'P2',
    title           TEXT NOT NULL,
    description     TEXT,
    reasoning       TEXT,
    proposed_action TEXT,
    run_id          TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
    occurrences     INTEGER NOT NULL DEFAULT 1,
    first_seen      TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen       TEXT NOT NULL DEFAULT (datetime('now')),
    acted_at        TEXT,
    acted_by        TEXT,
    acted_outcome   TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_growth_status
     ON growth_findings(status, last_seen DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_growth_agent
     ON growth_findings(agent, status)`,
  `CREATE INDEX IF NOT EXISTS idx_growth_subject
     ON growth_findings(subject_type, subject_id)`,
  `CREATE INDEX IF NOT EXISTS idx_growth_severity_status
     ON growth_findings(severity, status)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running growth_findings migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ growth_findings + indices created.');
} catch (err: unknown) {
  console.error('✗ Migration error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

console.log('Done.');
