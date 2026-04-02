---
phase: 07-agent-execution
plan: 02
subsystem: api
tags: [anthropic, generateDraft, task-matcher, tdd, retry-logic, structured-output]

# Dependency graph
requires:
  - phase: 07-agent-execution
    plan: 01
    provides: loadTaskTypeConfig, TaskTypeConfig, buildSystemPrompt, buildUserMessage, JSON schemas
  - phase: 06-task-matching-engine
    provides: assembleContext, searchSkills, getBrandContext, updateTaskRunStatus
provides:
  - generateDraft internal function: Anthropic API call with SOP + brand context, structured JSON output
  - updateTaskRunOutput query: atomic status=draft_ready + output JSON write
  - Retry logic: 1s backoff on first failure, failed status on second consecutive failure
  - Full assembleContext pipeline: context assembly → generating → draft generation → draft_ready
affects: [08-qa-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: tests written first (RED), implementation second (GREEN)"
    - "Mutable holder pattern for mock.module closures in node:test (per-call state)"
    - "Timer-based mock switching: setTimeout(100ms) to clear error before 1s retry delay"
    - "generateDraft retry loop: max 2 attempts, 1s backoff, internal failure handling (no rethrow)"
    - "SOP content truncation at 2000 chars per entry — defensive against very long SOPs"

key-files:
  created:
    - web/lib/task-matcher.test.ts
  modified:
    - web/lib/task-matcher.ts
    - web/lib/queries/task-runs.ts
    - web/lib/queries/task-runs.test.ts

key-decisions:
  - "generateDraft handles its own retry and failure transitions internally — assembleContext outer catch only fires on unexpected errors"
  - "updateTaskRunOutput atomically sets status=draft_ready and writes output in a single UPDATE — no separate status transition"
  - "Empty sources array treated as retryable failure (same path as API error) — sources are required for SOP attribution traceability"
  - "JSON parse failure treated as retryable failure — API reliability, not schema, may be the cause"
  - "output_config.format json_schema passed to Anthropic API with @ts-expect-error — not yet in SDK types but supported by API"
  - "task-runs.test.ts assembleContext assertions updated from generating to draft_ready — Phase 7 extends the pipeline"

patterns-established:
  - "generateDraft pattern: load config → build prompts → call API → parse → validate sources → store output"
  - "Timer-based mock state switching for async retry tests: set error → setTimeout(100ms) → clear before 1s retry"

requirements-completed: [TASK-04]

# Metrics
duration: 440s
completed: 2026-04-02
---

# Phase 7 Plan 2: generateDraft LLM Integration Summary

**generateDraft calls the Anthropic API (claude-sonnet-4-6) with assembled SOP + brand context, produces structured JSON output with non-empty sources array, stores it atomically via updateTaskRunOutput, and retries once on failure before transitioning to failed**

## Performance

- **Duration:** 440s (~7 min, includes 1s retry delays in test suite)
- **Started:** 2026-04-02T08:15:34Z
- **Completed:** 2026-04-02T08:22:54Z
- **Tasks:** 2 (TDD: 2 commits for Task 2)
- **Files modified:** 4

## Accomplishments

- `updateTaskRunOutput` query atomically sets status=draft_ready and writes output JSON in a single UPDATE
- `generateDraft` internal function: loads task type config, builds SOP + brand prompts, calls Anthropic API, parses JSON response
- Retry logic: 1 second backoff then single retry; two consecutive failures transition to `failed` without re-throwing (fire-and-forget safe)
- JSON parse failure and empty sources array both treated as retryable errors
- SOP content truncated at 2000 chars per entry with console.warn logging
- Missing `ANTHROPIC_API_KEY` throws immediately without retry (surface the config error)
- Full `assembleContext` pipeline now ends at `draft_ready` on success: queued → generating → draft_ready
- 47 tests across 13 suites (plan scope), 87 tests across full suite — all passing
- Existing Phase 6 assembleContext tests updated to reflect new `draft_ready` final status

## Task Commits

Each task was committed atomically (via auto-commit process):

1. **Task 1: updateTaskRunOutput** — committed via auto: commits (07378f1, 4f122e5, aeb4858)
2. **Task 2 (RED): failing tests** — `126ae0a` (test)
3. **Task 2 (GREEN): implementation** — committed via auto: commits (6112335, dba3ddb, 57cfaa0, 4ad888e, c985c97, 7801654)

## Files Created/Modified

- `web/lib/task-matcher.ts` — Extended with `generateDraft` function and updated `assembleContext` step 6
- `web/lib/task-matcher.test.ts` — New file: 7 test cases for `generateDraft` via `assembleContext` (mocked Anthropic SDK, TDD pattern)
- `web/lib/queries/task-runs.ts` — Added `updateTaskRunOutput` query function
- `web/lib/queries/task-runs.test.ts` — Added `updateTaskRunOutput` test cases; added SDK mock + updated assembleContext assertions for Phase 7

## Decisions Made

- `generateDraft` handles its own retry and failure transitions internally so `assembleContext`'s outer catch only fires on truly unexpected errors
- `updateTaskRunOutput` uses a single atomic UPDATE for status + output rather than two sequential writes
- Empty sources array treated as a retryable failure (same code path as API/parse errors) — enforces the SOP attribution invariant from Phase 7 Plan 1
- `output_config.format` with `json_schema` passed with `@ts-expect-error` — the field is supported by the Anthropic API but not yet reflected in SDK TypeScript types
- `task-runs.test.ts` assembleContext status assertions updated from `generating` to `draft_ready` to reflect the fully assembled pipeline in Phase 7

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing assembleContext tests in task-runs.test.ts needed updating**
- **Found during:** Task 2 GREEN phase
- **Issue:** Phase 6 tests asserted `status=generating` as the final state; Phase 7 adds `generateDraft` which transitions to `draft_ready`, causing 3 test failures in the full suite
- **Fix:** Added `@anthropic-ai/sdk` mock, `task-types/index.js` mock, and API key to `task-runs.test.ts`; updated 2 status assertions from `generating` to `draft_ready`
- **Files modified:** `web/lib/queries/task-runs.test.ts`
- **Commit:** auto-committed (7801654, c985c97)

## Issues Encountered

None beyond the auto-fixed test update above.

## User Setup Required

`ANTHROPIC_API_KEY` must be set in `.env.local` for `generateDraft` to function in production. The function throws immediately if the key is missing — this surfaces the config error at generation time rather than silently failing.

## Next Phase Readiness

- `assembleContext` now produces `task_runs.output` (structured JSON) with status `draft_ready`
- Phase 8 (QA validation) can read `output` from `task_runs` where `status = 'draft_ready'` and validate against channel-specific rules
- `sources` array in every output provides SOP attribution for audit trail

## Self-Check: PASSED

- `web/lib/task-matcher.ts` — FOUND
- `web/lib/task-matcher.test.ts` — FOUND
- `web/lib/queries/task-runs.ts` — FOUND
- `.planning/phases/07-agent-execution/07-02-SUMMARY.md` — FOUND
- Commit `126ae0a` (RED phase tests) — FOUND

---
*Phase: 07-agent-execution*
*Completed: 2026-04-02*
