# Requirements: VendoOS Skills Layer

**Defined:** 2026-04-01
**Core Value:** When an AM assigns a task, the system pulls the right SOPs and brand context, produces a compliant draft, and validates it against standards.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Drive Sync

- [ ] **SYNC-01**: System receives Google Drive webhook notifications when files are created, updated, or deleted
- [ ] **SYNC-02**: System classifies incoming documents by channel (paid social / SEO / paid ads) based on Drive folder path
- [ ] **SYNC-03**: System auto-renews webhook watch channels before silent expiry (max 7 days)
- [ ] **SYNC-04**: System detects actual content changes via content hashing, skipping metadata-only updates
- [ ] **SYNC-05**: System handles document renames, moves between folders, and deletions correctly
- [ ] **SYNC-06**: System provides a manual full re-index command for initial population and recovery

### Skills Library

- [ ] **SKIL-01**: SOPs and templates are stored in an FTS5-indexed skills table with channel, skill type, and document metadata
- [ ] **SKIL-02**: Skills are queryable by channel, skill type, and free-text search
- [ ] **SKIL-03**: Each skill record tracks document version (Drive modified timestamp) and content hash
- [ ] **SKIL-04**: When a Drive document is updated, the corresponding skill record is re-indexed with the new version
- [ ] **SKIL-05**: System surfaces an explicit "no matching skill found" signal when retrieval confidence is below threshold

### Brand Hub

- [ ] **BRND-01**: Per-client brand files are ingested from Drive and stored with client association
- [ ] **BRND-02**: Brand context is queryable by client name or ID
- [ ] **BRND-03**: Brand hub supports 25+ clients without performance degradation
- [ ] **BRND-04**: Client brand context is strictly isolated — queries for client A never return client B data

### Task Execution

- [ ] **TASK-01**: AM can assign a task by selecting client, channel, and task type
- [ ] **TASK-02**: Task matching engine retrieves relevant SOPs based on channel + task type
- [ ] **TASK-03**: Task matching engine retrieves client brand context and injects it into agent prompt
- [ ] **TASK-04**: Agent produces structured draft output (ad copy, content brief, report section) from retrieved context
- [ ] **TASK-05**: Each channel (paid social, SEO, paid ads) has distinct agent behaviour with channel-specific output structure
- [ ] **TASK-06**: Task execution runs asynchronously — does not block the web request
- [ ] **TASK-07**: Each task has a status: queued / generating / qa_check / draft_ready / approved / failed

### QA & Compliance

- [ ] **QA-01**: Agent output is validated against SOP checklist criteria after generation
- [ ] **QA-02**: On QA failure, agent receives critique and regenerates (retry-with-critique, max 2 retries)
- [ ] **QA-03**: After max retries, task escalates to human review with critique attached
- [ ] **QA-04**: AHPRA/dental compliance pre-flight runs on all output before surfacing to AM
- [ ] **QA-05**: Compliance check flags non-compliant content with specific rule violations, does not silently suppress

### Audit & Traceability

- [ ] **AUDT-01**: Every generation is logged: AM who triggered, client, channel, SOPs used, SOP versions, QA score
- [ ] **AUDT-02**: Each draft shows which SOPs were used ("based on: [SOP names]")
- [ ] **AUDT-03**: Audit log is append-only — no records deleted

### AM Interface

- [ ] **UI-01**: AM can submit a new task from the web dashboard (select client, channel, task type)
- [ ] **UI-02**: AM can view generated draft with SOP attribution
- [ ] **UI-03**: AM can approve a draft or request regeneration
- [ ] **UI-04**: AM can browse and search indexed skills by channel and type
- [ ] **UI-05**: Task list shows all tasks with current status

### Infrastructure

- [ ] **INFR-01**: Split queries.ts monolith into domain-specific query modules before adding skills queries
- [x] **INFR-02**: Database schema extended with skills, brand_hub, task_runs, drive_watch_channels tables
- [ ] **INFR-03**: OAuth token handling hardened (crypto key versioning resolved, silent-failure path surfaces status)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admin & Management

- **ADMN-01**: Admin skills management UI (view indexed skills, force re-sync, mark deprecated)
- **ADMN-02**: Admin can view and filter audit trail by client, channel, date, QA score

### Access Tiers

- **TIER-01**: Staff portal with tools and chatbot only (no revenue/financials visible)
- **TIER-02**: Client CRM portal on isolated database (about Vendo, their AM, integration guides, live results)
- **TIER-03**: Admin dashboard with revenue, financials, user monitoring, project admin

### Future Agents

- **AGNT-01**: Specialist sub-agents per channel (creative, audience, copy, reporting)
- **AGNT-02**: QA agents for cross-cutting audit of all processes
- **AGNT-03**: Vendo chatbot trained on all company data (staff portal)
- **AGNT-04**: Admin chatbot trained on all company data including financials

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI-based document classification | Silent false positives in regulated context; folder-based is deterministic and auditable |
| Real-time streaming output | Adds frontend complexity for content AMs review anyway; async + poll is sufficient |
| Autonomous publishing to ad platforms | Removes human checkpoint; AHPRA compliance requires AM sign-off |
| Client-facing AI chat | Liability and expectation management issues; separate milestone |
| Periodic cron-based Drive sync | Stale SOPs mean wrong agent output; webhook latency is justified |
| Freeform LLM output without SOP grounding | Defeats the purpose; always retrieve-then-generate |
| Per-task fine-tuning or model training | RAG achieves equivalent grounding without ML infrastructure costs |
| Multi-step approval chains | Defeats time-saving purpose; single AM review step only |
| Mobile app | Web-first; browser access sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-06 | Phase 2 | Pending |
| SYNC-02 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |
| SYNC-05 | Phase 3 | Pending |
| SKIL-01 | Phase 4 | Pending |
| SKIL-02 | Phase 4 | Pending |
| SKIL-03 | Phase 4 | Pending |
| SKIL-04 | Phase 4 | Pending |
| SKIL-05 | Phase 4 | Pending |
| BRND-01 | Phase 5 | Pending |
| BRND-02 | Phase 5 | Pending |
| BRND-03 | Phase 5 | Pending |
| BRND-04 | Phase 5 | Pending |
| TASK-01 | Phase 6 | Pending |
| TASK-02 | Phase 6 | Pending |
| TASK-03 | Phase 6 | Pending |
| TASK-06 | Phase 6 | Pending |
| TASK-07 | Phase 6 | Pending |
| TASK-04 | Phase 7 | Pending |
| TASK-05 | Phase 7 | Pending |
| QA-01 | Phase 8 | Pending |
| QA-02 | Phase 8 | Pending |
| QA-03 | Phase 8 | Pending |
| QA-04 | Phase 8 | Pending |
| QA-05 | Phase 8 | Pending |
| AUDT-01 | Phase 9 | Pending |
| AUDT-02 | Phase 9 | Pending |
| AUDT-03 | Phase 9 | Pending |
| UI-01 | Phase 10 | Pending |
| UI-02 | Phase 10 | Pending |
| UI-03 | Phase 10 | Pending |
| UI-04 | Phase 10 | Pending |
| UI-05 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 — traceability populated after roadmap creation*
