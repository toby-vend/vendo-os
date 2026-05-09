import { z } from 'zod';
import { defineTool, modeField } from './_tool';
import { CAPABILITIES } from '../permissions';
import type { ToolCtx } from '../types';

// No execute path is possible — there is no SMTP / SES / mail provider
// configured in this codebase yet. The tool always returns dry-run regardless
// of the requested mode, with note='email-not-configured', so the model can
// compose drafts for human approval until a sender is wired in.

const inputSchema = z.object({
  mode: modeField(),
  to: z.string().email(),
  subject: z.string().min(2).max(200),
  body: z.string().min(2).max(8000),
  cc: z.array(z.string().email()).optional(),
});

const outputSchema = z.object({
  mode: z.literal('dry-run'),
  payload: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    cc: z.array(z.string()).nullable(),
  }),
  note: z.literal('email-not-configured'),
});

export const draftEmail = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'draftEmail',
      description:
        'Draft an email to a recipient. Email sending is not yet wired in this codebase — this tool always returns dry-run payloads. Use it to compose drafts for human approval.',
      hasSideEffect: true,
      capability: CAPABILITIES.EMAIL_WRITE,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        return {
          mode: 'dry-run' as const,
          payload: {
            to: args.to,
            subject: args.subject,
            body: args.body,
            cc: args.cc ?? null,
          },
          note: 'email-not-configured' as const,
        };
      },
    },
    ctx,
  );
