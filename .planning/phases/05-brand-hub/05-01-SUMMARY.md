---
phase: 05-brand-hub
plan: 01
subsystem: database
tags: [libsql, turso, fts5, sqlite, brand-hub, tdd]

requires:
  - phase: 04-skills-library
    provides: FTS5 content-sync pattern (syncSkillFts/deleteSkillFts) mirrored for brand_hub_fts

provides:
  - brand.ts query module with 6 functions + 2 FTS helpers + 3 types
  - FTS5 brand_hub_fts virtual table with client_name + content columns
  - UNIQUE index on brand_hub.drive_file_id (required for ON CONFLICT upsert)
  - title column migration on brand_hub in both Turso and sql.js paths
  - Client isolation guarantee (getBrandContext and searchBrandContent always scope by client_slug)

affects:
  - 05-02 (brand ingestion pipeline — calls upsertBrandFromDrive, deleteBrandFile)
  - 06-task-runner (calls getBrandContext to pull brand context into task drafts)

tech-stack:
  added: []
  patterns:
    - "FTS5 content-sync with id (rowid alias) — SELECT id not rowid for libsql compatibility"
    - "Serialise FTS5 writes — concurrent writes to content-sync vtab corrupt the index"
    - "Client isolation via WHERE client_slug = ? — explicit scope parameter, never cross-client"
    - "Pre-read pattern — fetch old row before upsert so FTS5 delete step receives correct old values"

key-files:
  created:
    - web/lib/queries/brand.ts
    - web/lib/queries/brand.test.ts
  modified:
    - web/lib/queries/auth.ts
    - scripts/utils/db.ts

key-decisions:
  - "libsql maps rowid to the INTEGER PRIMARY KEY column name (id) — SELECT id not rowid to avoid undefined"
  - "FTS5 content-sync writes must be serialised — Promise.all over concurrent upserts corrupts the vtab"
  - "searchBrandContent without clientSlug returns all-client results for internal global search — separate from BRND-04 client-scoped path"
  - "brand_hub_fts indexes client_name + content (not title) — matching search intent for brand context lookup"

patterns-established:
  - "Brand query pattern: all content-returning functions require clientSlug (BRND-04 constraint)"
  - "FTS5 rowid pattern: always use INTEGER PRIMARY KEY column name alias, not rowid, with libsql"

requirements-completed: [BRND-01, BRND-02, BRND-03, BRND-04]

duration: 4min
completed: 2026-04-01
---

# Phase 05 Plan 01: Brand Hub Query Module Summary

**Brand query module with FTS5 full-text search, ON CONFLICT upsert, and strict client isolation — all test-driven against real in-memory libsql with 22 passing assertions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T21:46:53Z
- **Completed:** 2026-04-01T21:51:17Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- Brand query module with all 6 functions + 2 FTS helpers + 3 types exported
- BRND-04 client isolation: getBrandContext and searchBrandContent always scope by client_slug — explicit test assertion confirms client-a never leaks client-b data
- FTS5 brand_hub_fts virtual table in Turso path; title column + UNIQUE index in both paths
- 22 tests covering upsert (insert + update), isolation, FTS5 search, performance (25+ clients), and FTS5 sync/delete lifecycle

## Task Commits

TDD cycle:

1. **RED — Failing test suite** - `5b5ddf2` (test)
2. **GREEN — brand.ts + schema migrations** (auto-committed in parts):
   - `f6cca39` — auth.ts: title migration, UNIQUE index, brand_hub_fts FTS5 table
   - `a1d0251` — db.ts: title migration, UNIQUE index (no FTS5)
   - `827b07c` — brand.test.ts: serialise BRND-03 inserts (fix concurrent FTS5 corruption)
   - `859c384` — brand.ts: full query module implementation

## Files Created/Modified

- `web/lib/queries/brand.ts` — Brand query module: getBrandContext, listBrandClients, searchBrandContent, getBrandFile, upsertBrandFromDrive, deleteBrandFile, syncBrandFts, deleteBrandFts + BrandHubRow, BrandClientRow, BrandSearchResult types
- `web/lib/queries/brand.test.ts` — 22 tests: BRND-01 through BRND-04, FTS5 lifecycle, 25+ client performance
- `web/lib/queries/auth.ts` — Added title column migration, UNIQUE index on drive_file_id, brand_hub_fts FTS5 virtual table
- `scripts/utils/db.ts` — Added title column migration, UNIQUE index on drive_file_id (no FTS5 — sql.js FTS4 only)

## Decisions Made

- `id` not `rowid` in SELECT statements — libsql maps rowid to the INTEGER PRIMARY KEY column name, so `SELECT rowid FROM brand_hub` returns the column named `id`, making `.rowid` undefined on the row object
- Serialised FTS5 writes in BRND-03 test — `Promise.all` across concurrent upserts triggers `SQLITE_CORRUPT_VTAB` on content-sync tables; serialised with sequential `await` loop
- `searchBrandContent` without `clientSlug` returns global results — intentional for internal cross-client search; BRND-04 scoping is opt-in via the parameter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed libsql rowid undefined — SELECT id not rowid**
- **Found during:** Task 1 GREEN phase (deleteBrandFile test failure)
- **Issue:** `SELECT rowid, client_name, content FROM brand_hub` returned `undefined` for `rowid` because libsql maps the rowid alias to the INTEGER PRIMARY KEY column name (`id`). The `deleteBrandFts` call received `undefined` as the rowid argument, causing `TypeError: undefined cannot be passed as argument to the database`.
- **Fix:** Changed all rowid reads to `SELECT id, client_name, content` and used `oldRow.id` throughout brand.ts
- **Files modified:** web/lib/queries/brand.ts
- **Verification:** `deleteBrandFile` test passes; FTS5 entry correctly removed
- **Committed in:** 859c384

**2. [Rule 1 - Bug] Serialised FTS5 writes in BRND-03 performance test**
- **Found during:** Task 1 GREEN phase (BRND-03 test failure)
- **Issue:** `Promise.all` spawning 25 concurrent `upsertBrandFromDrive` calls caused `SQLITE_CORRUPT_VTAB` — FTS5 content-sync tables do not tolerate concurrent write transactions
- **Fix:** Changed test to sequential `await` loop (serialised writes)
- **Files modified:** web/lib/queries/brand.test.ts
- **Verification:** BRND-03 test passes; 25+ clients inserted and queried without error
- **Committed in:** 827b07c

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. libsql rowid pattern and FTS5 serialisation are important conventions for future brand/FTS work.

## Issues Encountered

None beyond the two auto-fixed bugs above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Brand query data access layer complete — Plan 02 (ingestion pipeline) can call `upsertBrandFromDrive` and `deleteBrandFile` directly
- FTS5 search is ready for Plan 06 (task runner) to call `searchBrandContent(query, clientSlug)`
- Schema migrations idempotent — safe to deploy against existing Turso database
- No blockers

---
*Phase: 05-brand-hub*
*Completed: 2026-04-01*
