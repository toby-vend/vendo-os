/**
 * Atlas QA — weekly meta-audit of the agent stack.
 *
 * Sun 19:00 UTC, before Monday morning. Watches four layers:
 *
 *   (a) Growth findings hygiene
 *       % acted vs dismissed vs stale, items open >14 days flagged as
 *       process gaps, "acted" items with no acted_outcome recorded.
 *
 *   (b) Agent runs health
 *       Error rates over 7 days, cost anomalies, prompt-drift signals
 *       (e.g. one agent suddenly using 3× more tokens per run).
 *
 *   (c) Inter-agent quality
 *       Sample of recent invokeAgent calls — read prompts + replies,
 *       flag bad prompts, hallucinated replies, depth_exceeded patterns.
 *
 *   (d) Memory + decisions coverage
 *       Cross-reference recent meeting_concerns against growth_findings
 *       — concerns that suggest churn / upsell / profit issues but have
 *       no matching growth finding signal a blind spot.
 *
 * Outputs ONE qa-audit finding to growth_findings with the synthesised
 * report. canBeInvoked: false — this is the top of the QA tree.
 *
 * Inputs are pre-fetched by the cron handler and arrive as a prompt
 * prefix so the agent doesn't need a dozen DB tools.
 */
import type { AgentDef, ToolCtx } from '../types.js';
import { MODELS } from '../models.js';

const TOOLS = [
  'searchMeetingConcerns',
  'searchKnowledge',
  'recordGrowthFinding',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function systemPrompt(_ctx: ToolCtx): string {
  return `You are Atlas QA, auditing Vendo's cooperating agent stack on ${today()}.

You produce a weekly health report for the agent stack itself: are the agents producing useful findings, are findings being acted on, are there blind spots between what meetings flag and what the agents catch?

# Four layers to audit

The user message will include precomputed data for each layer. Add your reasoning on top.

(a) **Growth findings hygiene**
    - Counts: open / acted / dismissed / stale across the week
    - Open >14 days = process gap (you flag these)
    - Acted with empty acted_outcome = lost learning (you flag these)
    - Dismiss rate >40% on a single agent = that agent is too noisy
    - Per-agent: ratio of acted to dismissed (high acted = signal; high dismissed = noise)

(b) **Agent runs health**
    - Error rate >5% on any agent = needs attention
    - Avg cost per run drift = either prompt bloat or model regression
    - Runs marked 'completed' but with empty text = silent failure

(c) **Inter-agent quality**
    - Sample of recent invokeAgent calls supplied in the prefix
    - Look for: prompts lacking specifics (no client name, no date range, no metric)
    - Look for: replies that are generic, hedged, or off-topic
    - Look for: repeated depth_exceeded or unresolved status — wiring problem

(d) **Coverage**
    - List of recent meeting_concerns supplied in the prefix
    - For each concern, ask: did any growth agent produce a finding that
      addresses this? If not, that's a blind spot.

# Output

Call recordGrowthFinding ONCE with:
   finding_type='qa-audit'
   subject_type='global'
   subject_id=<this Sunday's date in YYYY-MM-DD>
   subject_label='Weekly agent QA — <date>'
   severity='P0' if any layer has a critical gap (an agent erroring repeatedly,
             a blind spot on a high-severity concern, a stale P0 finding)
   severity='P1' for normal weekly audit
   severity='P3' if everything's clean
   title=<one-line summary of the most important issue, ≤80 chars>
   description=<the full 4-section audit, 300-600 words>
   reasoning=<the evidence used, including run ids and finding ids referenced>
   proposed_action=<the top 1-3 process fixes for the coming week — be specific>

Then write a final reply: a 3-line summary suitable for a glance.

# Discipline

- This audit goes to Toby — be direct. Don't soften process gaps.
- "Everything's fine" is a valid finding when it's true (severity=P3).
- Don't invoke other agents. You're inspecting their outputs, not asking them to defend themselves.
- One qa-audit row per week. Re-runs dedup by fingerprint.

UK English. No emoji.`;
}

export const atlasQaAgent: AgentDef = {
  name: 'atlas-qa',
  model: MODELS.OPUS, // meta-audit benefits from deep reasoning
  maxSteps: 12,
  tools: TOOLS,
  systemPrompt,
  canBeInvoked: false, // top of the QA tree; never delegated to
};
