---
phase: 02-drive-webhook-foundation
plan: "02"
subsystem: drive-sync
tags: [drive, webhook, cron, renewal, re-index, skills]
dependency_graph:
  requires: [02-01]
  provides: [cron-renewal, drive-reindex-cli]
  affects: [web/server.ts, vercel.json, web/lib/queries/drive.ts, web/lib/queries/auth.ts, scripts/utils/db.ts]
tech_stack:
  added: []
  patterns: [vercel-cron, node-test-module-mocks, fastify-plugin]
key_files:
  created:
    - web/routes/drive-cron.ts
    - web/routes/drive-cron.test.ts
    - scripts/sync/sync-drive.ts
  modified:
    - web/server.ts
    - vercel.json
    - web/lib/queries/drive.ts
    - web/lib/queries/auth.ts
    - scripts/utils/db.ts
    - package.json
decisions:
  - "Cron route exempted from session auth via path-prefix check — same pattern as webhook route"
  - "upsertSkillFromDrive uses ON CONFLICT(drive_file_id) for idempotency — safe to re-run"
  - "idx_skills_drive_file partial index added to both schema paths — Turso WHERE clause, sql.js unconditional (partial index not supported)"
  - "Re-index script imports from Turso path (web/lib/queries) not sql.js — writes to production data"
  - "Content field left empty in skills upsert — Phase 3 handles Drive file content extraction"
metrics:
  duration: "226s"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_modified: 8
---

# Phase 02 Plan 02: Cron Renewal and Drive Re-index Summary

**One-liner:** Vercel Cron endpoint renews expiring Drive webhook channels daily, with a `npm run drive:reindex` CLI that walks configured folders and idempotently populates the skills table.

## What Was Built

**Task 1: Cron renewal route + Vercel Cron config**

`web/routes/drive-cron.ts` — Fastify plugin exposing `GET /api/cron/renew-drive-channels`. Validates `Authorization: Bearer <CRON_SECRET>` on every request (returns 401 if env var is unset or token is wrong). Calls `getChannelsExpiringWithin24h()` then iterates, calling `renewChannel()` per channel with per-channel try/catch so a single failure does not abort the rest. Returns `{ success, renewed, failed, errors[] }`.

Registered in `web/server.ts` alongside the webhook route, with `/api/cron/` path prefix exempted from session middleware. `vercel.json` gains a `crons` array firing daily at 06:00 UTC.

6 behaviour tests written first (TDD) — all pass:
- 401 on missing Authorization header
- 401 on wrong Bearer token
- 401 when CRON_SECRET env var is unset
- 200 with renewed:0 when no channels expiring
- 200 with correct renewed count for expiring channels
- Continues processing remaining channels after one failure

**Task 2: Full re-index CLI script**

`scripts/sync/sync-drive.ts` — loads `.env.local`, resolves admin user from `DRIVE_ADMIN_USER_ID`, gets Google access token, walks all configured Drive folders (`DRIVE_FOLDER_PAID_SOCIAL`, `DRIVE_FOLDER_SEO`, `DRIVE_FOLDER_PAID_ADS`, `DRIVE_FOLDER_GENERAL`) recursively. For each Google Doc/Sheet/text file, calls `upsertSkillFromDrive()` which upserts into the skills table. Content is left empty — Phase 3 handles extraction.

`--watch` flag optionally registers a Drive webhook channel after re-indexing.

`upsertSkillFromDrive` added to `web/lib/queries/drive.ts` — uses `ON CONFLICT(drive_file_id) DO UPDATE` for idempotency. `idx_skills_drive_file` unique index added to both schema paths (Turso in `auth.ts`, sql.js in `scripts/utils/db.ts`).

## Decisions Made

1. **Cron route exempted from session auth via path prefix** — same pattern as webhook route. `/api/cron/` paths skip the session middleware's cookie check. CRON_SECRET is the auth mechanism.

2. **upsertSkillFromDrive uses ON CONFLICT(drive_file_id)** — requires the unique index on `drive_file_id`. The sql.js schema DDL already had `UNIQUE` on the column; the explicit index adds it declaratively to both paths for clarity.

3. **Re-index imports from Turso path, not sql.js** — the re-index script uses `web/lib/queries/drive.ts` which connects to Turso. This writes to production data, which is correct behaviour.

4. **Content empty until Phase 3** — Drive file content requires export API calls (Docs as text, Sheets as CSV). Deferring to Phase 3 keeps the re-index fast and focused on structure.

5. **Partial index with WHERE clause** — Turso/libsql supports partial indexes; sql.js does not. The sql.js path uses an unconditional index on `drive_file_id` (all rows have a value in the re-index context anyway).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Created/Modified
- `web/routes/drive-cron.ts` — FOUND
- `web/routes/drive-cron.test.ts` — FOUND
- `scripts/sync/sync-drive.ts` — FOUND
- `web/server.ts` — modified with driveCronRoutes
- `vercel.json` — modified with crons array
- `web/lib/queries/drive.ts` — modified with upsertSkillFromDrive
- `web/lib/queries/auth.ts` — modified with idx_skills_drive_file
- `scripts/utils/db.ts` — modified with idx_skills_drive_file
- `package.json` — modified with drive:reindex scripts

### Commits
- `44742ae` — feat(02-02): add cron renewal route and Vercel Cron config
- `8b98e93` — feat(02-02): add Drive re-index CLI script and upsertSkillFromDrive

## Self-Check: PASSED
