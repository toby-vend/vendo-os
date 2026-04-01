# Roadmap: VendoOS Skills Layer

## Overview

VendoOS already has a working web dashboard, meeting intelligence pipeline, and data syncs. This milestone adds the skills layer: Google Drive is indexed in real time, SOPs and brand context are stored in a classified, queryable library, and AI agents use that library to produce compliant drafts when an AM assigns a task. The build order is strict — each phase is a hard prerequisite for the next. Infrastructure is hardened first, Drive sync is established second, the knowledge stores are built third, and agent execution and AM interface come last.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure** - Harden OAuth tokens, split queries.ts, extend database schema (completed 2026-04-01)
- [x] **Phase 2: Drive Webhook Foundation** - Register webhook channels, receive push notifications, renew before expiry (completed 2026-04-01)
- [ ] **Phase 3: Drive Document Processing** - Classify documents by folder, detect content changes, handle moves and deletions
- [ ] **Phase 4: Skills Library** - FTS5-indexed SOP store with channel classification and version tracking
- [ ] **Phase 5: Brand Hub** - Per-client brand context ingested from Drive and queryable in isolation
- [ ] **Phase 6: Task Matching Engine** - Match task type and client to relevant SOPs and brand context, async queuing
- [ ] **Phase 7: Agent Execution** - Produce structured draft output per channel using retrieved context
- [ ] **Phase 8: QA and Compliance** - Validate output against SOP criteria, AHPRA pre-flight, retry with critique
- [ ] **Phase 9: Audit and Traceability** - Append-only generation log with SOP version attribution
- [ ] **Phase 10: AM Interface** - Task submission, status polling, draft review, approve and regenerate

## Phase Details

### Phase 1: Infrastructure
**Goal**: The existing codebase is stable enough to build on — OAuth tokens survive key rotation, queries.ts is split into domain modules, and all new database tables exist
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. OAuth token encryption uses versioned keys — a key rotation does not invalidate existing tokens
  2. Existing dashboard routes and data syncs continue to work after the queries.ts split
  3. All new tables exist in the schema: skills, skills_fts, brand_hub, drive_watch_channels, task_runs
  4. Admin dashboard surfaces OAuth token status — silent failure is visible
**Plans:** 3/3 plans complete

Plans:
- [ ] 01-01-PLAN.md — Crypto key versioning, dual-key rotation, lazy migration, admin OAuth status
- [ ] 01-02-PLAN.md — Database schema extension (5 new tables in both schema paths)
- [ ] 01-03-PLAN.md — Split queries.ts monolith into domain modules with barrel export

### Phase 2: Drive Webhook Foundation
**Goal**: The system receives real-time push notifications from Google Drive and never loses sync due to silent channel expiry
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-03, SYNC-06
**Success Criteria** (what must be TRUE):
  1. A new or updated file in Google Drive triggers a push notification to the webhook endpoint within seconds
  2. Webhook channels are renewed automatically before their 7-day expiry — no manual intervention required
  3. Running the full re-index command populates the skills table from all current Drive documents
  4. The pageToken survives Vercel serverless cold starts — sync does not gap on restart
**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md — Drive queries module, webhook endpoint, channel registration logic
- [ ] 02-02-PLAN.md — Cron channel renewal route, full re-index CLI script

### Phase 3: Drive Document Processing
**Goal**: Every document arriving via webhook is classified by channel, content-hashed for change detection, and correctly updated when moved, renamed, or deleted
**Depends on**: Phase 2
**Requirements**: SYNC-02, SYNC-04, SYNC-05
**Success Criteria** (what must be TRUE):
  1. A document in the "paid social" Drive folder is classified as paid_social; moving it to "SEO" reclassifies it on next sync
  2. A metadata-only update (rename without content change) does not trigger a re-index of the document body
  3. Deleting a Drive document removes the corresponding skill record from the database
  4. A document moved between channel folders updates its channel classification in the skills table
**Plans:** 1/2 plans executed

Plans:
- [ ] 03-01-PLAN.md — Query functions and Drive API helpers (classification, extraction, hashing)
- [ ] 03-02-PLAN.md — Queue processor, unit tests, re-index content extraction

### Phase 4: Skills Library
**Goal**: SOPs, templates, and frameworks from Drive are stored in a queryable FTS5 index, classified by channel and skill type, with version tracking
**Depends on**: Phase 3
**Requirements**: SKIL-01, SKIL-02, SKIL-03, SKIL-04, SKIL-05
**Success Criteria** (what must be TRUE):
  1. Searching the skills library by channel and keyword returns relevant SOPs ranked by relevance
  2. Each skill record shows its Drive document version (modified timestamp) and content hash
  3. When a Drive document is updated, the corresponding skill record is re-indexed with new content and version
  4. Querying for a task type with no matching SOPs returns an explicit "no skill found" signal, not an empty result that silently degrades output
**Plans**: TBD

### Phase 5: Brand Hub
**Goal**: Per-client brand context (tone, compliance, differentiators) is ingested from Drive brand files and queryable in strict client isolation
**Depends on**: Phase 3
**Requirements**: BRND-01, BRND-02, BRND-03, BRND-04
**Success Criteria** (what must be TRUE):
  1. Brand context for a given client is retrievable by client name or slug
  2. A query for client A never returns any data belonging to client B — verified by a test that asserts this explicitly
  3. All 25+ active clients can have brand files ingested without performance degradation on retrieval
  4. When a client's brand file in Drive is updated, the brand hub record reflects the new content on next sync
**Plans**: TBD

### Phase 6: Task Matching Engine
**Goal**: An AM can queue a task (client + channel + task type) and the system assembles the correct context — relevant SOPs plus brand context — without blocking the web request
**Depends on**: Phase 4, Phase 5
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-06, TASK-07
**Success Criteria** (what must be TRUE):
  1. Submitting a task from the UI returns immediately — status shows "queued" without waiting for generation
  2. The task matching engine retrieves the top relevant SOPs for the given channel and task type
  3. Client brand context is injected into the task context alongside SOPs — never mixed with another client's data
  4. Every task in the system has one of the defined statuses: queued / generating / qa_check / draft_ready / approved / failed
**Plans**: TBD

### Phase 7: Agent Execution
**Goal**: The background task executor produces a structured draft — ad copy, content brief, or report section — grounded in retrieved SOPs and brand context, with channel-specific output structure
**Depends on**: Phase 6
**Requirements**: TASK-04, TASK-05
**Success Criteria** (what must be TRUE):
  1. A paid social task produces output in the paid social channel structure (headline, body, CTA format)
  2. A SEO task produces output in the SEO channel structure (meta title, meta description, content brief)
  3. Every generated draft is grounded in at least one retrieved SOP — freeform generation without SOP context does not occur
  4. Agent output includes the names of the SOPs used to produce it
**Plans**: TBD

### Phase 8: QA and Compliance
**Goal**: Every draft is validated against SOP checklist criteria and AHPRA dental advertising rules before it reaches an AM — non-compliant output is flagged with specific rule violations, not silently surfaced or suppressed
**Depends on**: Phase 7
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05
**Success Criteria** (what must be TRUE):
  1. A draft that fails a SOP criterion is regenerated with a critique — the AM sees only the improved version
  2. After two retries, a still-failing draft reaches the AM as "requires human review" with the QA critique attached
  3. Output containing a prohibited AHPRA claim is flagged with the specific rule violated
  4. AHPRA compliance check runs on every draft before status moves to draft_ready — it cannot be bypassed
  5. QA failures never loop indefinitely — maximum three total attempts (initial + 2 retries) is enforced
**Plans**: TBD

### Phase 9: Audit and Traceability
**Goal**: Every generation is logged in an append-only record — who triggered it, which client, which SOPs were used, which SOP versions, and what QA score was achieved
**Depends on**: Phase 8
**Requirements**: AUDT-01, AUDT-02, AUDT-03
**Success Criteria** (what must be TRUE):
  1. Every draft displayed to an AM shows which SOPs it was based on (names visible in the UI)
  2. The audit log contains a complete record for each generation: AM, client, channel, SOPs used, SOP versions, QA score
  3. Audit records cannot be deleted — the log is append-only at the database level
**Plans**: TBD

### Phase 10: AM Interface
**Goal**: Account managers can submit tasks, monitor status, review drafts with SOP attribution, and approve or request regeneration — all from the existing web dashboard
**Depends on**: Phase 9
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. An AM can submit a new task by selecting client, channel, and task type from the dashboard
  2. The task list shows live status for all tasks — queued, generating, draft ready, approved, failed
  3. An AM can read a draft alongside the SOPs it was based on, then approve it or request regeneration with a single click
  4. An AM can browse and search the skills library by channel and skill type to understand what SOPs the system has available
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 3/3 | Complete    | 2026-04-01 |
| 2. Drive Webhook Foundation | 2/2 | Complete    | 2026-04-01 |
| 3. Drive Document Processing | 1/2 | In Progress|  |
| 4. Skills Library | 0/TBD | Not started | - |
| 5. Brand Hub | 0/TBD | Not started | - |
| 6. Task Matching Engine | 0/TBD | Not started | - |
| 7. Agent Execution | 0/TBD | Not started | - |
| 8. QA and Compliance | 0/TBD | Not started | - |
| 9. Audit and Traceability | 0/TBD | Not started | - |
| 10. AM Interface | 0/TBD | Not started | - |
