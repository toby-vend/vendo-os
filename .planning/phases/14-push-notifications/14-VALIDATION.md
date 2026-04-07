---
phase: 14
slug: push-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | None — run directly with `node --test` |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/**/*.test.ts web/routes/**/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts`
- **After every plan wave:** Run full test suite across all `*.test.ts` files
- **Before `/gsd:verify-work`:** Full suite must be green; PUSH-07 manually verified on real device
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PUSH-01 | unit | `node --test --import tsx/esm scripts/generate-vapid-keys.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | PUSH-02 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | PUSH-03 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | PUSH-04 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 2 | PUSH-05 | unit | covered in push-sender.test.ts | ❌ W0 | ⬜ pending |
| 14-02-04 | 02 | 2 | PUSH-06 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 3 | PUSH-07 | manual | Real iPhone, iOS 16.4+, non-standalone → install prompt; standalone → permission request | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/queries/push-subscriptions.test.ts` — stubs for PUSH-02
- [ ] `web/lib/push-sender.test.ts` — stubs for PUSH-03, PUSH-04, PUSH-05, PUSH-06

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS standalone gate + install prompt | PUSH-07 | Requires real iPhone with iOS 16.4+; simulator not representative | 1. Open VendoOS in Safari on iPhone. 2. Verify install prompt shows (not push permission). 3. Install to home screen. 4. Reopen via home screen icon. 5. Verify push permission request appears. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
