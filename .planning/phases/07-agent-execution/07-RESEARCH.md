# Phase 7: Agent Execution - Research

**Researched:** 2026-04-02
**Domain:** Anthropic SDK structured output, config-driven prompt assembly, task type schemas
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each channel has distinct output JSON structure:
  - **Paid social (ad_copy):** Multiple variants (3-5), each with primary_text, headline, description, call_to_action
  - **SEO (content_brief):** meta_title (60 chars), meta_description (155 chars), content_brief (headings, key points, word count target)
  - **Paid ads (rsa_copy):** Multiple headlines (30 chars each), descriptions (90 chars each), optional sitelink extensions
- Output stored as structured JSON in task_runs.output
- Config-driven output schemas — JSON schema files per channel+task_type, no code changes to add new types
- Every output JSON includes a `sources` metadata array listing SOP titles and IDs
- System prompt contains: role definition + channel output schema + SOP content (concatenated from retrieved skills)
- User message contains: specific task request + brand context as "## Brand Context for [Client]" section
- SOPs are primary authority; model can supplement where SOPs don't cover
- SOP attribution via `sources` metadata field, not inline citations
- Phase 7 ships: `ad_copy` (paid social), `content_brief` (SEO), `rsa_copy` (paid ads)
- Model: claude-sonnet-4-6 for all generation tasks
- Trigger: extend assembleContext() — after context assembly, immediately call LLM in the same fire-and-forget
- On LLM failure: retry once with exponential backoff, then transition to 'failed' with error message
- On success: transition to 'draft_ready' (not qa_check — Phase 8 adds that)
- Structured output enforced via Anthropic SDK tool_use or structured output mode

### Claude's Discretion
- Exact prompt templates per task type (wording, instruction phrasing)
- Token limits and max_tokens configuration
- Temperature setting for generation
- How output schema configs are structured on disk (directory layout, naming)
- Retry backoff timing

### Deferred Ideas (OUT OF SCOPE)
- QA validation of generated output — Phase 8
- AHPRA/dental compliance checking — Phase 8
- AM-facing UI for viewing/approving drafts — Phase 10
- Configurable model per task type — future enhancement
- Full task type implementation (12 types across 3 channels) — incremental after Phase 7
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-04 | Agent produces structured draft output (ad copy, content brief, report section) from retrieved context | output_config.format with json_schema enforces schema compliance; config-driven schemas define the structure per task type |
| TASK-05 | Each channel (paid social, SEO, paid ads) has distinct agent behaviour with channel-specific output structure | Three separate JSON schema configs (ad_copy, content_brief, rsa_copy); system prompt includes the active schema; prompt assembly differs per task type |
</phase_requirements>

---

## Summary

Phase 7 extends `assembleContext()` in `web/lib/task-matcher.ts` to call the Anthropic API immediately after context assembly, store the structured JSON output in `task_runs.output`, and transition status to `draft_ready`. The Anthropic SDK v0.81.0 (already installed) supports `output_config.format` with `type: 'json_schema'` — this is the correct mechanism for structured output, not tool_use. The `output_config` approach is GA for claude-sonnet-4-6 and returns valid JSON in `response.content[0].text` without needing to parse tool call arguments.

The config-driven design requires a new directory (e.g. `web/lib/task-types/`) containing one TypeScript module per task type that exports the JSON schema and a prompt-builder function. This is the only new concept; everything else (Anthropic client instantiation, fire-and-forget pattern, status transitions) follows established project patterns already in `ai-classify.ts` and `api/chat.ts`.

The `updateTaskRunStatus` function needs a companion `updateTaskRunOutput` function (or an extended extras parameter) to write structured output JSON to `task_runs.output` atomically with the `draft_ready` status transition.

**Primary recommendation:** Use `output_config.format` with `type: 'json_schema'` for structured output. Load the schema from the task type config file at runtime. Store the `sources` array (SOP titles + IDs) inside the output JSON itself, populated from the already-available `skillResponse.results` in `assembleContext()`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.81.0 (installed) | Anthropic API client | Already in project; output_config.format is GA in this version |

### No New Dependencies Required
The entire phase is implemented with what is already installed. No new npm packages needed.

---

## Architecture Patterns

### Recommended Directory Structure (new additions)
```
web/lib/
├── task-matcher.ts         # Extend with generateDraft() call
├── task-types/             # NEW — config-driven task type registry
│   ├── index.ts            # Exports loadTaskTypeConfig(channel, taskType)
│   ├── ad_copy.ts          # paid_social / ad_copy schema + prompt builder
│   ├── content_brief.ts    # seo / content_brief schema + prompt builder
│   └── rsa_copy.ts         # paid_ads / rsa_copy schema + prompt builder
```

### Pattern 1: output_config.format (Structured JSON Output)

**What:** Pass a JSON schema in `output_config.format` to the SDK. The model is constrained to return valid JSON matching the schema. Output appears in `response.content[0].text` (type: 'text' block).

**When to use:** Any time you need guaranteed schema-compliant JSON. Preferred over tool_use for generation tasks — cleaner response parsing, no tool call argument extraction needed.

**Example:**
```typescript
// Source: platform.claude.com/docs/en/build-with-claude/structured-outputs
// and verified against node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts

import Anthropic, { type OutputConfig } from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const outputConfig: OutputConfig = {
  format: {
    type: 'json_schema',
    schema: taskTypeConfig.schema,  // loaded from web/lib/task-types/ad_copy.ts
  },
};

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: buildSystemPrompt(taskTypeConfig, sopContent),
  messages: [{ role: 'user', content: buildUserMessage(taskRequest, brandContent) }],
  output_config: outputConfig,
});

// Output is in response.content[0].text as a JSON string
const textBlock = response.content.find(b => b.type === 'text');
const output = JSON.parse(textBlock!.text);
```

### Pattern 2: Task Type Config Module

**What:** Each task type exports a schema (for output_config) and a prompt-builder function. Loaded dynamically by channel + task_type key.

**Example:**
```typescript
// web/lib/task-types/ad_copy.ts
export const schema = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          primary_text:   { type: 'string' },
          headline:       { type: 'string' },
          description:    { type: 'string' },
          call_to_action: { type: 'string' },
        },
        required: ['primary_text', 'headline', 'description', 'call_to_action'],
        additionalProperties: false,
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:    { type: 'number' },
          title: { type: 'string' },
        },
        required: ['id', 'title'],
        additionalProperties: false,
      },
    },
  },
  required: ['variants', 'sources'],
  additionalProperties: false,
};

export function buildSystemPrompt(sopContent: string): string {
  return [
    'You are an expert paid social copywriter for a digital marketing agency.',
    'You produce Meta ad copy variants grounded in the provided SOPs.',
    'Output format: ' + JSON.stringify(schema),
    '## SOPs\n' + sopContent,
  ].join('\n\n');
}
```

### Pattern 3: generateDraft() — extending assembleContext()

**What:** After `updateTaskRunStatus(taskRunId, 'generating', ...)`, call `generateDraft()` which builds prompts, calls the API, retries once on failure, then writes output and transitions to `draft_ready` or `failed`.

**Retry pattern (Claude's discretion — exponential backoff):**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));  // 1s, 2s
    }
  }
  throw new Error('unreachable');
}
```

### Pattern 4: updateTaskRunOutput() — new query function

**What:** Write structured JSON output to `task_runs.output` atomically with the `draft_ready` status transition.

**Example:**
```typescript
// web/lib/queries/task-runs.ts — new function

export async function updateTaskRunOutput(
  id: number,
  output: string,  // JSON string
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET status = 'draft_ready', output = ?, updated_at = ? WHERE id = ?`,
    args: [output, now, id],
  });
}
```

### Pattern 5: Prompt Assembly

System prompt structure (for all task types):
```
You are [role for channel/task_type].
[Task-specific instructions grounded in SOPs — not freeform.]

## Output Format
[Embedded schema description or JSON schema]

## SOPs
[Concatenated content of retrieved skills — title + content per SOP]
```

User message structure:
```
Generate [task_type] for the following brief:
[task request / user-provided description]

## Brand Context for [Client Name]
[Concatenated brand file content]
```

### Anti-Patterns to Avoid
- **Calling the LLM without SOP context:** The gap check in `assembleContext()` already prevents this — if `skillResponse.gap === true`, the run fails before the LLM is ever called.
- **Using tool_use for structured output:** The `output_config.format` approach is cleaner — response is in `content[0].text`, no tool call argument extraction needed.
- **Storing output before confirming valid JSON:** Always `JSON.parse()` the response before writing to `task_runs.output`. If parse fails, treat as LLM failure and retry.
- **Concatenating all brand files into a single blob without labels:** Brand files should each be prefixed with their title so the model can distinguish them.
- **Awaiting fire-and-forget in the HTTP handler:** Phase 6 established that `assembleContext()` is called without await after `reply.code(202).send()`. The LLM call inside it must not break this contract.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema-validated JSON output | Manual JSON validation loop | `output_config.format` with `json_schema` | Constrained decoding — never produces invalid JSON |
| Retry logic | Custom retry class | Simple loop with setTimeout | Two-attempt retry is trivial; a library is overkill |
| SOP content fetching | New DB query | `searchSkills()` result already on hand in assembleContext() | `skillResponse.results` contains `title` and `content` — pass through |
| Brand content fetching | New DB query | `getBrandContext(clientSlug)` already called in assembleContext() | Result is already available — pass through |

---

## Common Pitfalls

### Pitfall 1: output_config not available on MessageCreateParams type
**What goes wrong:** TypeScript reports `output_config` as unknown property if the SDK type import is incorrect.
**Why it happens:** The type is exported from `@anthropic-ai/sdk/resources/messages` not from the top-level import in older typings.
**How to avoid:** Import `OutputConfig` from `@anthropic-ai/sdk` (re-exported at top level in v0.81.0). Verified: `output_config` appears at line 2744 of the installed messages.ts.
**Warning signs:** TS2353 error on `output_config` key.

### Pitfall 2: Response content block type
**What goes wrong:** Code reads `response.content[0].text` directly and fails at runtime when the block type is not 'text'.
**Why it happens:** With `output_config.format`, the response always has a `text` content block, but defensive coding requires checking `block.type === 'text'`.
**How to avoid:** `const textBlock = response.content.find(b => b.type === 'text')` — matches the pattern in `api/chat.ts`.
**Warning signs:** `undefined` or runtime error when reading `.text` off a non-text block.

### Pitfall 3: JSON.parse on LLM output failing
**What goes wrong:** `JSON.parse(textBlock.text)` throws even with `output_config` active.
**Why it happens:** Rare but possible if the model adds markdown fencing (```json ... ```) around the output despite structured output mode — this should not happen with `output_config.format` but is worth guarding.
**How to avoid:** Wrap `JSON.parse` in try/catch; treat parse failure the same as an API error (trigger retry).
**Warning signs:** `SyntaxError: Unexpected token` in the fire-and-forget error log.

### Pitfall 4: SOP content exceeding context window
**What goes wrong:** Concatenating 5 large SOPs + brand files exceeds token budget, causing API error.
**Why it happens:** SOPs can be large Google Docs; `searchSkills` returns up to 5.
**How to avoid:** Set `max_tokens` conservatively (2048 for output); set a soft limit on SOP content inclusion — truncate each SOP content at ~2000 chars if needed. Log a warning when truncation occurs.
**Warning signs:** `context_length_exceeded` error from API.

### Pitfall 5: `sources` array not populated
**What goes wrong:** `sources` in the output JSON is empty or omitted, violating the CONTEXT.md requirement that every output lists the SOPs used.
**Why it happens:** Model treats `sources` as optional metadata and omits it under token pressure.
**How to avoid:** Mark `sources` as `required` in the JSON schema. Additionally, after parsing the output, verify `output.sources.length > 0`; if empty, retry.
**Warning signs:** `output.sources` is `[]` in stored task_runs rows.

### Pitfall 6: Character limit constraints in JSON schema
**What goes wrong:** RSA headlines exceed 30 chars or SEO meta_title exceeds 60 chars despite being in the schema.
**Why it happens:** JSON Schema `maxLength` enforces length at validation time, but `output_config` constrained decoding may not enforce `maxLength` at token generation time — it enforces structure (object shape, required keys) but not string-level constraints.
**How to avoid:** Include character limits in the system prompt instructions AND in schema descriptions. After parsing, validate char limits and retry if violated. For RSA copy in particular, be explicit: "Each headline MUST be 30 characters or fewer. Count carefully."
**Warning signs:** RSA headlines consistently at 31-35 characters.

---

## Code Examples

### Full generateDraft() skeleton
```typescript
// web/lib/task-matcher.ts (extension)
// Source: verified against @anthropic-ai/sdk v0.81.0 installed in node_modules

import Anthropic from '@anthropic-ai/sdk';
import { loadTaskTypeConfig } from './task-types/index.js';
import { updateTaskRunOutput } from './queries/task-runs.js';

async function generateDraft(
  taskRunId: number,
  channel: string,
  taskType: string,
  skills: SkillSearchResult[],
  brandFiles: BrandHubRow[],
): Promise<void> {
  const config = loadTaskTypeConfig(channel, taskType);
  const sopContent = skills.map(s => `### ${s.title}\n${s.content}`).join('\n\n');
  const brandContent = brandFiles.map(b => `### ${b.title}\n${b.content}`).join('\n\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const client = new Anthropic({ apiKey });

  const callApi = () => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: config.buildSystemPrompt(sopContent),
    messages: [{ role: 'user', content: config.buildUserMessage(taskType, brandContent) }],
    output_config: { format: { type: 'json_schema', schema: config.schema } },
  });

  let response: Awaited<ReturnType<typeof callApi>>;
  try {
    response = await callApi();
  } catch {
    // Retry once after 1s
    await new Promise(r => setTimeout(r, 1000));
    response = await callApi();  // throws to caller on second failure
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text block in response');
  const outputJson = textBlock.text;
  JSON.parse(outputJson);  // validate — throws if invalid

  await updateTaskRunOutput(taskRunId, outputJson);
}
```

### Task type config index
```typescript
// web/lib/task-types/index.ts
import * as adCopy from './ad_copy.js';
import * as contentBrief from './content_brief.js';
import * as rsaCopy from './rsa_copy.js';

const registry: Record<string, typeof adCopy> = {
  'paid_social:ad_copy': adCopy,
  'seo:content_brief': contentBrief,
  'paid_ads:rsa_copy': rsaCopy,
};

export function loadTaskTypeConfig(channel: string, taskType: string) {
  const key = `${channel}:${taskType}`;
  const config = registry[key];
  if (!config) throw new Error(`No task type config for channel=${channel} taskType=${taskType}`);
  return config;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tool_use with forced tool_choice for structured output | `output_config.format` with `json_schema` | GA in SDK v0.81.0 | Cleaner — response in content[0].text, no tool arg extraction |
| beta header `structured-outputs-2025-11-13` | No beta header required | GA as of Anthropic API update | No betas array needed in the request |

---

## Open Questions

1. **Does `output_config.format` enforce `maxLength` constraints at generation time?**
   - What we know: JSON Schema `maxLength` is part of the schema spec; constrained decoding typically enforces structural constraints (type, required, additionalProperties) but may not token-enforce string lengths.
   - What's unclear: Whether Anthropic's constrained decoding implements `maxLength` enforcement.
   - Recommendation: Treat `maxLength` as advisory in the schema. Add character limit validation in code post-parse. If violated, retry with strongly worded instruction in system prompt.

2. **Should brand content be truncated when multiple files are large?**
   - What we know: `getBrandContext(clientSlug)` returns all brand files for a client, potentially multiple large docs.
   - What's unclear: Typical total size in this specific deployment.
   - Recommendation: Concatenate all files but truncate each at 2000 chars with a `[truncated]` marker. Log a warning. This is safe to implement defensively without knowing the actual data volume.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no separate framework) |
| Config file | None — invoked directly with flags |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/queries/drive.test.ts web/lib/queries/brand.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| TASK-04 | generateDraft() produces JSON output stored in task_runs.output | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ❌ Wave 0 |
| TASK-04 | draft_ready transition occurs on successful generation | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ❌ Wave 0 |
| TASK-04 | failed transition occurs after two API failures | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts` | ❌ Wave 0 |
| TASK-05 | ad_copy output matches paid social schema (variants array with primary_text, headline, description, CTA) | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-types/task-types.test.ts` | ❌ Wave 0 |
| TASK-05 | content_brief output matches SEO schema (meta_title, meta_description, content_brief) | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-types/task-types.test.ts` | ❌ Wave 0 |
| TASK-05 | rsa_copy output matches paid ads schema (headlines array, descriptions array) | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-types/task-types.test.ts` | ❌ Wave 0 |
| TASK-04 | sources array is populated in every output | unit | included in task-matcher.test.ts | ❌ Wave 0 |
| TASK-04 | updateTaskRunOutput writes output JSON to task_runs.output | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (file exists, new test needed) |

### Sampling Rate
- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts`
- **Per wave merge:** Full suite above (task-matcher + task-types + task-runs)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/task-matcher.test.ts` — covers TASK-04 (generateDraft, retry, draft_ready, failed, sources populated); mock Anthropic SDK via `mock.module('@anthropic-ai/sdk', ...)`
- [ ] `web/lib/task-types/task-types.test.ts` — covers TASK-05 (schema shape validation for all 3 task types; buildSystemPrompt and buildUserMessage output)
- [ ] New `updateTaskRunOutput` test case in existing `web/lib/queries/task-runs.test.ts`

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` — `OutputConfig`, `JSONOutputFormat` types and `output_config` parameter on `MessageCreateParams` confirmed present in v0.81.0
- `platform.claude.com/docs/en/build-with-claude/structured-outputs` — official structured outputs docs; `output_config.format` with `json_schema` is GA for claude-sonnet-4-6
- `web/lib/task-matcher.ts` — current `assembleContext()` implementation; extension point confirmed
- `web/lib/queries/task-runs.ts` — `updateTaskRunStatus()` pattern; `output` column confirmed in `TaskRunRow`
- `scripts/matching/strategies/ai-classify.ts` — established Anthropic client instantiation pattern
- `api/chat.ts` — established streaming pattern; `content.find(b => b.type === 'text')` pattern

### Secondary (MEDIUM confidence)
- npm CLI `npm show @anthropic-ai/sdk version` — confirms v0.82.0 is latest, v0.81.0 is what is installed (per package.json `^0.81.0`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK already installed; output_config verified in installed node_modules
- Architecture: HIGH — follows established project patterns; no new concepts
- Pitfalls: HIGH for SDK usage; MEDIUM for character limit enforcement (behaviour not definitively confirmed in Anthropic docs)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable SDK — 30 days)
