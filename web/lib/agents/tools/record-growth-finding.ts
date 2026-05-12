/**
 * recordGrowthFinding — the write tool every cooperating growth agent
 * (atlas-churn-risk, atlas-upsell, atlas-lead-quality, atlas-case-study,
 * atlas-profitability, atlas-feature-prioritiser, atlas-growth) uses to
 * persist a finding into growth_findings.
 *
 * hasSideEffect: false — the side effect is internal-only (a row in our
 * own DB, not an external system like Asana / Slack / Email). That
 * means it doesn't need graduation; agents can execute directly. The
 * /inbox approval flow is the right gate for external writes; for
 * internal findings the /admin/growth dashboard is the gate.
 *
 * Output gives the agent the persisted row id + fingerprint so it can
 * reference the finding in its final reply.
 */
import { defineTool, z } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { upsertGrowthFinding } from '../../growth/findings-store.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  finding_type: z.enum([
    'churn-risk',
    'upsell',
    'lead-score',
    'profit-alert',
    'feature-priority',
    'case-study-candidate',
    'growth-prescription',
    'qa-audit',
  ]),
  subject_type: z.enum(['client', 'lead', 'feature', 'global']).nullable(),
  subject_id: z
    .string()
    .nullable()
    .describe('Stable id (clients.id, opportunity id, feature slug). Required for dedup across runs.'),
  subject_label: z
    .string()
    .nullable()
    .describe('Display string — client name, lead name, feature title.'),
  severity: z.enum(['P0', 'P1', 'P2', 'P3']),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).nullable(),
  reasoning: z
    .string()
    .max(4000)
    .nullable()
    .describe('Evidence + specialist excerpts. Include sub-agent run ids if invoked.'),
  proposed_action: z
    .string()
    .max(4000)
    .nullable()
    .describe('Concrete next step: draft email, call script, internal note.'),
});

const outputSchema = z.object({
  id: z.number(),
  fingerprint: z.string(),
  outcome: z.enum(['new', 'persisting', 'suppressed']),
  url: z.string(),
});

export const recordGrowthFinding = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'recordGrowthFinding',
      description:
        'Persist a structured growth finding to the /admin/growth dashboard. Use this to record ' +
        'each insight your run produces — one finding per (subject, type) so the dashboard dedups. ' +
        'Returns the row id and a URL you can include in your final reply.',
      hasSideEffect: false,
      capability: CAPABILITIES.AGENTS_INVOKE,
      input: inputSchema,
      output: outputSchema,
      run: async (args, ctx) => {
        const outcome = await upsertGrowthFinding({
          agent: ctx.agent,
          finding_type: args.finding_type,
          subject_type: args.subject_type,
          subject_id: args.subject_id,
          subject_label: args.subject_label,
          severity: args.severity,
          title: args.title,
          description: args.description,
          reasoning: args.reasoning,
          proposed_action: args.proposed_action,
          run_id: ctx.runId,
        });
        return {
          id: outcome.id,
          fingerprint: outcome.fingerprint,
          outcome: outcome.status,
          url: `/admin/growth/${outcome.id}`,
        };
      },
    },
    ctx,
  );
