# Phase 8: QA and Compliance - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Every draft is validated against SOP checklist criteria and AHPRA dental advertising rules before it reaches an AM — non-compliant output is flagged with specific rule violations, not silently surfaced or suppressed. Phase 8 inserts a qa_check step between generation and draft_ready, adds retry-with-critique for SOP quality failures, and runs AHPRA compliance as a separate pass that flags but does not block. No AM UI for reviewing/approving — that's Phase 10.

</domain>

<decisions>
## Implementation Decisions

### AHPRA compliance rules
- Hardcoded checklist in a TypeScript/JSON file listing prohibited claims, restricted terms, and required disclaimers
- Claude researcher compiles the AHPRA/TGA dental advertising rules during the research phase (already flagged in STATE.md)
- AHPRA compliance is a SEPARATE check that runs AFTER SOP QA — two distinct passes
- On AHPRA violation: flag with specific rule violations — no auto-fix, no regeneration, no silent suppression
- AHPRA violations flag but still show the draft to AM — they decide what to do (honours QA-05: does not silently suppress)

### SOP checklist criteria
- LLM-as-judge with full SOP context — separate LLM call receives generated output + the SOPs used + a scoring rubric
- QA model: Haiku (fast, cheap for pass/fail evaluation)
- Pass/fail + structured critique — binary decision with specific issues listed on failure
- QA judge receives full SOP content (same SOPs the generator used), not just titles/IDs

### Retry-with-critique flow
- On QA failure: append critique to user message for retry ("Previous attempt failed QA. Issues: [critique]. Please regenerate addressing these issues.")
- Same system prompt preserved on retry — SOP grounding maintained
- Same model (Sonnet) for all generation attempts — no model escalation
- Status flow: generating → qa_check → (pass) draft_ready | (fail) back to generating with incremented attempts
- Maximum 3 total attempts (initial + 2 retries) — hard cap, no infinite loops
- Only store the final output — task_runs.output holds latest attempt, qa_critique holds latest critique, attempts counter tracks tries

### Human escalation behaviour
- After max retries: AM sees the latest draft + QA critique + "requires human review" flag
- Status: draft_ready with qa_score=0 (draft is visible but flagged)
- AHPRA violations stored in qa_critique JSON alongside SOP issues: `{sop_issues: [...], ahpra_violations: [...]}`
- No new columns needed — qa_critique (TEXT) holds the structured JSON

### Claude's Discretion
- Exact QA scoring rubric/prompt design for the LLM-as-judge
- AHPRA rule matching implementation (regex, keyword, or structured patterns)
- How qa_critique JSON is structured internally beyond the two top-level sections
- Token management for QA calls (SOP content may need truncation for Haiku context)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/task-matcher.ts`: assembleContext() + generateDraft() — extend with QA step between generation and draft_ready
- `web/lib/queries/task-runs.ts`: updateTaskRunStatus(), updateTaskRunOutput() — extend with QA-specific updates (qa_score, qa_critique)
- `task_runs` table columns: qa_score (INTEGER), qa_critique (TEXT), attempts (INTEGER) — all already exist
- `@anthropic-ai/sdk`: Already installed, Haiku model ID available
- Task type configs in `web/lib/task-types/`: contain the schemas and prompt builders — QA judge can reference these

### Established Patterns
- Anthropic SDK pattern in `ai-classify.ts` and `task-matcher.ts` — same pattern for QA judge call
- Structured JSON output via `output_config.format` — QA judge returns structured pass/fail + critique
- Fire-and-forget pattern — QA runs within the same async flow as generation

### Integration Points
- `web/lib/task-matcher.ts` — modify generateDraft() flow: generate → qa_check → (pass) draft_ready | (fail) retry
- `web/lib/queries/task-runs.ts` — add updateTaskRunQA() for setting qa_score + qa_critique
- New module: `web/lib/qa-checker.ts` — QA judge logic (LLM call with SOPs + output + rubric)
- New module: `web/lib/ahpra-rules.ts` — hardcoded AHPRA compliance checklist
- Phase 7's direct `draft_ready` transition needs to route through QA first

</code_context>

<specifics>
## Specific Ideas

- Two-pass design: SOP quality (LLM judge, triggers retries) → AHPRA compliance (rule-based, flags only)
- AHPRA violations are regulatory, not quality — they should never trigger regeneration, only flagging
- qa_critique JSON structure: `{sop_issues: [{criterion, description}], ahpra_violations: [{rule, violation, severity}]}`

</specifics>

<deferred>
## Deferred Ideas

- AM ability to manually trigger regeneration from the UI — Phase 10
- Admin ability to edit/update AHPRA rules from the dashboard — future enhancement
- Per-channel QA rubrics (different quality standards per channel) — future enhancement

</deferred>

---

*Phase: 08-qa-and-compliance*
*Context gathered: 2026-04-02*
