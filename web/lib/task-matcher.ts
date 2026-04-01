import { searchSkills } from './queries/drive.js';
import { getBrandContext } from './queries/brand.js';
import { updateTaskRunStatus } from './queries/task-runs.js';
import { scalar } from './queries/base.js';

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
 * Assemble the context for a task run.
 *
 * Steps:
 *   1. Call searchSkills(taskType, channel, 5)
 *   2. If gap=true, mark task_run as failed and return early.
 *   3. Resolve clientSlug via brand_hub.
 *   4. If clientSlug found, call getBrandContext(clientSlug) and take first result's id.
 *   5. Update task_run to status=generating with sops_used and brand_context_id.
 *
 * On any thrown error, transitions status to failed before re-throwing.
 *
 * Does NOT call the Anthropic SDK — that is Phase 7.
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

    // Step 4: Retrieve brand context if client slug resolved
    let brandContextId: number | null = null;
    if (clientSlug !== null) {
      const brandFiles = await getBrandContext(clientSlug);
      if (brandFiles.length > 0) {
        brandContextId = brandFiles[0].id;
      }
    }

    // Step 5: Transition to generating with assembled context
    await updateTaskRunStatus(taskRunId, 'generating', { sopsUsed: sopIds, brandContextId });
  } catch (err) {
    // On any error, mark as failed (fire-and-forget — do not mask the original error)
    updateTaskRunStatus(taskRunId, 'failed').catch(() => {});
    throw err;
  }
}
