/**
 * Capability-based permission helpers and graduation lookup.
 *
 * Capabilities are slugs (e.g. 'meetings:read', 'asana:write') held by users
 * via either SessionUser.channels or SessionUser.allowedRoutes — both arrays
 * are checked. The same set is consulted by defineTool's permission gate.
 *
 * Graduations are per (agent, tool_name) flags persisted in agent_graduations.
 * When a row exists, the agent runtime is permitted to call the tool with
 * mode='execute'; when it does not, mode is structurally coerced to
 * 'dry-run' regardless of what the model requested.
 */
import { db } from '../queries/base.js';
import type { SessionUser } from '../auth.js';

// ---------------------------------------------------------------------------
// Capability slugs registered in the agent runtime. Adding a new slug here is
// a deliberate act — every tool's `capability` must be one of these so that
// permission audits are predictable.
// ---------------------------------------------------------------------------

export const CAPABILITIES = {
  // reads
  MEETINGS_READ: 'meetings:read',
  CLIENTS_READ: 'clients:read',
  CAMPAIGNS_READ: 'campaigns:read',
  HEALTH_READ: 'health:read',
  DECISIONS_READ: 'decisions:read',
  KNOWLEDGE_READ: 'knowledge:read',
  ASANA_READ: 'asana:read',
  TIME_READ: 'time:read',
  TRAFFIC_READ: 'traffic:read',
  FRAMEIO_READ: 'frameio:read',
  CONCERNS_READ: 'concerns:read',
  XERO_READ: 'xero:read',
  GHL_READ: 'ghl:read',
  CALENDAR_READ: 'calendar:read',
  // agent orchestration — delegating to another agent via invokeAgent
  AGENTS_INVOKE: 'agents:invoke',
  // writes (always start dry-run-only — graduation is the only path to execute)
  ASANA_WRITE: 'asana:write',
  SLACK_WRITE: 'slack:write',
  PUSH_WRITE: 'push:write',
  EMAIL_WRITE: 'email:write',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// ---------------------------------------------------------------------------
// Route slug → implied read capabilities.
//
// The /admin/permissions matrix grants ROUTE slugs (e.g. 'clients'), not
// capability slugs (e.g. 'clients:read') — nothing in the admin UI ever
// hands out a capability directly, so without this mapping every non-admin
// hit `permission_denied` on every agent tool. A user who can already open
// a page is allowed to read the same data through chat.
//
// Deliberately NOT derivable from routes: decisions:read, xero:read
// (financial/strategic — admin-only) and every write capability (writes
// stay admin-only; graduation then governs dry-run vs execute).
// ---------------------------------------------------------------------------

const ROUTE_CAPABILITY_GRANTS: Record<string, Capability[]> = {
  clients: [CAPABILITIES.CLIENTS_READ, CAPABILITIES.HEALTH_READ, CAPABILITIES.KNOWLEDGE_READ],
  meetings: [CAPABILITIES.MEETINGS_READ, CAPABILITIES.CONCERNS_READ],
  ads: [CAPABILITIES.CAMPAIGNS_READ],
  dashboards: [CAPABILITIES.CAMPAIGNS_READ, CAPABILITIES.TRAFFIC_READ],
  reports: [CAPABILITIES.CAMPAIGNS_READ, CAPABILITIES.TRAFFIC_READ],
  'action-items': [CAPABILITIES.ASANA_READ],
  'asana-tasks': [CAPABILITIES.ASANA_READ],
  'time-tracking': [CAPABILITIES.TIME_READ],
  capacity: [CAPABILITIES.TIME_READ],
  'video-production': [CAPABILITIES.FRAMEIO_READ],
  pipeline: [CAPABILITIES.GHL_READ],
};

export function capabilitiesForRoutes(routeSlugs: string[]): Set<string> {
  const caps = new Set<string>();
  for (const slug of routeSlugs) {
    for (const cap of ROUTE_CAPABILITY_GRANTS[slug] ?? []) caps.add(cap);
    // Any chat variant (chat, chat-am, chat-paid-social…) implies the user
    // may talk to agents, which delegate to sub-agents and read the user's
    // own calendar.
    if (slug === 'chat' || slug.startsWith('chat-')) {
      caps.add(CAPABILITIES.AGENTS_INVOKE);
      caps.add(CAPABILITIES.CALENDAR_READ);
    }
  }
  return caps;
}

// ---------------------------------------------------------------------------
// Capability check — used by defineTool's permission gate.
// ---------------------------------------------------------------------------

export function hasCapability(user: SessionUser, capability: string): boolean {
  // Admins have every capability. Writes still default to dry-run via the
  // graduation gate, so this only widens what admins can DRAFT, not what
  // they can EXECUTE without approval.
  if (user.role === 'admin') return true;
  // Explicit capability slugs (a channel or override named e.g.
  // 'clients:read') are honoured as-is…
  if (
    user.channels.includes(capability) ||
    user.allowedRoutes.includes(capability)
  ) {
    return true;
  }
  // …otherwise derive read capabilities from the route slugs the user holds.
  return capabilitiesForRoutes(user.allowedRoutes).has(capability);
}

// ---------------------------------------------------------------------------
// Graduation lookup — returns the set of tool names the given agent may
// invoke in execute mode. Until a row exists in agent_graduations, the
// runtime forces dry-run.
// ---------------------------------------------------------------------------

export async function loadGraduations(agent: string): Promise<Set<string>> {
  const result = await db.execute({
    sql: `SELECT tool_name FROM agent_graduations WHERE agent = ?`,
    args: [agent],
  });
  return new Set(result.rows.map(r => String(r.tool_name)));
}

// ---------------------------------------------------------------------------
// Full graduation list — every (agent, tool) pair currently graduated, with
// audit metadata. Used by the /admin/graduations matrix view and any audit
// surface that needs the full picture (rather than a per-agent slice).
// ---------------------------------------------------------------------------

export interface GraduationView {
  agent: string;
  toolName: string;
  graduatedAt: string;
  graduatedBy: string;
  notes: string | null;
}

export async function listGraduations(): Promise<GraduationView[]> {
  const result = await db.execute({
    sql: `SELECT agent, tool_name, graduated_at, graduated_by, notes
            FROM agent_graduations
           ORDER BY agent, tool_name`,
    args: [],
  });
  return result.rows.map(r => ({
    agent: String(r.agent),
    toolName: String(r.tool_name),
    graduatedAt: String(r.graduated_at),
    graduatedBy: String(r.graduated_by),
    notes: r.notes == null ? null : String(r.notes),
  }));
}

// ---------------------------------------------------------------------------
// Admin grant / revoke — used by the graduation flow on /decisions/dashboard.
// Each grant is recorded with the operator email + optional notes for audit.
// ---------------------------------------------------------------------------

export async function graduate(opts: {
  agent: string;
  toolName: string;
  graduatedBy: string;
  notes?: string;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO agent_graduations (agent, tool_name, graduated_by, notes)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(agent, tool_name) DO UPDATE SET
            graduated_at = datetime('now'),
            graduated_by = excluded.graduated_by,
            notes = excluded.notes`,
    args: [opts.agent, opts.toolName, opts.graduatedBy, opts.notes ?? null],
  });
}

export async function revokeGraduation(
  agent: string,
  toolName: string,
): Promise<void> {
  await db.execute({
    sql: `DELETE FROM agent_graduations WHERE agent = ? AND tool_name = ?`,
    args: [agent, toolName],
  });
}
