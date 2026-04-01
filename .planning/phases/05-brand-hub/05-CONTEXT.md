# Phase 5: Brand Hub - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-client brand context (tone, compliance, differentiators) is ingested from Drive brand files and queryable in strict client isolation. Brand files live in DRIVE_FOLDER_BRANDS with one subfolder per client. This phase builds the ingestion pipeline and query layer for brand_hub. No task execution, no AM-facing UI — those are Phases 6 and 10 respectively.

</domain>

<decisions>
## Implementation Decisions

### Drive folder structure
- One subfolder per client inside DRIVE_FOLDER_BRANDS (e.g. `DRIVE_FOLDER_BRANDS/Kana Health Group/`)
- Multiple brand files per client (tone guides, compliance docs, differentiators, etc.)
- Recursive ingestion — files at any depth within a client folder are ingested
- Folder partially populated — not all 25+ clients have brand files yet; system handles missing/empty client folders gracefully
- Auto-discover new clients — any new subfolder is automatically treated as a new client, zero manual setup
- Same webhook pipeline as skills (Phases 2-3) — DRIVE_FOLDER_BRANDS is a watched folder, webhook fires on changes, queue processor routes brand files to brand_hub instead of skills table
- Manual re-index command: `npm run brand:reindex` walks DRIVE_FOLDER_BRANDS and populates brand_hub (needed for initial population)

### Brand content model
- One record per brand file in brand_hub (not merged per client) — preserves granularity, supports per-file change detection via content_hash
- Google Docs: extracted as plain text (same pattern as skills pipeline in Phase 3)
- Non-text files (PDFs, Sheets, images): handling at Claude's discretion (metadata-only vs skip)
- Retrieval strategy for task execution (concatenated vs individual): Claude's discretion

### Client registry
- Client identity derived from Drive folder structure — no separate clients table
- client_name: Drive subfolder name (e.g. "Kana Health Group")
- client_slug: auto-generated via lowercase + hyphenation (e.g. "kana-health-group")
- client_id: hash-based from Drive folder ID — stable across re-indexes, same folder always produces same ID
- Folder rename = same client (Drive folder ID doesn't change on rename); client_name updates to new folder name
- Client list is internal only — no dashboard page; Phase 10 (AM Interface) surfaces it later

### Query interface
- Four query functions in `web/lib/queries/brand.ts`:
  1. `getBrandContext(clientSlug)` — returns all brand_hub rows for a client
  2. `listBrandClients()` — returns distinct client names/slugs
  3. `searchBrandContent(query, clientSlug?)` — FTS5 search across brand files, optionally scoped to one client
  4. `getBrandFile(driveFileId)` — returns one specific brand file record
- FTS5 indexed: create `brand_hub_fts` virtual table on brand_hub(content) — follows skills pattern
- Query functions only — no HTTP/API routes; Phase 10 adds those
- Client isolation via WHERE clause on client_id — every content-returning function requires client_id/client_slug parameter; `listBrandClients` returns names only, not content

### Claude's Discretion
- Non-text file handling (metadata-only record vs skip entirely)
- Brand context retrieval strategy for task execution (concatenated vs individual files)
- FTS5 tokenizer and indexing configuration details
- Error handling for empty client folders or extraction failures

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/queries/drive.ts`: 7 query functions + `upsertSkillFromDrive` — pattern for `upsertBrandFromDrive`
- `scripts/sync/sync-drive.ts`: Folder walking + content extraction pipeline — extend with brand folder handling (BRANDS_FOLDER already reserved)
- `web/lib/queries/base.ts`: Shared db client + `rows<T>()`/`scalar<T>()` helpers — new `brand.ts` module slots in
- `brand_hub` table: Already created in Phase 1 with client_id, client_name, client_slug, content, content_hash, drive_file_id columns
- Content extraction from Phase 3: `extractContent()` for Google Docs → plain text, `hashContent()` for SHA-256

### Established Patterns
- Query modules live in `web/lib/queries/` and import from `./base.js`
- Sync scripts in `scripts/sync/` follow fetch → transform → upsert pattern
- FTS5 virtual table pattern established with `skills_fts` (Turso path only; sql.js is FTS4-only)
- `CHANNEL_FOLDER_MAP` in sync-drive.ts maps env vars to channels — extend with brand folder routing

### Integration Points
- `scripts/sync/sync-drive.ts` line 48-49: `BRANDS_FOLDER` already declared and reserved — activate it
- `web/lib/queries/` — add `brand.ts` module with four query functions
- Queue processor (`processQueue` in drive processing) — add branch for brand files (files under BRANDS_FOLDER → brand_hub instead of skills)
- Schema: `brand_hub_fts` virtual table needs adding to `web/lib/queries/auth.ts` initSchema and `scripts/utils/db.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-brand-hub*
*Context gathered: 2026-04-01*
