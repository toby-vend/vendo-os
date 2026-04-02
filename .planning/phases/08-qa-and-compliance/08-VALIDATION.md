---
phase: 8
slug: qa-and-compliance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts web/lib/ahpra-rules.test.ts web/lib/task-matcher.test.ts` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | QA-04, QA-05 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/ahpra-rules.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | QA-01, QA-02, QA-03 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | QA-01 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/ahpra-rules.test.ts` — covers QA-04, QA-05; tests rule matching against known prohibited phrases
- [ ] `web/lib/qa-checker.test.ts` — covers QA-01, QA-02, QA-03; mocks Haiku LLM judge, tests retry loop, escalation
- [ ] Extend `web/lib/queries/task-runs.test.ts` with `updateTaskRunQA` test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end QA with real Haiku API | QA-01 | Requires ANTHROPIC_API_KEY and real API call | Submit task, verify QA judge runs and produces structured critique |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
