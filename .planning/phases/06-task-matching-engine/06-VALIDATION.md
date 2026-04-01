---
phase: 6
slug: task-matching-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly to node |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/queries/brand.test.ts web/lib/queries/drive.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | TASK-01, TASK-07 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | TASK-02, TASK-03 | unit | same | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | TASK-06 | manual | Verify via curl — fire-and-forget timing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/queries/task-runs.test.ts` — stubs for TASK-01, TASK-02, TASK-03, TASK-07
- [ ] `web/lib/task-matcher.ts` — context assembly logic (required before tests pass)

*Existing test infrastructure: `brand.test.ts`, `drive.test.ts` use the same pattern — no new framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route responds 202 before context assembly completes | TASK-06 | Fire-and-forget timing not unit-testable | Submit task via curl, verify immediate 202 response while context assembly runs asynchronously |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
