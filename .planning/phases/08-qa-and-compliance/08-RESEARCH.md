# Phase 8: QA and Compliance — Research

**Researched:** 2026-04-02
**Domain:** LLM-as-judge quality checking, AHPRA dental advertising compliance, retry-with-critique patterns
**Confidence:** HIGH (architecture patterns from codebase; AHPRA rules from official AHPRA sources and verified practitioner guidance)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two-pass design: SOP quality (LLM judge Haiku, triggers retries) → AHPRA compliance (rule-based, flags only)
- Hardcoded AHPRA checklist in a TypeScript/JSON file — researcher compiles the rules
- AHPRA compliance is a SEPARATE check that runs AFTER SOP QA — two distinct passes
- On AHPRA violation: flag with specific rule violations — no auto-fix, no regeneration, no silent suppression
- AHPRA violations flag but still show the draft to AM — they decide what to do
- LLM-as-judge with full SOP context — separate LLM call receives generated output + the SOPs used + a scoring rubric
- QA model: Haiku (`claude-haiku-4-5-20251001`) — fast, cheap for pass/fail evaluation
- Pass/fail + structured critique — binary decision with specific issues listed on failure
- QA judge receives full SOP content (same SOPs the generator used), not just titles/IDs
- On QA failure: append critique to user message for retry ("Previous attempt failed QA. Issues: [critique]. Please regenerate addressing these issues.")
- Same system prompt preserved on retry — SOP grounding maintained
- Same model (Sonnet) for all generation attempts — no model escalation
- Status flow: `generating → qa_check → (pass) draft_ready | (fail) back to generating` with incremented attempts
- Maximum 3 total attempts (initial + 2 retries) — hard cap
- Only store the final output — `task_runs.output` holds latest attempt, `qa_critique` holds latest critique, `attempts` counter tracks tries
- After max retries: AM sees latest draft + QA critique + "requires human review" flag
- Status: `draft_ready` with `qa_score=0` (draft visible but flagged)
- `qa_critique` JSON structure: `{sop_issues: [{criterion, description}], ahpra_violations: [{rule, violation, severity}]}`
- No new columns needed — `qa_critique` (TEXT) holds the structured JSON

### Claude's Discretion
- Exact QA scoring rubric/prompt design for the LLM-as-judge
- AHPRA rule matching implementation (regex, keyword, or structured patterns)
- How `qa_critique` JSON is structured internally beyond the two top-level sections
- Token management for QA calls (SOP content may need truncation for Haiku context)

### Deferred Ideas (OUT OF SCOPE)
- AM ability to manually trigger regeneration from the UI — Phase 10
- Admin ability to edit/update AHPRA rules from the dashboard — future enhancement
- Per-channel QA rubrics (different quality standards per channel) — future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QA-01 | Agent output is validated against SOP checklist criteria after generation | LLM-as-judge pattern documented; Haiku model ID confirmed; integration point in `generateDraft` identified |
| QA-02 | On QA failure, agent receives critique and regenerates (retry-with-critique, max 2 retries) | Retry loop pattern with critique injection documented; attempts counter already in schema |
| QA-03 | After max retries, task escalates to human review with critique attached | `draft_ready` + `qa_score=0` pattern; `qa_critique` column already exists |
| QA-04 | AHPRA/dental compliance pre-flight runs on all output before surfacing to AM | Full AHPRA rules compiled below; rule-based checker pattern documented |
| QA-05 | Compliance check flags non-compliant content with specific rule violations, does not silently suppress | Violation structure documented; `ahpra_violations` array in `qa_critique` JSON |
</phase_requirements>

---

## Summary

Phase 8 inserts a two-pass validation gate between draft generation and `draft_ready`. The first pass is an LLM-as-judge call using Haiku to evaluate the draft against the SOPs used to generate it — on failure it injects a critique into the user message and retries up to 2 more times. The second pass is a deterministic rule-based AHPRA compliance check — it never triggers regeneration, only attaches violation records to `qa_critique`.

The architecture is a pure extension of `task-matcher.ts`: the existing `generateDraft` function transitions to `draft_ready` directly; Phase 8 intercepts that by routing through `qa-checker.ts` (new module) and `ahpra-rules.ts` (new module) before any `draft_ready` transition. The `task_runs` table already has all required columns (`qa_score`, `qa_critique`, `attempts`).

**Primary recommendation:** Implement QA as a new `runQACheck()` function in `web/lib/qa-checker.ts` called from within `generateDraft` (replacing the direct `updateTaskRunOutput` call). The attempts counter drives the retry loop. AHPRA runs after SOP QA passes or after max retries are exhausted — always before `draft_ready`.

---

## AHPRA Dental Advertising Rules (Compiled)

This is the mandatory compliance checklist for the hardcoded `web/lib/ahpra-rules.ts` module. Rules sourced from AHPRA's official advertising guidelines (Health Practitioner Regulation National Law, s.133), the 2025 cosmetic procedures guidelines (effective 2 September 2025), and verified practitioner guidance.

### Category 1: Testimonials and Patient Stories

**Rule AHPRA-T1 — Clinical outcome testimonials prohibited**
Any statement, quote, or narrative that references a patient's clinical outcome, treatment result, or health improvement. Covers patient quotes, success stories, case studies with outcome claims, and star ratings referencing treatment effectiveness.

Prohibited patterns:
- `"my pain was gone after"`
- `"fixed my [condition]"`
- `"best [practitioner type] ever, my [symptom] disappeared"`
- `"results speak for themselves"`
- Patient name + outcome combination

Allowed: Non-clinical feedback about facility, staff friendliness, booking ease, location.

**Rule AHPRA-T2 — Influencer endorsements prohibited (from 2 September 2025)**
Use of influencers, brand ambassadors, or social media personalities to promote regulated health services or cosmetic dental procedures.

Prohibited patterns:
- Influencer/celebrity promotion of dental procedures
- Free treatment in exchange for promotion/content
- `"as seen on"` linked to influencer content

---

### Category 2: Outcome Claims and Guarantees

**Rule AHPRA-O1 — Guaranteed results prohibited**
Any claim that promises, implies, or suggests a guaranteed outcome.

Prohibited terms and phrases:
- `"guaranteed"`
- `"100% success rate"`
- `"guaranteed results in"`
- `"permanent solution"`
- `"will fix"`
- `"you will achieve"`
- `"certain to"`
- `"definitely"`

**Rule AHPRA-O2 — Unrealistic expectation language prohibited**
Terms that create unreasonable expectations about treatment outcomes, safety, or experience.

Prohibited terms:
- `"pain-free"` (as absolute claim)
- `"instant results"`
- `"risk-free"`
- `"safe"` (as unqualified absolute)
- `"miracle"`
- `"cure"`
- `"instant cure"`
- `"permanent"` (when describing cosmetic outcome)
- `"happier you"`
- `"restore self-esteem"` (emotive outcome claim)
- `"confidence boost"` (as treatment outcome)
- `"transform your life"`

**Rule AHPRA-O3 — Fear-based and urgency advertising prohibited**
Content that exploits fear, creates undue urgency, or implies adverse consequences from not seeking treatment.

Prohibited patterns:
- `"book now or"` + negative consequence
- `"before it's too late"`
- `"don't risk"`
- Fear of medical condition used as sales pressure
- Urgency language for cosmetic procedures (`"limited time"`, `"act now"` for clinical services)

---

### Category 3: Comparative and Superlative Claims

**Rule AHPRA-C1 — Superlative claims prohibited without objective basis**
Unverifiable claims of superiority.

Prohibited terms:
- `"best"`
- `"leading"`
- `"most trusted"`
- `"world-class"`
- `"world renowned"`
- `"number one"`
- `"top"`
- `"premier"` (when used as superiority claim)
- `"Australia's best"`
- `"most experienced"`

**Rule AHPRA-C2 — Comparative advertising without objective proof prohibited**
Direct claims of superiority over competitors without verifiable objective evidence.

Prohibited patterns:
- `"better than"` + competitor/category
- `"unlike other [practitioners]"`
- `"the only practice that"`

---

### Category 4: Title and Qualification Misuse

**Rule AHPRA-Q1 — Specialist title restricted**
"Specialist" and related terms can only be used by practitioners holding formal AHPRA specialist registration.

Prohibited uses (without formal specialist registration):
- `"specialist"` as a standalone claim
- `"specialises in"` (implies formal specialist status)
- `"specialty practice"`
- `"specialised [procedure] dentist"`
- `"expert"` (requires formal accreditation)
- `"expert in"`

Allowed: `"special interest in"` — this specific phrase is explicitly permitted for non-specialist practitioners.

**Rule AHPRA-Q2 — Protected title misuse prohibited**
Using a registered title without holding that registration.

Prohibited:
- `"Dr"` used by practitioners not registered as medical doctors or dentists
- Using another profession's registered title
- Implying qualifications not held

---

### Category 5: Visual Content (for drafted content describing imagery)

**Rule AHPRA-V1 — Before-and-after image rules**
Before-and-after clinical photographs are prohibited in general dental advertising. For higher-risk cosmetic procedures (effective 2 September 2025), they are permitted only with strict conditions: real unretouched patients, no minors, disclaimer that results vary, "after" image not the most prominent element.

Prohibited in copy:
- Describing AI-generated or retouched comparison images
- Directing readers to before/after galleries without disclaimers
- Copy implying a specific visual outcome the patient will achieve

**Rule AHPRA-V2 — No minors in cosmetic content**
Marketing must not target individuals under 18 or feature minors in cosmetic procedure content.

Prohibited:
- Any content targeting under-18s for cosmetic dental procedures
- Use of minor images in cosmetic-related copy

---

### Category 6: Inducements and Offers

**Rule AHPRA-I1 — Undisclosed inducements prohibited**
Gifts, discounts, and promotional offers can be advertised but must include clear terms and conditions. "Free" claims are prohibited when costs are recouped elsewhere.

Prohibited:
- `"free"` when costs are bundled or recouped via Medicare/elsewhere
- Discounts without terms and conditions
- Referral bonuses without transparent disclosure
- `"limited offer"` without stated terms
- Offers to influencers in exchange for promotion

**Rule AHPRA-I2 — Offers encouraging unnecessary treatment prohibited**
Offers or incentives structured to encourage procedures the patient may not need.

Prohibited patterns:
- Bundle pricing that incentivises multiple procedures
- `"buy two get one free"` on clinical procedures
- Promotional urgency for clinical (non-cosmetic) treatments

---

### Category 7: Evidence and Accuracy

**Rule AHPRA-E1 — Unsubstantiated claims prohibited**
Claims about treatment effectiveness must be supported by peer-reviewed evidence. Anecdotal or single-case claims about clinical effectiveness are not permitted.

Prohibited:
- `"proven to"`  without citing peer-reviewed evidence
- `"clinically proven"` without evidence reference
- Statistics presented without source (`"99% of patients"`)
- Unverifiable efficacy claims

**Rule AHPRA-F1 — False or misleading claims (s.133 core prohibition)**
All advertising must not be false, misleading, or deceptive, or likely to be misleading or deceptive.

Prohibited:
- Incorrect pricing that omits known additional costs
- Service descriptions that do not match what is delivered
- Any statement the practitioner knows to be false

---

### Severity Classification

| Severity | Meaning | Examples |
|----------|---------|---------|
| HIGH | Direct s.133 breach; potential $60k/$120k fine | Testimonials, guaranteed results, title misuse |
| MEDIUM | Likely breach; formal warning territory | Superlatives, unsubstantiated claims, undisclosed offers |
| LOW | Borderline / best-practice concern | Emotive language without outcome claim, vague urgency |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | installed | QA judge LLM call (Haiku) | Same SDK as generation; no new dependency |
| `node:test` | Node built-in | Test framework | Established project pattern across all phases |
| `tsx/esm` | installed | ESM TypeScript loader for tests | Used across all existing test files |

### Models

| Model | ID | Use | Cost |
|-------|-----|-----|------|
| Claude Haiku | `claude-haiku-4-5-20251001` | QA judge (pass/fail evaluation) | Cheapest; confirmed in `ai-classify.ts` |
| Claude Sonnet | `claude-sonnet-4-6` | Generation retries | Confirmed in `task-matcher.ts` |

**Installation:** No new packages needed. All dependencies already present.

---

## Architecture Patterns

### Recommended Module Structure

```
web/lib/
├── task-matcher.ts          # MODIFY: route through QA before draft_ready
├── qa-checker.ts            # NEW: runQACheck() — LLM judge + AHPRA check
├── ahpra-rules.ts           # NEW: hardcoded AHPRA rule checklist
└── queries/
    └── task-runs.ts         # MODIFY: add updateTaskRunQA()
```

### Pattern 1: QA Check Integration Point in generateDraft

The existing `generateDraft` in `task-matcher.ts` calls `updateTaskRunOutput()` on success, which atomically sets `status=draft_ready`. Phase 8 replaces that call with a `runQACheck()` call that manages the status transition itself.

**Current flow (Phase 7):**
```
generate → parse/validate → updateTaskRunOutput() [sets draft_ready]
```

**Phase 8 flow:**
```
generate → parse/validate → runQACheck() → (pass) updateTaskRunQA(pass) + updateTaskRunOutput()
                                         → (fail, attempts < 3) retry with critique injected
                                         → (fail, attempts = 3) updateTaskRunQA(fail) + updateTaskRunOutput() [draft_ready, qa_score=0]
```

### Pattern 2: Retry-with-Critique Loop

The retry loop lives inside `generateDraft` (renamed or extended). The `attempts` counter on `task_runs` tracks total attempts across the QA loop.

```typescript
// Pseudocode — exact prompt wording is Claude's discretion
const MAX_ATTEMPTS = 3;

async function generateDraft(taskRunId, ..., attempts = 0): Promise<void> {
  // Build user message — on retry, prepend critique
  const userMessage = attempts === 0
    ? config.buildUserMessage(...)
    : buildRetryMessage(config, critique, brandContent, clientName);

  // Call Anthropic (Sonnet)
  const output = await callGeneration(systemPrompt, userMessage);

  // Increment attempt counter in DB
  await incrementAttempts(taskRunId);

  // Run SOP QA (Haiku)
  const qaResult = await runSOPCheck(output, sopContent);

  if (qaResult.pass) {
    // Run AHPRA check (always, regardless of SOP pass/fail)
    const ahpraResult = runAHPRACheck(output);
    const critique = buildCritique(null, ahpraResult);
    await updateTaskRunQA(taskRunId, { score: 1, critique });
    await updateTaskRunOutput(taskRunId, JSON.stringify(output));
    return;
  }

  if (attempts + 1 < MAX_ATTEMPTS) {
    // Retry with critique
    return generateDraft(taskRunId, ..., attempts + 1, qaResult.critique);
  }

  // Max retries exhausted — surface to AM
  const ahpraResult = runAHPRACheck(output);
  const critique = buildCritique(qaResult.critique, ahpraResult);
  await updateTaskRunQA(taskRunId, { score: 0, critique });
  await updateTaskRunOutput(taskRunId, JSON.stringify(output)); // draft_ready with qa_score=0
}
```

### Pattern 3: AHPRA Rule Matcher

The AHPRA checker is a deterministic function — no LLM call. It receives the serialised draft text, tests against the rule list, and returns an array of violations.

```typescript
// Source: ahpra-rules.ts pattern
export interface AHPRARule {
  id: string;          // e.g. "AHPRA-T1"
  category: string;    // e.g. "testimonials"
  description: string; // human-readable rule name
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  patterns: RegExp[];  // matched against draft text (case-insensitive)
}

export interface AHPRAViolation {
  rule: string;        // rule ID
  violation: string;   // matched text or description
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function checkAHPRACompliance(draftText: string): AHPRAViolation[]
```

**Matching approach:** Keyword/phrase regex patterns are sufficient for the current hardcoded ruleset. LLM-based matching is not needed and would introduce non-determinism — rule-based is auditable and reproducible.

**Text extraction:** `draftText` should be the full JSON output serialised as a string — pattern matching runs across all text fields (primary_text, headline, description, etc.) without requiring field-by-field parsing.

### Pattern 4: updateTaskRunQA (new query function)

```typescript
// Add to web/lib/queries/task-runs.ts
export async function updateTaskRunQA(
  id: number,
  qa: { score: number; critique: string } // critique is JSON string
): Promise<void>
```

This is a targeted UPDATE of `qa_score` and `qa_critique` only — separate from `updateTaskRunOutput` which sets `status=draft_ready` and writes the output. Both are called in sequence for the final transition.

### Pattern 5: qa_critique JSON Structure

```typescript
interface QACritique {
  sop_issues: Array<{
    criterion: string;   // e.g. "Character limit compliance"
    description: string; // specific failure detail
  }>;
  ahpra_violations: Array<{
    rule: string;        // e.g. "AHPRA-O1"
    violation: string;   // matched text excerpt or description
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}
```

### Anti-Patterns to Avoid

- **Calling AHPRA check before SOP QA resolves:** AHPRA runs after SOP pass OR after max retries — never in the middle of the retry loop. This keeps the two passes truly separate.
- **Blocking draft_ready on AHPRA violations:** AHPRA flags but does not block. An AHPRA-violated draft still reaches `draft_ready` — the AM decides.
- **Re-running AHPRA on retried drafts mid-loop:** AHPRA only runs on the final output (pass or exhausted retries). Running it on intermediate attempts wastes Haiku budget and creates confusing intermediate states.
- **Storing intermediate outputs:** Only the last attempt's output is stored. `updateTaskRunOutput` is only called once per `assembleContext` invocation.
- **Infinite loops:** The `MAX_ATTEMPTS = 3` constant must be enforced before any LLM call — check `attempts >= MAX_ATTEMPTS - 1` before deciding to retry, not after.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON output from Haiku | Custom parser | `JSON.parse` on structured output via `output_config` | Same pattern as generation; already proven |
| Token counting for SOP truncation | Custom tokeniser | Fixed character limit (e.g. 3000 chars per SOP for Haiku) | Haiku context is 200k tokens; SOP content is small; exact counting not needed |
| Regex compilation | Inline patterns | Pre-compiled `RegExp[]` in the rule definition | Compiled once at module load, not per-check |

**Key insight:** The AHPRA checker is intentionally rule-based, not LLM-based. LLM matching would add latency, cost, and non-determinism to what should be a fast, auditable compliance gate.

---

## Common Pitfalls

### Pitfall 1: Attempts Counter Out of Sync

**What goes wrong:** The `attempts` column in `task_runs` gets incremented at the wrong point in the flow — either too early (before generation) or too late (after QA) — causing the max-attempt gate to misfire.
**Why it happens:** The counter needs to reflect "how many complete generation+QA cycles have occurred", not "how many Anthropic calls were made".
**How to avoid:** Increment `attempts` once per generation+QA cycle, after the Anthropic call succeeds (or after the existing generation retry within `generateDraft` exhausts its 2 attempts). The QA retry loop is a separate concern from the generation retry.
**Warning signs:** Tests show 4+ Anthropic calls for a 3-attempt limit.

**Clarification on retry counts:** There are TWO retry mechanisms:
1. **Generation retry** (existing Phase 7 code): 2 attempts for Anthropic API/parse failures — this is purely for robustness against transient API errors.
2. **QA retry** (Phase 8): 3 total attempts (initial + 2) — this is for SOP quality failures.

These are nested. A single QA "attempt" may internally make up to 2 Anthropic calls if the first fails with a network error.

### Pitfall 2: AHPRA Check on Partial/Invalid JSON

**What goes wrong:** `checkAHPRACompliance` receives a malformed string when the JSON parse step fails, causing false positives from pattern matching on error messages or JSON syntax characters.
**Why it happens:** AHPRA check is called on draft text before validation.
**How to avoid:** Only call `checkAHPRACompliance` after `JSON.parse` succeeds and `sources` validation passes.

### Pitfall 3: Haiku Context Overflow with Large SOPs

**What goes wrong:** QA judge call fails or truncates when SOPs passed to the generation step are large (e.g., 5 × 2000 char = 10,000 chars of SOP content).
**Why it happens:** Haiku has a 200k token context window but the QA prompt also includes the generated output + rubric. In practice this is unlikely to overflow, but defensive truncation prevents unexpected failures.
**How to avoid:** Cap SOP content passed to the QA judge at a lower limit than generation (e.g., 1500 chars per SOP) if token budget is tight. The QA judge needs enough SOP context to evaluate against criteria — not every word.

### Pitfall 4: Status Stuck at qa_check

**What goes wrong:** If `runQACheck` throws an unhandled error, the task run stays in `qa_check` indefinitely with no transition to `failed` or `draft_ready`.
**Why it happens:** The outer catch in `assembleContext` catches errors from `assembleContext`-level code, but errors inside `generateDraft` (which calls QA) need their own error handling.
**How to avoid:** Wrap `runQACheck` in a try/catch that transitions to `failed` on unexpected errors — same pattern as the existing generation try/catch in `generateDraft`.

### Pitfall 5: Critique Injection Breaking System Prompt

**What goes wrong:** Appending critique to the user message inadvertently overrides the SOP grounding if the system prompt is not preserved exactly.
**Why it happens:** Some implementations rebuild the full prompt on retry rather than appending to the user message only.
**How to avoid:** Per the locked decision: same system prompt on all retries. Only the user message changes. Build `buildRetryMessage()` as a wrapper that prepends the critique to the existing user message content.

---

## Code Examples

### LLM-as-Judge Call (Haiku pattern from existing codebase)

```typescript
// Pattern from scripts/matching/strategies/ai-classify.ts
// Adapted for QA judge use
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  system: QA_JUDGE_SYSTEM_PROMPT, // rubric + SOP content
  messages: [{ role: 'user', content: draftText }],
  // @ts-expect-error — output_config not yet in SDK types
  output_config: { format: { type: 'json_schema', schema: QA_RESULT_SCHEMA } },
});
```

### AHPRA Rule Definition Structure

```typescript
// web/lib/ahpra-rules.ts
export const AHPRA_RULES: AHPRARule[] = [
  {
    id: 'AHPRA-T1',
    category: 'testimonials',
    description: 'Clinical outcome testimonials prohibited',
    severity: 'HIGH',
    patterns: [
      /my (pain|symptoms?|condition)\s+(is|are|was|were)\s+(gone|fixed|cured|healed)/i,
      /fixed my\s+\w+/i,
      /results?\s+speak\s+for\s+themselves/i,
    ],
  },
  {
    id: 'AHPRA-O1',
    category: 'outcome-claims',
    description: 'Guaranteed results prohibited',
    severity: 'HIGH',
    patterns: [
      /\bguaranteed?\b/i,
      /100%\s+success/i,
      /permanent\s+(solution|result|fix)/i,
    ],
  },
  // ... full ruleset per compiled rules above
];
```

### Status Flow with qa_check Transition

```typescript
// web/lib/queries/task-runs.ts — add qa_check transition
// updateTaskRunStatus already supports all TaskRunStatus values including 'qa_check'
// TaskRunStatus type already includes 'qa_check' (confirmed in task-runs.ts line 7)
await updateTaskRunStatus(taskRunId, 'qa_check');
```

### updateTaskRunQA (new function signature)

```typescript
// Add to web/lib/queries/task-runs.ts
export async function updateTaskRunQA(
  id: number,
  qa: { score: number; critique: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET qa_score = ?, qa_critique = ?, updated_at = ? WHERE id = ?`,
    args: [qa.score, qa.critique, now, id],
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Rule-based output validation | LLM-as-judge for quality, rule-based for compliance | Hybrid: LLM for nuanced SOP criteria, deterministic for regulatory rules |
| Single retry on failure | Retry-with-critique (critique injected into prompt) | Critique makes retry targeted, not blind |
| Silent failure to human | Structured escalation with critique attached | AM sees why the draft needs review |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None — flags passed directly |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts web/lib/ahpra-rules.test.ts web/lib/task-matcher.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| QA-01 | SOP QA judge called after generation, status transitions to `qa_check` | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` | ❌ Wave 0 |
| QA-02 | Critique injected into retry message; max 3 total attempts enforced | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` | ❌ Wave 0 |
| QA-03 | After attempt 3: `draft_ready` + `qa_score=0` + critique attached | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts` | ❌ Wave 0 |
| QA-04 | AHPRA check runs on every draft before `draft_ready`; cannot be bypassed | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/ahpra-rules.test.ts` | ❌ Wave 0 |
| QA-05 | AHPRA violation records include rule ID, matched text, severity; draft not suppressed | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/ahpra-rules.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/qa-checker.test.ts`
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/lib/qa-checker.test.ts` — covers QA-01, QA-02, QA-03
- [ ] `web/lib/ahpra-rules.test.ts` — covers QA-04, QA-05
- [ ] `web/lib/queries/task-runs.test.ts` already exists — extend with `updateTaskRunQA` test

*(Framework install: none needed — `node:test` + `tsx/esm` already in use)*

---

## Open Questions

1. **Haiku structured output via `output_config`**
   - What we know: Generation uses `output_config` with `@ts-expect-error` (SDK types lag the feature). Haiku is used in `ai-classify.ts` without structured output.
   - What's unclear: Whether `output_config` works on Haiku the same as Sonnet — or whether the QA judge should return a simpler text response and use a parsed format.
   - Recommendation: Use `output_config` on Haiku for the QA judge (same pattern as generation). If it fails in practice, fall back to plain text with a simple pass/fail prefix the planner can document as a contingency.

2. **Attempts counter: QA loop vs generation retry interaction**
   - What we know: The existing Phase 7 `generateDraft` has its own 2-attempt retry for API/parse failures. Phase 8 adds a QA-level retry of up to 3 total.
   - What's unclear: Whether the `attempts` column should count QA cycles (1 per QA pass regardless of generation retries) or total Anthropic calls.
   - Recommendation: Count QA cycles — one increment per successful generation+QA evaluation. This aligns with "3 total attempts" in the user's mental model.

---

## Sources

### Primary (HIGH confidence)

- AHPRA official advertising hub — https://www.ahpra.gov.au/Resources/Advertising-hub/Advertising-guidelines-and-other-guidance.aspx
- AHPRA official testimonials guidance — https://www.ahpra.gov.au/Resources/Advertising-hub/Resources-for-advertisers/Testimonial-tool.aspx
- AHPRA s.133 Health Practitioner Regulation National Law — confirmed via multiple authoritative sources
- AHPRA cosmetic procedures guidelines (effective 2 September 2025) — Clayton Utz legal analysis: https://www.claytonutz.com/insights/2025/june/navigating-the-2025-ahpra-guidelines-on-cosmetic-procedures-heres-what-you-need-to-know
- Codebase: `web/lib/task-matcher.ts`, `web/lib/queries/task-runs.ts`, `scripts/matching/strategies/ai-classify.ts`

### Secondary (MEDIUM confidence)

- Complete Smiles AHPRA dental FAQ (practitioner compliance resource): https://completesmilesbv.com.au/ahpra-advertising-faqs-for-dentists/
- Complete Smiles enforcement overview: https://completesmilesbv.com.au/how-ahpra-enforces-dental-advertising-rules/
- Practice Lab testimonials guide: https://practicelab.com.au/knowledge-base/ahpra-guidelines-on-testimonials-whats-allowed-and-whats-not/
- PracticeBoost dental AHPRA 2025 compliance: https://www.practiceboost.com.au/blog/navigating-new-ahpra-guidelines-what-dental-practices-must-know-for-compliant-and-effective-marketing
- That Content Agency 2025 AHPRA copywriting guide: https://www.thatcontentagency.com.au/blog/the-2025-ahpra-copywriting-guide-for-health-professionals

### Tertiary (LOW confidence — for awareness only)

- Specific penalty figures ($60k individual / $120k organisation) confirmed by multiple sources but not directly verified against the National Law text; treat as accurate for practical purposes.

---

## Metadata

**Confidence breakdown:**
- AHPRA rules: HIGH — sourced from official AHPRA pages and verified against multiple independent practitioner guidance documents; 2025 rule changes confirmed via Clayton Utz legal analysis
- Architecture patterns: HIGH — derived directly from existing codebase patterns (task-matcher.ts, ai-classify.ts, task-runs.ts)
- QA scoring rubric content: LOW — deliberately left to Claude's discretion (locked decision); design is well-understood, exact prompt wording is implementation detail
- Haiku structured output compatibility: MEDIUM — pattern established in codebase but not tested with QA judge use case

**Research date:** 2026-04-02
**Valid until:** AHPRA rules — 2026-09-01 (stable; next likely update cycle); Architecture — stable until codebase changes
