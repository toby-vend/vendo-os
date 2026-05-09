/**
 * Agents registry — single import surface for the runtime, channel
 * adapters, and route handlers.
 *
 *   import { getAgent } from '../agents/index.js';
 *   const atlas = getAgent('atlas');
 *
 * Phase 2 workflow agents (Daily Brief, Monitor, Concern, etc.) and
 * Phase 3 specialists (AM, Creative, Finance, Performance) plug in here
 * as they're built. Adding an agent is two lines: import + entry in
 * AGENTS.
 */
import type { AgentDef } from '../types.js';
import type { SessionUser } from '../../auth.js';
import { atlasAgent } from './atlas.js';
import { atlasStaffAgent } from './atlas-staff.js';

const AGENTS: Record<string, AgentDef> = {
  atlas: atlasAgent,
  'atlas-staff': atlasStaffAgent,
};

export type AgentName = keyof typeof AGENTS;

export function getAgent(name: string): AgentDef | null {
  return AGENTS[name] ?? null;
}

export function listAgents(): string[] {
  return Object.keys(AGENTS);
}

/**
 * Tier router — picks the right Atlas variant for a logged-in user.
 *
 *   role === 'admin'    → atlasAgent (full toolset, sees finance + decisions)
 *   role === 'standard' → atlasStaffAgent (no finance, no decisions)
 *   role === 'client'   → null (client-portal users don't get Atlas)
 *
 * The user-facing brand is "Atlas" in both tiers; only the tool list
 * and system prompt differ.
 */
export function getAgentForUser(user: SessionUser): AgentDef | null {
  if (user.role === 'admin') return atlasAgent;
  if (user.role === 'client') return null;
  return atlasStaffAgent;
}

// Direct re-exports for callers that prefer named imports.
export { atlasAgent, atlasStaffAgent };
