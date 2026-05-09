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
  // writes (always start dry-run-only — graduation is the only path to execute)
  ASANA_WRITE: 'asana:write',
  SLACK_WRITE: 'slack:write',
  PUSH_WRITE: 'push:write',
  EMAIL_WRITE: 'email:write',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// ---------------------------------------------------------------------------
// Capability check — used by defineTool's permission gate.
// ---------------------------------------------------------------------------

export function hasCapability(user: SessionUser, capability: string): boolean {
  // Admins have every capability. Writes still default to dry-run via the
  // graduation gate, so this only widens what admins can DRAFT, not what
  // they can EXECUTE without approval.
  if (user.role === 'admin') return true;
  return (
    user.channels.includes(capability) ||
    user.allowedRoutes.includes(capability)
  );
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
