/**
 * Agents registry — single import surface for the runtime, channel
 * adapters, and route handlers.
 *
 *   import { getAgent } from '../agents';
 *   const atlas = getAgent('atlas');
 *
 * Phase 2 workflow agents (Daily Brief, Monitor, Concern, etc.) and
 * Phase 3 specialists (AM, Creative, Finance, Performance) plug in here
 * as they're built. Adding an agent is two lines: import + entry in
 * AGENTS.
 */
import type { AgentDef } from '../types';
import { atlasAgent } from './atlas';

const AGENTS: Record<string, AgentDef> = {
  atlas: atlasAgent,
};

export type AgentName = keyof typeof AGENTS;

export function getAgent(name: string): AgentDef | null {
  return AGENTS[name] ?? null;
}

export function listAgents(): string[] {
  return Object.keys(AGENTS);
}

// Direct re-exports for callers that prefer named imports.
export { atlasAgent };
