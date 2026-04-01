# Phase 3: Drive Document Processing - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Process documents arriving via Drive webhook: classify by channel based on folder path, detect actual content changes via hashing, handle moves between folders (reclassify), renames, and deletions. This phase consumes `drive_sync_queue` records written by Phase 2's webhook and updates the skills table accordingly. No FTS5 indexing or querying — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User trusts Claude to make sensible technical decisions for all document processing choices. Key areas and recommended approaches:

**Content extraction:**
- Google Docs: export as plain text via Drive API `export` endpoint (`text/plain` mimeType) — simpler than HTML, sufficient for FTS5 and agent context
- Google Sheets: export as CSV or skip — SOPs are unlikely to be spreadsheets; if encountered, store filename/metadata only
- PDFs: use Drive API `export` if Google Doc-backed; for uploaded PDFs, store metadata only (PDF text extraction is a future enhancement)
- Store extracted text in `skills.content` column — this is what FTS5 indexes in Phase 4
- Compute SHA-256 hash of content and store in `skills.content_hash` for change detection
- On webhook-triggered processing: if content_hash matches existing record, skip re-processing (metadata-only update)

**Folder-to-channel mapping:**
- Any file at any depth under a channel folder inherits that channel: `Paid social/Subfolder/Deep/file.doc` → `paid_social`
- Mapping is determined by which top-level watched folder the file is under — use the folder ID lineage
- `DRIVE_FOLDER_PAID_SOCIAL`, `DRIVE_FOLDER_SEO`, `DRIVE_FOLDER_PAID_ADS` → `paid_social`, `seo`, `paid_ads`
- `DRIVE_FOLDER_GENERAL` → `general` channel — agency-wide SOPs shared across all channels
- `DRIVE_FOLDER_BRANDS` → handled separately by Phase 5 (Brand Hub), not as skills
- If a file is not under any watched folder, ignore it (no classification, no indexing)
- `skill_type` field: derive from subfolder name or file naming convention (e.g. "Ad copy templates" subfolder → `ad_copy_template`); Claude picks the best heuristic

**Move/delete behaviour:**
- **Move between channel folders:** Update `skills.channel` to new channel classification on next sync. The Changes API reports the move; processing re-derives channel from new parent folder.
- **Move OUT of all watched folders:** Treat as deletion — remove from skills table (or mark inactive)
- **Rename:** Update `skills.title`, keep everything else. If content unchanged (same hash), no re-processing.
- **Delete:** Remove skill record from skills table and FTS5 index. Append-only audit trail (Phase 9) will preserve the historical record.
- **Timing:** Processing happens when `drive_sync_queue` records are consumed. A background processor (or the next `changes.list()` call) handles the queue. Not instantaneous, but within minutes of the Drive change.

**Queue processing pattern:**
- A processor function reads `drive_sync_queue` records, calls `changes.list()` with stored pageToken, processes each change
- Each change: determine file's parent folder → derive channel → export content → compute hash → upsert or delete
- After processing, update pageToken in `drive_watch_channels` table
- Can be triggered by: (a) webhook arrival, (b) cron job, (c) manual `npm run drive:process` command
- Processing is idempotent — safe to re-run on the same queue records

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/queries/drive.ts`: 7 query functions + `upsertSkillFromDrive` — extend with content update and delete functions
- `web/lib/drive-sync.ts`: Channel registration + Google Drive API auth — extend with `changes.list()`, `files.get()`, `files.export()`
- `drive_sync_queue` table: Written by webhook handler — this phase adds the consumer
- `skills` table: Has content, content_hash, channel, skill_type columns ready for population

### Established Patterns
- Sync scripts in `scripts/sync/` follow: fetch → transform → upsert pattern
- `scripts/sync/sync-drive.ts` already walks folders — extend with content extraction
- API clients use `getUserOAuthToken()` for auth — Drive API calls follow same pattern

### Integration Points
- `web/routes/drive-webhook.ts` writes to `drive_sync_queue` — this phase reads from it
- `web/lib/queries/drive.ts` — add `updateSkillContent()`, `deleteSkill()`, `getQueuedSyncItems()`
- `scripts/sync/sync-drive.ts` — extend with content extraction during re-index
- New: `scripts/sync/process-drive-queue.ts` or integrate into existing Drive sync module

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly delegated all document processing decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-drive-document-processing*
*Context gathered: 2026-04-01*
