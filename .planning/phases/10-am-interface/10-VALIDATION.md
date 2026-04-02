---
phase: 10
slug: am-interface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/task-runs-ui.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/task-runs-ui.test.ts web/routes/skills-browser.test.ts web/lib/queries/task-runs.test.ts` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific test file for the changed module
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | UI-05 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend) | ⬜ pending |
| 10-02-01 | 02 | 2 | UI-01, UI-05 | integration | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/task-runs-ui.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | UI-02, UI-03 | integration | same | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | UI-04 | integration | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/skills-browser.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/routes/task-runs-ui.test.ts` — covers UI-01, UI-02, UI-03, UI-05
- [ ] `web/routes/skills-browser.test.ts` — covers UI-04
- [ ] Extend `web/lib/queries/task-runs.test.ts` — add `rejected` status assertion

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HTMX polling updates task list every 10s | UI-05 | Requires running browser with timer | Open /tasks, submit a task, observe status badge updates |
| Searchable client picker UX | UI-01 | Browser interaction | Type partial client name, verify dropdown filters |
| Copy to clipboard | UI-03 | Requires Clipboard API in browser | Click copy button, paste into text editor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
