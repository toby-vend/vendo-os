---
phase: 01-infrastructure
plan: 02
subsystem: database
tags: [sqlite, turso, libsql, sql.js, fts5, schema, ddl]

# Dependency graph
requires: []
provides:
  - "skills table in both Turso and local sql.js schema paths"
  - "skills_fts FTS5 virtual table in Turso path (libsql)"
  - "brand_hub table with client_id index in both schema paths"
  - "drive_watch_channels table with UNIQUE channel_id in both schema paths"
  - "task_runs table with client_id, status, created_at indexes in both schema paths"
  - "initSchema export from web/lib/queries.ts (renamed from initAuthSchema)"
  - "initAuthSchema kept as deprecated alias for backward compatibility"
affects: [02-skills-sync, 03-brand-hub, 04-drive-watch, 05-task-runs, any phase querying skills/brand/task data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual schema path pattern: Turso/libsql (production web) vs sql.js (local scripts) — FTS5 only in Turso"
    - "IF NOT EXISTS DDL for zero-risk additive schema migrations"
    - "Deprecated alias export pattern: export const initAuthSchema = initSchema"

key-files:
  created: []
  modified:
    - web/lib/queries.ts
    - scripts/utils/db.ts

key-decisions:
  - "skills_fts FTS5 virtual table added only to Turso path — sql.js 1.11.0 does not support FTS5"
  - "initAuthSchema renamed to initSchema (broader scope than just auth); deprecated alias retained"
  - "All new DDL uses IF NOT EXISTS — safe to run repeatedly on existing databases"

patterns-established:
  - "FTS5 virtual tables: Turso/libsql only. Document explicitly in sql.js path with a comment."
  - "Schema init functions: one call to initSchema covers all tables. No separate per-domain init."

requirements-completed: [INFR-02]

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 1 Plan 02: Database Schema Extension Summary

**Five new production tables added to both schema paths: skills (with FTS5 in Turso), brand_hub, drive_watch_channels, and task_runs — all additive, IF NOT EXISTS, zero-risk**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-01T19:21:00Z
- **Completed:** 2026-04-01T19:29:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `initAuthSchema` → `initSchema` in `web/lib/queries.ts` with 5 new table DDL blocks (skills, skills_fts FTS5, brand_hub, drive_watch_channels, task_runs) plus all required indexes
- Extended `scripts/utils/db.ts` sql.js schema init with 4 new tables (skills_fts intentionally omitted with comment; FTS5 unavailable in sql.js 1.11.0)
- Maintained backward compatibility via `export const initAuthSchema = initSchema` deprecated alias — call site in `scripts/utils/seed-admin.ts` continues to work unmodified

## Task Commits

Each task was committed atomically (auto-committed by the session):

1. **Task 1: Add new table DDL to libsql schema init (Turso production path)** - `aa5d998` (feat)
2. **Task 2: Add new table DDL to sql.js schema init (local scripts path)** - `e313bff` (feat)

## Files Created/Modified

- `web/lib/queries.ts` — `initAuthSchema` renamed to `initSchema`; 5 new table DDL blocks appended; deprecated alias exported
- `scripts/utils/db.ts` — 4 new table DDL blocks appended after existing auth tables (skills, brand_hub, drive_watch_channels, task_runs); FTS5 omission documented with comment

## Decisions Made

- `skills_fts` (FTS5 virtual table) added only to the Turso/libsql path. sql.js 1.11.0 ships FTS4 only, and skills FTS queries are executed by the web app (not scripts), so omitting it from `db.ts` is safe and correct.
- `initAuthSchema` kept as a re-export alias to avoid breaking `scripts/utils/seed-admin.ts`. Next time that file is touched (Plan 03 queries split), the import can be updated to `initSchema`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. New tables are created on next call to `initSchema` (or `initAuthSchema`) against Turso. The Turso database receives the new DDL the next time the web server initialises or seed-admin runs.

## Next Phase Readiness

- All 5 new tables defined in both schema paths — Phase 2+ skills sync, brand hub, drive watch, and task run features can proceed
- Plan 03 (queries.ts split) can now move the extended `initSchema` function into `queries/auth.ts` as part of the barrel split
- No blockers

---
*Phase: 01-infrastructure*
*Completed: 2026-04-01*
