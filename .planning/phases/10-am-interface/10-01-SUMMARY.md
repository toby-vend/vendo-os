---
phase: 10-am-interface
plan: "01"
subsystem: api
tags: [typescript, sqlite, task-runs, brand-hub, navigation, css]

requires:
  - phase: 09-audit-and-traceability
    provides: "task_runs schema with sops_used, getAuditRecord, TaskRunStatus type"
  - phase: 05-brand-hub
    provides: "brand_hub table with client_id/client_name for JOIN"

provides:
  - "TaskRunStatus union extended with 'rejected' status"
  - "TaskRunListRow interface with client_name from brand_hub LEFT JOIN"
  - "listTaskRuns extended with channel/dateFrom/dateTo/offset filters"
  - "VALID_STATUSES array includes 'rejected'"
  - "GET /runs accepts channel query param"
  - "Asana routes moved to /asana-tasks prefix, /tasks free for AM UI"
  - "Navigation: Content Tasks, Asana Tasks, Skills links"
  - "Seven task run status badge CSS classes"

affects: [10-am-interface-02, 10-am-interface-03]

tech-stack:
  added: []
  patterns:
    - "TaskRunListRow extends TaskRunRow pattern for query-specific row shapes"
    - "LEFT JOIN subquery on brand_hub GROUP BY client_id to avoid duplicate rows"

key-files:
  created: []
  modified:
    - web/lib/queries/task-runs.ts
    - web/routes/task-runs.ts
    - web/server.ts
    - web/views/layouts/base.eta
    - web/public/style.css

key-decisions:
  - "TaskRunListRow extends TaskRunRow rather than duplicating fields — keeps type hierarchy clean"
  - "dateTo filter appends T23:59:59.999Z to make it inclusive of the full day"
  - "Asana Tasks nav link uses canSee('tasks') guard (same permission as Content Tasks)"
  - "Skills nav link uses canSee('drive') guard — skills are Drive-derived, same permission"

patterns-established:
  - "Extended list row interface pattern: create XxxListRow extends XxxRow for views with JOINs"

requirements-completed: [UI-05]

duration: 5min
completed: 2026-04-02
---

# Phase 10 Plan 01: AM Interface Foundation Summary

**`rejected` status added to TaskRunStatus, listTaskRuns extended with brand_hub JOIN and channel/date/offset filters, Asana routes freed from /tasks prefix, seven badge CSS classes and updated navigation in place**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T13:30:00Z
- **Completed:** 2026-04-02T13:37:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended `TaskRunStatus` union with `'rejected'` and aligned `VALID_STATUSES` array
- Rewrote `listTaskRuns` with full filter set (channel, dateFrom, dateTo, offset, limit) and LEFT JOIN on brand_hub returning `TaskRunListRow` with `client_name`
- Moved Asana routes to `/asana-tasks`, freeing `/tasks` prefix for the AM task-run UI in Plan 02
- Updated sidebar nav with Content Tasks, Asana Tasks, and Skills links; updated `pageNames` map
- Added seven `.badge-{status}` CSS classes for all task run statuses

## Task Commits

1. **Task 1: Extend TaskRunStatus and listTaskRuns query** - `3bc982b` (feat)
2. **Task 2: Move Asana routes, add nav link and badge CSS** - `72867dd` (feat)

## Files Created/Modified
- `web/lib/queries/task-runs.ts` - Added `'rejected'` to union, added `TaskRunListRow`, rewrote `listTaskRuns` with extended filters and brand_hub JOIN
- `web/routes/task-runs.ts` - Added `'rejected'` to `VALID_STATUSES`, added `channel` query param parsing in GET /runs
- `web/server.ts` - Moved tasksRoutes from `/tasks` to `/asana-tasks` prefix
- `web/views/layouts/base.eta` - Updated nav links (Content Tasks, Asana Tasks, Skills), updated `pageNames` map
- `web/public/style.css` - Added 7 task run status badge CSS classes

## Decisions Made
- `TaskRunListRow extends TaskRunRow` rather than duplicating fields — cleaner type hierarchy
- `dateTo` filter appends `T23:59:59.999Z` for full-day inclusion
- Skills nav link uses `canSee('drive')` guard — skills are Drive-derived content, same permission level
- Asana Tasks nav link shares the `canSee('tasks')` guard with Content Tasks

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors in `web/lib/qa-checker.ts` and `web/lib/task-matcher.ts` (unused `@ts-expect-error` directives) and in `web/lib/queries/brand.test.ts` — none related to this plan's changes, none introduced by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `TaskRunStatus` includes `'rejected'` everywhere — route validation and type system aligned
- `listTaskRuns` returns `TaskRunListRow[]` with `client_name` for display in AM task list
- `/tasks` prefix is free for Plan 02 to register the AM task-run UI routes
- Badge CSS classes ready for template use in Plans 02 and 03

---
*Phase: 10-am-interface*
*Completed: 2026-04-02*
