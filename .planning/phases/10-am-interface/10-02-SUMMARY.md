---
phase: 10-am-interface
plan: "02"
subsystem: ui
tags: [typescript, eta, htmx, fastify, task-runs, am-workflow]

requires:
  - phase: 10-am-interface
    plan: "01"
    provides: "TaskRunStatus with rejected, listTaskRuns with brand_hub JOIN, /tasks prefix free, badge CSS classes"
  - phase: 09-audit-and-traceability
    provides: "getAuditRecord returning parsed SopSnapshot[], task_runs schema"
  - phase: 07-agent-execution
    provides: "assembleContext for regenerate fire-and-forget"

provides:
  - "GET /tasks — task list with HTMX polling every 10s and filter bar"
  - "GET /tasks/new — task submission form with HTMX channel->taskType swap"
  - "POST /tasks/new — form handler forwarding to /api/tasks/runs"
  - "GET /tasks/:id — draft review page with QA/AHPRA banners, SOP attribution, actions"
  - "POST /tasks/:id/approve — transitions to approved, writes am_feedback to qa_critique"
  - "POST /tasks/:id/reject — requires reason, stores am_feedback, transitions to rejected"
  - "POST /tasks/:id/regenerate — resets to queued, re-fires assembleContext"
  - "getTaskTypesForChannel helper exported from task-types/index.ts"

affects: [10-am-interface-03]

tech-stack:
  added: []
  patterns:
    - "HTMX polling pattern: hx-get + hx-trigger='every 10s' on list wrapper div"
    - "HTMX swap pattern: channel select triggers GET /tasks/task-types to populate task type select"
    - "Fire-and-forget after redirect: reply.redirect() before assembleContext() call"
    - "qa_critique merge pattern: parse existing JSON, spread, add am_feedback key, re-serialise"
    - "app.inject() for internal API forwarding from UI route to API route"

key-files:
  created:
    - web/routes/task-runs-ui.ts
    - web/views/task-runs/new.eta
    - web/views/task-runs/list.eta
    - web/views/task-runs/list-rows.eta
    - web/views/task-runs/detail.eta
    - web/views/task-runs/partials/draft-ad-copy.eta
    - web/views/task-runs/partials/draft-content-brief.eta
    - web/views/task-runs/partials/draft-rsa-copy.eta
  modified:
    - web/lib/task-types/index.ts
    - web/server.ts

key-decisions:
  - "POST /tasks/new forwards to app.inject('/api/tasks/runs') — reuses existing validation, createTaskRun, and fire-and-forget assembleContext from Phase 6 without duplication"
  - "qa_critique merge uses spread pattern: parse existing, spread, overwrite am_feedback key — never clobbers sop_issues or ahpra_violations"
  - "Regenerate redirects before assembleContext call — guarantees redirect is sent before the async work starts"
  - "instructions field logged but not stored in v1 — no column exists, acceptable per research open question"
  - "getTaskTypesForChannel exported as helper rather than exporting REGISTRY directly — cleaner API boundary"

requirements-completed: [UI-01, UI-02, UI-03, UI-05]

duration: 278
completed: 2026-04-02
---

# Phase 10 Plan 02: AM Task Workflow UI Summary

**Full AM task workflow: submission form with HTMX channel/task-type swap, live-polling task list, and draft review page with approve/reject/regenerate actions and channel-specific card layouts**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T13:38:00Z
- **Completed:** 2026-04-02T13:43:25Z
- **Tasks:** 2
- **Files modified/created:** 10

## Accomplishments

- Created `taskRunsUiRoutes` FastifyPluginAsync registered at `/tasks` in server.ts
- Task submission form with searchable client select, HTMX-driven channel→task type swap via GET /tasks/task-types
- Task list at /tasks with filter bar (status, client, channel, date range) and HTMX polling every 10 seconds
- GET /tasks/rows partial for HTMX polling swaps
- Draft review page with AHPRA violations (red banner), SOP QA issues (yellow banner), and collapsible SOP attribution section
- Approve, reject (with required reason), regenerate (with optional comment) actions
- am_feedback merged into existing qa_critique JSON without clobbering sop_issues or ahpra_violations
- Regenerate resets status to queued and re-fires assembleContext fire-and-forget
- Three channel-specific draft partials: ad copy variant cards, content brief with meta/sections, RSA copy with character count indicators
- `getTaskTypesForChannel` helper exported from task-types/index.ts
- POST /tasks/new forwards to internal API route via app.inject() to avoid duplicating creation logic

## Task Commits

1. **Task 1: Route module and task submission form** - `fd3d6c0` (feat)
2. **Task 2: Draft review page with actions and channel-specific templates** - `cf639af` (feat)

## Files Created/Modified

- `web/lib/task-types/index.ts` - Added `getTaskTypesForChannel` helper
- `web/server.ts` - Registered `taskRunsUiRoutes` at `/tasks` prefix
- `web/routes/task-runs-ui.ts` - All UI routes: GET /, /rows, /new, /task-types, /:id and POST /new, /:id/approve, /:id/reject, /:id/regenerate
- `web/views/task-runs/new.eta` - Task submission form with HTMX task type swap
- `web/views/task-runs/list.eta` - Task list page with filter bar and HTMX polling wrapper
- `web/views/task-runs/list-rows.eta` - HTMX rows partial (table only)
- `web/views/task-runs/detail.eta` - Draft review page with QA banners, SOP attribution, action forms
- `web/views/task-runs/partials/draft-ad-copy.eta` - Ad copy variant cards
- `web/views/task-runs/partials/draft-content-brief.eta` - Content brief card layout
- `web/views/task-runs/partials/draft-rsa-copy.eta` - RSA copy with character count indicators

## Decisions Made

- POST /tasks/new uses app.inject() to forward to /api/tasks/runs — avoids duplicating createTaskRun + fire-and-forget assembleContext logic
- qa_critique merge pattern: parse existing JSON, spread, set am_feedback key — sop_issues and ahpra_violations are preserved as-is
- Regenerate sends redirect before assembleContext call — matches Phase 6 fire-and-forget pattern (reply before async work)
- instructions field captured and logged but not stored (no column) — acceptable for v1 per research
- getTaskTypesForChannel as a named export rather than exporting the raw REGISTRY Map

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `web/lib/task-matcher.ts` (unused @ts-expect-error), `web/lib/qa-checker.ts`, `web/lib/queries/brand.test.ts`, and `scripts/` (sql.js missing types) — none related to this plan, none introduced by it.

## Self-Check

Files created:
- web/routes/task-runs-ui.ts — exists
- web/views/task-runs/new.eta — exists
- web/views/task-runs/list.eta — exists
- web/views/task-runs/list-rows.eta — exists
- web/views/task-runs/detail.eta — exists
- web/views/task-runs/partials/draft-ad-copy.eta — exists
- web/views/task-runs/partials/draft-content-brief.eta — exists
- web/views/task-runs/partials/draft-rsa-copy.eta — exists

Commits:
- fd3d6c0 — Task 1
- cf639af — Task 2

## Self-Check: PASSED
