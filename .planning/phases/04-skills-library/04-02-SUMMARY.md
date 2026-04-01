---
phase: 04-skills-library
plan: 02
subsystem: database
tags: [fts5, libsql, turso, search, skills]

# Dependency graph
requires:
  - phase: 04-01
    provides: FTS5 helpers syncSkillFts, deleteSkillFts, searchSkills — used inline in mutation functions

provides:
  - updateSkillContent with inline FTS5 sync (fetches old values before upsert, re-indexes after)
  - updateSkillMetadata with inline FTS5 sync (re-indexes with new title, existing content)
  - deleteSkill with inline FTS5 removal before skills row deletion
  - SKILL_TYPE_MAP controlled vocabulary (8 subfolder slugs → canonical skill_type values)
  - resolveSkillType using SKILL_TYPE_MAP; unknown subfolders fall back to 'general'

affects:
  - phase 05 (skill search route — consumes searchSkills and types from barrel)
  - phase 06 (SKILL_TYPE_MAP exported for taxonomy reference)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fetch-before-mutate: read old title/content before upsert/delete to supply correct old values to FTS5 content-sync delete
    - Controlled vocabulary map: Record<string,string> lookup before falling back to default
    - FTS5 sync sequencing: deleteSkillFts always before DELETE FROM skills; syncSkillFts always after upsert

key-files:
  created: []
  modified:
    - web/lib/queries/drive.ts
    - web/lib/drive-sync.ts

key-decisions:
  - "updateSkillContent fetches old row BEFORE upsert (not after) so old FTS5 values are available for the content-sync delete step"
  - "New INSERT path uses empty strings for FTS5 delete step (no prior entry — no-op for content-sync table)"
  - "Unknown subfolder names fall back to 'general' (not raw slug) per CONTEXT.md decision"
  - "SKILL_TYPE_MAP exported for Phase 6 reference and testability"

patterns-established:
  - "Fetch-before-mutate for FTS5 sync: always read old values before any write that needs to remove old FTS tokens"
  - "FTS5 delete ordering: remove FTS entry before removing skills row to avoid content-sync table integrity errors"

requirements-completed: [SKIL-04]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 04 Plan 02: Skills Library FTS5 Integration Summary

**FTS5 index wired inline into all skill mutation paths — updateSkillContent, updateSkillMetadata, and deleteSkill now sync FTS5 automatically; resolveSkillType uses an 8-entry controlled vocabulary map with 'general' fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T21:36:42Z
- **Completed:** 2026-04-01T21:38:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All three skill mutation functions now keep FTS5 in sync inline — no batch rebuild required
- deleteSkill correctly removes FTS5 entry before the skills row (required by content-sync tables)
- SKILL_TYPE_MAP provides deterministic, auditable mapping for 8 known subfolder types
- resolveSkillType falls back to 'general' for unknown subfolders (was returning raw slug)
- All 18 existing tests pass; TypeScript clean in web/ directory

## Task Commits

Each task was committed atomically (via auto-save hooks):

1. **Task 1: Wire FTS5 sync into skill mutation functions** - `15bf5e9` (feat)
2. **Task 2: Extend skill type taxonomy and update barrel exports** - `da5c721` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `web/lib/queries/drive.ts` — updateSkillContent, updateSkillMetadata, deleteSkill each updated with inline FTS5 sync calls
- `web/lib/drive-sync.ts` — SKILL_TYPE_MAP added and exported; resolveSkillType updated to use controlled vocabulary with 'general' fallback

## Decisions Made

- Fetch old row BEFORE upsert in updateSkillContent so old title/content are available for the FTS5 delete step — the upsert overwrites them
- New INSERT path passes empty strings to syncSkillFts delete step (no prior FTS5 entry exists — empty string delete is a safe no-op for content-sync tables)
- SKILL_TYPE_MAP exported (not kept private) so Phase 6 can reference the vocabulary without redefining it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected syncSkillFts call strategy for updateSkillContent**
- **Found during:** Task 1 (Wire FTS5 sync into skill mutation functions)
- **Issue:** Plan assumed syncSkillFts(rowid, title, content) signature, but the actual signature is syncSkillFts(rowid, oldTitle, oldContent, newTitle, newContent) per Plan 01 deviation. After an upsert the old values are gone, so they must be fetched before the upsert.
- **Fix:** Added a SELECT rowid, title, content query before the upsert. On INSERT path, pass empty strings for old values.
- **Files modified:** web/lib/queries/drive.ts
- **Verification:** 18 tests pass including syncSkillFts and deleteSkillFts tests
- **Committed in:** 15bf5e9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug correction for known signature mismatch)
**Impact on plan:** Required adjustment; no scope change. The deviation was flagged in the execution context and handled correctly.

## Issues Encountered

None beyond the known syncSkillFts signature mismatch documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- FTS5 search index stays current automatically on every write
- searchSkills, SkillSearchResult, SkillSearchResponse, SkillVersionInfo all re-exported via web/lib/queries/index.ts barrel
- SKILL_TYPE_MAP exported from web/lib/drive-sync.ts for Phase 6 reference
- Ready for Phase 05: skills search route and API endpoint

---
*Phase: 04-skills-library*
*Completed: 2026-04-01*
