---
phase: 09-audit-and-traceability
plan: "01"
subsystem: audit-trail
tags: [audit, sop-snapshots, task-runs, tdd]
dependency_graph:
  requires: [08-qa-and-compliance]
  provides: [SopSnapshot type, getAuditRecord query, enriched sops_used column]
  affects: [web/lib/queries/task-runs.ts, web/lib/task-matcher.ts]
tech_stack:
  added: []
  patterns: [append-only module pattern, backward-compat JSON parsing]
key_files:
  created: []
  modified:
    - web/lib/queries/task-runs.ts
    - web/lib/queries/task-runs.test.ts
    - web/lib/task-matcher.ts
    - web/lib/task-matcher.test.ts
decisions:
  - SopSnapshot stored inline at generation time — no extra DB lookup required (SkillSearchResult already has all fields)
  - parseSopsUsed returns null for old number[] rows (backward compat) — existing rows are not migrated
  - getAuditRecord spreads TaskRunRow fields — keeps AuditRecord in sync without manual field listing
metrics:
  duration: 358s
  completed: "2026-04-02"
  tasks: 2
  files: 4
---

# Phase 9 Plan 1: SOP Snapshot Audit Trail Summary

Enriched the task_runs audit trail so every draft generation stores full SOP metadata ({id, title, drive_modified_at, content_hash}) instead of bare IDs, and added a typed read path for Phase 10 consumption.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SopSnapshot type, getAuditRecord query, append-only policy | ea223a6 | task-runs.ts, task-runs.test.ts |
| 2 | Wire assembleContext to write enriched SOP snapshots | 8e45b60 | task-matcher.ts, task-matcher.test.ts |

## What Was Built

**task-runs.ts changes:**
- Added `SopSnapshot` exported interface: `{ id, title, drive_modified_at, content_hash }`
- Added `AuditRecord` exported interface: typed read projection with `sops_used: SopSnapshot[] | null`
- Added `parseSopsUsed(raw)` helper with backward compatibility — returns `null` for old `number[]` format rows
- Added `getAuditRecord(id)` exported function returning `AuditRecord | null`
- Changed `updateTaskRunStatus` `extras.sopsUsed` type from `number[]` to `SopSnapshot[]`
- Added append-only module header comment (AUDT-03)

**task-matcher.ts changes:**
- Imported `SopSnapshot` type from queries/task-runs.js
- Replaced `sopIds = results.map(r => r.id)` with `sopSnapshots = results.map(s => ({ id, title, drive_modified_at, content_hash }))`
- Passes enriched `sopSnapshots` to `updateTaskRunStatus` — no extra DB call

## Test Results

- 35/37 tests pass
- 2 pre-existing failures in `task-runs.test.ts` assembleContext suite (QA checker not mocked in that file — unrelated to this plan's changes)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `web/lib/queries/task-runs.ts` — modified
- [x] `web/lib/task-matcher.ts` — modified
- [x] `SopSnapshot` exported: `grep "export interface SopSnapshot" web/lib/queries/task-runs.ts` returns match at line 12
- [x] No DELETE export: `grep "export.*delete" web/lib/queries/task-runs.ts` returns no match
- [x] `getAuditRecord` exported: exists at end of query section
- [x] Tests green for all new test cases (getAuditRecord suite, append-only policy, Test 1b)

## Self-Check: PASSED
