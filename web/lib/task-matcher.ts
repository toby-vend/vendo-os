import Anthropic from '@anthropic-ai/sdk';
import { searchSkills, type SkillSearchResult } from './queries/drive.js';
import { getBrandContext, type BrandHubRow } from './queries/brand.js';
import {
  updateTaskRunStatus,
  updateTaskRunOutput,
  updateTaskRunQA,
  incrementAttempts,
} from './queries/task-runs.js';
import { scalar } from './queries/base.js';
import { loadTaskTypeConfig } from './task-types/index.js';
import { runSOPCheck } from './qa-checker.js';
import { checkAHPRACompliance } from './ahpra-rules.js';

/**
 * Resolve the client_slug for a given client_id by querying brand_hub.
 * Returns null and logs a warning when no brand entry exists for the client.
 */
async function resolveClientSlug(clientId: number): Promise<string | null> {
  const slug = await scalar<string>(
    'SELECT client_slug FROM brand_hub WHERE client_id = ? LIMIT 1',
    [clientId],
  );
  if (slug === null) {
    console.warn(`[task-matcher] No brand_hub entry found for client_id=${clientId} — proceeding without brand context.`);
  }
  return slug;
}

/**
 * Build a retry message that prepends the previous critique to the original
 * user message content so the LLM can address the specific issues.
 */
function buildRetryMessage(originalUserMessage: string, critique: string): string {
  return `Previous attempt failed QA. Issues:\n${critique}\n\nPlease regenerate addressing these issues.\n\n${originalUserMessage}`;
}

/**
 * Call the Anthropic API with assembled SOP + brand context to produce
 * a structured JSON draft. Retries on QA failure up to MAX_ATTEMPTS total.
 * SOP QA (Haiku) and AHPRA compliance run on every draft before draft_ready.
 *
 * Retry logic:
 *   - Attempt 0..2 (3 total): generate → qa_check → runSOPCheck
 *   - On SOP pass: run AHPRA, write qa_score=1, write output (draft_ready)
 *   - On SOP fail + more attempts: prepend critique to retry message, continue
 *   - On SOP fail + exhausted: run AHPRA, write qa_score=0, write output (draft_ready)
 *   - On QA error: transition to failed (not stuck at qa_check)
 *
 * Not exported — called internally by assembleContext after status=generating.
 */
async function generateDraft(
  taskRunId: number,
  channel: string,
  taskType: string,
  skills: SkillSearchResult[],
  brandFiles: BrandHubRow[],
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — cannot call Anthropic API');
  }

  // Load task-type config (throws if channel:taskType not registered)
  const config = loadTaskTypeConfig(channel, taskType);

  // Build SOP content — truncate each SOP at 2000 chars (defensive)
  const sopContent = skills
    .map(s => {
      const content = s.content.length > 2000
        ? (console.warn(`[task-matcher] SOP "${s.title}" truncated from ${s.content.length} to 2000 chars`), s.content.slice(0, 2000))
        : s.content;
      return `### ${s.title}\n${content}`;
    })
    .join('\n\n');

  // Build brand content
  const brandContent = brandFiles.map(b => `### ${b.title}\n${b.content}`).join('\n\n');

  // Resolve client name
  const clientName = brandFiles.length > 0 ? brandFiles[0].client_name : 'Unknown';

  // Build prompts
  const systemPrompt = config.buildSystemPrompt(sopContent);
  const baseUserMessage = config.buildUserMessage(taskType, brandContent, clientName);

  // Instantiate Anthropic client
  const client = new Anthropic({ apiKey });

  const MAX_ATTEMPTS = 3;
  let previousCritique: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Build user message — on retry, prepend critique
    const userMessage =
      attempt === 0 || previousCritique === null
        ? baseUserMessage
        : buildRetryMessage(baseUserMessage, previousCritique);

    let parsed: { sources?: unknown[] };

    // Generation step — on API/parse error, throw (assembleContext catch handles failed transition)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      // @ts-expect-error — output_config is not yet in the SDK types
      output_config: { format: { type: 'json_schema', schema: config.schema } },
    });

    // Extract text block from response
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!textBlock) {
      throw new Error('No text block in Anthropic response');
    }

    // Parse JSON
    parsed = JSON.parse(textBlock.text) as { sources?: unknown[] };

    // Validate sources array is non-empty
    if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
      throw new Error('Anthropic response is missing a non-empty sources array');
    }

    // Transition to qa_check and increment attempts counter
    await updateTaskRunStatus(taskRunId, 'qa_check');
    await incrementAttempts(taskRunId);

    // QA check — wrap in try/catch to prevent stuck qa_check on unexpected error
    try {
      const sopCheckResult = await runSOPCheck(JSON.stringify(parsed), sopContent);

      if (sopCheckResult.pass) {
        // SOP passed — run AHPRA and write result
        const ahpraViolations = checkAHPRACompliance(JSON.stringify(parsed));
        const critiqueObj = { sop_issues: [], ahpra_violations: ahpraViolations };
        await updateTaskRunQA(taskRunId, { score: 1, critique: JSON.stringify(critiqueObj) });
        await updateTaskRunOutput(taskRunId, JSON.stringify(parsed));
        return;
      }

      // SOP failed
      if (attempt < MAX_ATTEMPTS - 1) {
        // More attempts remain — store critique for next iteration
        previousCritique = sopCheckResult.critique;
        continue;
      }

      // Exhausted attempts — surface as draft_ready with qa_score=0
      const ahpraViolations = checkAHPRACompliance(JSON.stringify(parsed));
      const sopIssues = sopCheckResult.critique
        ? sopCheckResult.critique.split('\n').filter(Boolean)
        : [];
      const critiqueObj = { sop_issues: sopIssues, ahpra_violations: ahpraViolations };
      await updateTaskRunQA(taskRunId, { score: 0, critique: JSON.stringify(critiqueObj) });
      await updateTaskRunOutput(taskRunId, JSON.stringify(parsed));
      return;

    } catch (qaErr) {
      // QA infrastructure error — transition to failed, do not leave stuck at qa_check
      console.error(
        `[task-matcher] QA check error for taskRunId=${taskRunId} attempt=${attempt}: ${(qaErr as Error).message}`,
      );
      await updateTaskRunStatus(taskRunId, 'failed');
      return;
    }
  }
}

/**
 * Assemble the context for a task run and generate a draft via the Anthropic API.
 *
 * Steps:
 *   1. Call searchSkills(taskType, channel, 5)
 *   2. If gap=true, mark task_run as failed and return early.
 *   3. Resolve clientSlug via brand_hub.
 *   4. If clientSlug found, call getBrandContext(clientSlug) — keep full array for generation.
 *   5. Update task_run to status=generating with sops_used and brand_context_id.
 *   6. Call generateDraft() with assembled SOPs and brand files.
 *
 * On any thrown error, transitions status to failed before re-throwing.
 *
 * Fire-and-forget: called without await from the HTTP route handler — HTTP 202
 * is returned before this function begins executing.
 */
export async function assembleContext(
  taskRunId: number,
  clientId: number,
  channel: string,
  taskType: string,
): Promise<void> {
  try {
    // Step 1: Retrieve relevant SOPs
    const skillResponse = await searchSkills(taskType, channel, 5);

    // Step 2: Gap detection — no SOPs available for this task/channel combination
    if (skillResponse.gap) {
      console.warn(`[task-matcher] SOP gap detected for taskRunId=${taskRunId} taskType=${taskType} channel=${channel}`);
      await updateTaskRunStatus(taskRunId, 'failed');
      return;
    }

    const sopIds = skillResponse.results.map(r => r.id);

    // Step 3: Resolve client slug from brand_hub
    const clientSlug = await resolveClientSlug(clientId);

    // Step 4: Retrieve brand context if client slug resolved (keep full array for generation)
    let brandFiles: BrandHubRow[] = [];
    let brandContextId: number | null = null;
    if (clientSlug !== null) {
      brandFiles = await getBrandContext(clientSlug);
      if (brandFiles.length > 0) {
        brandContextId = brandFiles[0].id;
      }
    }

    // Step 5: Transition to generating with assembled context
    await updateTaskRunStatus(taskRunId, 'generating', { sopsUsed: sopIds, brandContextId });

    // Step 6: Generate draft with QA routing (Phase 8)
    await generateDraft(taskRunId, channel, taskType, skillResponse.results, brandFiles);

  } catch (err) {
    // On any error, mark as failed (fire-and-forget — do not mask the original error)
    updateTaskRunStatus(taskRunId, 'failed').catch(() => {});
    throw err;
  }
}
