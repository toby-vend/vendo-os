---
phase: 07-agent-execution
plan: 01
subsystem: api
tags: [anthropic, json-schema, task-types, prompt-builders, tdd]

# Dependency graph
requires:
  - phase: 06-task-matching-engine
    provides: assembleContext, task_runs schema, searchSkills, getBrandContext
provides:
  - loadTaskTypeConfig registry resolving paid_social:ad_copy, seo:content_brief, paid_ads:rsa_copy
  - JSON schemas for Anthropic structured output per channel+task type
  - buildSystemPrompt and buildUserMessage prompt builders per task type
  - sources attribution array in every schema
affects: [07-agent-execution, 08-qa-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config-driven task type registry: channel:taskType key maps to schema + prompt builders"
    - "TDD: tests written first (RED), implementation second (GREEN)"
    - "Schema design: additionalProperties: false throughout, sources array required in all schemas"

key-files:
  created:
    - web/lib/task-types/index.ts
    - web/lib/task-types/ad_copy.ts
    - web/lib/task-types/content_brief.ts
    - web/lib/task-types/rsa_copy.ts
    - web/lib/task-types/task-types.test.ts

key-decisions:
  - "Config-driven registry: adding new channel/task type = new config file only, no core code changes"
  - "Character limit guidance embedded in prompts as explicit counting instructions (not just maxLength) — research pitfall 6"
  - "sources array required in every schema for SOP attribution traceability"
  - "buildUserMessage omits brand section entirely when brandContent is empty"

patterns-established:
  - "Task type config module: exports schema, buildSystemPrompt(sopContent), buildUserMessage(taskType, brandContent, clientName?)"
  - "Registry keyed as channel:taskType string — loadTaskTypeConfig throws descriptive error listing registered keys on miss"

requirements-completed: [TASK-05]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 7 Plan 1: Task Type Config Registry Summary

**Config-driven task type registry with JSON schemas and prompt builders for paid_social:ad_copy, seo:content_brief, and paid_ads:rsa_copy — each schema enforces additionalProperties: false with required SOP attribution sources array**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T08:10:50Z
- **Completed:** 2026-04-02T08:12:54Z
- **Tasks:** 1 (TDD: 2 commits)
- **Files modified:** 5

## Accomplishments
- loadTaskTypeConfig registry resolves all 3 channel:taskType combos and throws a descriptive error for unknown combos
- Three distinct JSON schemas for Anthropic structured output: ad_copy (3–5 Meta variants), content_brief (meta tags + headings + key_points), rsa_copy (headlines/descriptions/sitelinks with strict char limits)
- buildSystemPrompt injects SOP content under ## SOPs heading with explicit character-counting instructions
- buildUserMessage labels brand context as "## Brand Context for [client]" and omits the section entirely when brandContent is empty
- 20 tests passing across registry resolution, schema validation, prompt content, and user message structure

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests** - `a751cd3` (test)
2. **Task 1 (GREEN): implementation** - `5b4e293` (feat)

## Files Created/Modified
- `web/lib/task-types/index.ts` - Registry with loadTaskTypeConfig and TaskTypeConfig interface
- `web/lib/task-types/ad_copy.ts` - Meta ad copy: 3–5 variants with primary_text, headline (40 chars), description (30 chars), CTA
- `web/lib/task-types/content_brief.ts` - SEO brief: meta_title (60 chars), meta_description (155 chars), headings, key_points, word_count_target
- `web/lib/task-types/rsa_copy.ts` - Google Ads RSA: 3–15 headlines (30 chars), 2–4 descriptions (90 chars), optional sitelinks
- `web/lib/task-types/task-types.test.ts` - 20 unit tests across all task type configs

## Decisions Made
- Character limit guidance written as explicit counting instructions in system prompts rather than only relying on JSON schema maxLength — per research pitfall 6, LLMs count more reliably when instructed to count in the text
- sources array required (not optional) in all schemas to enforce SOP attribution traceability from day one
- buildUserMessage omits the brand context section entirely (not just empty) when brandContent is empty, keeping the user message clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Task type configs are ready for consumption by the LLM call extension to assembleContext() in Phase 7 Plan 2
- loadTaskTypeConfig(channel, taskType) is the integration point — pass SOP content to buildSystemPrompt, brand context + client name to buildUserMessage
- Schema objects are ready to pass directly as the JSON schema for Anthropic structured output mode

---
*Phase: 07-agent-execution*
*Completed: 2026-04-02*
