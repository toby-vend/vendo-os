/**
 * Asana hand-off triggered when a Frame.io-sourced ad copy is approved.
 *
 * Creates one task per approval — assignee = client AM (resolved via
 * resolveClientAMGid), falls back to ASANA_DEFAULT_ASSIGNEE_GID, then
 * to unassigned (with a warning). Failure here must never block the
 * approval itself; callers receive a warning instead of an exception.
 */
import { resolveClientAMGid } from '../asana/assignee.js';
import { createPrivateAsanaTask } from '../asana/tasks.js';

export interface CreateAdCopyTaskInput {
  reviewId: number;
  clientName: string;
  assetName: string;
  markdown: string;
  frameioViewUrl: string | null;
  approverEmail: string | null;
}

export interface CreateAdCopyTaskResult {
  ok: true;
  taskGid: string;
  assigneeSource: 'client_am' | 'default' | 'unassigned';
}
export interface CreateAdCopyTaskError {
  ok: false;
  reason: string;
}

/**
 * Today + 3 business days as YYYY-MM-DD. Skips Sat/Sun by adding one
 * extra calendar day each time we land on a weekend.
 */
function dueOnIn3BusinessDays(): string {
  const d = new Date();
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function buildTaskNotes(input: CreateAdCopyTaskInput): string {
  const lines: string[] = [];
  lines.push(input.markdown.trim());
  lines.push('');
  lines.push('---');
  lines.push(`Client: ${input.clientName}`);
  lines.push(`Source asset: ${input.assetName}`);
  if (input.frameioViewUrl) lines.push(`Frame.io: ${input.frameioViewUrl}`);
  if (input.approverEmail) lines.push(`Approved by: ${input.approverEmail}`);
  lines.push(`Dashboard: https://vendo-os.vercel.app/dashboards/frame-io#review-${input.reviewId}`);
  return lines.join('\n');
}

export async function createAdCopyAsanaTask(
  input: CreateAdCopyTaskInput,
): Promise<CreateAdCopyTaskResult | CreateAdCopyTaskError> {
  // Resolve assignee with fallback chain. Both calls swallow their own
  // errors so we just inspect the return value.
  let assigneeGid: string | undefined;
  let assigneeSource: 'client_am' | 'default' | 'unassigned' = 'unassigned';
  try {
    assigneeGid = await resolveClientAMGid(input.clientName);
    if (assigneeGid) assigneeSource = 'client_am';
  } catch { /* swallow */ }
  if (!assigneeGid) {
    const fallback = process.env.ASANA_DEFAULT_ASSIGNEE_GID;
    if (fallback) {
      assigneeGid = fallback;
      assigneeSource = 'default';
    }
  }

  const projects = process.env.ASANA_DEFAULT_PROJECT_GID
    ? [process.env.ASANA_DEFAULT_PROJECT_GID]
    : undefined;

  try {
    const taskGid = await createPrivateAsanaTask({
      name: `Launch Meta ad: ${input.assetName}`.slice(0, 200),
      assigneeGid,
      dueOn: dueOnIn3BusinessDays(),
      notes: buildTaskNotes(input),
      projects,
    });
    return { ok: true, taskGid, assigneeSource };
  } catch (err) {
    const reason = (err as Error).message ?? String(err);
    return { ok: false, reason };
  }
}
