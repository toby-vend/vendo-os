---
phase: 7
slug: agent-execution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts web/lib/task-types/task-types.test.ts web/lib/queries/task-runs.test.ts web/lib/queries/drive.test.ts web/lib/queries/brand.test.ts` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TASK-05 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-types/task-types.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | TASK-04 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | TASK-04 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (add tests) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/task-matcher.test.ts` — covers TASK-04: generateDraft, retry, draft_ready, failed, sources populated; mock Anthropic SDK
- [ ] `web/lib/task-types/task-types.test.ts` — covers TASK-05: schema shape validation for all 3 task types; buildSystemPrompt and buildUserMessage output
- [ ] New `updateTaskRunOutput` test case in existing `web/lib/queries/task-runs.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end generation with real Anthropic API | TASK-04 | Requires ANTHROPIC_API_KEY and real API call | Submit task via POST /api/tasks/runs, verify task_runs.output contains structured JSON with sources array |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
