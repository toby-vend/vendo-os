# Phase 4: Skills Library - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the indexed SOPs queryable. The skills table is already populated with content by Phase 3 — this phase adds FTS5 search with channel filtering, version tracking queries, and gap detection (explicit "no matching skill found" signal). No UI — that's Phase 10. No task matching — that's Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User trusts Claude to make sensible technical decisions for all skills library choices. Key areas and recommended approaches:

**Search behaviour:**
- FTS5 with BM25 ranking — use `skills_fts` virtual table created in Phase 1
- Channel filtering: WHERE clause on `skills.channel` before FTS5 match — always filter by channel first, then rank by relevance within channel
- Also support `general` channel results in all queries — general SOPs apply across channels
- Return top 5 results by default (configurable) — enough for agent context without overwhelming
- Gap detection threshold: if top result BM25 score is below a configurable threshold OR zero results, return explicit `{ gap: true, query, channel }` signal
- Query API: `searchSkills(query: string, channel: string, limit?: number)` → `{ results: SkillResult[], gap: boolean }`
- `SkillResult` includes: id, title, content (or snippet), channel, skill_type, drive_modified_at, content_hash, bm25_score

**Skill type taxonomy:**
- Controlled vocabulary derived from actual Drive subfolder names:
  - `ad_copy_template` — ad copy templates
  - `creative_framework` — creative frameworks
  - `content_guide` — content writing guides
  - `performance_sop` — performance tracking SOPs
  - `audience_research` — audience research methods
  - `reporting_template` — reporting templates
  - `client_comms` — client communication templates
  - `onboarding` — onboarding checklists
  - `general` — anything that doesn't match above
- `resolveSkillType()` in `drive-sync.ts` already maps subfolder names — extend with this controlled vocabulary
- Unknown subfolder names fall back to `general`

**FTS5 sync trigger:**
- Inline during content upsert — `updateSkillContent()` triggers FTS5 update automatically via SQLite trigger or manual INSERT/DELETE on `skills_fts`
- FTS5 content sync table pattern: `skills_fts` is a content-sync table pointing to `skills` — content updates require explicit `INSERT INTO skills_fts(skills_fts, rowid, title, content) VALUES('delete', ?, ?, ?)` then re-insert
- No batch rebuild needed — inline keeps search always current
- Delete from skills = delete from skills_fts (handled in `deleteSkill()`)

**Version tracking queries:**
- `getSkillVersion(driveFileId)` → returns drive_modified_at, content_hash, indexed_at
- `getSkillsByVersion(channel, since: Date)` → skills updated after a given date (useful for debugging)
- Version info included in search results so Phase 9 (audit) can link generations to specific SOP versions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills_fts` FTS5 virtual table: Created in Phase 1 schema, `tokenize='unicode61'`
- `web/lib/queries/drive.ts`: 13 query functions — extend with search and version queries
- `web/lib/queries/base.ts`: `rows<T>()` and `scalar<T>()` helpers
- Existing FTS5 usage in `queries/meetings.ts` (meeting search) — follow same pattern for skills search
- `web/lib/queries/index.ts`: Barrel export — add new search exports

### Established Patterns
- FTS5 queries use `MATCH ?` with BM25 ranking via `bm25(table)` function
- Existing meeting search sanitises FTS operators before querying
- Query functions return typed interfaces

### Integration Points
- `web/lib/queries/drive.ts` — add `searchSkills()`, `getSkillVersion()`, FTS5 sync functions
- `updateSkillContent()` — needs to trigger FTS5 re-index after content update
- `deleteSkill()` — needs to also delete from `skills_fts`
- Phase 6 (Task Matching) will call `searchSkills()` directly

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly delegated all skills library decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-skills-library*
*Context gathered: 2026-04-01*
