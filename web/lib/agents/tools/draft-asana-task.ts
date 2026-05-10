import { z } from 'zod';
import { defineTool, modeField } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { resolveAssignee } from '../../asana/assignee.js';
import { createPrivateAsanaTask } from '../../asana/tasks.js';
import { getAsanaProjectForClient } from '../../jobs/sync-actions-to-asana.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  mode: modeField(),
  title: z.string().min(3).max(200),
  notes: z.string().optional(),
  assigneeEmail: z.string().email(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url().optional(),
  // Optional client name. When supplied the task is added to that
  // client's Asana project board (resolved via client_source_mappings).
  // When omitted the task stays private in the assignee's My Tasks —
  // appropriate for internal/personal follow-ups.
  client: z.string().optional(),
});

const outputSchema = z.object({
  mode: z.enum(['dry-run', 'execute']),
  payload: z.object({
    title: z.string(),
    notes: z.string().nullable(),
    assigneeEmail: z.string(),
    dueOn: z.string(),
    sourceUrl: z.string().nullable(),
    client: z.string().nullable(),
  }),
  asanaUrl: z.string().nullable(),
  // Resolved project gid attached to the task — null if no client was
  // provided or if the client name didn't resolve to a project mapping.
  projectGid: z.string().nullable(),
  error: z.string().nullable(),
});

export const draftAsanaTask = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'draftAsanaTask',
      description:
        "Draft an Asana task. Pass `client` with the exact client name when the task belongs in a client's project (use searchClients first if unsure of the spelling). Without `client` the task lands in the assignee's My Tasks (private). In dry-run mode returns the would-be payload; execute mode commits and returns the task URL.",
      hasSideEffect: true,
      capability: CAPABILITIES.ASANA_WRITE,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        // Resolve client → project gid up-front so dry-run drafts also
        // surface the mapping (or its absence) for human review.
        let projectGid: string | null = null;
        if (args.client) {
          const resolved = await getAsanaProjectForClient(args.client);
          projectGid = resolved ?? null;
        }

        const payload = {
          title: args.title,
          notes: args.notes ?? null,
          assigneeEmail: args.assigneeEmail,
          dueOn: args.dueOn,
          sourceUrl: args.sourceUrl ?? null,
          client: args.client ?? null,
        };

        if (args.mode === 'dry-run') {
          return {
            mode: 'dry-run' as const,
            payload,
            asanaUrl: null,
            projectGid,
            error: args.client && !projectGid ? 'client_not_mapped_to_asana_project' : null,
          };
        }

        // Execute path. If a client was specified but didn't resolve,
        // refuse to create rather than silently fall back to private —
        // the user expected it in that client's project.
        if (args.client && !projectGid) {
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: null,
            projectGid: null,
            error: `client_not_mapped_to_asana_project: ${args.client}`,
          };
        }

        // Resolve the assignee's Asana gid via the live /users endpoint
        // (cached). Vendo-domain emails only.
        const asanaGid = await resolveAssignee(undefined, args.assigneeEmail);
        if (!asanaGid) {
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: null,
            projectGid,
            error: 'no_asana_gid_for_email',
          };
        }

        try {
          const gid = await createPrivateAsanaTask({
            name: args.title,
            assigneeGid: asanaGid,
            dueOn: args.dueOn,
            notes: args.notes,
            projects: projectGid ? [projectGid] : undefined,
          });
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: `https://app.asana.com/0/0/${gid}`,
            projectGid,
            error: null,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: null,
            projectGid,
            error: message,
          };
        }
      },
    },
    ctx,
  );
