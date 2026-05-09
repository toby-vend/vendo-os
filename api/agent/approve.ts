/**
 * /api/agent/approve — approve / edit / reject a pending recommendation.
 *
 * POST { recId, decision, editDiff? }
 *   decision ∈ 'approved' | 'rejected' | 'edited'
 *   editDiff (optional, with 'edited') — the user's tweaks to the payload
 *
 * On approval the runtime re-runs the underlying tool in execute mode
 * (graduation-bypassed for this single call — the user is the gate). The
 * tool result is stored in agent_recommendations.execute_result via
 * markExecuted().
 *
 * Auth: same vendo_session JWT pattern as /api/agent/chat. Only the
 * recommendation's owning user_id may approve it; admins may approve
 * anyone's. (Admin override left for Phase 2 once we have a clear
 * audit case for it.)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseCookies, verifySessionToken } from '../../web/lib/auth';
import { getUserById } from '../../web/lib/queries/auth';
import {
  getById,
  decide,
  markExecuted,
} from '../../web/lib/agents/recommendations';
import { TOOL_FACTORIES, type ToolName } from '../../web/lib/agents/tools';
import { atlasAgent } from '../../web/lib/agents/agents';
import type { ChannelName, ToolCtx } from '../../web/lib/agents/types';
import type { SessionUser } from '../../web/lib/auth';

interface ApproveBody {
  recId: string;
  decision: 'approved' | 'rejected' | 'edited';
  editDiff?: Record<string, unknown>;
  /** Optional patched payload for 'edited' — fields override the original. */
  payload?: Record<string, unknown>;
}

function userRowToSessionUser(row: {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'standard' | 'client';
  must_change_password: number;
}): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
    channels: [],
    allowedRoutes: [],
    googleConnected: false,
    clientId: null,
    clientName: null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // -- Auth ----------------------------------------------------------------
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['vendo_session'];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const userRow = await getUserById(payload.userId);
  if (!userRow) {
    res.status(401).json({ error: 'Session user no longer exists' });
    return;
  }
  const user = userRowToSessionUser(userRow);

  // -- Body ----------------------------------------------------------------
  const body = (req.body ?? {}) as ApproveBody;
  if (!body.recId || !['approved', 'rejected', 'edited'].includes(body.decision)) {
    res.status(400).json({ error: 'recId and decision required' });
    return;
  }

  // -- Load + ownership check ---------------------------------------------
  const rec = await getById(body.recId);
  if (!rec) {
    res.status(404).json({ error: 'recommendation not found' });
    return;
  }
  if (rec.status !== 'pending') {
    res.status(409).json({ error: `recommendation already ${rec.status}` });
    return;
  }
  if (rec.user_id !== user.id && user.role !== 'admin') {
    res.status(403).json({ error: 'not your recommendation' });
    return;
  }

  // -- Decide --------------------------------------------------------------
  const updated = await decide({
    id: body.recId,
    decidedBy: user.id,
    decision: body.decision,
    editDiff: body.editDiff,
  });
  if (!updated) {
    res.status(500).json({ error: 'decide() returned no row' });
    return;
  }

  // -- Reject is terminal here --------------------------------------------
  if (body.decision === 'rejected') {
    res.status(200).json({ ok: true, status: updated.status });
    return;
  }

  // -- Approved or edited: re-run the underlying tool in execute mode -----
  const factory = TOOL_FACTORIES[rec.tool_name as ToolName];
  if (!factory) {
    res.status(500).json({ error: `unknown tool ${rec.tool_name}` });
    return;
  }

  // Build a transient ctx with this single (agent, tool) pair graduated so
  // the runtime allows execute. The original recommendation lives in the
  // DB; this is a one-off authorisation tied to the human's approval.
  const ctx: ToolCtx = {
    runId: rec.run_id,
    user,
    channel: 'web' as ChannelName,
    conversationId: null,
    graduations: new Set([rec.tool_name]),
  };

  const tool = factory(ctx);
  if (!tool.execute) {
    res.status(500).json({ error: 'tool has no execute() — provider tool?' });
    return;
  }

  // Merge the original dry-run payload with any user edits; force execute mode.
  const originalPayload = JSON.parse(rec.payload) as Record<string, unknown>;
  const finalInput = {
    ...originalPayload,
    ...(body.payload ?? {}),
    mode: 'execute',
  };

  let result: unknown;
  try {
    result = await tool.execute(
      finalInput as never,
      { toolCallId: `approval-${rec.id}`, messages: [] },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'execute_failed', message });
    return;
  }

  // markExecuted records the tool's result on the rec row. Permission/audit
  // is handled inside the tool wrapper; we just persist the outcome here.
  await markExecuted(rec.id, result);

  res.status(200).json({ ok: true, status: updated.status, result });
}
