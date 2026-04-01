---
phase: 04-skills-library
plan: 01
subsystem: database
tags: [fts5, sqlite, libsql, full-text-search, skills, bm25, tdd]

# Dependency graph
requires:
  - phase: 03-drive-document-processing
    provides: skills table with content/content_hash populated, drive.ts query module
  - phase: 01-infrastructure
    provides: skills_fts FTS5 virtual table schema

provides:
  - searchSkills function with BM25-ranked FTS5 search, channel+general filter, gap detection
  - syncSkillFts helper for FTS5 content-sync DELETE+INSERT updates
  - deleteSkillFts helper for removing skills from FTS5 index
  - getSkillVersion for retrieving drive_modified_at/content_hash/version metadata
  - getSkillsByVersion for listing skills updated after a given date
  - SkillSearchResult, SkillSearchResponse, SkillVersionInfo TypeScript interfaces

affects: [06-task-matching, 07-content-generation, 08-compliance, any phase that searches skills]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FTS5 content-sync table: DELETE (with OLD values) + INSERT (with NEW values) for index updates
    - BM25 ordering: bm25() returns negative values, ORDER BY ASC = most relevant first
    - Query sanitisation: strip quotes, split, append *, join with space (same pattern as meetings.ts)
    - In-memory libsql test database: createClient(':memory:') with real FTS5 for query validation

key-files:
  created:
    - web/lib/queries/drive.test.ts
  modified:
    - web/lib/queries/drive.ts

key-decisions:
  - "syncSkillFts accepts (rowid, oldTitle, oldContent, newTitle, newContent): FTS5 content-sync delete requires OLD values to remove previously indexed tokens — plan spec had this wrong"
  - "Tests use real in-memory libsql database (not mocks) for FTS5 query validation — mock.module at top level + --import tsx/esm + --experimental-test-module-mocks pattern"
  - "bm25() returns negative values — ORDER BY ASC gives most-relevant-first ordering"

patterns-established:
  - "FTS5 test pattern: createClient(':memory:'), mock.module at top level, before() for fixtures, --import tsx/esm flag"
  - "syncSkillFts callers must capture old title+content before updating skills row, then pass both to syncSkillFts"

requirements-completed: [SKIL-01, SKIL-02, SKIL-03, SKIL-05]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 4 Plan 01: Skills FTS5 Search and Version Tracking Summary

**BM25-ranked FTS5 search with channel+general filtering, gap detection signal, and FTS5 content-sync helpers for skills library query layer**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-01T21:21:02Z
- **Completed:** 2026-04-01T21:27:27Z
- **Tasks:** 1 feature (TDD: RED + GREEN + fix)
- **Files modified:** 2

## Accomplishments

- `searchSkills(query, channel, limit)` — FTS5 MATCH with BM25 ordering, channel + 'general' filter, gap: true on zero results
- `syncSkillFts` and `deleteSkillFts` — correct FTS5 content-sync DELETE+INSERT helpers
- `getSkillVersion` and `getSkillsByVersion` — version tracking queries
- 18 tests passing against a real in-memory FTS5 database

## Task Commits

TDD execution:

1. **RED — Failing tests** - `38f2e52` (test)
2. **GREEN — Implementation** - `5400f9e`, `1908ea0`, `e93a283` (auto-saved), `fc56207`, `0fa763d` (auto-saved test updates)

_Note: The "auto:" commits are Claude Code's auto-save during editing; they contain the implementation work._

## Files Created/Modified

- `/Users/Toby_1/Vendo-OS/web/lib/queries/drive.ts` — Added `searchSkills`, `syncSkillFts`, `deleteSkillFts`, `getSkillVersion`, `getSkillsByVersion` functions and `SkillSearchResult`, `SkillSearchResponse`, `SkillVersionInfo` interfaces
- `/Users/Toby_1/Vendo-OS/web/lib/queries/drive.test.ts` — 18 tests covering all search, gap detection, FTS5 sync, and version tracking behaviour

## Decisions Made

- Used `--import tsx/esm` and `mock.module` at top level (matching the established webhook test pattern) for TypeScript test execution
- Tests use real in-memory libsql `:memory:` database with FTS5 schema rather than mocking SQL — validates actual BM25 scoring and query behaviour
- `bm25()` returns negative values; `ORDER BY bm25(...) ASC` is correct for most-relevant-first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] syncSkillFts signature corrected to accept old and new values separately**
- **Found during:** GREEN phase (syncSkillFts test)
- **Issue:** Plan spec said `syncSkillFts(rowid, title, content)` passing new values for both DELETE and INSERT. FTS5 content-sync tables require the EXACT currently-indexed values for the delete command to remove old tokens. Passing new values to delete left old terms in the index.
- **Fix:** Changed signature to `(rowid, oldTitle, oldContent, newTitle, newContent)`. The delete uses old values; the insert uses new values. Verified with in-memory FTS5 that old terms are correctly removed.
- **Files modified:** `web/lib/queries/drive.ts`, `web/lib/queries/drive.test.ts`
- **Verification:** Test "updates FTS index so new terms are findable and old terms are removed" passes
- **Committed in:** fc56207 / 0fa763d (auto-saved)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correction for FTS5 index correctness. Without it, deleted/updated skills would leave ghost tokens in the search index.

## Issues Encountered

- `mock.module` with `before()` approach failed — module resolution error for `base.js`. Resolved by following established webhook test pattern: `mock.module` at top level before dynamic import, `before()` only for fixture insertion.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `searchSkills` is ready for Phase 6 (Task Matching) to retrieve relevant SOPs by keyword and channel
- All exports available via `web/lib/queries/index.ts` barrel (export * from drive.js)
- Callers of `syncSkillFts` must capture old title+content from skills row BEFORE updating it, then pass both old and new values

---
*Phase: 04-skills-library*
*Completed: 2026-04-01*
