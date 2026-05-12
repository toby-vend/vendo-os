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
import { atlasChurnRiskAgent } from './atlas-churn-risk.js';
import { atlasUpsellAgent } from './atlas-upsell.js';
import { atlasLeadQualityAgent } from './atlas-lead-quality.js';
import { atlasCaseStudyAgent } from './atlas-case-study.js';
import { atlasProfitabilityAgent } from './atlas-profitability.js';
import { atlasFeaturePrioritiserAgent } from './atlas-feature-prioritiser.js';
import { atlasGrowthAgent } from './atlas-growth.js';

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
  // Wave 1 growth agents — each cron-driven, each able to invoke the
  // specialists above when domain depth is needed. The orchestrator
  // (atlas-growth) invokes the six workers.
  'atlas-churn-risk': atlasChurnRiskAgent,
  'atlas-upsell': atlasUpsellAgent,
  'atlas-lead-quality': atlasLeadQualityAgent,
  'atlas-case-study': atlasCaseStudyAgent,
  'atlas-profitability': atlasProfitabilityAgent,
  'atlas-feature-prioritiser': atlasFeaturePrioritiserAgent,
  'atlas-growth': atlasGrowthAgent,
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
 * for the requesting user.
 *
 * Access rules:
 *   - 'atlas'   → delegates to getAgentForUser (tier router)
 *   - specialist → returned if user is admin OR has the matching
 *     '/chat/<slug>' route permission (e.g. 'chat-am' for atlas-am).
 *     Falls back to atlas-staff otherwise so the caller still gets *some*
 *     reply rather than a dead-end 403.
 *   - other registered name (atlas-staff, atlas-brief, atlas-monitor) →
 *     returned verbatim for cron / system callers.
 *   - unknown → null.
 *   - client-role users → always null (client portal is a different
 *     surface entirely).
 *
 * Tool-level capability gates still apply, so a non-admin user routed to
 * a specialist will only get the tool answers their channels grant them
 * — e.g. they'll see meeting data but get permission_denied on
 * getXeroFinancials. That's the intended graceful degradation.
 */

// Mirror routes/admin/permissions.ts ROUTE_SLUGS — each specialist's
// route slug, used to check user.allowedRoutes for non-admins.
const SPECIALIST_ROUTE_SLUGS: Record<string, string> = {
  'atlas-am': 'chat-am',
  'atlas-paid-social': 'chat-paid-social',
  'atlas-paid-search': 'chat-paid-search',
  'atlas-creative': 'chat-creative',
  'atlas-seo': 'chat-seo',
};

export function resolveAgentByName(
  name: string,
  user: SessionUser,
): AgentDef | null {
  if (user.role === 'client') return null;

  // Default → tier router
  if (name === 'atlas') return getAgentForUser(user);

  // Specialist → admin OR explicit route grant; otherwise atlas-staff fallback
  if (SPECIALIST_AGENTS.has(name)) {
    if (user.role === 'admin') return AGENTS[name] ?? null;
    const slug = SPECIALIST_ROUTE_SLUGS[name];
    if (slug && user.allowedRoutes.includes(slug)) return AGENTS[name] ?? null;
    return atlasStaffAgent;
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
  atlasChurnRiskAgent,
  atlasUpsellAgent,
  atlasLeadQualityAgent,
  atlasCaseStudyAgent,
  atlasProfitabilityAgent,
  atlasFeaturePrioritiserAgent,
  atlasGrowthAgent,
};
