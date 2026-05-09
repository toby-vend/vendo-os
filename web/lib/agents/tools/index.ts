import type { Tool } from 'ai';
import type { ToolCtx, AgentDef } from '../types.js';
import { searchMeetings } from './search-meetings.js';
import { searchClients } from './search-clients.js';
import { getClientHealth } from './get-client-health.js';
import { getClientHealthStaff } from './get-client-health-staff.js';
import { getCampaignPerformance } from './get-campaign-performance.js';
import { queryDecisions } from './query-decisions.js';
import { searchKnowledge } from './search-knowledge.js';
import { draftAsanaTask } from './draft-asana-task.js';
import { draftSlackMessage } from './draft-slack-message.js';
import { draftPushNotification } from './draft-push-notification.js';
import { draftEmail } from './draft-email.js';

export const TOOL_FACTORIES = {
  searchMeetings,
  searchClients,
  getClientHealth,
  getClientHealthStaff,
  getCampaignPerformance,
  queryDecisions,
  searchKnowledge,
  draftAsanaTask,
  draftSlackMessage,
  draftPushNotification,
  draftEmail,
} as const;

export type ToolName = keyof typeof TOOL_FACTORIES;

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
