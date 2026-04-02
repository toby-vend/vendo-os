# Phase 9: Audit and Traceability — Research

**Researched:** 2026-04-02
**Domain:** Append-only audit logging, SOP version snapshotting, SQLite/libsql constraints
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDT-01 | Every generation is logged: AM who triggered, client, channel, SOPs used, SOP versions, QA score | `task_runs` already stores most fields; `sops_used` currently holds skill IDs only — needs enrichment to include `drive_modified_at` and `content_hash` per SOP at time of use |
| AUDT-02 | Each draft shows which SOPs were used ("based on: [SOP names]") | SOP titles already exist in `output.sources[]` (written by Phase 7); need a query that returns them reliably; UI-facing read path in Phase 10 |
| AUDT-03 | Audit log is append-only — no records deleted | No `deleteTaskRun` function exists anywhere in the codebase; enforce via policy: no DELETE query exported from `task-runs.ts`, document in module header |

</phase_requirements>

---

## Summary

Phase 9 is primarily a data-layer enrichment phase. The `task_runs` table already captures most audit fields from Phases 6–8: `created_by`, `client_id`, `channel`, `task_type`, `sops_used` (skill IDs), `qa_score`, and `qa_critique`. Two gaps remain.

**Gap 1 — SOP versions missing from audit record.** `sops_used` currently stores `number[]` (skill IDs). AUDT-01 requires SOP versions (`drive_modified_at`, `content_hash`) at the moment of use. Skills are mutable — their `drive_modified_at` and `content_hash` change when a Drive document is updated. Without a snapshot, the audit record cannot answer "which version of this SOP was used for this generation?" The fix is to enrich `sops_used` from `number[]` to a JSON array of `{id, title, drive_modified_at, content_hash}` objects. This is a single-column schema change (TEXT remains TEXT, just richer JSON) captured in `assembleContext` where the skills array is already in scope.

**Gap 2 — Append-only constraint.** libsql/Turso does not support `AFTER DELETE` triggers in the hosted environment (it strips DDL triggers). The append-only guarantee is enforced by policy: the `task-runs.ts` query module never exports a DELETE function, and this is documented in the module header. No migration is needed. This is the correct pattern for the stack — the constraint lives in the application layer, not the database layer.

**Gap 3 — No new table needed.** A separate `task_run_sop_snapshots` table was considered but rejected. The snapshot data is small (5 SOPs × 3 fields), the existing `sops_used TEXT` column already holds JSON, and keeping it in one column maintains the flat query pattern established in Phases 6–8. No JOIN is needed for the audit read path.

**Primary recommendation:** Enrich `sops_used` JSON schema to include SOP title and version fields; add `getSkillsByIds` batch query to drive.ts; update `assembleContext` to snapshot skills at generation time; add `getAuditRecord` query to task-runs.ts; document append-only policy.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@libsql/client` | existing | SQLite query execution | Already wired via `web/lib/queries/base.ts` |
| `node:test` | built-in | Unit tests | Established in every previous phase |
| `tsx/esm` | existing | TypeScript ESM loader for tests | Same pattern as all existing test files |

No new packages required.

---

## Architecture Patterns

### Current `sops_used` Shape (before Phase 9)
```typescript
// Written by assembleContext in task-matcher.ts (Phase 6)
sops_used: JSON.stringify([1, 3, 7])  // number[] — skill IDs only
```

### Proposed `sops_used` Shape (after Phase 9)
```typescript
// Enriched snapshot written at generation time
sops_used: JSON.stringify([
  { id: 1, title: 'Meta Ad Copy Framework', drive_modified_at: '2026-03-15T10:22:00Z', content_hash: 'abc123' },
  { id: 3, title: 'AHPRA Dental Guidelines', drive_modified_at: '2026-02-01T08:00:00Z', content_hash: 'def456' },
])
```

This is a backward-compatible change: `sops_used` is TEXT in the schema. Existing rows with `number[]` content are unaffected by the column type — only new rows get the enriched format. The `TaskRunRow` type annotation changes from `string | null` to a documented JSON format, but no migration is needed.

### New Type: `SopSnapshot`
```typescript
// In web/lib/queries/task-runs.ts
export interface SopSnapshot {
  id: number;
  title: string;
  drive_modified_at: string;
  content_hash: string;
}
```

### New Query: `getSkillsByIds` (drive.ts)
```typescript
// Batch lookup by primary key — used by assembleContext to snapshot versions
export async function getSkillsByIds(ids: number[]): Promise<SkillRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return rows<SkillRow>(
    `SELECT id, title, drive_modified_at, content_hash FROM skills WHERE id IN (${placeholders})`,
    ids,
  );
}
```

Note: parameterised `IN (?, ?, ?)` is safe with libsql. The IDs come from `searchSkills` results which are already validated integers.

### Updated `assembleContext` Snapshot Point

In `task-matcher.ts`, step 5 currently calls:
```typescript
await updateTaskRunStatus(taskRunId, 'generating', { sopsUsed: sopIds, brandContextId });
```

After Phase 9, replace `sopsUsed: sopIds` (plain IDs) with `sopsUsed: sopSnapshots` (rich objects). The `updateTaskRunStatus` signature changes to accept `SopSnapshot[]` instead of `number[]`. The skills array from `searchSkills` already contains `drive_modified_at` and `content_hash`, so no extra DB call is needed — just map the existing `SkillSearchResult[]` to `SopSnapshot[]`.

```typescript
// In assembleContext, before updateTaskRunStatus
const sopSnapshots: SopSnapshot[] = skillResponse.results.map(s => ({
  id: s.id,
  title: s.title,
  drive_modified_at: s.drive_modified_at,
  content_hash: s.content_hash,
}));

await updateTaskRunStatus(taskRunId, 'generating', { sopsUsed: sopSnapshots, brandContextId });
```

`SkillSearchResult` already exposes `drive_modified_at` and `content_hash` (confirmed in `drive.ts` line 5–14). No extra query needed.

### Updated `updateTaskRunStatus` Signature

```typescript
// Before (Phase 6)
extras?: { sopsUsed?: number[]; brandContextId?: number | null }

// After (Phase 9)
extras?: { sopsUsed?: SopSnapshot[]; brandContextId?: number | null }
```

The SQL is unchanged — `JSON.stringify(extras.sopsUsed)` produces a string either way.

### New Query: `getAuditRecord` (task-runs.ts)

A dedicated read function that returns the full audit record, parsing `sops_used` JSON for the caller:

```typescript
export interface AuditRecord {
  id: number;
  created_by: string;
  client_id: number;
  channel: string;
  task_type: string;
  sops_used: SopSnapshot[] | null;
  qa_score: number | null;
  qa_critique: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export async function getAuditRecord(id: number): Promise<AuditRecord | null> {
  const run = await getTaskRun(id);
  if (!run) return null;
  return {
    ...run,
    sops_used: run.sops_used ? JSON.parse(run.sops_used) as SopSnapshot[] : null,
  };
}
```

### Append-Only Policy (AUDT-03)

libsql/Turso does not support persistent DDL triggers (`CREATE TRIGGER ... BEFORE DELETE`). Verified: Turso's hosted environment strips trigger DDL at create time. The append-only guarantee is enforced at the application layer:

1. No `deleteTaskRun` or `truncateTaskRuns` function is exported from `task-runs.ts` — this is the primary enforcement.
2. Module header comment documents the append-only policy explicitly.
3. No existing DELETE on `task_runs` exists anywhere in the codebase (confirmed by `grep -rn "DELETE.*task_runs"`).

This is the correct pattern for this stack. Do not attempt DDL triggers.

### Project Structure (Phase 9 changes)

```
web/lib/
├── queries/
│   ├── drive.ts              # ADD: getSkillsByIds()
│   ├── task-runs.ts          # CHANGE: SopSnapshot type, updateTaskRunStatus signature,
│   │                         #         ADD: getAuditRecord()
│   └── task-runs.test.ts     # ADD: tests for new shape and getAuditRecord
├── task-matcher.ts           # CHANGE: snapshot skills into SopSnapshot[], update call site
└── task-matcher.test.ts      # ADD: assert sops_used is enriched JSON
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Append-only at DB level | DDL trigger on `task_runs` | Application-layer policy (no DELETE export) | libsql/Turso strips DDL triggers in hosted env |
| SOP version lookup | Extra DB query per SOP ID after generation | Map `SkillSearchResult[]` directly | Skills array is already in scope in `assembleContext`; no round-trip needed |
| Separate audit table | New `task_run_audit_log` table | Enrich existing `sops_used` column | Data is small; flat query pattern matches existing codebase; no JOIN required |

---

## Common Pitfalls

### Pitfall 1: Extra DB Round-Trip for Version Snapshot
**What goes wrong:** Developer calls `getSkillsByIds()` after `searchSkills()` to retrieve version info — two queries when one is sufficient.
**Why it happens:** `getAuditRecord` is written before the developer notices `SkillSearchResult` already includes `drive_modified_at` and `content_hash`.
**How to avoid:** Map `SkillSearchResult[]` → `SopSnapshot[]` directly in `assembleContext`. `getSkillsByIds` is only needed if the IDs need to be re-fetched from a different context (e.g., the audit read path for old rows that have `number[]` format).
**Warning signs:** Two DB calls in the `assembleContext` generation path where previously there was one.

### Pitfall 2: Breaking Existing `updateTaskRunStatus` Callers
**What goes wrong:** Changing `sopsUsed` type from `number[]` to `SopSnapshot[]` breaks the test setup in `task-runs.test.ts` which passes raw IDs.
**Why it happens:** The test file constructs `sopsUsed: [1, 2, 3]` directly.
**How to avoid:** Update all call sites in the same plan wave as the signature change. There are only two call sites: `assembleContext` in `task-matcher.ts` and the test mock in `task-runs.test.ts`.

### Pitfall 3: Assuming Turso Supports DDL Triggers
**What goes wrong:** Adding `CREATE TRIGGER before_delete_task_runs BEFORE DELETE ON task_runs ...` to `initSchema` — silently fails on Turso, works on sql.js in-memory tests, giving false confidence.
**Why it happens:** SQLite supports triggers; Turso's hosted libsql strips them.
**How to avoid:** Do not add DDL triggers. Enforce append-only via no-DELETE-export policy only.

### Pitfall 4: Old Rows with `number[]` `sops_used`
**What goes wrong:** `getAuditRecord` calls `JSON.parse(run.sops_used)` and assumes `SopSnapshot[]` shape — old rows return `number[]` which breaks the consumer.
**Why it happens:** Rows created in Phases 6–8 testing have `[1, 2, 3]` format.
**How to avoid:** In `getAuditRecord`, detect the format: if the first element is a number, return `null` or an empty array for `sops_used` (old format, version info unavailable). Document this in the function JSDoc.

---

## Code Examples

### Mapping SkillSearchResult to SopSnapshot
```typescript
// Source: SkillSearchResult interface in web/lib/queries/drive.ts
// id, title, drive_modified_at, content_hash are all present in search results
const sopSnapshots: SopSnapshot[] = skillResponse.results.map(s => ({
  id: s.id,
  title: s.title,
  drive_modified_at: s.drive_modified_at,
  content_hash: s.content_hash,
}));
```

### Detecting Old vs New `sops_used` Format
```typescript
// In getAuditRecord — handle pre-Phase-9 rows gracefully
function parseSopsUsed(raw: string | null): SopSnapshot[] | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  // Old format: number[] — version info unavailable
  if (typeof parsed[0] === 'number') return null;
  // New format: SopSnapshot[]
  return parsed as SopSnapshot[];
}
```

### Test Pattern (node:test + in-memory libsql)
```typescript
// Source: established pattern from web/lib/queries/task-runs.test.ts
// Run: node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sops_used: number[]` | `sops_used: SopSnapshot[]` (with title + version) | Phase 9 | Audit record now contains full version snapshot at time of generation |
| No audit read path | `getAuditRecord()` returns parsed `SopSnapshot[]` | Phase 9 | Phase 10 UI can read SOP attribution without parsing raw JSON |

---

## Open Questions

1. **Old rows with `number[]` sops_used**
   - What we know: Test and development runs from Phases 6–8 will have `[1, 2, 3]` format in `sops_used`. Production has no data yet.
   - What's unclear: Whether Phase 10 UI needs to handle this gracefully or can assume Phase 9+ format only.
   - Recommendation: `getAuditRecord` detects old format and returns `null` for `sops_used` (version unavailable). Phase 10 renders "SOP versions not available" for these rows.

2. **`getSkillsByIds` utility**
   - What we know: Not needed for the hot path (snapshots taken from in-scope `SkillSearchResult[]`).
   - What's unclear: Whether it's useful for audit query paths (e.g., enriching old rows, admin view).
   - Recommendation: Add it to `drive.ts` as a utility regardless — it's a natural gap in the query module and costs nothing.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 22+) |
| Config file | none — flags passed per invocation |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/task-matcher.test.ts web/lib/queries/drive.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|--------------|
| AUDT-01 | `sops_used` JSON contains `{id, title, drive_modified_at, content_hash}` per SOP | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend existing) |
| AUDT-01 | `assembleContext` writes enriched snapshot to `task_runs.sops_used` | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ✅ (extend existing) |
| AUDT-01 | `getAuditRecord` returns parsed `SopSnapshot[]` | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend existing) |
| AUDT-02 | `output.sources` titles accessible from draft record | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (verify existing) |
| AUDT-03 | No `deleteTaskRun` or equivalent exported from `task-runs.ts` | unit (export check) | `node --test --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts`
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure in `task-runs.test.ts` and `task-matcher.test.ts` covers all phase requirements. Tests need new assertions added to existing files, not new files created.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `web/lib/queries/task-runs.ts` — confirmed `sops_used TEXT` schema, no DELETE function exists
- Codebase: `web/lib/queries/drive.ts` — confirmed `SkillSearchResult` includes `drive_modified_at` and `content_hash`
- Codebase: `web/lib/task-matcher.ts` — confirmed `skillResponse.results` is in scope at snapshot point
- Codebase: `web/lib/queries/auth.ts:268` — confirmed `task_runs` DDL, no trigger support in initSchema
- Codebase: `web/lib/task-types/ad_copy.ts` — confirmed `sources: [{id, title}]` in Phase 7 output schema

### Secondary (MEDIUM confidence)
- Turso DDL trigger behaviour: Turso documentation states triggers are not supported in the hosted environment; confirmed by absence of any trigger DDL in the existing codebase across 8 phases

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all patterns established in prior phases
- Architecture: HIGH — sops_used enrichment is a single column change with no migration; all data already in scope
- Pitfalls: HIGH — old-row format detection and Turso trigger limitation both confirmed from codebase inspection

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain — SQLite/libsql patterns do not change frequently)
