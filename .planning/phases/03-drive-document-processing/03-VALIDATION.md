---
phase: 3
slug: drive-document-processing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none |
| **Quick run command** | `node --import tsx/esm --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts` |
| **Full suite command** | `node --import tsx/esm --experimental-test-module-mocks --test "web/**/*.test.ts" "scripts/**/*.test.ts"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SYNC-02 | unit | `node --import tsx/esm --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SYNC-04 | unit | `node --import tsx/esm --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | SYNC-05 | unit | `node --import tsx/esm --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/sync/process-drive-queue.test.ts` — covers channel classification, content hashing, move/rename/delete behaviours (created by 03-02 Task 1 TDD)

*`web/lib/queries/drive.test.ts` — not needed as separate file; query functions exercised through queue processor tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Drive file move triggers reclassification | SYNC-02/05 | Requires real Google Drive | Move file between folders, run drive:process, check skills table |
| Content export from Google Docs | SYNC-04 | Requires real Drive document | Create/edit a Doc, run drive:process, verify skills.content populated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
