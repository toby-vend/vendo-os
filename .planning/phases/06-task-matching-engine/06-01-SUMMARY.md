---
phase: 06-task-matching-engine
plan: 01
subsystem: database
tags: [libsql, sqlite, task-runs, sop-matching, brand-context]

# Dependency graph
requires:
  - phase: 04-skills-library
    provides: searchSkills FTS5 search returning SkillSearchResponse with gap flag
  - phase: 05-brand-hub
    provides: getBrandContext returning BrandHubRow[], brand_hub table with client_slug
provides:
  - task_runs CRUD: createTaskRun, updateTaskRunStatus, getTaskRun, listTaskRuns
  - TaskRunRow and TaskRunStatus types
  - assembleContext function — SOP retrieval + brand context injection + status transitions
affects:
  - 06-02-task-matching-engine (HTTP route calls assembleContext and createTaskRun)
  - 07-ai-draft-generation (reads sops_used and brand_context_id from task_runs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD with node:test + in-memory libsql — mock.module at top level, dynamic import after
    - mutable holder objects for per-test mock control without re-registering mocks
    - updateTaskRunStatus extras pattern for optional JSON sops_used + integer brand_context_id

key-files:
  created:
    - web/lib/queries/task-runs.ts
    - web/lib/queries/task-runs.test.ts
    - web/lib/task-matcher.ts
  modified:
    - web/lib/queries/index.ts

key-decisions:
  - "COALESCE in updateTaskRunStatus preserves existing sops_used/brand_context_id when extras not passed — avoids nulling columns on simple status updates"
  - "assembleContext takes clientId not clientSlug — resolveClientSlug() does the brand_hub lookup internally, keeping the call signature clean for the HTTP route"
  - "resolveClientSlug returns null (not throws) when no brand_hub row — missing brand is not a failure condition per plan spec"
  - "mutable driveHolder/brandHolder objects enable per-test mock state without re-registering mocks (node:test mock.module runs once at module level)"

patterns-established:
  - "Mutable holder pattern: mock.module closure captures a mutable object; tests mutate the object's properties to control mock responses per test"
  - "resolveClientSlug internal helper: never exported, wraps a single scalar query with console.warn on null"

requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-07]

# Metrics
duration: 4min
completed: 2026-04-01
---

# Phase 6 Plan 01: Task Matching Engine — Data Layer Summary

**task_runs CRUD module (createTaskRun/updateTaskRunStatus/getTaskRun/listTaskRuns) and assembleContext engine — SOP retrieval via searchSkills, brand context injection via getBrandContext, gap detection, and status transitions**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-01T22:05:00Z
- **Completed:** 2026-04-01T22:09:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `task-runs.ts` query module with full CRUD, status transitions, and typed exports
- `task-matcher.ts` assembleContext engine — retrieves SOPs, resolves brand context, handles gap detection and error fallback
- 18 tests passing (13 for query module, 5 for assembleContext), zero regressions across all 58 tests in the suite

## Task Commits

1. **Task 1: Task runs query module with TDD tests** — `7f859d3` (feat)
2. **Task 2: Context assembly engine (task-matcher.ts)** — `0ba6c03` (feat)

## Files Created/Modified

- `web/lib/queries/task-runs.ts` — TaskRunStatus type, TaskRunRow interface, createTaskRun, updateTaskRunStatus, getTaskRun, listTaskRuns
- `web/lib/queries/task-runs.test.ts` — 18 tests covering all query functions and assembleContext
- `web/lib/task-matcher.ts` — assembleContext with resolveClientSlug helper
- `web/lib/queries/index.ts` — barrel re-export of task-runs.js added

## Decisions Made

- **COALESCE in updateTaskRunStatus:** `SET sops_used = COALESCE(?, sops_used)` preserves existing column values when extras are not passed. Without this, a plain status update would null out sops_used written by a previous call.
- **assembleContext signature uses clientId not clientSlug:** The HTTP route will pass clientId from the task assignment payload; the function resolves the slug internally via resolveClientSlug(), keeping the boundary clean.
- **Missing brand is not a failure:** When resolveClientSlug returns null (no brand_hub row for client), assembleContext logs a warning and proceeds with brand_context_id=null, as specified in the plan.
- **Mutable holder pattern for mocks:** node:test mock.module runs once at module load time. To vary mock responses across tests, the mock closure captures a mutable holder object and tests mutate its properties directly. Avoids the need to re-register mocks or use dynamic imports per test.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `createTaskRun`, `assembleContext`, `TaskRunRow`, `TaskRunStatus` all exported and tested
- Plan 02 can build the HTTP POST `/api/tasks` route calling createTaskRun + assembleContext directly
- No blockers

---
*Phase: 06-task-matching-engine*
*Completed: 2026-04-01*

## Self-Check: PASSED

- web/lib/queries/task-runs.ts: FOUND
- web/lib/queries/task-runs.test.ts: FOUND
- web/lib/task-matcher.ts: FOUND
- .planning/phases/06-task-matching-engine/06-01-SUMMARY.md: FOUND
- Commit 7f859d3: FOUND
- Commit 0ba6c03: FOUND
