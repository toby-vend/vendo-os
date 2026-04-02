# Phase 7: Agent Execution - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The background task executor produces a structured draft — ad copy, content brief, or report section — grounded in retrieved SOPs and brand context, with channel-specific output structure. Phase 7 extends assembleContext() to call the Anthropic API after context assembly, store structured JSON output in task_runs.output, and transition status to draft_ready. No QA validation — that's Phase 8. No AM UI — that's Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Channel output structures
- Each channel has distinct output JSON structure:
  - **Paid social (ad_copy):** Multiple variants (3-5), each with primary_text, headline, description, call_to_action
  - **SEO (content_brief):** meta_title (60 chars), meta_description (155 chars), content_brief (headings, key points, word count target)
  - **Paid ads (rsa_copy):** Multiple headlines (30 chars each), descriptions (90 chars each), optional sitelink extensions — matches Google Ads RSA format
- Output stored as structured JSON in task_runs.output
- Config-driven output schemas — JSON schema files per channel+task_type define output fields, constraints (char limits), and variant counts
- Adding new channels or task types = adding a new config file, no code changes to the core engine
- Every output JSON includes a `sources` metadata array listing SOP titles and IDs used for attribution

### Prompt design and SOP grounding
- System prompt contains: role definition + channel output schema + SOP content (concatenated from retrieved skills)
- User message contains: specific task request + brand context as a clearly labelled separate section ("## Brand Context for [Client]")
- SOPs are primary authority for structure and best practices; model can supplement with general marketing knowledge where SOPs don't cover
- SOP attribution via `sources` metadata field in the output JSON — not inline citations

### Task types per channel
- Phase 7 ships with one task type per channel to prove the engine works end-to-end:
  - `ad_copy` (paid social) — Meta ad copy variants
  - `content_brief` (SEO) — meta tags + content brief
  - `rsa_copy` (paid ads) — Google Ads RSA copy
- Full task type list for future implementation:
  - Paid social: ad_copy, creative_brief, monthly_report_social, content_calendar, content_shoot_plan
  - SEO: content_brief, blog_post_draft, monthly_report_seo, on_page_audit
  - Paid ads: rsa_copy, campaign_strategy_brief, monthly_report_ads
- New types added via config files — no code changes needed

### Generation behaviour
- Model: Claude Sonnet (claude-sonnet-4-6) for all generation tasks
- Trigger: extend assembleContext() — after context assembly succeeds, immediately call the LLM within the same fire-and-forget
- On LLM failure: retry once with exponential backoff, then transition to 'failed' status with error message
- On success: transition to 'draft_ready' status (not qa_check — Phase 8 adds that step later)
- Structured output enforced via Anthropic SDK tool_use or structured output mode

### Claude's Discretion
- Exact prompt templates per task type (wording, instruction phrasing)
- Token limits and max_tokens configuration
- Temperature setting for generation
- How output schema configs are structured on disk (directory layout, naming)
- Retry backoff timing

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/task-matcher.ts`: assembleContext() — extend with LLM call after context assembly
- `@anthropic-ai/sdk` v0.81.0: Already installed; usage pattern in `scripts/matching/strategies/ai-classify.ts` and `api/chat.ts`
- `web/lib/queries/task-runs.ts`: updateTaskRunStatus() — used to transition to draft_ready/failed
- `web/lib/queries/drive.ts`: searchSkills() returns skill results with titles and content for SOP injection
- `web/lib/queries/brand.ts`: getBrandContext() returns brand files for client context injection
- `task_runs.output` column: TEXT field ready for JSON storage
- `task_runs.sops_used` column: JSON array of SOP IDs — already populated by assembleContext()

### Established Patterns
- Anthropic SDK pattern: `new Anthropic({ apiKey })`, `client.messages.create()` — see `ai-classify.ts`
- Fire-and-forget: assembleContext() already runs without blocking the web request
- Status transitions: `updateTaskRunStatus(id, status, opts)` — extend with output storage

### Integration Points
- `web/lib/task-matcher.ts` — extend assembleContext() to call LLM after context assembly
- `web/lib/queries/task-runs.ts` — may need `updateTaskRunOutput()` or extend updateTaskRunStatus to accept output
- Config directory for output schemas — new directory (e.g. `config/task-types/` or `web/lib/task-types/`)
- `ANTHROPIC_API_KEY` env var — already in .env.example

</code_context>

<specifics>
## Specific Ideas

- System must be extensible: user plans to add more task types and channels over time. Config-driven design is a hard requirement, not a nice-to-have.
- Full task type list captured above for future implementation — these are the AM's actual deliverables.
- "Content Shoot Plan" is a paid social task type (user-specified) — add to future implementation list.

</specifics>

<deferred>
## Deferred Ideas

- QA validation of generated output — Phase 8
- AHPRA/dental compliance checking — Phase 8
- AM-facing UI for viewing/approving drafts — Phase 10
- Configurable model per task type (Haiku for simple tasks, Sonnet for complex) — future enhancement
- Full task type implementation (12 types across 3 channels) — incremental after Phase 7 proves the engine

</deferred>

---

*Phase: 07-agent-execution*
*Context gathered: 2026-04-02*
