import { z } from 'zod';
import { defineTool, modeField } from './_tool';
import { CAPABILITIES } from '../permissions';
import { dmTobyFailsafe } from '../../classification/slack';
import type { ToolCtx } from '../types';

const inputSchema = z.object({
  mode: modeField(),
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(2000),
  linkUrl: z.string().url().optional(),
});

const outputSchema = z.object({
  mode: z.enum(['dry-run', 'execute']),
  payload: z.object({
    title: z.string(),
    body: z.string(),
    linkUrl: z.string().nullable(),
  }),
  posted: z.boolean(),
});

export const draftSlackMessage = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'draftSlackMessage',
      description:
        'Draft a Slack message to a known channel or user. In dry-run mode (default until graduated) returns the would-be payload. Execute mode posts and returns ok=true.',
      hasSideEffect: true,
      capability: CAPABILITIES.SLACK_WRITE,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const payload = {
          title: args.title,
          body: args.body,
          linkUrl: args.linkUrl ?? null,
        };

        if (args.mode === 'dry-run') {
          return { mode: 'dry-run' as const, payload, posted: false };
        }

        // v1 routing: deliberately narrow — DM Toby via the existing
        // fail-safe webhook. Phase 1's new Slack App will replace this with
        // richer channel/user routing.
        const ok = await dmTobyFailsafe({
          meetingTitle: args.title,
          meetingUrl: args.linkUrl ?? null,
          reason: args.body,
        });

        return { mode: 'execute' as const, payload, posted: ok };
      },
    },
    ctx,
  );
