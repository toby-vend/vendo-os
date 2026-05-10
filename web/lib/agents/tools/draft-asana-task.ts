import { z } from 'zod';
import { defineTool, modeField } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { resolveAssignee } from '../../asana/assignee.js';
import { createPrivateAsanaTask } from '../../asana/tasks.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  mode: modeField(),
  title: z.string().min(3).max(200),
  notes: z.string().optional(),
  assigneeEmail: z.string().email(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url().optional(),
});

const outputSchema = z.object({
  mode: z.enum(['dry-run', 'execute']),
  payload: z.object({
    title: z.string(),
    notes: z.string().nullable(),
    assigneeEmail: z.string(),
    dueOn: z.string(),
    sourceUrl: z.string().nullable(),
  }),
  asanaUrl: z.string().nullable(),
  error: z.string().nullable(),
});

export const draftAsanaTask = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'draftAsanaTask',
      description:
        'Draft an Asana task. In dry-run mode (default until graduated) returns the would-be payload without creating the task. Execute mode commits and returns the task URL.',
      hasSideEffect: true,
      capability: CAPABILITIES.ASANA_WRITE,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const payload = {
          title: args.title,
          notes: args.notes ?? null,
          assigneeEmail: args.assigneeEmail,
          dueOn: args.dueOn,
          sourceUrl: args.sourceUrl ?? null,
        };

        if (args.mode === 'dry-run') {
          return { mode: 'dry-run' as const, payload, asanaUrl: null, error: null };
        }

        // Execute path. Resolve the assignee's Asana gid via the live
        // /users endpoint (cached) — same helper used by the Slack
        // director-action 'add_to_asana' button. Vendo-domain emails only.
        const asanaGid = await resolveAssignee(undefined, args.assigneeEmail);
        if (!asanaGid) {
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: null,
            error: 'no_asana_gid_for_email',
          };
        }

        try {
          const gid = await createPrivateAsanaTask({
            name: args.title,
            assigneeGid: asanaGid,
            dueOn: args.dueOn,
            notes: args.notes,
          });
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: `https://app.asana.com/0/0/${gid}`,
            error: null,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            mode: 'execute' as const,
            payload,
            asanaUrl: null,
            error: message,
          };
        }
      },
    },
    ctx,
  );
