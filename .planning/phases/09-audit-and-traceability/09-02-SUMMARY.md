---
phase: 09-audit-and-traceability
plan: "02"
subsystem: audit-trail
tags: [audit, sop-snapshots, task-runs, gap-closure, tdd]
dependency_graph:
  requires: [09-01]
  provides: [parsed AuditRecord on GET /runs/:id, qa-checker mock, BEFORE DELETE trigger attempt]
  affects: [web/routes/task-runs.ts, web/lib/queries/task-runs.test.ts, web/lib/queries/auth.ts]
tech_stack:
  added: []
  patterns: [try/catch DDL for unsupported trigger, mutable holder pattern for mock.module]
key_files:
  created: []
  modified:
    - web/routes/task-runs.ts
    - web/lib/queries/task-runs.test.ts
    - web/lib/queries/auth.ts
decisions:
  - BEFORE DELETE trigger wrapped in try/catch — Turso/libsql may not support DDL triggers; silent catch is intentional with app-layer as primary enforcer
  - getAuditRecord replaces getTaskRun in GET /runs/:id — returns parsed SopSnapshot[] not raw JSON string (AUDT-02)
  - qa-checker mock uses mutable holder pattern matching established convention in this test file
metrics:
  duration: 176s
  completed: "2026-04-02"
  tasks: 2
  files: 3
---

# Phase 9 Plan 2: Audit Trail Gap Closure Summary

Closed three verification gaps from Plan 01: wired `getAuditRecord` into `GET /runs/:id` so API consumers receive parsed SOP names, added a BEFORE DELETE trigger attempt in `initSchema` for database-level append-only enforcement, and fixed two pre-existing test failures by adding a `qa-checker` mock to the test suite.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire getAuditRecord into GET /runs/:id, add qa-checker mock | 4438c1d, c254514 | task-runs.ts (route), task-runs.test.ts |
| 2 | BEFORE DELETE trigger on task_runs in initSchema | b0f87e0 | auth.ts |

## What Was Built

**web/routes/task-runs.ts changes:**
- Added `getAuditRecord` to import alongside `getTaskRun`
- `GET /runs/:id` handler now calls `getAuditRecord(id)` instead of `getTaskRun(id)` — returns `AuditRecord` with `sops_used: SopSnapshot[] | null` (parsed), not raw JSON string

**web/lib/queries/task-runs.test.ts changes:**
- Added `qaCheckerHolder` mutable holder object
- Added `mock.module('../qa-checker.js', ...)` calling `runSOPCheck` from the holder — inserted after `task-types/index.js` mock, before dynamic imports
- Fixed 2 pre-existing `assembleContext` test failures (now all 26 tests pass; 37 across both test files)

**web/lib/queries/auth.ts changes:**
- Added BEFORE DELETE trigger attempt in `initSchema` after task_runs indexes
- Wrapped in try/catch — if Turso/libsql doesn't support CREATE TRIGGER DDL, silently continues; app-layer constraint (no DELETE export in task-runs.ts) remains primary enforcer
- No other schema changes made

## Test Results

- 37/37 tests pass across task-runs.test.ts and task-matcher.test.ts (was 35/37 before)
- 26/26 in task-runs.test.ts (was 24/26 — 2 assembleContext failures fixed)
- 11/11 in task-matcher.test.ts (unchanged)

## Deviations from Plan

### Auto-fixed Issues

None.

**Note on append-only test:** The plan specified adding a `does not export any delete function` test to the `append-only policy` describe block. This test already existed (added in Plan 01) with slightly different but equivalent logic (also checks `remove.*task` pattern). No duplication needed.

## Self-Check

- [x] `web/routes/task-runs.ts` — `getAuditRecord` imported and called in GET /runs/:id
- [x] `web/lib/queries/task-runs.test.ts` — `qa-checker` mock present
- [x] `web/lib/queries/auth.ts` — `prevent_task_run_delete` trigger attempted in initSchema
- [x] All 37 tests pass: `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/task-matcher.test.ts`
- [x] No DELETE export from task-runs.ts confirmed by test and grep
- [x] Commits: 4438c1d (route), c254514 (test mock), b0f87e0 (trigger)

## Self-Check: PASSED
