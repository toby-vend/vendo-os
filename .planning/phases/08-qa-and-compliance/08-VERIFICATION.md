---
phase: 08-qa-and-compliance
verified: 2026-04-02T10:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 08: QA and Compliance Verification Report

**Phase Goal:** Every draft is validated against SOP checklist criteria and AHPRA dental advertising rules before it reaches an AM — non-compliant output is flagged with specific rule violations, not silently surfaced or suppressed
**Verified:** 2026-04-02
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A draft that fails a SOP criterion is regenerated with a critique — the AM sees only the improved version | VERIFIED | `task-matcher.ts` lines 93–148: loop stores `previousCritique` and calls `buildRetryMessage`; `updateTaskRunOutput` is only called on SOP pass or exhaustion. Test 3/4 confirm. |
| 2 | After two retries, a still-failing draft reaches the AM as "requires human review" with the QA critique attached | VERIFIED | `task-matcher.ts` lines 150–158: on `attempt === MAX_ATTEMPTS - 1` with fail, `updateTaskRunQA(score=0)` then `updateTaskRunOutput` both called. Test 5 confirms `qa_score=0` and `sop_issues` present. |
| 3 | Output containing a prohibited AHPRA claim is flagged with the specific rule violated | VERIFIED | `ahpra-rules.ts`: `checkAHPRACompliance` returns `AHPRAViolation[]` with `rule`, `violation` (matched text), and `severity`. 36 tests pass covering all 15 rules across 7 categories. |
| 4 | AHPRA compliance check runs on every draft before status moves to draft_ready — it cannot be bypassed | VERIFIED | `task-matcher.ts` lines 136 and 151: `checkAHPRACompliance` called on both the SOP-pass path and the exhausted-retries path. Every call to `updateTaskRunOutput` is preceded by `checkAHPRACompliance`. Test 1 and 2 confirm AHPRA runs even on clean SOP pass. |
| 5 | QA failures never loop indefinitely — maximum three total attempts (initial + 2 retries) is enforced | VERIFIED | `task-matcher.ts` line 90: `MAX_ATTEMPTS = 3`. Loop is `for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++)`. Test 6 asserts `anthropicHolder.callCount <= 3`. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/lib/ahpra-rules.ts` | AHPRA compliance checker with 15 rules, `checkAHPRACompliance` export | VERIFIED | 297 lines, exports `AHPRARule`, `AHPRAViolation`, `AHPRA_RULES` (15 rules, 7 categories), `checkAHPRACompliance`. All patterns pre-compiled. |
| `web/lib/ahpra-rules.test.ts` | Unit tests for AHPRA rule matching | VERIFIED | 332 lines (>80 min), 36 tests, 14 describe blocks, all pass. |
| `web/lib/qa-checker.ts` | Haiku LLM-as-judge SOP QA, exports `runSOPCheck` | VERIFIED | 122 lines, exports `runSOPCheck`. Uses `claude-haiku-4-5-20251001`, SOP capped at 1500 chars, JSON schema output. |
| `web/lib/qa-checker.test.ts` | Unit tests for QA checker | VERIFIED | 244 lines (>100 min), 5 tests, all pass. |
| `web/lib/queries/task-runs.ts` | Extended with `updateTaskRunQA` and `incrementAttempts` | VERIFIED | Lines 109–130: both functions exported with correct SQL (`qa_score`, `qa_critique`, `attempts + 1`). |
| `web/lib/task-matcher.ts` | `generateDraft` routes through QA before `draft_ready` | VERIFIED | Full QA loop with retry-with-critique, AHPRA wiring, MAX_ATTEMPTS=3, try/catch for QA errors. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `web/lib/task-matcher.ts` | `web/lib/qa-checker.ts` | `runSOPCheck(` called after generation | VERIFIED | Line 12: `import { runSOPCheck } from './qa-checker.js'`; line 132: `runSOPCheck(JSON.stringify(parsed), sopContent)` |
| `web/lib/task-matcher.ts` | `web/lib/ahpra-rules.ts` | `checkAHPRACompliance(` called on final output | VERIFIED | Line 13: `import { checkAHPRACompliance } from './ahpra-rules.js'`; lines 136, 151: called on both code paths |
| `web/lib/task-matcher.ts` | `web/lib/queries/task-runs.ts` | `updateTaskRunQA(` for status transitions | VERIFIED | Lines 7–9: imports `updateTaskRunQA` and `incrementAttempts`; lines 138, 156: `updateTaskRunQA` called before every `updateTaskRunOutput` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QA-01 | 08-02-PLAN | Agent output is validated against SOP checklist criteria after generation | SATISFIED | `runSOPCheck` called on every generated draft in `generateDraft` loop |
| QA-02 | 08-02-PLAN | On QA failure, agent receives critique and regenerates (retry-with-critique, max 2 retries) | SATISFIED | `buildRetryMessage` prepends critique; loop continues up to attempt 2 (indices 0–2, 3 total) |
| QA-03 | 08-02-PLAN | After max retries, task escalates to human review with critique attached | SATISFIED | `qa_score=0` + `qa_critique` with `sop_issues` and `ahpra_violations` written; draft surfaces as `draft_ready` |
| QA-04 | 08-01-PLAN | AHPRA/dental compliance pre-flight runs on all output before surfacing to AM | SATISFIED | `checkAHPRACompliance` called on every `updateTaskRunOutput` path — cannot be bypassed |
| QA-05 | 08-01-PLAN | Compliance check flags non-compliant content with specific rule violations, does not silently suppress | SATISFIED | `AHPRAViolation` records include `rule` (e.g. `AHPRA-T1`), `violation` (matched text excerpt), `severity`; stored in `qa_critique.ahpra_violations` |

No orphaned requirements — all 5 QA requirement IDs claimed in plans and verified.

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments found. No stub return values. No empty handlers. All code paths fully implemented.

---

### Human Verification Required

None — all success criteria are verifiable programmatically.

---

### Gaps Summary

None. All 5 observable truths verified, all 6 artifacts pass all three levels (exists, substantive, wired), all 3 key links confirmed active, all 5 requirements satisfied.

**Test results (all passing):**
- `ahpra-rules.test.ts`: 36/36 pass
- `qa-checker.test.ts`: 5/5 pass
- `task-matcher.test.ts`: 10/10 pass
- Total: 51/51

---

_Verified: 2026-04-02_
_Verifier: Claude (gsd-verifier)_
