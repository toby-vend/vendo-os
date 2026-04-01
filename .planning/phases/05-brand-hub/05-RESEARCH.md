# Phase 5: Brand Hub - Research

**Researched:** 2026-04-01
**Domain:** SQLite/libsql brand data ingestion, FTS5 search with client isolation, Drive folder walking
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Drive folder structure:**
- One subfolder per client inside DRIVE_FOLDER_BRANDS (e.g. `DRIVE_FOLDER_BRANDS/Kana Health Group/`)
- Multiple brand files per client (tone guides, compliance docs, differentiators, etc.)
- Recursive ingestion — files at any depth within a client folder are ingested
- Folder partially populated — not all 25+ clients have brand files yet; system handles missing/empty client folders gracefully
- Auto-discover new clients — any new subfolder is automatically treated as a new client, zero manual setup
- Same webhook pipeline as skills (Phases 2-3) — DRIVE_FOLDER_BRANDS is a watched folder, webhook fires on changes, queue processor routes brand files to brand_hub instead of skills table
- Manual re-index command: `npm run brand:reindex` walks DRIVE_FOLDER_BRANDS and populates brand_hub (needed for initial population)

**Brand content model:**
- One record per brand file in brand_hub (not merged per client) — preserves granularity, supports per-file change detection via content_hash
- Google Docs: extracted as plain text (same pattern as skills pipeline in Phase 3)
- Non-text files (PDFs, Sheets, images): handling at Claude's discretion (metadata-only vs skip)
- Retrieval strategy for task execution (concatenated vs individual): Claude's discretion

**Client registry:**
- Client identity derived from Drive folder structure — no separate clients table
- client_name: Drive subfolder name (e.g. "Kana Health Group")
- client_slug: auto-generated via lowercase + hyphenation (e.g. "kana-health-group")
- client_id: hash-based from Drive folder ID — stable across re-indexes, same folder always produces same ID
- Folder rename = same client (Drive folder ID doesn't change on rename); client_name updates to new folder name
- Client list is internal only — no dashboard page; Phase 10 (AM Interface) surfaces it later

**Query interface:**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRND-01 | Per-client brand files are ingested from Drive and stored with client association | `upsertBrandFromDrive` function mirrors `upsertSkillFromDrive` pattern; BRANDS_FOLDER already declared in sync-drive.ts |
| BRND-02 | Brand context is queryable by client name or ID | `getBrandContext(clientSlug)` and `getBrandFile(driveFileId)` in new `brand.ts` module |
| BRND-03 | Brand hub supports 25+ clients without performance degradation | `idx_brand_hub_client` index already exists; FTS5 `brand_hub_fts` adds full-text search without table scans |
| BRND-04 | Client brand context is strictly isolated — queries for client A never return client B data | Every content-returning query requires `client_id`/`client_slug` parameter; isolation test asserts no cross-client leakage |
</phase_requirements>

---

## Summary

Phase 5 is a direct extension of the skills pipeline established in Phases 3-4. The infrastructure is already in place: the `brand_hub` table exists in both schema files, `BRANDS_FOLDER` is declared but void-referenced in `sync-drive.ts`, and the content extraction functions (`extractContent`, `hashContent`) are importable from `drive-sync.ts`. The work is to activate what was reserved.

The phase has three distinct deliverables: (1) a query module `web/lib/queries/brand.ts` with four functions and a test file, (2) an extension to `process-drive-queue.ts` to route brand files to `brand_hub` instead of `skills`, and (3) a new `scripts/sync/sync-brands.ts` re-index script with an `npm run brand:reindex` script entry. The FTS5 virtual table `brand_hub_fts` must also be added to `initSchema` in `web/lib/queries/auth.ts`.

The critical design constraint is client isolation. Every content-returning query function must accept a `client_id` or `client_slug` parameter and apply a `WHERE client_id = ?` clause. This is not optional — the test suite must include an explicit cross-client isolation assertion that fails if the WHERE clause is missing. The `listBrandClients()` function is the only safe exception: it returns names and slugs only, never content.

**Primary recommendation:** Mirror the skills pipeline exactly. Re-use `extractContent`/`hashContent` from `drive-sync.ts`, the `mock.module` test pattern from `drive.test.ts`, and the `slugifyFolderName` utility already in both files. The only new logic is client_id derivation from Drive folder ID (SHA-256 truncated to integer).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@libsql/client` | ^0.17.2 | Turso/libsql query execution | Already in use; FTS5 support; all existing queries use it |
| Node.js `crypto` | built-in | SHA-256 for client_id + content_hash | Already used in `drive-sync.ts` via `createHash` |
| `node:test` + `node:assert` | built-in | Test framework | Established pattern in `drive.test.ts`, `drive-webhook.test.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | ^4.19.0 | Script runner | All scripts use `tsx scripts/...` pattern |
| `dotenv` | ^16.4.0 | Env var loading in scripts | Required for `TURSO_DATABASE_URL`, `DRIVE_FOLDER_BRANDS` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hash-based client_id (integer truncated from SHA-256) | Auto-increment INTEGER | Hash is stable across re-indexes; auto-increment is not — same Drive folder would get different IDs on second `brand:reindex` |
| FTS5 `unicode61` tokenizer | `porter` tokenizer | `unicode61` matches the `skills_fts` configuration; porter adds stemming but inconsistent with existing index behaviour |

**Installation:** No new dependencies required.

---

## Architecture Patterns

### Recommended Project Structure
```
web/lib/queries/
├── brand.ts           # New: four query functions + FTS5 helpers + types
├── brand.test.ts      # New: isolation test + search + CRUD tests
├── drive.ts           # Existing: extended with upsertBrandFromDrive
└── auth.ts            # Existing: brand_hub_fts added to initSchema

scripts/sync/
├── sync-brands.ts     # New: walk BRANDS_FOLDER, populate brand_hub
└── process-drive-queue.ts  # Existing: extended with brand routing branch
```

### Pattern 1: Client ID Derivation from Drive Folder ID

**What:** Derive a stable integer `client_id` from the Drive folder ID string, so re-indexes always produce the same ID for the same client folder.

**When to use:** Every `upsertBrandFromDrive` call where a client folder ID is known.

**Example:**
```typescript
// Source: existing hashContent pattern in web/lib/drive-sync.ts + Node crypto docs
import { createHash } from 'node:crypto';

function deriveClientId(driveFolderId: string): number {
  const hex = createHash('sha256').update(driveFolderId, 'utf8').digest('hex');
  // Take first 8 hex chars → 32-bit integer, always positive
  return parseInt(hex.slice(0, 8), 16);
}
```

### Pattern 2: Client Slug Derivation

**What:** Convert a Drive folder name to a URL-safe slug for the `client_slug` column.

**When to use:** On every brand file upsert — store alongside `client_name`.

**Example:**
```typescript
// Mirrors slugifyFolderName in web/lib/drive-sync.ts
function slugifyClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
// "Kana Health Group" → "kana-health-group"
// Note: uses hyphens (not underscores) — client-facing slug convention
```

### Pattern 3: Brand Upsert (per-file, idempotent)

**What:** Insert or update a single brand file record. Uses `drive_file_id` as conflict key, same as skills pattern.

**When to use:** In both the re-index script and the queue processor.

**Example:**
```typescript
// Mirrors updateSkillContent in web/lib/queries/drive.ts
export async function upsertBrandFromDrive(data: {
  driveFileId: string;
  title: string;
  content: string;
  contentHash: string;
  clientId: number;
  clientName: string;
  clientSlug: string;
  driveModifiedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO brand_hub (drive_file_id, client_id, client_name, client_slug, content, content_hash, drive_modified_at, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(drive_file_id) DO UPDATE SET
            client_name = excluded.client_name,
            client_slug = excluded.client_slug,
            content = excluded.content,
            content_hash = excluded.content_hash,
            drive_modified_at = excluded.drive_modified_at,
            indexed_at = excluded.indexed_at`,
    args: [data.driveFileId, data.clientId, data.clientName, data.clientSlug,
           data.content, data.contentHash, data.driveModifiedAt, now],
  });
}
```

**Schema note:** `brand_hub` has no `UNIQUE` constraint on `drive_file_id` in the current schema (only an index on `client_id`). A `UNIQUE` constraint on `drive_file_id` is required before `ON CONFLICT(drive_file_id)` will work. This must be added via `ALTER TABLE` migration in `initSchema`, mirroring the `skills` table pattern.

### Pattern 4: FTS5 Virtual Table — brand_hub_fts

**What:** Content-sync FTS5 table on `brand_hub(content)` plus `client_name` for name-scoped searches.

**When to use:** Added to `initSchema` in `auth.ts` (Turso path only; sql.js is FTS4-only, `brand_hub_fts` must be omitted from `scripts/utils/db.ts`).

**Example:**
```typescript
// Mirrors skills_fts creation in web/lib/queries/auth.ts
await db.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS brand_hub_fts USING fts5(
  client_name,
  content,
  content='brand_hub',
  tokenize='unicode61'
)`, args: [] });
```

### Pattern 5: Client-Isolated Query (BRND-04 critical path)

**What:** Every content-returning query function applies a `WHERE client_id = ?` clause. Client slug is resolved to client_id at query time.

**When to use:** `getBrandContext`, `searchBrandContent`.

**Example:**
```typescript
// getBrandContext — returns all brand files for one client
export async function getBrandContext(clientSlug: string): Promise<BrandHubRow[]> {
  return rows<BrandHubRow>(
    'SELECT * FROM brand_hub WHERE client_slug = ? ORDER BY indexed_at DESC',
    [clientSlug]
  );
}

// searchBrandContent — FTS5 search, always scoped to one client when clientSlug provided
export async function searchBrandContent(
  query: string,
  clientSlug?: string,
): Promise<BrandSearchResult[]> {
  const ftsQuery = query.replace(/['"]/g, '').trim().split(/\s+/).filter(Boolean).map(w => w + '*').join(' ');
  if (!ftsQuery) return [];

  if (clientSlug) {
    return rows<BrandSearchResult>(`
      SELECT b.id, b.client_id, b.client_name, b.client_slug, b.content, b.drive_file_id,
             bm25(brand_hub_fts) as bm25_score
      FROM brand_hub_fts fts
      JOIN brand_hub b ON b.rowid = fts.rowid
      WHERE brand_hub_fts MATCH ? AND b.client_slug = ?
      ORDER BY bm25(brand_hub_fts) ASC
      LIMIT 10
    `, [ftsQuery, clientSlug]);
  }

  // No clientSlug — global search (internal tooling only; never exposed to AM interface)
  return rows<BrandSearchResult>(`
    SELECT b.id, b.client_id, b.client_name, b.client_slug, b.content, b.drive_file_id,
           bm25(brand_hub_fts) as bm25_score
    FROM brand_hub_fts fts
    JOIN brand_hub b ON b.rowid = fts.rowid
    WHERE brand_hub_fts MATCH ?
    ORDER BY bm25(brand_hub_fts) ASC
    LIMIT 10
  `, [ftsQuery]);
}
```

### Pattern 6: Queue Processor Branch for Brand Files

**What:** In `processChange` (process-drive-queue.ts), check if the changed file belongs to BRANDS_FOLDER. If yes, route to brand_hub upsert. If no, existing skills path handles it.

**When to use:** In `processChange`, after resolving parent folders.

**Example:**
```typescript
// In process-drive-queue.ts — add BRANDS_FOLDER detection alongside CHANNEL_FOLDER_MAP
const BRANDS_FOLDER_ID = process.env.DRIVE_FOLDER_BRANDS;

// After resolveChannel:
const isBrandFile = BRANDS_FOLDER_ID
  ? await isUnderFolder(fileId, BRANDS_FOLDER_ID, accessToken)
  : false;

if (isBrandFile) {
  // Brand path: resolve client folder, extract content, upsert to brand_hub
  await processBrandChange(change, accessToken);
  return;
}
// else: existing skills path continues unchanged
```

**Note:** `resolveClientFolder` walks up the parent chain to find the immediate child of BRANDS_FOLDER (that is the client folder). This is the same logic as `resolveChannel` but targeting `BRANDS_FOLDER_ID` instead of `CHANNEL_FOLDER_MAP`.

### Pattern 7: Re-index Script (sync-brands.ts)

**What:** Standalone script that walks `BRANDS_FOLDER`, discovers client subfolders, and upserts all brand files.

**Structure mirrors `sync-drive.ts` exactly:**
1. Load env with dotenv
2. Get admin user Google access token
3. List top-level subfolders of BRANDS_FOLDER — each is a client
4. For each client subfolder: derive client_id + client_slug, recurse into files
5. For each file: extractContent → hash → upsertBrandFromDrive
6. Log summary

**Empty client folder handling:** If a client subfolder has zero files, log and skip — no error.

### Anti-Patterns to Avoid

- **Merging brand files per client into a single row:** Loses per-file change detection via content_hash. The locked decision is one row per file.
- **Using an auto-increment client_id:** Re-indexing would assign different IDs. Use SHA-256 hash of Drive folder ID.
- **Querying brand_hub without a WHERE clause on client_id/client_slug in content-returning functions:** This is the BRND-04 violation — the isolation test exists specifically to catch this.
- **Adding brand_hub_fts to scripts/utils/db.ts:** sql.js supports FTS4 only. The comment in db.ts already says "skills_fts omitted: FTS5 not available in sql.js". Same applies to brand_hub_fts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plain text extraction from Google Docs | Custom export handler | `extractContent()` from `web/lib/drive-sync.ts` | Already handles 403 size limit, null for unsupported MIME types |
| Content change detection | Timestamp comparison | `hashContent()` from `web/lib/drive-sync.ts` | SHA-256 is already the gate; `drive_modified_at` alone misses content-identical saves |
| Folder recursion | New recursive walker | `listFilesInFolder()` from `sync-drive.ts` | Already handles pagination and subfolder recursion |
| Slug generation | New slug function | `slugifyFolderName()` pattern in `drive-sync.ts` | Identical logic; only difference is using hyphens instead of underscores for client slugs |
| FTS5 content-sync delete/insert | Custom index management | Same DELETE-then-INSERT pattern as `syncSkillFts` in `drive.ts` | FTS5 content-sync tables require old values for delete — this is non-obvious and already solved |

---

## Common Pitfalls

### Pitfall 1: Missing UNIQUE constraint on brand_hub.drive_file_id

**What goes wrong:** `ON CONFLICT(drive_file_id)` in the upsert SQL throws a runtime error — SQLite requires a unique index on the conflict target column.

**Why it happens:** The existing schema (`auth.ts` + `db.ts`) creates `brand_hub` with only `CREATE INDEX` on `client_id`, not a unique constraint on `drive_file_id`.

**How to avoid:** Add a `UNIQUE` constraint or a unique index on `drive_file_id` to `brand_hub` in `initSchema`. Use the same migration-safe pattern as `skills`: add via `ALTER TABLE` try/catch, or add to the `CREATE TABLE` statement (safe since `CREATE TABLE IF NOT EXISTS` is idempotent only if the table didn't exist yet — prefer the migration approach for live databases).

**Warning signs:** `LibsqlError: SQLITE_ERROR: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint` at runtime.

### Pitfall 2: client_id Collision from Hash Truncation

**What goes wrong:** Two different Drive folder IDs produce the same 32-bit integer client_id, creating false client merges.

**Why it happens:** Truncating SHA-256 to 8 hex chars (32 bits) gives a 1-in-4-billion collision probability. With 25+ clients, this is negligible.

**How to avoid:** 32-bit truncation is fine for 25+ clients. If client count ever reaches thousands, revisit. Document the derivation so future developers understand why.

**Warning signs:** `getBrandContext("client-a")` returns files from a different client.

### Pitfall 3: Webhook Route Picks Up Brand Files Before Queue Processor Branch Exists

**What goes wrong:** A brand file change fires a webhook → queue item → existing processChange → `resolveChannel` returns null → `deleteSkill` is called with the brand file's Drive ID. If the brand file happened to match a skills drive_file_id, it would be deleted.

**Why it happens:** The existing queue processor has no brand routing — it calls `deleteSkill` for all unrecognised files (resolveChannel null path).

**How to avoid:** In the same plan that adds the brand routing branch to processChange, verify the null-channel path does NOT call `deleteSkill` for brand files. The fix is to check `isBrandFile` before falling through to the delete path.

### Pitfall 4: FTS5 brand_hub_fts Out of Sync After Upsert

**What goes wrong:** `searchBrandContent` returns stale results — FTS index not updated when `brand_hub` row changes.

**Why it happens:** FTS5 content-sync tables do not auto-update when the source table is modified via `db.execute`. The sync must be done explicitly (DELETE old tokens, INSERT new tokens), same as `syncSkillFts`.

**How to avoid:** Add `syncBrandFts(rowid, oldContent, newContent)` and `deleteBrandFts(rowid, oldContent)` functions, and call them from `upsertBrandFromDrive` by reading the old row first.

**Simpler alternative:** For the initial implementation, use a non-content-sync FTS5 table (remove `content='brand_hub'`). This makes inserts simpler (just `INSERT INTO brand_hub_fts`) at the cost of content duplication. Given brand files are small text documents, duplication is acceptable. Choose one approach and document it.

### Pitfall 5: DRIVE_FOLDER_BRANDS Environment Variable Not Set

**What goes wrong:** `sync-brands.ts` silently exits with zero files processed. Queue processor brand branch never activates.

**Why it happens:** BRANDS_FOLDER is already guarded in sync-drive.ts with `void BRANDS_FOLDER` — it is reserved but not validated.

**How to avoid:** In both `sync-brands.ts` and the queue processor branch, guard with an explicit check and a clear error: `if (!BRANDS_FOLDER_ID) { log('DRIVE_FOLDER_BRANDS not set — skipping brand routing'); return; }`. This matches the `if (!folderId) { log('Skipping channel...'); continue; }` pattern in sync-drive.ts.

---

## Code Examples

### Brand Query Module Structure

```typescript
// Source: mirrors web/lib/queries/drive.ts structure exactly
// web/lib/queries/brand.ts

import { rows, db } from './base.js';

export interface BrandHubRow {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  content: string;
  content_hash: string;
  drive_file_id: string | null;
  drive_modified_at: string | null;
  indexed_at: string;
}

export interface BrandClientRow {
  client_name: string;
  client_slug: string;
  client_id: number;
  file_count: number;
}

export interface BrandSearchResult {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  content: string;
  drive_file_id: string | null;
  bm25_score: number;
}

export async function getBrandContext(clientSlug: string): Promise<BrandHubRow[]>;
export async function listBrandClients(): Promise<BrandClientRow[]>;
export async function searchBrandContent(query: string, clientSlug?: string): Promise<BrandSearchResult[]>;
export async function getBrandFile(driveFileId: string): Promise<BrandHubRow | null>;
export async function upsertBrandFromDrive(data: { ... }): Promise<void>;
export async function deleteBrandFile(driveFileId: string): Promise<void>;
export async function syncBrandFts(rowid: number, oldContent: string, newContent: string): Promise<void>;
```

### listBrandClients — Safe (returns no content)

```typescript
export async function listBrandClients(): Promise<BrandClientRow[]> {
  return rows<BrandClientRow>(`
    SELECT client_name, client_slug, client_id, COUNT(*) as file_count
    FROM brand_hub
    GROUP BY client_id
    ORDER BY client_name ASC
  `);
}
```

### Test: Client Isolation Assertion (BRND-04)

```typescript
// Source: mirrors drive.test.ts pattern; uses real in-memory libsql
it('getBrandContext for client A never returns files belonging to client B', async () => {
  // Insert two clients with different client_id / client_slug
  await insertBrandFixture({ clientId: 1, clientSlug: 'client-a', driveFileId: 'file-a1', content: 'Alpha brand tone guide' });
  await insertBrandFixture({ clientId: 2, clientSlug: 'client-b', driveFileId: 'file-b1', content: 'Beta brand tone guide' });

  const results = await getBrandContext('client-a');
  assert.ok(results.every(r => r.client_slug === 'client-a'),
    `Expected only client-a results, got: ${results.map(r => r.client_slug).join(', ')}`
  );
  assert.ok(!results.some(r => r.client_slug === 'client-b'),
    'client-b data must never appear in client-a query'
  );
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate clients table with manual registration | Client identity derived from Drive folder structure | Phase 5 design decision | Zero manual setup; Drive folder IS the source of truth |
| Single merged brand record per client | One record per brand file | Phase 5 design decision | Per-file change detection via content_hash; granular updates |

---

## Open Questions

1. **FTS5 content-sync vs duplicate storage for brand_hub_fts**
   - What we know: Skills uses content-sync (`content='skills'`) which requires explicit DELETE/INSERT sync on every upsert
   - What's unclear: Whether the complexity is worth it for brand content (read far less frequently than written during re-index)
   - Recommendation: Use content-sync (`content='brand_hub'`) for consistency with the skills pattern. The extra complexity is one helper function — already understood from Phase 4.

2. **Non-text file handling (PDFs, Sheets)**
   - What we know: `extractContent` returns null for PDFs and Sheets; skills pipeline stores metadata-only rows for these
   - What's unclear: Whether a metadata-only brand_hub row (empty content) is useful for brand context retrieval
   - Recommendation: Skip non-text files entirely (no row inserted) rather than inserting an empty-content row. An empty content row wastes storage and produces misleading FTS results. Log the skip at DEBUG level.

3. **Slug collision between client names**
   - What we know: "Kana Health" and "Kana Health Group" would produce different slugs; "Client A" and "Client  A" (double space) would produce the same slug
   - What's unclear: Whether any existing Vendo clients have names that would collide after slugification
   - Recommendation: client_id (hash of Drive folder ID) is the true isolation key, not client_slug. Slug is display/lookup convenience. If two clients collide on slug, queries still return correct results because the WHERE clause uses client_slug across all rows with that slug — which would incorrectly merge them. Add a UNIQUE index on `client_slug` to surface this immediately on upsert.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | None — flags passed directly |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts && node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/drive.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| BRND-01 | Brand files ingested and stored with client association | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts` | Wave 0 |
| BRND-02 | `getBrandContext(clientSlug)` returns correct files | unit | same | Wave 0 |
| BRND-02 | `getBrandFile(driveFileId)` returns correct record | unit | same | Wave 0 |
| BRND-02 | `listBrandClients()` returns correct names/slugs | unit | same | Wave 0 |
| BRND-02 | `searchBrandContent(query, clientSlug)` returns FTS5 results | unit | same | Wave 0 |
| BRND-03 | 25+ client records insert and query without error | unit | same | Wave 0 |
| BRND-04 | `getBrandContext("client-a")` never returns client-b data | unit | same — explicit isolation assertion | Wave 0 |
| BRND-04 | `searchBrandContent(query, "client-a")` never returns client-b data | unit | same | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts`
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/queries/brand.test.ts` — covers BRND-01 through BRND-04; uses real in-memory libsql with FTS5 schema
- [ ] `brand_hub` schema: add UNIQUE constraint on `drive_file_id` (migration in `initSchema`)
- [ ] `brand_hub_fts` virtual table: add to `web/lib/queries/auth.ts` initSchema (Turso path)
- [ ] `npm run brand:reindex` script entry in `package.json`

---

## Sources

### Primary (HIGH confidence)
- Codebase: `web/lib/queries/drive.ts` — FTS5 search pattern, BM25 ordering, content-sync delete/insert
- Codebase: `web/lib/queries/drive.test.ts` — test setup pattern with in-memory libsql, mock.module, isolation assertions
- Codebase: `scripts/sync/process-drive-queue.ts` — queue processor structure for brand routing branch
- Codebase: `scripts/sync/sync-drive.ts` — re-index script pattern; `BRANDS_FOLDER` already declared
- Codebase: `web/lib/queries/auth.ts` — `initSchema` with brand_hub and skills_fts definitions
- Codebase: `scripts/utils/db.ts` — sql.js schema confirming brand_hub exists, FTS5 omitted comment

### Secondary (MEDIUM confidence)
- libsql FTS5 docs — `content='table'` mode requires explicit DELETE/INSERT sync; verified against existing skills_fts pattern in codebase
- SQLite `ON CONFLICT` docs — requires unique index on conflict target column; gap identified from schema inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already in use
- Architecture: HIGH — all patterns directly mirrored from Phase 3/4 codebase with concrete code references
- Pitfalls: HIGH — Pitfall 1 (missing UNIQUE constraint) and Pitfall 3 (brand files deleted by null-channel path) are verified against actual schema and code; others are structural inferences

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack; no external API changes expected)
