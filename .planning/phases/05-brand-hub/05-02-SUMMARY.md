---
phase: 05-brand-hub
plan: 02
subsystem: brand-ingestion
tags: [brand-hub, drive-sync, queue-processor, reindex]
dependency-graph:
  requires: [05-01]
  provides: [brand-ingestion-pipeline, brand-reindex-script, queue-brand-routing]
  affects: [scripts/sync/sync-brands.ts, scripts/sync/process-drive-queue.ts]
tech-stack:
  added: []
  patterns: [drive-api-parent-chain-walk, sha256-derived-client-id, hyphen-slug]
key-files:
  created:
    - scripts/sync/sync-brands.ts
  modified:
    - scripts/sync/process-drive-queue.ts
    - package.json
decisions:
  - resolveClientFolder walks parent chain up to 5 levels (matches resolveChannel pattern) to find immediate child of BRANDS_FOLDER
  - brand check (step 3.5) inserted BEFORE resolveChannel to ensure brand files never reach skills null-channel delete path
  - deleteBrandFile called on every trashed/removed change as a safe no-op when file is not in brand_hub
  - isBrandFile helper removed (redundant — resolveClientFolder used directly inline)
metrics:
  duration: 183s
  completed: 2026-04-01
  tasks: 2
  files: 3
---

# Phase 05 Plan 02: Brand Ingestion Pipeline Summary

Brand ingestion pipeline activated: `npm run brand:reindex` walks DRIVE_FOLDER_BRANDS and populates brand_hub; queue processor routes brand webhook events to brand_hub instead of skills.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Brand re-index script and npm script entry | 8d4dbaf | scripts/sync/sync-brands.ts, package.json |
| 2 | Extend queue processor with brand file routing | 49d3210 (auto) | scripts/sync/process-drive-queue.ts |

## What Was Built

**Task 1 — `scripts/sync/sync-brands.ts`:**
- Reads `DRIVE_FOLDER_BRANDS` env var; exits gracefully (exit 0) with informational log when not set
- Discovers client subfolders (immediate children of BRANDS_FOLDER) via Drive API
- Recursively lists all files within each client folder
- Filters to indexable MIME types: Google Docs, text/plain, text/markdown (excludes spreadsheets)
- Extracts content via `extractContent`, skips files where extraction returns null
- Calls `upsertBrandFromDrive` with derived `clientId` (SHA-256 of folder ID, first 8 hex chars as int), `clientSlug` (hyphenated lowercase), and `clientName`
- Logs summary: clients discovered, clients indexed, files indexed, files skipped
- `npm run brand:reindex` script entry added to package.json

**Task 2 — `scripts/sync/process-drive-queue.ts`:**
- Imports `upsertBrandFromDrive`, `deleteBrandFile`, `getBrandFile` from queries/brand
- `BRANDS_FOLDER_ID` constant reads `DRIVE_FOLDER_BRANDS` at module load
- `resolveClientFolder`: walks parent chain (up to 5 levels) to find immediate child folder of BRANDS_FOLDER_ID; returns `{ id, name }` of the client folder or null
- `processBrandChange`: extracts content, applies hash gate (skips if unchanged), upserts to brand_hub; non-indexable files logged and skipped
- **Step 2 (trashed/removed):** `deleteBrandFile(fileId)` added alongside `deleteSkill` — safe no-op when file is not in brand_hub
- **Step 3.5 (brand check):** inserted BEFORE `resolveChannel` call — brand files get early return and never reach the skills null-channel delete path

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Adjustments

**1. [Cleanup] Removed unused `isBrandFile` helper**
- Found during: Task 2 implementation
- Issue: Plan specified `isBrandFile` as a helper, but `resolveClientFolder` is called directly inline in `processChange` — a separate wrapper was redundant
- Fix: Removed `isBrandFile` function; `resolveClientFolder` used directly
- No behaviour change

## Verification Results

```
brand.test.ts:  22 tests, 22 pass, 0 fail
drive.test.ts:  18 tests, 18 pass, 0 fail
sync-brands.ts: Exits gracefully when DRIVE_FOLDER_BRANDS not set
npm run brand:reindex: Valid script entry confirmed
```

## Self-Check: PASSED

- [x] `scripts/sync/sync-brands.ts` exists (285 lines)
- [x] `scripts/sync/process-drive-queue.ts` contains `DRIVE_FOLDER_BRANDS` reference
- [x] `package.json` contains `brand:reindex` script entry
- [x] Commit 8d4dbaf exists (Task 1)
- [x] Commit 49d3210 exists (Task 2, auto-committed)
- [x] All 22 brand tests pass
- [x] All 18 drive tests pass (no regressions)
