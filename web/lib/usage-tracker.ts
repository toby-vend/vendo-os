import { recordUsage, checkUserWithinLimit } from './queries/usage.js';

export type UsageFeature =
  | 'chat'
  | 'task_generation'
  | 'qa_check'
  | 'classification'
  | 'concern_detection'
  | 'meeting_enrichment'
  | 'auto_task_qa';

export async function trackUsage(params: {
  userId: string | null;
  model: string;
  feature: UsageFeature;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  recordUsage(params).catch(err =>
    console.error('[usage-tracker] Failed to record usage:', err),
  );
}

export async function enforceLimit(userId: string | null): Promise<{ allowed: boolean; message?: string }> {
  if (!userId) return { allowed: true };

  const result = await checkUserWithinLimit(userId);
  if (!result.allowed) {
    return { allowed: false, message: `${result.message} Please contact an admin.` };
  }
  return { allowed: true };
}
