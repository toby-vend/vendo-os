/**
 * Codebase Health — schema migration for the daily code-scan agent.
 *
 * Creates:
 *   - code_findings       one row per distinct issue (fingerprinted so
 *                         re-scans update `last_seen` and `occurrences`
 *                         instead of duplicating)
 *   - code_health_runs    one row per scan run — stats + status, used by
 *                         /admin/code-health to render "today's scan".
 *
 * Safe to re-run. Append-only schema except for explicit status updates
 * (resolved | noise | wontfix) made by the admin via the UI.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-code-findings.ts
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
  // code_findings — fingerprinted distinct issues. Re-scans bump
  // `last_seen` and `occurrences`; missing-this-run open findings get
  // flipped to status='resolved' with `resolved_at` set.
  //
  //   fingerprint = sha1(file_path | line_start | finding_type | title)
  //
  //   status:
  //     'open'      — currently flagged
  //     'resolved'  — was open, no longer seen → auto-resolved
  //     'noise'     — admin dismissed; same fingerprint never re-raised
  //     'wontfix'   — admin acknowledged but chose not to act
  //
  //   severity:
  //     P0 — production bug / security risk
  //     P1 — high-value perf, refactor, or latent bug
  //     P2 — quality, dead code, mild perf
  //     P3 — style / nit
  //
  //   source:
  //     'static:tsc'        — TypeScript compiler diagnostic
  //     'static:audit'      — npm audit (vulnerable dep)
  //     'static:knip'       — knip dead-code report
  //     'static:gitleaks'   — secret scan hit
  //     'static:cron-drift' — vercel.json cron path missing from api/cron/
  //     'static:todo'       — TODO/FIXME/HACK marker
  //     'llm:review'        — Sonnet per-file review
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS code_findings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint     TEXT NOT NULL UNIQUE,
    file_path       TEXT NOT NULL,
    line_start      INTEGER,
    line_end        INTEGER,
    finding_type    TEXT NOT NULL,
    severity        TEXT NOT NULL,
    source          TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    proposed_fix    TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
    first_seen      TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen       TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at     TEXT,
    resolved_commit TEXT,
    noise_marked_by TEXT,
    noise_reason    TEXT,
    occurrences     INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS idx_code_findings_status
     ON code_findings(status, last_seen DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_code_findings_severity_status
     ON code_findings(severity, status)`,
  `CREATE INDEX IF NOT EXISTS idx_code_findings_file
     ON code_findings(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_code_findings_source
     ON code_findings(source, status)`,

  // ----------------------------------------------------------------------
  // code_health_runs — one row per scan run. Drives the header bar on
  // /admin/code-health ("last scan: X new, Y persisting, Z resolved").
  // ----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS code_health_runs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at              TEXT NOT NULL DEFAULT (datetime('now')),
    trigger             TEXT NOT NULL DEFAULT 'cron',
    files_scanned       INTEGER NOT NULL DEFAULT 0,
    findings_new        INTEGER NOT NULL DEFAULT 0,
    findings_persisting INTEGER NOT NULL DEFAULT 0,
    findings_resolved   INTEGER NOT NULL DEFAULT 0,
    duration_ms         INTEGER,
    cost_usd            REAL,
    status              TEXT NOT NULL DEFAULT 'ok',
    error               TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_code_health_runs_at
     ON code_health_runs(run_at DESC)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running code-findings migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ code_findings + indices created.');
  console.log('✓ code_health_runs + index created.');
} catch (err: unknown) {
  console.error('✗ Migration error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

console.log('Done.');
