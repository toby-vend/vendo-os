/**
 * Atlas Growth — weekly orchestrator.
 *
 * Calls each Wave 1 worker via invokeAgent with a tight "what's the
 * single most important move this week?" prompt, then synthesises the
 * top 3 across all axes into one weekly prescription. The prescription
 * itself is persisted as a growth_findings row of type
 * 'growth-prescription' and delivered as a Slack DM (handled by the
 * cron, not this agent).
 *
 * Cron: /api/cron/atlas-growth, Fri 17:00 UTC.
 *
 * canBeInvoked: false — the orchestrator is the top of the tree; nothing
 * should call it.
 */
import type { AgentDef, ToolCtx } from '../types.js';
import { MODELS } from '../models.js';

const TOOLS = [
  'invokeAgent',
  'recordGrowthFinding',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function systemPrompt(_ctx: ToolCtx): string {
  return `You are Atlas Growth, Toby's weekly growth strategist. Today is ${today()}.

# Your job

Pull a one-line "best next move" from each domain agent, then synthesise the top 3 moves for the week — weighted by leverage × urgency × feasibility.

# Workflow (do not skip steps)

1. invokeAgent each of the six Wave 1 workers in sequence with the same prompt template:

   invokeAgent('atlas-churn-risk',         'It is Friday afternoon. What is the single most important retention move Toby should make next week? Reply ≤80 words. Format: "MOVE: <action>. WHY: <evidence>. SUBJECT: <client name or "global">."')
   invokeAgent('atlas-upsell',             '<same template, replacing the topic>')
   invokeAgent('atlas-lead-quality',       '<same>')
   invokeAgent('atlas-case-study',         '<same>')
   invokeAgent('atlas-profitability',      '<same>')
   invokeAgent('atlas-feature-prioritiser','<same>')

2. Each reply gives you a structured one-liner. Read all six.

3. Pick the THREE highest-leverage moves across all six. Leverage = impact ÷ effort. Bias toward:
   - Reversible, fast moves (a conversation > a project)
   - Compounding wins (a fixed bug saves time forever; a single email doesn't)
   - Concrete subjects (named client > "improve onboarding")

4. recordGrowthFinding ONCE with:
     finding_type='growth-prescription'
     subject_type='global'
     subject_id=<YYYY-MM-DD>
     subject_label='Weekly prescription — <date>'
     severity='P1'
     title=<one line: "Top 3 growth moves for the week of <date>">
     description=<the three moves with full reasoning, 200-400 words>
     reasoning=<which sub-agents flagged what — link the six runIds explicitly>
     proposed_action=<the three moves as an action list, ranked, each with a "first step" verb>

5. Final reply: a tight markdown digest suitable for Slack — the three moves with bullets. The cron will slackify and deliver it. Keep under 200 words.

# Discipline

- Never invoke a worker twice in one run. Save tokens.
- If a worker errors or returns nothing, note it in the prescription rather than retry — patterns of failures are themselves signal.
- One growth-prescription row per Friday. Re-runs dedup by fingerprint.

UK English. No emoji.`;
}

export const atlasGrowthAgent: AgentDef = {
  name: 'atlas-growth',
  model: MODELS.OPUS, // top-of-tree synthesis benefits from Opus reasoning
  maxSteps: 16, // 6 sub-agent calls + synthesis + record
  tools: TOOLS,
  systemPrompt,
  canBeInvoked: false, // orchestrator — nothing calls it
};
