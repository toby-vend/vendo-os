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
import { atlasBriefAgent } from './atlas-brief.js';
import { atlasMonitorAgent } from './atlas-monitor.js';
import { atlasAmAgent } from './atlas-am.js';
import { atlasPaidSocialAgent } from './atlas-paid-social.js';
import { atlasPaidSearchAgent } from './atlas-paid-search.js';
import { atlasCreativeAgent } from './atlas-creative.js';
import { atlasSeoAgent } from './atlas-seo.js';

const AGENTS: Record<string, AgentDef> = {
  atlas: atlasAgent,
  'atlas-staff': atlasStaffAgent,
  'atlas-brief': atlasBriefAgent,
  'atlas-monitor': atlasMonitorAgent,
  'atlas-am': atlasAmAgent,
  'atlas-paid-social': atlasPaidSocialAgent,
  'atlas-paid-search': atlasPaidSearchAgent,
  'atlas-creative': atlasCreativeAgent,
  'atlas-seo': atlasSeoAgent,
};

// Specialist names that need admin tier to use (they touch financial /
// strategy data via getClientHealth / getCampaignPerformance). Staff
// who try to invoke a specialist fall back to atlas-staff so they
// always get *some* answer.
export const SPECIALIST_AGENTS = new Set([
  'atlas-am',
  'atlas-paid-social',
  'atlas-paid-search',
  'atlas-creative',
  'atlas-seo',
]);

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

/**
 * Resolve a named specialist agent (e.g. 'atlas-am', 'atlas-paid-social')
 * for the requesting user. Returns the specialist when:
 *   - The user is admin (specialists are admin-only at v1)
 *   - The name is a registered specialist
 *
 * For 'atlas' (the default) this delegates to getAgentForUser so the
 * tier router still applies.
 *
 * For unknown names, returns null. For non-admin users requesting a
 * specialist, falls back to atlas-staff (so they get *something*
 * rather than a dead-end 403).
 *
 * Client-role users always get null regardless of name (client portal
 * uses a different surface entirely).
 */
export function resolveAgentByName(
  name: string,
  user: SessionUser,
): AgentDef | null {
  if (user.role === 'client') return null;

  // Default → tier router
  if (name === 'atlas') return getAgentForUser(user);

  // Specialist → admin-only; non-admins fall back to atlas-staff
  if (SPECIALIST_AGENTS.has(name)) {
    if (user.role !== 'admin') return atlasStaffAgent;
    return AGENTS[name] ?? null;
  }

  // Any other registered name (atlas-staff, atlas-brief, atlas-monitor)
  // is allowed through verbatim — used by cron / system contexts.
  return AGENTS[name] ?? null;
}

// Direct re-exports for callers that prefer named imports.
export {
  atlasAgent,
  atlasStaffAgent,
  atlasBriefAgent,
  atlasMonitorAgent,
  atlasAmAgent,
  atlasPaidSocialAgent,
  atlasPaidSearchAgent,
  atlasCreativeAgent,
  atlasSeoAgent,
};
