---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 10-am-interface-03-PLAN.md — Phase 10 complete, all plans done
last_updated: "2026-04-02T16:01:35.616Z"
last_activity: 2026-04-01 — Roadmap created
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 22
  completed_plans: 22
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** When an AM assigns a task, the system pulls the right SOPs and brand context, produces a compliant draft, and validates it against standards.
**Current focus:** Phase 1 — Infrastructure

## Current Position

Phase: 1 of 10 (Infrastructure)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-01 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-infrastructure P02 | 8 | 2 tasks | 2 files |
| Phase 01-infrastructure P01 | 4 | 2 tasks | 5 files |
| Phase 01-infrastructure P03 | 8 | 2 tasks | 10 files |
| Phase 02-drive-webhook-foundation P01 | 233s | 2 tasks | 8 files |
| Phase 02-drive-webhook-foundation P02 | 226s | 2 tasks | 8 files |
| Phase 03-drive-document-processing P01 | 176s | 2 tasks | 2 files |
| Phase 03-drive-document-processing P02 | 238s | 2 tasks | 4 files |
| Phase 04-skills-library P01 | 385 | 1 tasks | 2 files |
| Phase 04-skills-library P02 | 120 | 2 tasks | 2 files |
| Phase 05-brand-hub P01 | 266 | 1 tasks | 4 files |
| Phase 05-brand-hub P02 | 183 | 2 tasks | 3 files |
| Phase 06-task-matching-engine P01 | 240 | 2 tasks | 4 files |
| Phase 06-task-matching-engine P02 | 125 | 2 tasks | 2 files |
| Phase 07-agent-execution P01 | 124 | 1 tasks | 5 files |
| Phase 07-agent-execution P02 | 440 | 2 tasks | 4 files |
| Phase 08-qa-and-compliance P01 | 140 | 1 tasks | 2 files |
| Phase 08-qa-and-compliance P02 | 329 | 2 tasks | 5 files |
| Phase 09-audit-and-traceability P01 | 358 | 2 tasks | 4 files |
| Phase 09-audit-and-traceability P02 | 176 | 2 tasks | 3 files |
| Phase 10-am-interface P01 | 300 | 2 tasks | 5 files |
| Phase 10-am-interface P03 | 167 | 1 tasks | 6 files |
| Phase 10-am-interface P02 | 278 | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Folder-based classification over AI classification (deterministic, auditable)
- Real-time webhook sync over periodic cron (stale SOPs mean wrong agent output)
- Skills layer before client CRM portal (direct revenue impact)
- Extend existing Fastify/Eta stack (proven in production)
- [Phase 01-infrastructure]: skills_fts FTS5 virtual table added only to Turso/libsql path — sql.js 1.11.0 is FTS4-only and skills queries run via web app
- [Phase 01-infrastructure]: initAuthSchema renamed to initSchema (broader scope); deprecated alias retained for backward compatibility
- [Phase 01-infrastructure]: Token version prefix: v1:<base64> for all new encrypted tokens; bare base64 treated as legacy v0
- [Phase 01-infrastructure]: Dual-key Map cache keyed by raw env value enables concurrent key rotation without module reload
- [Phase 01-infrastructure]: Lazy v0-to-v1 migration is fire-and-forget — never await on token access hot path
- [Phase 01-infrastructure]: moduleResolution: bundler does not auto-resolve queries.js to queries/index.js — retained queries.ts as thin barrel for zero consumer import changes
- [Phase 01-infrastructure]: Domain module split pattern: new query modules go in web/lib/queries/ and import rows/scalar/db from ./base.js; consumer imports unchanged via thin barrel
- [Phase 02-drive-webhook-foundation]: mock.module requires --experimental-test-module-mocks in Node 25 — webhook tests use this flag
- [Phase 02-drive-webhook-foundation]: Webhook route exempted from session auth via path check in onRequest hook — Google POSTs are unauthenticated, DRIVE_WEBHOOK_SECRET token is the auth mechanism
- [Phase 02-drive-webhook-foundation]: drive_sync_queue partial index (WHERE processed_at IS NULL) in Turso path only — sql.js uses unconditional index
- [Phase 02-drive-webhook-foundation]: Cron route exempted from session auth via path-prefix check — same pattern as webhook route
- [Phase 02-drive-webhook-foundation]: Re-index script imports from Turso path (web/lib/queries) — writes to production data
- [Phase 02-drive-webhook-foundation]: Content field empty in skills upsert — Phase 3 handles Drive file content extraction
- [Phase 03-drive-document-processing]: Spreadsheets excluded from extractContent — metadata only; CHANNEL_FOLDER_MAP env var guards prevent undefined Map key; hashContent SHA-256 used as content-change gate (not drive_modified_at)
- [Phase 03-drive-document-processing]: Dynamic import of getGoogleAccessToken inside processQueue loop avoids circular mock.module interference in tests
- [Phase 03-drive-document-processing]: subfolderName propagated through listFilesInFolder recursion avoids extra files.get API calls during re-index
- [Phase 04-skills-library]: syncSkillFts signature accepts (rowid, oldTitle, oldContent, newTitle, newContent): FTS5 content-sync delete requires OLD values to remove previously indexed tokens
- [Phase 04-skills-library]: FTS5 tests use real in-memory libsql database — mock.module at top level + --import tsx/esm pattern; bm25() returns negative values so ORDER BY ASC gives most-relevant-first
- [Phase 04-skills-library]: updateSkillContent fetches old row BEFORE upsert so old FTS5 values are available for content-sync delete step; new INSERT path passes empty strings (safe no-op)
- [Phase 04-skills-library]: Unknown subfolder names fall back to 'general' in resolveSkillType (not raw slug); SKILL_TYPE_MAP exported for Phase 6 reference
- [Phase 05-brand-hub]: libsql maps rowid to INTEGER PRIMARY KEY column name — SELECT id not rowid to avoid undefined in row objects
- [Phase 05-brand-hub]: FTS5 content-sync writes must be serialised — concurrent upserts via Promise.all corrupt the vtab (SQLITE_CORRUPT_VTAB)
- [Phase 05-brand-hub]: searchBrandContent without clientSlug returns global results — BRND-04 client scoping is opt-in via parameter
- [Phase 05-brand-hub]: brand_hub_fts indexes client_name + content columns (not title) — matches brand context lookup search intent
- [Phase 05-brand-hub]: resolveClientFolder walks parent chain up to 5 levels (matches resolveChannel pattern) to find immediate child of BRANDS_FOLDER
- [Phase 05-brand-hub]: brand check (step 3.5) inserted BEFORE resolveChannel to ensure brand files never reach skills null-channel delete path
- [Phase 05-brand-hub]: deleteBrandFile called on every trashed/removed change as a safe no-op when file is not in brand_hub
- [Phase 06-task-matching-engine]: COALESCE in updateTaskRunStatus preserves existing sops_used/brand_context_id when extras not passed — avoids nulling columns on simple status updates
- [Phase 06-task-matching-engine]: assembleContext takes clientId not clientSlug — resolveClientSlug() does brand_hub lookup internally, keeping HTTP route call signature clean
- [Phase 06-task-matching-engine]: Mutable holder pattern for mock.module closures in node:test — avoids re-registering mocks per test
- [Phase 06-task-matching-engine]: Fire-and-forget placed after reply.code(202).send() — guarantees 202 is returned before assembleContext starts; no await
- [Phase 06-task-matching-engine]: Status query param validated against TaskRunStatus union — invalid values silently ignored (no filter applied) rather than 400 (filter semantics not strict)
- [Phase 07-agent-execution]: Config-driven registry: adding new channel/task type = new config file only, no core code changes
- [Phase 07-agent-execution]: Character limit guidance embedded in prompts as explicit counting instructions (not just maxLength) for LLM reliability
- [Phase 07-agent-execution]: sources array required in every schema for SOP attribution traceability
- [Phase 07-agent-execution]: generateDraft handles its own retry and failure transitions internally — assembleContext outer catch only fires on unexpected errors
- [Phase 07-agent-execution]: updateTaskRunOutput atomically sets status=draft_ready and writes output JSON in single UPDATE
- [Phase 07-agent-execution]: Empty sources array treated as retryable failure — enforces SOP attribution invariant from day one
- [Phase 08-qa-and-compliance]: AHPRA-Q1 'specialises in' uses negative lookbehind to exclude explicitly allowed 'special interest in' phrase
- [Phase 08-qa-and-compliance]: checkAHPRACompliance emits at most one violation per rule (first pattern match wins) — consistent with rule-level reporting model
- [Phase 08-qa-and-compliance]: AHPRA checker receives full serialised draft text string — no field-by-field JSON parsing required
- [Phase 08-qa-and-compliance]: runSOPCheck is only export from qa-checker.ts — retry loop and AHPRA wiring live in task-matcher.ts
- [Phase 08-qa-and-compliance]: MAX_ATTEMPTS=3 for QA retries (initial + 2); on QA error transition to failed not stuck at qa_check; qa_critique always contains both sop_issues and ahpra_violations
- [Phase 09-audit-and-traceability]: SopSnapshot stored inline at generation time — no extra DB lookup required (SkillSearchResult already has all fields)
- [Phase 09-audit-and-traceability]: parseSopsUsed returns null for old number[] rows (backward compat) — existing rows are not migrated
- [Phase 09-audit-and-traceability]: BEFORE DELETE trigger wrapped in try/catch — Turso/libsql may not support DDL triggers; app-layer constraint is primary enforcer (AUDT-03)
- [Phase 09-audit-and-traceability]: getAuditRecord replaces getTaskRun in GET /runs/:id — returns parsed SopSnapshot[] not raw JSON string (AUDT-02)
- [Phase 10-am-interface]: TaskRunListRow extends TaskRunRow pattern used for query-specific row shapes with JOINs
- [Phase 10-am-interface]: dateTo filter appends T23:59:59.999Z for full-day inclusion in listTaskRuns
- [Phase 10-am-interface]: Skills nav link uses canSee('drive') guard — skills are Drive-derived, same permission
- [Phase 10-am-interface]: SkillForDisplay Pick<> type bridges SkillRow and SkillSearchResult so groupBySkillType works on both browse and search paths
- [Phase 10-am-interface]: listSkillChannels() queries DISTINCT channel dynamically — tabs appear automatically when new channels are indexed
- [Phase 10-am-interface]: POST /tasks/new forwards to app.inject('/api/tasks/runs') — reuses existing creation logic without duplication
- [Phase 10-am-interface]: qa_critique merge uses spread pattern to add am_feedback key — never clobbers sop_issues or ahpra_violations
- [Phase 10-am-interface]: getTaskTypesForChannel exported as named helper rather than exporting REGISTRY Map — cleaner API boundary

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Crypto key rotation vulnerability in web/lib/crypto.ts must be resolved before Drive sync is built — any key rotation without versioning wipes all OAuth tokens
- Phase 1 research flag: Google Drive Changes API channel registration sequence and pageToken persistence pattern need phase research before planning
- Phase 8 research flag: AHPRA/TGA 2025 dental advertising rules need enumeration for compliance pre-flight checklist before planning Phase 8

## Session Continuity

Last session: 2026-04-02T15:57:33.059Z
Stopped at: Completed 10-am-interface-03-PLAN.md — Phase 10 complete, all plans done
Resume file: None
