---
phase: 9
slug: audit-and-traceability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/task-matcher.test.ts web/lib/queries/drive.test.ts` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | AUDT-01 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-02 | 01 | 1 | AUDT-01 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ✅ (extend) | ⬜ pending |
| 09-01-03 | 01 | 1 | AUDT-02, AUDT-03 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing test infrastructure in `task-runs.test.ts` and `task-matcher.test.ts` covers all phase requirements. Tests need new assertions added to existing files, not new files created.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SOP names visible in draft UI display | AUDT-02 | UI rendering is Phase 10 | Verify output.sources array contains SOP titles via API response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
