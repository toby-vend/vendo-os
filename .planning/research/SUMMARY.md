# Project Research Summary

**Project:** VendoOS Skills Layer — Google Drive-synced SOPs + AI Agent Task Execution
**Domain:** Agency operating system — SOP-grounded AI task execution for dental marketing
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

VendoOS is adding a structured knowledge layer on top of its existing Fastify 5 + Eta + HTMX + Turso stack. The core pattern is retrieve-then-generate: Google Drive is the source of truth for SOPs and brand guidelines; these documents are synced in real time via Drive webhooks, indexed in SQLite FTS5, and retrieved at task time to ground Claude-generated output. This is not a generic AI content tool — every draft is traceable to specific SOP documents, QA-validated against those documents, and checked against AHPRA/TGA dental advertising compliance rules before it surfaces to an account manager.

The recommended approach is deliberately minimal: no new frameworks, no vector database, no separate job queue. The existing stack extends cleanly — `googleapis` for Drive, `@anthropic-ai/sdk` with a manual tool loop for Claude, SQLite FTS5 for retrieval, and Turso's existing `@libsql/client` connection throughout. Task execution runs asynchronously (write to `task_runs`, trigger background function, UI polls for completion) to avoid Vercel serverless timeout issues. The QA layer uses claude-haiku for speed and cost, with a hard cap of two retries before escalating to a human reviewer.

The highest risks are all operational, not architectural: Google Drive webhook channels expire silently (must be renewed proactively), the `pageToken` for change tracking must be persisted to the database on every poll, client brand data must be isolated at the query level rather than in application logic, and the existing OAuth token infrastructure has a crypto key rotation problem that must be resolved before building Drive sync on top of it. None of these are blockers — all are known and all have clear mitigations.

---

## Key Findings

### Recommended Stack

The existing stack requires three net-new runtime dependencies: `googleapis` (official Drive API client), `@anthropic-ai/sdk` (Claude API with manual tool loop), and `openai` (embeddings only, using `text-embedding-3-small`). Supporting libraries are `tiktoken` for token counting during chunking and `google-auth-library` as a peer dependency of googleapis. Nothing from the existing stack changes.

The decision to avoid LangChain, the Anthropic Agent SDK, and a dedicated vector database is deliberate. All three would add significant bundle weight and abstraction overhead for what is a simple three-step loop (retrieve, generate, validate). Turso's native `F32_BLOB` vector type is available if FTS5 relevance proves insufficient, but it is a future optimisation, not a day-one requirement.

**Core technologies:**
- `googleapis@171.x`: Drive API v3 — file sync, export, webhook channel registration — Google's official Node.js client; typed, handles OAuth2 refresh
- `@anthropic-ai/sdk@0.81.x`: Claude API for task generation (Sonnet) and QA validation (Haiku) — manual tool loop, ~30 lines of TypeScript, no framework dependency
- `openai@4.x`: Embeddings only (`text-embedding-3-small`) — $0.02/1M tokens; Anthropic has no embedding model
- `tiktoken@1.x`: Token counting for 400–500 token chunking before embedding — prevents exceeding the 8191-token embedding limit
- `@libsql/client@0.17.x` (existing): Extends to FTS5 skills index and, if needed, F32_BLOB vector columns — no new DB client

### Expected Features

The complete MVP is ten features, all P1. The feature dependency chain is strict: Drive sync must be stable before the skills library has data; the skills library must be indexed before task matching works; task matching must work before agent execution can be tested; agent execution must produce output before QA can be developed. Building out of this order wastes time.

**Must have (table stakes — v1):**
- Drive webhook sync with delta token persistence — real-time SOP updates; polling is unacceptable
- Folder-based channel classification — deterministic (paid_social / SEO / paid_ads / general) from Drive folder path; no AI classification
- Skills library — FTS5-indexed store of SOPs with channel and doc type metadata
- Brand hub — per-client brand context (tone, compliance, differentiators) keyed by client slug
- Task matching engine — maps task type + client ID to relevant SOPs + brand context
- Agent task execution — structured draft from retrieved context using Claude Sonnet
- QA validation with retry — SOP-checklist pass, one retry with critique, `draft_review_required` on third failure
- AHPRA/TGA compliance pre-flight — dental-specific rules enforced before draft surfaces
- Output status tracking — queued / running / qa_check / draft_ready / approved
- AM review interface — trigger task, view draft, approve or request regeneration

**Should have (add after v1 is stable — v1.x):**
- SOP versioning — link generation output to the document version used; enables debugging when output changes after an SOP update
- SOP gap detection — surface "no skill found" explicitly rather than producing degraded output; requires real usage data to calibrate thresholds
- Output audit trail — generation log with AM, SOPs used, QA score, version; required before scaling beyond 3–4 users
- Admin skills management UI — view indexed skills, force re-sync, deprecate documents

**Defer (v2+):**
- Specialist sub-agents per channel — current single agent per channel is sufficient; split when output quality demands it
- Client CRM portal — separate milestone, separate database
- Cross-client performance correlation — requires mature data layer

**Explicit anti-features (not building):**
- AI-based document classification — deterministic folder path is safer and auditable
- Autonomous publishing to ad platforms — AHPRA compliance requires AM sign-off; no exceptions
- Freeform LLM output without SOP grounding — generic output defeats the purpose of the system

### Architecture Approach

The system is a three-layer monolith extending the existing Fastify deployment: a Drive Sync Engine that registers/renews webhook channels and ingests document text, a Skills Library that stores classified SOPs in an FTS5 virtual table alongside a base `skills` table, and a Task Executor that assembles context (skills + brand) and runs the generate → QA → conditional retry loop asynchronously. All four components share the existing SQLite/Turso database with four new tables. No new services.

**Major components:**
1. **Drive Sync Engine** (`web/routes/drive-webhook.ts` + `web/lib/drive-sync.ts`) — register/renew channels, receive push notifications, extract Google Doc text, classify by folder, upsert to skills table
2. **Skills Library** (`web/lib/skills.ts`) — FTS5 retrieval filtered by channel; base `skills` table with metadata and content hash; `brand_hub` table for per-client context
3. **Task Executor** (`scripts/functions/execute-task.ts` + `validate-output.ts`) — async background function; retrieves top-5 relevant skills + client brand context; calls Claude Sonnet for generation and Claude Haiku for QA; writes results to `task_runs`
4. **QA Validator** — second Claude call returning structured `{ passes, score, issues[] }`; retries once with critique appended; escalates to `draft_review_required` on third failure
5. **Channel Renewal Job** (`scripts/functions/renew-drive-watches.ts`) — daily cron; renews channels expiring within 12 hours; overlaps old/new channels by one hour to prevent notification gaps

**Key patterns:**
- Folder-based classification at ingest — not AI, not at query time
- Async task execution via `task_runs` table + HTMX polling — never in the HTTP request cycle
- QA as a second Claude call (Haiku, not Sonnet) — cheap, fast, structured output
- FTS5 with content-linked virtual table — base table retains all metadata; FTS indexes from it

### Critical Pitfalls

1. **Webhook channels expire silently** — Google sends no expiry notification; after max 7 days (changes resource) the sync stops with no error. Prevention: store `expiry_ms` in `drive_watch_channels`, run daily renewal cron, overlap channels on renewal to avoid gaps, alert if no event received in 24 hours during business hours.

2. **pageToken loss causes sync gaps** — the change tracking token is lost between Vercel serverless invocations if stored in memory. Prevention: persist `newStartPageToken` to a `webhook_state` table after every successful poll before processing changes; on cold start always load from DB; fall back to full re-index if no token found.

3. **OAuth token refresh fails silently** — existing `CONCERNS.md` flags a crypto key rotation problem in `web/lib/crypto.ts` that could make all OAuth tokens unrecoverable. This must be addressed before Drive sync is built. Prevention: harden token refresh, surface failures on admin dashboard, implement key versioning.

4. **Wrong client's SOP or brand data injected into agent context** — a missing or incorrectly placed `client_id` WHERE clause in a retrieval query causes content bleed between dental clients. Prevention: enforce client ID filtering at the database layer (never in application logic after retrieval); add a unit test that proves client B's data is never returned for client A's task.

5. **Unbounded QA retry loop** — without a hard cap, QA failures cause an infinite generate→fail→regenerate loop, with documented production cost spikes exceeding $47k. Prevention: hard cap of 2 retries (3 total attempts); on third failure save best attempt as `draft_review_required`; track QA failure rate — above 30% signals a calibration problem, not a content problem.

6. **Stale embeddings after document update** — sync updates document text but the stored embedding (derived from old text) is not invalidated. Prevention: store `content_hash` on every skills row from day one; on document update compare hashes and enqueue re-embedding if different; do not serve stale-marked documents for retrieval.

---

## Implications for Roadmap

The feature dependency chain is linear and the architecture research confirms it. There is no optional ordering here — each phase is a hard prerequisite for the next.

### Phase 1: Foundation — Drive Sync and OAuth Hardening

**Rationale:** Three existing problems in `CONCERNS.md` (crypto key rotation vulnerability, queries.ts monolith at 732 lines, OAuth silent failure) must be resolved before any new infrastructure is built on top of them. Driving webhooks into a brittle token layer will create irreversible technical debt. This phase also establishes the database schema extensions that everything else depends on.

**Delivers:** Hardened OAuth token infrastructure, split queries.ts module, four new DB tables (`skills`, `skills_fts`, `brand_hub`, `drive_watch_channels`, `task_runs`), full Drive re-index script, webhook endpoint for incremental sync, channel renewal cron.

**Addresses:** Drive webhook sync (table stakes), channel classification (table stakes)

**Avoids:** OAuth silent failure pitfall, pageToken loss pitfall, webhook channel silent expiry pitfall, queries.ts monolith technical debt

**Research flag:** Needs phase research — the Google Drive Changes API pagination and channel renewal logic is complex; the exact sequence for handling the initial `api#channel` sync notification and overlap renewal requires careful implementation against official docs.

---

### Phase 2: Skills Library and Brand Hub

**Rationale:** Once Drive sync is stable and the database schema exists, the skills index can be populated and tested in isolation. This phase produces a queryable store of SOPs before any agent logic is added, allowing retrieval quality to be verified independently.

**Delivers:** FTS5-indexed skills library (channel-classified SOPs, templates, frameworks), brand hub populated from Drive brand files per client, retrieval queries returning top-N relevant documents by channel and task type.

**Addresses:** Skills library (table stakes), brand hub (table stakes), folder-based classification (table stakes)

**Avoids:** Stale embedding pitfall (content hash from day one), anti-pattern of one giant cross-channel retrieval query, anti-pattern of FTS-only storage without base table

**Research flag:** Standard patterns — SQLite FTS5 is well-documented; retrieval queries are deterministic SQL; no external services involved.

---

### Phase 3: Agent Task Execution and QA

**Rationale:** With a populated skills library and brand hub, the task executor can be built and tested with real data. The generate → QA → retry pipeline is implemented as an async background function, never in the HTTP request cycle. The QA validator is a second Claude Haiku call returning structured pass/fail criteria.

**Delivers:** Task executor script (retrieve → generate → QA → write result), QA validator with hard retry cap (max 2 retries), AHPRA compliance pre-flight check, `task_runs` status tracking, unit tests for client isolation.

**Addresses:** Task matching engine (table stakes), agent task execution (table stakes), QA validation with retry (table stakes), AHPRA compliance guardrails (table stakes), output status tracking (table stakes)

**Avoids:** Unbounded QA retry loop pitfall, client data bleed pitfall, synchronous execution in request handler anti-pattern

**Research flag:** Needs phase research — AHPRA/TGA dental advertising rules should be researched specifically to produce an accurate compliance checklist for the QA prompt. The 2025 guideline updates (cosmetic treatment restrictions) are particularly relevant.

---

### Phase 4: AM Review Interface

**Rationale:** The backend pipeline is complete after Phase 3. This phase wires the UI — task submission, status polling, draft display, approve/regenerate actions — following the existing Fastify + HTMX pattern.

**Delivers:** Task submission UI, HTMX status polling (queued → running → draft_ready), draft display with SOP source attribution, approve and regenerate actions, QA failure detail (which rule failed, relevant rule text, suggested action).

**Addresses:** AM review interface (table stakes), SOP-source traceability (v1.x differentiator, low complexity, include here)

**Avoids:** AM submitting duplicate tasks due to no feedback, wall-of-text output, raw QA failure messages without context

**Research flag:** Standard patterns — HTMX polling and Eta templates are already in use; no new patterns required.

---

### Phase 5: Observability and v1.x Features

**Rationale:** Once the core pipeline is running with real tasks, add the features needed for quality monitoring and debugging before scaling beyond a handful of users. SOP versioning, gap detection, and the audit trail all require real usage data to be meaningful.

**Delivers:** Output audit trail (append-only generation log), SOP versioning (document version linked to generation), SOP gap detection (explicit signal when no SOP found, not degraded output), admin skills management UI, token cost logging per task execution.

**Addresses:** All v1.x features from FEATURES.md

**Avoids:** Invisible Anthropic cost spikes (per-task cost logging), AMs unable to debug why output changed (SOP versioning), system producing degraded output when SOPs are missing (gap detection)

**Research flag:** Standard patterns — all features are low-complexity extensions to the existing data model.

---

### Phase Ordering Rationale

- **Phase 1 before anything:** The crypto/OAuth vulnerability and queries.ts monolith are not cosmetic issues. Building Drive sync on top of an unversioned encryption key means any key rotation wipes all OAuth tokens and halts the entire system. Fix it first.
- **Phase 2 before Phase 3:** The agent executor is not testable without a populated skills index. Attempting to build execution logic against an empty database produces no signal.
- **Phase 3 before Phase 4:** There is nothing to display in the UI until the backend pipeline produces output. UI-first would require extensive mocking.
- **Phase 5 last:** Observability and v1.x features require real data from real tasks to be meaningful. Building an audit trail before any tasks run is premature.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** Google Drive Changes API — channel registration sequence, `api#channel` sync notification handling, renewal overlap strategy, `pageToken` persistence pattern
- **Phase 3:** AHPRA/TGA 2025 dental advertising guidelines — enumerate specific prohibited practices for the compliance pre-flight checklist

Phases with standard patterns (skip phase research):
- **Phase 2:** SQLite FTS5 retrieval — well-documented, established SQL patterns
- **Phase 4:** HTMX polling + Eta templates — already in use in the codebase
- **Phase 5:** Audit log + versioning — standard append-only table patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified against npm registry and official docs; version compatibility confirmed; Turso vector beta is the only caveat (FTS5 is the primary strategy, not vectors) |
| Features | HIGH | Table stakes and anti-features are definitive; AHPRA compliance specifics are MEDIUM (official source reviewed but rule encoding requires legal/practitioner validation) |
| Architecture | HIGH | Official Drive API docs, SQLite FTS5 docs, and Anthropic SDK docs all sourced directly; component boundaries and data flows are well-defined |
| Pitfalls | HIGH | Webhook expiry and pageToken pitfalls verified against official docs and production post-mortems; agent loop cost spike verified against documented case studies |

**Overall confidence:** HIGH

### Gaps to Address

- **AHPRA compliance rule set:** The research confirms that a dental-specific compliance check is required and identifies the categories (testimonials, unqualified superlatives, before/after imagery, cosmetic treatment restrictions). The exact enumerated rules for the QA prompt checklist require review against the current AHPRA advertising guidelines (2025 version) during Phase 3 planning.
- **Turso F32_BLOB vector beta:** Confirmed syntactically correct but beta status means API stability is not guaranteed. FTS5 is the primary retrieval strategy; vector search is a future optimisation. Verify F32_BLOB works end-to-end in the dev environment before committing to it in Phase 2.
- **Service account vs. per-user OAuth for Drive:** Research recommends a service account for server-side Drive sync (avoids per-user token revocation risk) but the existing infrastructure uses per-user OAuth. The practical migration path needs a decision during Phase 1 planning.
- **queries.ts split strategy:** The file is already at 732 lines. The split into domain modules (skills, brand, tasks, drive) needs to be designed during Phase 1 to avoid disrupting existing functionality.

---

## Sources

### Primary (HIGH confidence)
- [Google Drive Push Notifications — Official Docs](https://developers.google.com/workspace/drive/api/guides/push) — channel lifecycle, expiry, headers, domain requirements
- [Google Drive Retrieve Changes — Official Docs](https://developers.google.com/workspace/drive/api/guides/manage-changes) — pageToken management
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html) — virtual table schema, content-linked tables, query syntax
- [googleapis@171.x — npm](https://www.npmjs.com/package/googleapis) — version confirmation
- [@anthropic-ai/sdk@0.81.x — npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — version confirmation
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — QA validator response schema
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — maxDuration, Fluid Compute
- [AHPRA Advertising Guidelines 2025](https://www.ahpra.gov.au/Resources/Advertising-hub/Advertising-guidelines-and-other-guidance.aspx) — dental advertising compliance
- [Adobe GenStudio Brand Compliance](https://business.adobe.com/products/genstudio-for-performance-marketing/brand-compliance.html) — competitor feature reference

### Secondary (MEDIUM confidence)
- [Turso native vector search](https://turso.tech/vector) — F32_BLOB syntax (beta, verify in dev)
- [Integrating with Google APIs: Tips and Tricks Part 2 — Prismatic](https://prismatic.io/blog/integrating-with-google-apis-tips-and-tricks-part-2/) — production webhook renewal patterns
- [Why Most RAG Systems Fail in Production — DEV Community](https://dev.to/theprodsde/why-most-rag-systems-fail-in-production-and-how-to-design-one-that-actually-works-j55) — retrieval failure modes
- [Agentic RAG Failure Modes — Towards Data Science](https://towardsdatascience.com/agentic-rag-failure-modes-retrieval-thrash-tool-storms-and-context-bloat-and-how-to-spot-them-early/) — context bloat, retrieval thrash
- [Multi-Tenant Data Isolation Patterns — Propelius](https://propelius.tech/blogs/tenant-data-isolation-patterns-and-anti-patterns/) — client data bleed anti-patterns
- [SOP-Agent: Empower General Purpose AI Agent with Domain-Specific SOPs](https://arxiv.org/html/2501.09316v1) — SOP-guided agent execution patterns
- [New AHPRA Guidelines for Dental Practitioners 2025](https://jrmg.com.au/new-ahpra-guidelines-for-dental-health-practitioners/) — 2 September 2025 cosmetic treatment changes

### Tertiary (LOW confidence)
- [LLM Tool-Calling Infinite Loop Failure Mode — Medium](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8) — $47k cost spike case study (single source but highly consistent with other failure mode reports)
- [AI Content Workflow for Agencies 2026 — Trysight](https://www.trysight.ai/blog/ai-content-workflow-for-agencies) — agency content production patterns (single vendor source)

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
