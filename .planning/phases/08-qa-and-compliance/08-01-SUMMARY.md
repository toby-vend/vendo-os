---
phase: 08-qa-and-compliance
plan: 01
subsystem: testing
tags: [ahpra, compliance, regex, typescript, node-test]

# Dependency graph
requires:
  - phase: 07-agent-execution
    provides: draft generation pipeline that this compliance module gates
provides:
  - AHPRA_RULES: 15 pre-compiled rules across 7 categories for dental advertising compliance
  - checkAHPRACompliance: deterministic function returning structured AHPRAViolation[] records
  - AHPRARule and AHPRAViolation TypeScript interfaces
affects:
  - 08-02 (qa-checker.ts will import checkAHPRACompliance)
  - task-matcher.ts (Phase 8 integration will call AHPRA checker before draft_ready transition)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pre-compiled RegExp literals at module load time (no dynamic RegExp in hot path)
    - Negative lookbehind in AHPRA-Q1 to exclude explicitly allowed "special interest in" phrase
    - One-violation-per-rule early break pattern (first pattern match wins, subsequent patterns skipped)

key-files:
  created:
    - web/lib/ahpra-rules.ts
    - web/lib/ahpra-rules.test.ts
  modified: []

key-decisions:
  - "AHPRA-Q1 'specialises in' uses negative lookbehind to exclude the explicitly allowed phrase 'special interest in' — prevents false positives on permitted AHPRA language"
  - "One violation record per rule per check (first pattern match wins, break) — consistent with the rule-level violation reporting model; matched text is the violation excerpt"
  - "checkAHPRACompliance receives full serialised draft text string — no field-by-field JSON parsing required, patterns run across entire output"

patterns-established:
  - "AHPRA compliance module is pure synchronous function — no async, no LLM, no side effects; safe to call anywhere in generation pipeline"
  - "All AHPRA_RULES patterns are pre-compiled RegExp literals in the array definition — not created inside the checker function"

requirements-completed: [QA-04, QA-05]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 08 Plan 01: AHPRA Compliance Checker Summary

**Deterministic AHPRA dental advertising compliance checker with 15 pre-compiled rules across 7 categories, regex-based matching returning structured violation records**

## Performance

- **Duration:** 2 min 20 sec
- **Started:** 2026-04-02T09:41:05Z
- **Completed:** 2026-04-02T09:43:25Z
- **Tasks:** 1 (TDD: 3 commits — test RED, feat GREEN, verified)
- **Files modified:** 2

## Accomplishments

- AHPRA_RULES array with all 15 rules covering all 7 required categories (testimonials, outcome-claims, comparative, qualifications, visual, inducements, evidence)
- checkAHPRACompliance(draftText) returns AHPRAViolation[] with rule ID, matched text excerpt, and severity level
- Critical edge case handled: "special interest in" is explicitly ALLOWED by AHPRA — negative lookbehind in AHPRA-Q1 prevents false flagging
- 36 unit tests covering all rule categories, multiple violations, clean content, and violation structure validation

## Task Commits

Each task was committed atomically using TDD:

1. **Task 1 (RED): AHPRA rules tests** - `8a8a539` (test)
2. **Task 1 (GREEN): AHPRA rules implementation** - `adbebbf` (feat)

## Files Created/Modified

- `web/lib/ahpra-rules.ts` — AHPRARule and AHPRAViolation types, AHPRA_RULES array (15 rules), checkAHPRACompliance function
- `web/lib/ahpra-rules.test.ts` — 36 unit tests across 14 describe blocks covering all rule categories and edge cases

## Decisions Made

- **AHPRA-Q1 negative lookbehind:** "specialises in" is prohibited, but "special interest in" is explicitly permitted by AHPRA. Used regex negative lookbehind `(?<!special\s+interest\s+...)` to prevent false positives on the allowed phrase.
- **One violation per rule:** The checker emits at most one violation per rule (first pattern match, then breaks). This keeps the output clean and matches the rule-level reporting model — the AM sees "AHPRA-Q1 violated" not five pattern matches for the same rule.
- **Full text matching:** draftText is matched as a single string (the entire serialised JSON output), consistent with the architecture decision from the research document.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `checkAHPRACompliance` and `AHPRA_RULES` are ready for import in Phase 08-02 (qa-checker.ts)
- Function signature matches the architecture pattern from 08-RESEARCH.md exactly
- No blockers for subsequent QA plans

---
*Phase: 08-qa-and-compliance*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: web/lib/ahpra-rules.ts
- FOUND: web/lib/ahpra-rules.test.ts
- FOUND: .planning/phases/08-qa-and-compliance/08-01-SUMMARY.md
- FOUND commit: 8a8a539 (test RED)
- FOUND commit: adbebbf (feat GREEN)
