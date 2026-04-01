# Phase 3: Drive Document Processing — Research

**Researched:** 2026-04-01
**Domain:** Google Drive Changes API, content extraction, queue processing, content hashing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation decisions delegated to Claude. Key choices already specified:

- **Content extraction:** Google Docs → `text/plain` export via Drive API. Spreadsheets → CSV or skip (metadata only). PDFs → metadata only unless Google Doc-backed.
- **Hash algorithm:** SHA-256 of extracted content stored in `skills.content_hash`. Hash match = skip re-processing.
- **Channel mapping:** Folder ID lineage determines channel. File at any depth under a top-level watched folder inherits that channel.
- **Folder-to-channel map:** `DRIVE_FOLDER_PAID_SOCIAL` → `paid_social`, `DRIVE_FOLDER_SEO` → `seo`, `DRIVE_FOLDER_PAID_ADS` → `paid_ads`, `DRIVE_FOLDER_GENERAL` → `general`. `DRIVE_FOLDER_BRANDS` is Phase 5 only — ignore here.
- **skill_type:** Derive from subfolder name or file naming convention (e.g. "Ad copy templates" subfolder → `ad_copy_template`). Sensible heuristic acceptable.
- **Move between channel folders:** Re-derive channel from new parent. Update `skills.channel`.
- **Move out of all watched folders:** Treat as deletion — remove from skills table.
- **Rename:** Update `skills.title` only. No content re-index if hash unchanged.
- **Delete:** Remove skill record from skills table (no soft-delete — Phase 9 adds append-only audit trail).
- **Queue processor:** Reads `drive_sync_queue`, calls `changes.list()` with stored pageToken, processes each change, updates pageToken in `drive_watch_channels`.
- **Trigger options:** (a) webhook arrival, (b) cron job, (c) `npm run drive:process`.
- **Idempotency:** Processing must be safe to re-run on the same queue records.

### Claude's Discretion

All document processing implementation decisions — patterns, error handling, queue consumption strategy, skill_type heuristics, file naming conventions.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. FTS5 indexing/querying is Phase 4.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-02 | System classifies incoming documents by channel (paid social / SEO / paid ads) based on Drive folder path | Folder ID lineage approach: resolve file's parents chain up to a known top-level folder ID. Drive `files.get` returns `parents[]`. Map top-level parent ID to channel via env var lookup. |
| SYNC-04 | System detects actual content changes via content hashing, skipping metadata-only updates | SHA-256 of exported text content. Compare against `skills.content_hash` before writing. `drive_modified_at` alone is unreliable — Drive updates it on comments/permission changes too. |
| SYNC-05 | System handles document renames, moves between folders, and deletions correctly | Changes API `changeType` field distinguishes file vs drive changes. `file.trashed` indicates deletion. `file.parents` change indicates a move. `file.name` change is a rename. All three are fully detectable from the change payload. |

</phase_requirements>

---

## Summary

Phase 3 builds the queue consumer that was deliberately left out of Phase 2. The `drive_sync_queue` table already receives rows when Google Drive POSTs to the webhook; this phase adds the processor that reads those rows, calls `changes.list()` with the stored pageToken, resolves each file's parent folder lineage to derive a channel classification, extracts content for indexable MIME types, and writes to the skills table.

The Google Drive Changes API (`changes.list`) is the correct interface here — it returns a delta of everything that changed since the last pageToken, not just the single file that triggered the webhook. This is the authoritative source: the webhook notification is only a signal that "something changed"; the actual change data comes from `changes.list`. The pattern is well-established: store pageToken in `drive_watch_channels.page_token`, call `changes.list?pageToken=X`, process results, persist new `nextPageToken`.

Content extraction is straightforward: `files.export?mimeType=text/plain` for Google Docs, `files.export?mimeType=text/csv` for Sheets (or skip), and `files.get?alt=media` for plain text/markdown uploads. SHA-256 the extracted text before writing — this is the gating check that prevents Phase 4's FTS5 index from being rebuilt on trivial changes like comment additions or Drive permission updates.

**Primary recommendation:** Build a single `processQueue()` function in `scripts/sync/process-drive-queue.ts` that is importable as both a CLI script and a module (so the webhook handler can call it inline). Expose it via `npm run drive:process`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | built-in | SHA-256 content hashing | No dependency, correct API, already used in `web/lib/crypto.ts` |
| `@libsql/client` | 0.17.x (existing) | DB read/write | Already in use via `web/lib/queries/base.ts` |
| Google Drive API v3 | — | `changes.list`, `files.get`, `files.export` | Already established in `web/lib/drive-sync.ts` |
| `dotenv` | 16.x (existing) | `.env.local` loading in scripts | Already used in `scripts/sync/sync-drive.ts` |

### No new dependencies required
Everything needed is already present. This phase adds logic, not libraries.

---

## Architecture Patterns

### Recommended Structure

```
scripts/sync/
└── process-drive-queue.ts   # New: queue consumer (importable + CLI)

web/lib/
├── drive-sync.ts            # Extend: add listChanges(), getFileParents(), exportFileContent()
└── queries/
    └── drive.ts             # Extend: add markQueueItemProcessed(), updateSkillContent(),
                             #         deleteSkill(), getSkillByDriveFileId()
```

### Pattern 1: Queue Consumer Loop

**What:** Read unprocessed queue rows, call `changes.list` per channel, process each change, mark rows processed.

**When to use:** Every time the webhook fires, on cron, or on manual `npm run drive:process`.

```typescript
// Pseudocode for process-drive-queue.ts
async function processQueue(): Promise<void> {
  const queueItems = await getUnprocessedSyncQueueItems(50);
  if (queueItems.length === 0) return;

  // Group by channel_id to avoid redundant changes.list calls
  const uniqueChannelIds = [...new Set(queueItems.map(i => i.channel_id))];

  for (const channelId of uniqueChannelIds) {
    const channel = await getDriveWatchChannel(channelId);
    if (!channel) continue; // channel deregistered

    const pageToken = channel.page_token;
    if (!pageToken) continue;

    const { changes, newPageToken } = await listChanges(channel.user_id, pageToken);

    for (const change of changes) {
      await processChange(change);
    }

    // Always advance the pageToken even if no changes — this is the cursor
    await updatePageToken(channelId, newPageToken);
  }

  // Mark all queue rows processed (batch)
  for (const item of queueItems) {
    await markQueueItemProcessed(item.id);
  }
}
```

### Pattern 2: Channel Classification via Parent Lineage

**What:** Resolve a file's Drive parent folder IDs up the tree until one matches a known top-level folder. Map that folder ID to a channel slug.

**When to use:** Every time a change is processed for a file (not a deletion).

```typescript
// Build a Map of known top-level folder IDs at startup
const CHANNEL_FOLDER_MAP = new Map<string, string>([
  [process.env.DRIVE_FOLDER_PAID_SOCIAL!, 'paid_social'],
  [process.env.DRIVE_FOLDER_SEO!,         'seo'],
  [process.env.DRIVE_FOLDER_PAID_ADS!,   'paid_ads'],
  [process.env.DRIVE_FOLDER_GENERAL!,    'general'],
]);

async function resolveChannel(
  fileId: string,
  accessToken: string,
): Promise<string | null> {
  // files.get returns parents[] — walk up until we find a known folder
  const file = await filesGet(fileId, accessToken, 'id,parents');
  if (!file.parents?.length) return null;

  for (const parentId of file.parents) {
    if (CHANNEL_FOLDER_MAP.has(parentId)) {
      return CHANNEL_FOLDER_MAP.get(parentId)!;
    }
    // Recurse one level — most structures are shallow (top-level > subfolder > file)
    const parent = await filesGet(parentId, accessToken, 'id,parents');
    for (const grandparentId of parent.parents ?? []) {
      if (CHANNEL_FOLDER_MAP.has(grandparentId)) {
        return CHANNEL_FOLDER_MAP.get(grandparentId)!;
      }
    }
  }
  return null; // outside all watched folders
}
```

**Important:** Drive files can only have one parent (as of 2019 — multi-parent was removed). `parents` is always a single-element array for non-shared-drive files. The loop is defensive but will only ever iterate once.

### Pattern 3: Content Extraction with Hash Gating

**What:** Export content, compute SHA-256, compare against stored hash before writing.

```typescript
async function extractContent(
  fileId: string,
  mimeType: string,
  accessToken: string,
): Promise<string | null> {
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return res.text();
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Store metadata only — spreadsheets are unlikely SOPs
    return null;
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return res.text();
  }

  return null; // PDF or unknown — metadata only
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
```

**Hash gate (in upsert logic):**
```typescript
const newHash = hashContent(content);
const existing = await getSkillByDriveFileId(fileId);
if (existing?.content_hash === newHash) {
  // Metadata may have changed (title, channel) — update those without touching content/hash
  await updateSkillMetadata(fileId, { title, channel, driveModifiedAt });
  return; // skip content re-index
}
// Hash changed — full upsert including content
await updateSkillContent(fileId, { title, content, contentHash: newHash, channel, driveModifiedAt });
```

### Pattern 4: Change Type Routing

**What:** Route each change from `changes.list` to the correct handler based on what changed.

```typescript
// Changes API change object shape (relevant fields)
interface DriveChange {
  changeType: 'file' | 'drive';
  fileId: string;
  removed: boolean;          // true = file deleted or moved out of corpus
  file?: {
    id: string;
    name: string;
    mimeType: string;
    trashed: boolean;
    parents: string[];
    modifiedTime: string;
  };
}

async function processChange(change: DriveChange): Promise<void> {
  if (change.changeType !== 'file') return; // ignore drive-level changes

  const { fileId } = change;

  // Deletion: file removed from Drive or moved to trash
  if (change.removed || change.file?.trashed) {
    await deleteSkill(fileId);
    return;
  }

  if (!change.file) return;

  // Derive channel from parent folder lineage
  const channel = await resolveChannel(fileId, accessToken);
  if (!channel) {
    // File moved outside all watched folders — treat as deletion
    await deleteSkill(fileId);
    return;
  }

  // Determine skill_type from subfolder naming
  const skillType = await resolveSkillType(fileId, accessToken);

  // Extract content (may return null for non-indexable types)
  const content = await extractContent(fileId, change.file.mimeType, accessToken);

  if (content !== null) {
    const newHash = hashContent(content);
    const existing = await getSkillByDriveFileId(fileId);
    if (existing?.content_hash === newHash) {
      // Rename or metadata-only change
      await updateSkillMetadata(fileId, {
        title: change.file.name,
        channel,
        skillType,
        driveModifiedAt: change.file.modifiedTime,
      });
      return;
    }
    await updateSkillContent(fileId, {
      title: change.file.name,
      content,
      contentHash: newHash,
      channel,
      skillType,
      driveModifiedAt: change.file.modifiedTime,
    });
  } else {
    // Non-indexable type — upsert metadata only
    await updateSkillMetadata(fileId, {
      title: change.file.name,
      channel,
      skillType,
      driveModifiedAt: change.file.modifiedTime,
    });
  }
}
```

### Pattern 5: skill_type Heuristic

**What:** Derive `skill_type` from the immediate parent subfolder name (the folder directly containing the file under the channel root). Falls back to `'sop'` if resolution fails.

```typescript
async function resolveSkillType(
  fileId: string,
  accessToken: string,
): Promise<string> {
  const file = await filesGet(fileId, accessToken, 'id,parents');
  const parentId = file.parents?.[0];
  if (!parentId) return 'sop';

  // If parent IS the top-level channel folder, default to 'sop'
  if (CHANNEL_FOLDER_MAP.has(parentId)) return 'sop';

  const parent = await filesGet(parentId, accessToken, 'id,name');
  return slugifyFolderName(parent.name ?? '') ?? 'sop';
}

function slugifyFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
// "Ad copy templates" → "ad_copy_templates"
// "SEO frameworks"   → "seo_frameworks"
```

### Anti-Patterns to Avoid

- **Using webhook headers as the source of truth for what changed.** The Drive webhook body is empty for changes; headers only say "something changed on this channel". Always call `changes.list` with the pageToken for actual change data.
- **Advancing pageToken only on success.** If processing fails mid-batch, the pageToken should NOT advance — retry is correct behaviour. Advance only after successful processing of a batch.
- **Calling `files.get` inside the queue loop without caching.** The parent lineage resolution makes 1-2 API calls per file. For a 100-file batch this is acceptable; for bulk re-index use `sync-drive.ts` which already knows the folder structure.
- **Treating `drive_modified_at` as a reliable content-change signal.** Drive updates `modifiedTime` on comment additions, permission changes, and metadata edits. SHA-256 hash is the correct gate.
- **Deleting the skill record before checking `change.removed` carefully.** `removed: true` means removed from the Changes API corpus (could be a permission change on the watch channel). Check `file.trashed` as the definitive deletion signal; `change.removed` should trigger a `files.get` to confirm before deletion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Content hashing | Custom hash scheme | `node:crypto` `createHash('sha256')` | Built-in, no deps, correct |
| Drive API auth | Custom token logic | `getGoogleAccessToken()` from `web/lib/google-tokens.ts` | Already handles refresh, lazy migration, encryption |
| Queue deduplication | Custom logic | Group by `channel_id`, call `changes.list` once per channel | The Changes API is already idempotent by design — pageToken advancement is the dedup |
| File parent resolution | Recursive tree walk | `files.get?fields=id,parents` — one call returns direct parent | Drive files have exactly one parent since 2019 |

---

## Common Pitfalls

### Pitfall 1: Webhook notification ≠ single file change
**What goes wrong:** Code assumes the webhook fires once per file change, processes only one file.
**Why it happens:** Phase 2's webhook handler stores one queue row per webhook notification. But `changes.list` may return many changes per pageToken call — e.g. bulk upload of 20 docs fires 20 webhooks but `changes.list` returns all 20 in one call.
**How to avoid:** Always call `changes.list` and iterate ALL returned changes. Group queue items by `channel_id` and call `changes.list` once per unique channel per processing run.
**Warning signs:** Skills table gets partially updated after bulk uploads.

### Pitfall 2: pageToken not persisted atomically
**What goes wrong:** Process crashes after calling `changes.list` but before persisting the new pageToken. On restart, the same changes are re-processed (double upsert is safe due to idempotency) but worse — if the crash happens after `changes.list` returns but the new token is not saved, the next run re-fetches the same page.
**Why it happens:** Token persistence treated as a secondary concern.
**How to avoid:** Persist the new pageToken to `drive_watch_channels.page_token` immediately after receiving the `changes.list` response, before processing any changes. Processing failures will miss changes, but re-running `drive:process` will re-fetch from the last good token. Upserts are idempotent so re-running is safe.

### Pitfall 3: Export returns 403 for large Google Docs
**What goes wrong:** `files.export` returns 403 with "Export size exceeds limit" for Google Docs over ~10MB.
**Why it happens:** Drive API enforces an export size cap. Very rare for SOPs but possible for large template documents.
**How to avoid:** Wrap export in try/catch. On 403 during export, store metadata only (`content = ''`, `content_hash = ''`) and log a warning. Do not crash the processor.
**Warning signs:** Large SOP documents missing from skills table after sync.

### Pitfall 4: `changes.list` returns `nextPageToken` vs `newStartPageToken`
**What goes wrong:** Code reads `nextPageToken` to advance the cursor, but the field is only present when there are more pages. When all changes are returned in one page, the field to persist is `newStartPageToken`.
**Why it happens:** The API returns different fields depending on pagination state.
**How to avoid:**
```typescript
const nextCursor = data.nextPageToken ?? data.newStartPageToken;
// Always persist nextCursor — it is never null if the API call succeeded
```

### Pitfall 5: Deleting skills for files outside watched folders when Drive watch scope changes
**What goes wrong:** `change.removed: true` fires when the watch channel loses access to a file (e.g. admin's Google token scopes change), not just when the file is deleted.
**Why it happens:** `removed` means "no longer accessible via this watch", not "deleted from Drive".
**How to avoid:** For `removed: true` changes, call `files.get` to verify the file still exists and is accessible. Only delete the skill record if the file is confirmed trashed or inaccessible (4xx response).

---

## Code Examples

### `changes.list` call
```typescript
// Source: Google Drive API v3 docs — https://developers.google.com/drive/api/reference/rest/v3/changes/list
interface ChangesListResponse {
  changes: DriveChange[];
  nextPageToken?: string;       // present only if more pages follow
  newStartPageToken?: string;   // present on the last page — use as cursor for next poll
}

async function listChanges(
  userId: string,
  pageToken: string,
): Promise<{ changes: DriveChange[]; newPageToken: string }> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error('No access token for Drive changes.list');

  const params = new URLSearchParams({
    pageToken,
    fields: 'changes(changeType,fileId,removed,file(id,name,mimeType,trashed,parents,modifiedTime)),nextPageToken,newStartPageToken',
    includeRemoved: 'true',
    spaces: 'drive',
  });

  const allChanges: DriveChange[] = [];
  let currentToken = pageToken;

  // Paginate until newStartPageToken appears
  while (true) {
    params.set('pageToken', currentToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/changes?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`changes.list failed: ${res.status} ${body}`);
    }
    const data = await res.json() as ChangesListResponse;
    allChanges.push(...data.changes);

    if (data.newStartPageToken) {
      // This is the last page
      return { changes: allChanges, newPageToken: data.newStartPageToken };
    }
    if (data.nextPageToken) {
      currentToken = data.nextPageToken;
    } else {
      // Should not happen — treat as end of pages
      return { changes: allChanges, newPageToken: currentToken };
    }
  }
}
```

### New query functions needed in `web/lib/queries/drive.ts`
```typescript
// Mark queue item as processed
export async function markQueueItemProcessed(id: number, error?: string): Promise<void> {
  await db.execute({
    sql: `UPDATE drive_sync_queue SET processed_at = ?, error = ? WHERE id = ?`,
    args: [new Date().toISOString(), error ?? null, id],
  });
}

// Get skill by Drive file ID (for hash comparison)
export async function getSkillByDriveFileId(driveFileId: string): Promise<SkillRow | null> {
  const result = await rows<SkillRow>(
    'SELECT * FROM skills WHERE drive_file_id = ?',
    [driveFileId],
  );
  return result[0] ?? null;
}

// Update content + hash (full re-index)
export async function updateSkillContent(data: {
  driveFileId: string;
  title: string;
  content: string;
  contentHash: string;
  channel: string;
  skillType: string;
  driveModifiedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(drive_file_id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            content_hash = excluded.content_hash,
            channel = excluded.channel,
            skill_type = excluded.skill_type,
            drive_modified_at = excluded.drive_modified_at,
            indexed_at = excluded.indexed_at,
            version = version + 1`,
    args: [data.driveFileId, data.title, data.content, data.contentHash,
           data.channel, data.skillType, data.driveModifiedAt, now],
  });
}

// Update metadata only (rename, re-classification, no content change)
export async function updateSkillMetadata(data: {
  driveFileId: string;
  title: string;
  channel: string;
  skillType: string;
  driveModifiedAt: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE skills SET title = ?, channel = ?, skill_type = ?, drive_modified_at = ?
          WHERE drive_file_id = ?`,
    args: [data.title, data.channel, data.skillType, data.driveModifiedAt, data.driveFileId],
  });
}

// Delete skill record
export async function deleteSkill(driveFileId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM skills WHERE drive_file_id = ?`,
    args: [driveFileId],
  });
}

// Update page token in watch channels after processing
export async function updateDrivePageToken(channelId: string, pageToken: string): Promise<void> {
  await db.execute({
    sql: `UPDATE drive_watch_channels SET page_token = ? WHERE channel_id = ?`,
    args: [pageToken, channelId],
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `files.watch` (per-file push) | `changes.watch` (corpus-level push) | Phase 2 | One channel registration covers all files; already implemented |
| Multi-parent Drive files | Single-parent only | 2019 | `file.parents` is always 1 element for My Drive files |
| Poll-based sync | Webhook → queue → `changes.list` | Phase 2 | Already established; this phase adds the consumer |

**Deprecated/outdated:**
- `files.watch` per-file webhooks: superseded by `changes.watch` for corpus-level notifications. Not relevant here since Phase 2 already uses `changes.watch`.
- Google Drive real-time sync protocol: removed. Replaced by webhook + `changes.list` pattern.

---

## Open Questions

1. **Webhook processor invocation on webhook arrival**
   - What we know: CONTEXT.md says triggering can be (a) webhook arrival, (b) cron, (c) manual. The webhook route currently only writes to `drive_sync_queue`.
   - What's unclear: Should the webhook route also directly call `processQueue()` inline (fast, but adds latency to webhook acknowledgement), or rely on cron/manual only?
   - Recommendation: Keep webhook handler fast (queue write only). The cron already runs every 15 minutes (Phase 2). Processing latency of < 15 minutes is acceptable per CONTEXT.md ("within minutes"). If faster is wanted, the cron interval can be shortened.

2. **`resolveChannel` depth limit**
   - What we know: CONTEXT.md says "any depth" under a channel folder inherits that channel. The heuristic above only walks 2 levels (parent and grandparent).
   - What's unclear: Realistic folder depth in Vendo's Drive structure.
   - Recommendation: Cap at 5 levels with a while loop. Breadth-first crawl up to 5 levels is safe — Google Drive structures rarely exceed 3-4 levels deep for business documents.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — flags passed via CLI |
| Quick run command | `node --experimental-test-module-mocks --test web/lib/queries/drive.test.ts` |
| Full suite command | `node --experimental-test-module-mocks --test web/**/*.test.ts scripts/**/*.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| SYNC-02 | File under `DRIVE_FOLDER_PAID_SOCIAL` → classified as `paid_social` | unit | `node --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts` | ❌ Wave 0 |
| SYNC-02 | File 2 levels deep under `DRIVE_FOLDER_SEO` → classified as `seo` | unit | same | ❌ Wave 0 |
| SYNC-02 | File outside all watched folders → `resolveChannel` returns null | unit | same | ❌ Wave 0 |
| SYNC-04 | Same content hash → `updateSkillContent` NOT called, `updateSkillMetadata` called | unit | same | ❌ Wave 0 |
| SYNC-04 | Changed content hash → `updateSkillContent` called with new hash | unit | same | ❌ Wave 0 |
| SYNC-05 | `change.removed = true` → `deleteSkill` called | unit | same | ❌ Wave 0 |
| SYNC-05 | `file.trashed = true` → `deleteSkill` called | unit | same | ❌ Wave 0 |
| SYNC-05 | Rename (name change, same content hash) → title updated, content not re-indexed | unit | same | ❌ Wave 0 |
| SYNC-05 | Move between channel folders → `skills.channel` updated to new channel | unit | same | ❌ Wave 0 |
| SYNC-05 | Move out of all watched folders → `deleteSkill` called | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --experimental-test-module-mocks --test scripts/sync/process-drive-queue.test.ts`
- **Per wave merge:** `node --experimental-test-module-mocks --test web/**/*.test.ts scripts/**/*.test.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/sync/process-drive-queue.test.ts` — covers SYNC-02, SYNC-04, SYNC-05
- [ ] `web/lib/queries/drive.test.ts` — covers new query functions (`updateSkillContent`, `updateSkillMetadata`, `deleteSkill`, `markQueueItemProcessed`, `updateDrivePageToken`, `getSkillByDriveFileId`)

No new framework install needed — `node:test` is already in use (see `web/routes/drive-webhook.test.ts`).

---

## Sources

### Primary (HIGH confidence)
- Google Drive API v3 `changes.list` reference — https://developers.google.com/drive/api/reference/rest/v3/changes/list
- Google Drive API v3 `files.export` reference — https://developers.google.com/drive/api/reference/rest/v3/files/export
- Google Drive API v3 `files.get` reference — https://developers.google.com/drive/api/reference/rest/v3/files/get
- `node:crypto` `createHash` — Node.js built-in, no external reference needed
- Existing codebase: `web/lib/drive-sync.ts`, `web/lib/queries/drive.ts`, `scripts/sync/sync-drive.ts` — patterns directly readable

### Secondary (MEDIUM confidence)
- Google Drive single-parent change (2019): https://developers.google.com/drive/api/guides/ref-single-parent — files have exactly one parent since August 2019
- Drive export size limits (10MB cap on `files.export`): documented in Drive API known issues

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use
- Architecture: HIGH — patterns derived directly from existing code and Drive API docs
- Pitfalls: HIGH — `nextPageToken` vs `newStartPageToken` is a documented API behaviour; others are verifiable from Drive API spec
- skill_type heuristic: MEDIUM — sensible default, but real subfolder names in Vendo's Drive are unknown; slugification is deterministic and reversible

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (Drive API v3 is stable; 30-day window is conservative)
