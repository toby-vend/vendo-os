---
phase: 2
slug: drive-webhook-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (no install needed) |
| **Config file** | none — `node --test` discovers `*.test.ts` via tsx loader |
| **Quick run command** | `node --import tsx/esm --test web/lib/queries/index.test.ts` |
| **Full suite command** | `node --import tsx/esm --test "web/**/*.test.ts" "api/**/*.test.ts"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file
- **After every plan wave:** Run `node --import tsx/esm --test "web/**/*.test.ts" "api/**/*.test.ts"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | SYNC-01 | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | SYNC-03 | unit | `node --import tsx/esm --test web/lib/queries/drive.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SYNC-01 | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SYNC-01 | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SYNC-03 | unit | `node --import tsx/esm --test api/cron/renew-drive-channels.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | SYNC-06 | integration | `node --import tsx/esm --test scripts/sync/sync-drive.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/routes/drive-webhook.test.ts` — webhook handler: valid sync/change notifications return 200, unknown channel returns 404
- [ ] `web/lib/queries/drive.test.ts` — expiry query: channels expiring within 24h returned correctly
- [ ] `api/cron/renew-drive-channels.test.ts` — cron auth: returns 401 without CRON_SECRET
- [ ] Update `web/lib/queries/index.test.ts` — add Drive query exports to barrel smoke test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drive file change triggers webhook POST within seconds | SYNC-01 | Requires real Google Drive interaction | Upload a file to Drive folder, observe webhook log in Vercel |
| Channel renewal cron fires daily | SYNC-03 | Requires Vercel cron infrastructure | Check Vercel cron logs next day after deploy |
| Re-index populates skills table from Drive | SYNC-06 | Requires real Drive folder with documents | Run `npm run drive:reindex`, verify skills table rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
