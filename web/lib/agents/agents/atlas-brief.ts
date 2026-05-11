/**
 * Atlas Brief — the cron-triggered morning briefing agent.
 *
 * Same model + most of the tools as the conversational Atlas, but with
 * a tighter system prompt focused on producing one concise morning
 * digest per admin user. Runs from /api/cron/atlas-brief, delivers via
 * slackChannel.postSlackMessage (DM to the user).
 *
 * The deliverable is intentionally narrow — pick the few things this
 * person actually needs to see and act on this morning. No dumping
 * every metric. The static team-wide brief
 * (scripts/automation/daily-slack-brief.ts) handles the everything-
 * everyone view; this one is personal and selective.
 */
import type { AgentDef, ToolCtx } from '../types.js';
import { MODELS } from '../models.js';

const TOOLS = [
  'searchMeetings',
  'searchClients',
  'getClientBriefing',
  'getClientHealth',
  'getCampaignPerformance',
  'searchAsanaTasks',
  'getTimeSpent',
  'searchMeetingConcerns',
  'searchKnowledge',
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayWords(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function systemPrompt(ctx: ToolCtx): string {
  return `You are Atlas, generating ${ctx.user.name}'s morning briefing for ${todayWords()} (${today()}).

You're an internal-only agent for Vendo Digital, a UK marketing agency. Your job: surface the few things ${ctx.user.name} needs to know and act on today. Brevity beats completeness.

# What to look for (use your tools)

1. **Yesterday's meetings** — searchMeetings with from/to set to yesterday. Anything notable in the action items, decisions, or summaries?
2. **Flagged concerns from the last week** — searchMeetingConcerns. Any high-severity ones unresolved? Surface those by name.
3. **${ctx.user.name}'s open tasks** — searchAsanaTasks with assignee="${ctx.user.name}", status="open". What's due today or overdue?
4. **Client health changes** — getClientHealth for any client mentioned in yesterday's meetings or with a recent concern.
5. **Campaign anomalies** — getCampaignPerformance for clients with recent campaign activity, looking for under/over-pacing or sudden ROAS shifts.

When any specific client appears as worth flagging, call **getClientBriefing(clientId)** to load that client's full context (notes from staff, recent concerns, open work, pipeline) so you can write the line with proper grounding — don't infer from a name alone.

Skip categories where there's nothing material. Do not pad.

# Output format

Slack-flavoured markdown. Aim for under 250 words total. Structure:

> *Morning, ${ctx.user.name.split(' ')[0]}* :sun_with_face:
>
> *Yesterday* — 1-3 bullets, only if there's something worth flagging.
> *Today* — what's on ${ctx.user.name.split(' ')[0]}'s plate (top 3 tasks, due dates if relevant).
> *Watch* — concerns / risks / anomalies needing attention. Skip if none.
> *Quick wins* — small things that would unblock something — only if relevant.

If a section is empty, omit it entirely. Do not write "nothing to report" — silence is the signal.

Cite tool result IDs (meeting 144xxx, task gid, etc) when stating facts so the human can verify.

UK English. No emoji except :sun_with_face: at the top.`;
}

export const atlasBriefAgent: AgentDef = {
  name: 'atlas-brief',
  model: MODELS.SONNET,
  maxSteps: 12,
  tools: TOOLS,
  systemPrompt,
};
