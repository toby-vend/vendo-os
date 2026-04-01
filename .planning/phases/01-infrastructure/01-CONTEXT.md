# Phase 1: Infrastructure - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the existing codebase before building the skills layer on top. Three deliverables: (1) fix crypto key versioning so OAuth tokens survive key rotation, (2) split the 750-line queries.ts monolith into domain modules so skills/brand queries have a clean home, (3) create the 5 new database tables the skills layer needs. No user-facing features — this is foundation work.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User trusts Claude to make sensible technical decisions for all infrastructure choices. Key areas and recommended approaches:

**Queries split strategy:**
- Split by domain: `queries/meetings.ts`, `queries/auth.ts`, `queries/pipeline.ts`, `queries/ads.ts`, `queries/dashboard.ts`, `queries/base.ts` (shared helpers + db client export)
- Keep the same `rows<T>()` and `scalar<T>()` helpers in base — all modules import from there
- Re-export everything from a barrel `queries/index.ts` so existing imports don't break
- New skills/brand modules added in later phases slot into this structure

**OAuth token migration:**
- Add version byte prefix to encrypted token format: `v1:base64(iv+authTag+ciphertext)`
- Existing tokens (no prefix) treated as v0 — decrypted with current key
- On successful decrypt of v0 token, re-encrypt as v1 (lazy migration)
- Support dual-key period: try current key first, fall back to previous key
- Store `TOKEN_ENCRYPTION_KEY_PREVIOUS` env var for rotation window

**New table design:**
- `skills` — id, drive_file_id (unique), title, content, content_hash, channel (paid_social/seo/paid_ads), skill_type, drive_modified_at, indexed_at, version
- `skills_fts` — FTS5 virtual table on skills(title, content) with tokenize='unicode61'
- `brand_hub` — id, client_id (FK), client_name, client_slug, content, content_hash, drive_file_id, drive_modified_at, indexed_at
- `drive_watch_channels` — id, channel_id, resource_id, expiration, page_token, created_at, renewed_at
- `task_runs` — id, client_id, channel, task_type, status (queued/generating/qa_check/draft_ready/approved/failed), sops_used (JSON), brand_context_id, output, qa_score, qa_critique, attempts, created_by, created_at, updated_at
- Client isolation: `brand_hub.client_id` is always in WHERE clause — no cross-client queries possible by design
- All tables use `INTEGER PRIMARY KEY` (SQLite rowid alias) for performance

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/queries.ts`: `rows<T>()` and `scalar<T>()` helpers wrap @libsql/client — reuse in all split modules
- `web/lib/crypto.ts`: AES-256-GCM encrypt/decrypt — needs version prefix, but core algorithm is sound
- `web/lib/auth.ts`: Session token system — no changes needed, just benefits from hardened crypto
- `web/lib/google-tokens.ts`: OAuth token storage — direct consumer of crypto module changes

### Established Patterns
- Database client created once in module scope, exported for all consumers
- `@libsql/client` used throughout — same client works for local SQLite and Turso cloud
- Schema migrations done via `db:init` script (`scripts/utils/db.ts`) — new tables follow same pattern
- Existing FTS5 usage in meetings search (`web/lib/queries.ts:158`) — skills FTS follows same approach

### Integration Points
- `web/lib/queries.ts` imported by every route handler — split must maintain all existing exports
- `web/lib/crypto.ts` imported by `google-tokens.ts` — version change must be backwards-compatible
- `scripts/utils/db.ts` handles schema creation — extend with new tables
- `.env.local` / Vercel env vars — add `TOKEN_ENCRYPTION_KEY_PREVIOUS` for key rotation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly delegated all infrastructure decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-infrastructure*
*Context gathered: 2026-04-01*
