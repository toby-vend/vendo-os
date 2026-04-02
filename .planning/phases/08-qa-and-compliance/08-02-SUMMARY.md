---
phase: 08-qa-and-compliance
plan: 02
subsystem: qa-compliance
tags: [qa, llm-judge, haiku, ahpra, retry-loop, typescript, node-test, tdd]

# Dependency graph
requires:
  - phase: 08-qa-and-compliance
    plan: 01
    provides: checkAHPRACompliance and AHPRAViolation types
  - phase: 07-agent-execution
    provides: generateDraft pipeline that this QA module gates
provides:
  - runSOPCheck: Haiku LLM-as-judge SOP evaluation returning pass/fail + critique
  - QA retry loop: 3-attempt cycle with critique injection in task-matcher.ts
  - updateTaskRunQA: targeted QA score+critique update (task-runs.ts)
  - incrementAttempts: per-QA-cycle attempt counter increment (task-runs.ts)
affects:
  - Every draft entering draft_ready now passes through SOP QA and AHPRA compliance
  - qa_critique JSON always contains both sop_issues and ahpra_violations sections

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LLM-as-judge pattern using Haiku for cost-effective QA evaluation
    - Mutable holder pattern for controlling mock responses per test in node:test
    - Retry-with-critique: prepend previous failure analysis to next generation attempt
    - Fail-safe QA: on QA infrastructure error, transition to failed not stuck at qa_check

key-files:
  created:
    - web/lib/qa-checker.ts
    - web/lib/qa-checker.test.ts
  modified:
    - web/lib/queries/task-runs.ts
    - web/lib/task-matcher.ts
    - web/lib/task-matcher.test.ts

key-decisions:
  - "runSOPCheck is the only export from qa-checker.ts — retry loop and AHPRA wiring live in task-matcher.ts, keeping the QA checker a pure evaluation function"
  - "SOP content capped at 1500 chars in QA judge prompt — defensive cap consistent with 2000-char cap in generation; Haiku context is large but be consistent"
  - "MAX_ATTEMPTS changed from 2 to 3 — the old retry was for API errors; new retry is for QA failures (3 total: initial + 2 QA retries)"
  - "On QA infrastructure error (Haiku down), transition to failed not qa_check — prevents tasks stuck in qa_check indefinitely"
  - "qa_critique JSON always contains both sop_issues and ahpra_violations — even on SOP pass, AHPRA check runs and violations are recorded for AM visibility"
  - "buildRetryMessage prefixes critique with 'Previous attempt failed QA. Issues:' — consistent format that the LLM can act on"

requirements-completed: [QA-01, QA-02, QA-03]

# Metrics
duration: 329s
completed: 2026-04-02
---

# Phase 08 Plan 02: QA Checker and Retry Loop Summary

**Haiku LLM-as-judge SOP QA checker wired into generateDraft with 3-attempt retry-with-critique loop; AHPRA compliance always runs before draft_ready**

## Performance

- **Duration:** 5 min 29 sec
- **Started:** 2026-04-02T09:46:15Z
- **Completed:** 2026-04-02T09:51:44Z
- **Tasks:** 2 (TDD: RED commit + GREEN implementation)
- **Files modified:** 5

## Accomplishments

- `web/lib/qa-checker.ts`: `runSOPCheck` calls `claude-haiku-4-5-20251001` with SOP content embedded in system prompt; returns `{ pass, critique }` — SOP capped at 1500 chars
- `web/lib/queries/task-runs.ts`: Added `updateTaskRunQA` (targeted qa_score + qa_critique update) and `incrementAttempts` (per-QA-cycle counter)
- `web/lib/task-matcher.ts`: `generateDraft` rewritten with 3-attempt QA loop — on SOP pass writes qa_score=1; on SOP fail retries with critique injected into user message; after 3 failures writes qa_score=0 and surfaces draft anyway
- AHPRA check runs on every final draft (pass or exhausted) — `checkAHPRACompliance` output always recorded in `qa_critique.ahpra_violations`
- QA infrastructure errors (Haiku down) handled: task transitions to `failed`, never stuck at `qa_check`
- 51 total tests passing across all three test files (5 in qa-checker, 36 in ahpra-rules, 10 in task-matcher)

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 | GREEN | 50badcc | updateTaskRunQA + incrementAttempts added to task-runs.ts |
| Task 2 | RED | 2f51e23 | Failing tests for qa-checker.ts |
| Task 2 | GREEN | b24650f | qa-checker.ts created; task-matcher.ts + test rewritten |

## Files Created/Modified

- `web/lib/qa-checker.ts` — `runSOPCheck` function, Haiku judge with JSON schema output, SOP content capping
- `web/lib/qa-checker.test.ts` — 5 unit tests for `runSOPCheck` (pass, fail, SOP cap, error propagation)
- `web/lib/queries/task-runs.ts` — Added `updateTaskRunQA` and `incrementAttempts` exports
- `web/lib/task-matcher.ts` — `generateDraft` QA-aware retry loop, AHPRA compliance wiring, `buildRetryMessage` helper
- `web/lib/task-matcher.test.ts` — 10 tests covering all QA flow scenarios (pass, fail, retry, exhaustion, AHPRA, QA error, gap)

## Decisions Made

- **Retry loop lives in task-matcher.ts:** The QA checker is a pure evaluation function. Loop control, AHPRA wiring, and status transitions are orchestration concerns that belong in the generation flow.
- **SOP capped at 1500 chars in QA prompt:** The generation prompt already truncates individual SOPs at 2000 chars. The QA judge receives the aggregated SOP string, capped at 1500 to keep the Haiku prompt lean.
- **MAX_ATTEMPTS = 3 (initial + 2 retries):** The previous MAX_ATTEMPTS=2 was for API-level retries. This is now QA-level retries with a different failure mode.
- **QA error → failed, not stuck:** If Haiku is unavailable, the task fails cleanly rather than sitting at `qa_check` indefinitely. This is the safe default — an AM can re-queue the task.
- **qa_critique always has both sections:** Even when SOP passes, AHPRA violations are recorded. AMs get full compliance visibility without having to assume a clean critique means AHPRA was skipped.

## Deviations from Plan

None — plan executed exactly as written. The plan suggested re-thinking the `runQACheck` interface mid-spec and landed on `runSOPCheck` as the only export; this was followed exactly.

## Issues Encountered

- `process.env.ANTHROPIC_API_KEY` not set by default in test environment — added `process.env.ANTHROPIC_API_KEY = 'test-api-key-mock'` at the top of the test file before module import (same pattern as existing tests).

## Next Phase Readiness

- All QA-01, QA-02, QA-03 requirements met
- `qa_score`, `qa_critique`, and `attempts` columns now fully populated on every draft
- No blockers for Phase 09

---
*Phase: 08-qa-and-compliance*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: web/lib/qa-checker.ts
- FOUND: web/lib/qa-checker.test.ts
- FOUND: web/lib/queries/task-runs.ts (with updateTaskRunQA, incrementAttempts)
- FOUND: web/lib/task-matcher.ts (with QA routing)
- FOUND: web/lib/task-matcher.test.ts (10 QA flow tests)
- FOUND commit: 50badcc (task-runs additive functions)
- FOUND commit: 2f51e23 (RED test)
- FOUND commit: b24650f (GREEN implementation)
