---
phase: 1
slug: infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (zero install) |
| **Config file** | none — Wave 0 creates test files |
| **Quick run command** | `npx tsx --test web/lib/crypto.test.ts` |
| **Full suite command** | `npx tsx --test web/lib/**/*.test.ts scripts/**/*.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file
- **After every plan wave:** Run `npx tsx --test web/lib/**/*.test.ts scripts/**/*.test.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | INFR-03 | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | INFR-01 | smoke | `npx tsx --test web/lib/queries/index.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | INFR-02 | integration | `npx tsx --test scripts/utils/schema.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFR-03a | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | INFR-03b | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | INFR-03c | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | INFR-03d | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 1 | INFR-03e | unit | `npx tsx --test web/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | INFR-01 | smoke | `npx tsx --test web/lib/queries/index.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | INFR-02 | integration | `npx tsx --test scripts/utils/schema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/crypto.test.ts` — unit tests for versioned encryption (encrypt, decrypt v0, decrypt v1, rotation, error cases)
- [ ] `web/lib/queries/index.test.ts` — smoke test that all existing exports resolve
- [ ] `scripts/utils/schema.test.ts` — integration test that all 5 new tables exist after init

*No framework install needed — Node built-in `node:test` runs via `tsx --test`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin users view shows Google Connected column | INFR-03 | Visual UI check | Navigate to /admin/users, verify google_connected column visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
