import { z } from 'zod';
import { defineTool, modeField } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { sendPushToUser } from '../../push-sender.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  mode: modeField(),
  userId: z.string(),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(400),
  url: z.string().url(),
});

const outputSchema = z.object({
  mode: z.enum(['dry-run', 'execute']),
  payload: z.object({
    userId: z.string(),
    title: z.string(),
    body: z.string(),
    url: z.string(),
  }),
  sent: z.boolean(),
});

export const draftPushNotification = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'draftPushNotification',
      description:
        "Draft a web-push notification to a user. Dry-run returns the payload; execute sends to all of the user's subscribed devices.",
      hasSideEffect: true,
      capability: CAPABILITIES.PUSH_WRITE,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const payload = {
          userId: args.userId,
          title: args.title,
          body: args.body,
          url: args.url,
        };

        if (args.mode === 'dry-run') {
          return { mode: 'dry-run' as const, payload, sent: false };
        }

        try {
          await sendPushToUser(args.userId, {
            title: args.title,
            body: args.body,
            url: args.url,
          });
          return { mode: 'execute' as const, payload, sent: true };
        } catch (err) {
          console.error('[draftPushNotification] sendPushToUser failed', err);
          return { mode: 'execute' as const, payload, sent: false };
        }
      },
    },
    ctx,
  );
