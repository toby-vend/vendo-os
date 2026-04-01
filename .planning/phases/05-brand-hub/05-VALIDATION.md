---
phase: 5
slug: brand-hub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | None — flags passed directly |
| **Quick run command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts` |
| **Full suite command** | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts && node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/drive.test.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BRND-01 | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BRND-02 | unit | same | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | BRND-03 | unit | same | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | BRND-04 | unit | same — explicit isolation assertion | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/queries/brand.test.ts` — stubs for BRND-01 through BRND-04; uses real in-memory libsql with FTS5 schema
- [ ] `brand_hub` schema: add UNIQUE constraint on `drive_file_id` (migration in `initSchema`)
- [ ] `brand_hub_fts` virtual table: add to `web/lib/queries/auth.ts` initSchema (Turso path only)
- [ ] `npm run brand:reindex` script entry in `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drive webhook triggers brand processing | BRND-01 | Requires live Google Drive webhook | Upload file to brands folder, verify brand_hub row created within minutes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
