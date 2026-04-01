---
phase: 03-drive-document-processing
plan: "01"
subsystem: database
tags: [google-drive, sqlite, libsql, turso, crypto, sha256, queue]

# Dependency graph
requires:
  - phase: 02-drive-webhook-foundation
    provides: drive_sync_queue and skills tables in schema, upsertSkillFromDrive, existing drive-sync.ts helpers
provides:
  - SkillRow interface exported from web/lib/queries/drive.ts
  - markQueueItemProcessed query function
  - getSkillByDriveFileId query function
  - updateSkillContent query function (INSERT ON CONFLICT with version increment)
  - updateSkillMetadata query function (title, channel, skill_type only)
  - deleteSkill query function
  - updateDrivePageToken query function
  - CHANNEL_FOLDER_MAP exported const (folder ID to channel slug, built from env vars)
  - DriveChange interface
  - listChanges Drive API helper (paginated changes.list)
  - resolveChannel Drive API helper (walks parent lineage up to 5 levels)
  - extractContent Drive API helper (Google Docs, text/plain, text/markdown; null for sheets/PDFs)
  - resolveSkillType Drive API helper (subfolder name → slugified skill_type)
  - hashContent function (SHA-256 hex digest)
affects: [03-02-queue-processor, process-drive-queue.ts, re-index script]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CHANNEL_FOLDER_MAP built from env vars at module load with explicit undefined guards"
    - "resolveChannel walks parent chain up to 5 levels with early return on CHANNEL_FOLDER_MAP hit"
    - "extractContent returns null for non-indexable types and on 403 export size limit (warning logged)"
    - "hashContent SHA-256 used as content-change gate before writing to skills"
    - "updateSkillContent uses INSERT ON CONFLICT with version = version + 1 for content changes"
    - "updateSkillMetadata leaves content and content_hash untouched"

key-files:
  created: []
  modified:
    - web/lib/queries/drive.ts
    - web/lib/drive-sync.ts

key-decisions:
  - "Spreadsheets return null from extractContent — metadata only, not content-indexed"
  - "resolveChannel caps at 5 parent levels — covers all realistic Drive folder depths"
  - "CHANNEL_FOLDER_MAP entries with undefined env vars are silently omitted (no undefined Map key)"
  - "extractContent wraps export in try/catch and returns null on 403 (export size limit) with console.warn"
  - "hashContent used as content-change gate — drive_modified_at alone is unreliable (Drive updates on comments/permissions)"

patterns-established:
  - "Query functions: db.execute() for writes, rows<T>() for reads, ISO timestamps via new Date().toISOString()"
  - "Drive API helpers: fetch() with Bearer token from getGoogleAccessToken(), all errors throw"
  - "filesGet helper (private): centralises files.get calls with field projection"

requirements-completed: [SYNC-02, SYNC-04, SYNC-05]

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 03 Plan 01: Query Functions and Drive API Helpers Summary

**6 query functions for skills/queue operations and 6 Drive API helpers for content extraction, channel classification, and SHA-256 hash gating added as building blocks for the queue processor**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-01T20:48:34Z
- **Completed:** 2026-04-01T20:51:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added SkillRow interface and 6 new query functions to `web/lib/queries/drive.ts` without touching existing exports
- Added CHANNEL_FOLDER_MAP, DriveChange interface, and 5 Drive API helper functions to `web/lib/drive-sync.ts`
- hashContent produces verified SHA-256: `hashContent('test')` = `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

## Task Commits

Each task was committed atomically (by auto-commit on file save):

1. **Task 1: Add query functions to web/lib/queries/drive.ts** - `a9d8497`, `4d0c217` (feat)
2. **Task 2: Add Drive API helpers to web/lib/drive-sync.ts** - `e7b8e83`, `1f86c0a` (feat)

## Files Created/Modified
- `web/lib/queries/drive.ts` — Added SkillRow interface; markQueueItemProcessed, getSkillByDriveFileId, updateSkillContent, updateSkillMetadata, deleteSkill, updateDrivePageToken
- `web/lib/drive-sync.ts` — Added CHANNEL_FOLDER_MAP, DriveChange interface, listChanges, resolveChannel, extractContent, resolveSkillType, hashContent

## Decisions Made
- Spreadsheets excluded from content extraction (metadata only) — per research recommendation; spreadsheets are unlikely SOPs
- resolveChannel capped at 5 parent levels — defensive ceiling that covers realistic Drive folder depths per research
- CHANNEL_FOLDER_MAP built with explicit `if (process.env.X)` guards — prevents `undefined` as Map key if an env var is unset
- extractContent returns null on 403 with console.warn — handles Drive export size limit gracefully without crashing queue processor

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- tsx `-e` flag with relative imports fails because it has no base directory context — workaround was writing to a temp `.ts` file with absolute imports for verification. Not a code issue.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All building blocks for Plan 02 (queue processor) are in place
- Queue processor can import: `markQueueItemProcessed`, `getSkillByDriveFileId`, `updateSkillContent`, `updateSkillMetadata`, `deleteSkill`, `updateDrivePageToken` from queries/drive
- Queue processor can import: `listChanges`, `resolveChannel`, `extractContent`, `resolveSkillType`, `hashContent`, `CHANNEL_FOLDER_MAP` from drive-sync

---
*Phase: 03-drive-document-processing*
*Completed: 2026-04-01*
