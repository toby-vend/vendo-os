import type { Tool } from 'ai';
import type { ToolCtx, AgentDef } from '../types.js';
import { searchMeetings } from './search-meetings.js';
import { searchClients } from './search-clients.js';
import { getClientBriefing } from './get-client-briefing.js';
import { getClientHealth } from './get-client-health.js';
import { getClientHealthStaff } from './get-client-health-staff.js';
import { getCampaignPerformance } from './get-campaign-performance.js';
import { queryDecisions } from './query-decisions.js';
import { searchKnowledge } from './search-knowledge.js';
import { searchAsanaTasks } from './search-asana-tasks.js';
import { getTimeSpent } from './get-time-spent.js';
import { getTrafficStats } from './get-traffic-stats.js';
import { getFrameioStatus } from './get-frameio-status.js';
import { searchMeetingConcerns } from './search-meeting-concerns.js';
import { getXeroFinancials } from './get-xero-financials.js';
import { getGhlPipeline } from './get-ghl-pipeline.js';
import { getCalendarEvents } from './get-calendar-events.js';
import { draftAsanaTask } from './draft-asana-task.js';
import { draftSlackMessage } from './draft-slack-message.js';
import { draftPushNotification } from './draft-push-notification.js';
import { draftEmail } from './draft-email.js';
import { invokeAgent } from './invoke-agent.js';
import { recordGrowthFinding } from './record-growth-finding.js';

export const TOOL_FACTORIES = {
  searchMeetings,
  searchClients,
  getClientBriefing,
  getClientHealth,
  getClientHealthStaff,
  getCampaignPerformance,
  queryDecisions,
  searchKnowledge,
  searchAsanaTasks,
  getTimeSpent,
  getTrafficStats,
  getFrameioStatus,
  searchMeetingConcerns,
  getXeroFinancials,
  getGhlPipeline,
  getCalendarEvents,
  draftAsanaTask,
  draftSlackMessage,
  draftPushNotification,
  draftEmail,
  invokeAgent,
  recordGrowthFinding,
} as const;

export type ToolName = keyof typeof TOOL_FACTORIES;

/**
 * Tool names whose factories declare `hasSideEffect: true` in their
 * defineTool spec. The runtime keeps these in dry-run by default and only
 * lifts that gate when an `agent_graduations` row exists for the (agent,
 * tool) pair.
 *
 * This list is the authoritative input for the /admin/graduations matrix —
 * keep it in sync when adding new write tools. The smoke test asserts every
 * write tool registered here actually returns hasSideEffect=true at runtime,
 * so a forgotten entry will fail CI.
 */
export const WRITE_TOOL_NAMES = [
  'draftAsanaTask',
  'draftSlackMessage',
  'draftPushNotification',
  'draftEmail',
] as const satisfies readonly ToolName[];

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

/**
 * The toolset shape the runtime hands to ai SDK's `streamText({ tools })`.
 *
 * We deliberately widen each entry to `Tool<unknown, unknown>` rather than
 * the union of factory return types — the latter forces callers to satisfy
 * the *intersection* of every tool's input shape when invoking via the map.
 * Per-tool typing is preserved at the factory call site.
 */
export type AgentToolset = Record<string, Tool<unknown, unknown>>;

/**
 * Build the toolset an agent run sees. Returns a name→Tool record filtered
 * to the agent's declared tool list. Each tool is freshly instantiated with
 * the per-run ctx — tools cannot leak between runs.
 */
export function buildToolset(agent: AgentDef, ctx: ToolCtx): AgentToolset {
  const out: AgentToolset = {};
  for (const name of agent.tools) {
    const factory = TOOL_FACTORIES[name as ToolName];
    if (!factory) {
      console.warn(`[agent-tools] Unknown tool '${name}' for agent '${agent.name}'`);
      continue;
    }
    out[name] = factory(ctx) as Tool<unknown, unknown>;
  }
  return out;
}
