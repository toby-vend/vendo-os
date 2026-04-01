---
phase: 01-infrastructure
plan: 03
subsystem: database
tags: [libsql, turso, typescript, barrel-export, refactor]

# Dependency graph
requires:
  - phase: 01-infrastructure-01
    provides: google_connected column in getAllUsers, user_oauth_tokens table
  - phase: 01-infrastructure-02
    provides: initSchema with 5 new tables (skills, brand_hub, drive_watch_channels, task_runs, skills_fts)

provides:
  - web/lib/queries/ domain module directory (base, meetings, auth, dashboard, pipeline, ads)
  - web/lib/queries.ts thin barrel re-export for zero import-path changes
  - Smoke test verifying all exports resolve from barrel
  - getSyncStatus double-query bug fix
  - Clean home for future skills/brand query modules

affects: [skills, brand, drive, tasks, all-phases-using-queries]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain module split: one file per domain area (meetings, auth, dashboard, pipeline, ads)"
    - "Barrel re-export: queries.ts re-exports from queries/index.ts for zero consumer changes"
    - "Thin barrel pattern: queries.ts is 3 lines; all logic lives in domain modules"

key-files:
  created:
    - web/lib/queries/base.ts
    - web/lib/queries/meetings.ts
    - web/lib/queries/auth.ts
    - web/lib/queries/dashboard.ts
    - web/lib/queries/pipeline.ts
    - web/lib/queries/ads.ts
    - web/lib/queries/index.ts
    - web/lib/queries/index.test.ts
  modified:
    - web/lib/queries.ts (converted from monolith to 3-line barrel)
    - web/routes/pipeline.ts (removed dead getOpportunitiesByStage import)

key-decisions:
  - "moduleResolution: bundler does NOT auto-resolve queries.js to queries/index.js — retained queries.ts as thin barrel to avoid changing all consumer imports"
  - "Retained queries.ts as thin barrel re-export rather than deleting it — enables zero import path changes across all consumers"
  - "Removed dead getOpportunitiesByStage import from pipeline.ts — function never existed, was hidden by prior TS2307 error"

patterns-established:
  - "New domain query modules go in web/lib/queries/ — import rows/scalar/db from ./base.js"
  - "Consumer imports stay as ../lib/queries.js — barrel handles resolution"
  - "Smoke test pattern: import every export, assert typeof === function — no database needed"

requirements-completed: [INFR-01]

# Metrics
duration: 8min
completed: 2026-04-01
---

# Phase 01 Plan 03: Queries Monolith Split Summary

**750-line queries.ts split into 6 domain modules (base, meetings, auth, dashboard, pipeline, ads) with barrel re-export and 10-test smoke suite; getSyncStatus double-query bug fixed**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-01T19:34:35Z
- **Completed:** 2026-04-01T19:42:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Split 750-line monolith into 6 domain modules — each with its own interfaces and functions
- Retained `web/lib/queries.ts` as a 3-line barrel so all 17+ consumer imports stay unchanged
- Fixed `getSyncStatus` double-query bug: `ghl_opportunities` was queried twice; now resolved once via `Promise.all`
- 10-test smoke suite proves every previously-exported symbol resolves from the barrel
- Removed dead `getOpportunitiesByStage` import from `pipeline.ts` (function never existed)

## Task Commits

1. **Task 1: Split queries.ts into domain modules** - `1417a5a` (refactor)
2. **Task 2: Smoke test verifying all exports resolve** - `15b0c45` (test)

**Plan metadata:** (final commit follows)

## Files Created/Modified

- `web/lib/queries/base.ts` — db client, rows/scalar helpers; exported so domain modules can import
- `web/lib/queries/meetings.ts` — MeetingRow, ActionItemRow, searchMeetings, getMeetingById, getActionItems, filter helpers
- `web/lib/queries/auth.ts` — UserRow, ChannelRow, UserOAuthTokenRow, all user/channel/permission/OAuth/initSchema functions
- `web/lib/queries/dashboard.ts` — DashboardStats, ClientRow, SyncLogRow, getDashboardStats, getSyncStatus (bug fixed), listBriefs, getBriefContent
- `web/lib/queries/pipeline.ts` — PipelineOverview, OpportunityRow, getPipelineOverview, getRecentOpportunities, getWonDeals, getStalledDeals
- `web/lib/queries/ads.ts` — AdAccountSummary, CampaignSummary, getAdAccountSummary, getCampaignSummary
- `web/lib/queries/index.ts` — barrel re-export of all 6 modules
- `web/lib/queries/index.test.ts` — 10-test smoke suite (node:test + tsx)
- `web/lib/queries.ts` — converted from 750-line monolith to 3-line barrel: `export * from './queries/index.js'`
- `web/routes/pipeline.ts` — removed dead `getOpportunitiesByStage` import

## Decisions Made

- `moduleResolution: "bundler"` in tsconfig does NOT auto-resolve `queries.js` → `queries/index.js` (that's `node16`/`nodenext` behaviour). Retaining `queries.ts` as a thin barrel was the correct fix — zero consumer changes required.
- Kept `web/lib/queries.ts` rather than deleting it. The plan assumed deletion would work; it does not with `bundler` resolution.
- `getOpportunitiesByStage` was a dead import in `pipeline.ts` — the function never existed in `queries.ts`. Previously hidden by TS2307 (module not found); exposed once module resolved. Removed as a Rule 1 auto-fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retained queries.ts as thin barrel instead of deleting it**
- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** Plan specified deleting `queries.ts` and relying on TypeScript's `moduleResolution: "bundler"` to resolve `queries.js` → `queries/index.js`. This only works with `node16`/`nodenext` resolution, not `bundler`. All 17+ consumer imports produced TS2307 after deletion.
- **Fix:** Recreated `queries.ts` as a 3-line barrel: `export * from './queries/index.js'`. This satisfies TypeScript while keeping all consumer imports unchanged.
- **Files modified:** web/lib/queries.ts
- **Verification:** `npx tsc --noEmit` — zero errors in web layer
- **Committed in:** 1417a5a (Task 1 commit)

**2. [Rule 1 - Bug] Removed dead getOpportunitiesByStage import from pipeline.ts**
- **Found during:** Task 1 (TypeScript compile check after module resolution fix)
- **Issue:** `web/routes/pipeline.ts` imported `getOpportunitiesByStage` which never existed in `queries.ts`. Previously hidden behind TS2307; became visible once module resolved.
- **Fix:** Removed the import line. The function is never called in the route body.
- **Files modified:** web/routes/pipeline.ts
- **Verification:** `npx tsc --noEmit` — zero errors
- **Committed in:** 1417a5a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. The barrel retention preserves the plan's stated goal (zero consumer import changes). No scope creep.

## Issues Encountered

- TypeScript `moduleResolution: "bundler"` does not support directory-index resolution (`queries.js` → `queries/index.js`). Only `node16`/`nodenext` support this. Resolved by keeping `queries.ts` as a thin barrel.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

All 9 created/modified files exist on disk. Both task commits (1417a5a, 15b0c45) verified in git log.

## Next Phase Readiness

- Domain module structure is ready for Phase 4/5 skills and brand query modules
- Add new modules to `web/lib/queries/` and re-export from `web/lib/queries/index.ts`
- All existing consumers continue to import from `../lib/queries.js` unchanged

---
*Phase: 01-infrastructure*
*Completed: 2026-04-01*
