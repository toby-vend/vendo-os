/**
 * Agent runtime smoke test — exercises the trace store + recommendations
 * helpers end-to-end against the configured database.
 *
 * Writes rows tagged with agent='smoke-test'. Re-running the script first
 * deletes prior smoke rows so the database stays tidy.
 *
 * Usage (loads .env.local before any module evaluation, so the import of
 * web/lib/queries/base picks up TURSO_DATABASE_URL):
 *
 *   node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts
 *
 * To inspect the resulting trace by hand:
 *   SELECT * FROM agent_runs            WHERE agent='smoke-test';
 *   SELECT * FROM agent_messages        WHERE run_id IN (SELECT id FROM agent_runs WHERE agent='smoke-test');
 *   SELECT * FROM agent_tool_calls      WHERE run_id IN (SELECT id FROM agent_runs WHERE agent='smoke-test');
 *   SELECT * FROM agent_recommendations WHERE agent='smoke-test';
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../../web/lib/queries/base';
import { generateId } from '../../web/lib/auth';
import {
  startRun,
  endRun,
  recordMessage,
  recordToolCall,
  getRun,
  getRunMessages,
  getRunToolCalls,
} from '../../web/lib/agents/trace';
import {
  create as createRecommendation,
  decide,
  markExecuted,
  recordOutcome,
  getById,
  listPendingForInbox,
  acceptanceRate,
} from '../../web/lib/agents/recommendations';
import {
  graduate,
  revokeGraduation,
  loadGraduations,
} from '../../web/lib/agents/permissions';
import { buildToolset } from '../../web/lib/agents/tools';
import {
  getChannel,
  recToCard,
  isDeliveryChannel,
} from '../../web/lib/agents/channels';
import {
  insertChunk,
  searchSimilar,
} from '../../web/lib/agents/memory/long-term';
import {
  atlasAgent,
  atlasStaffAgent,
  getAgent,
  getAgentForUser,
  listAgents,
} from '../../web/lib/agents/agents';
import { runAgentBackground } from '../../web/lib/agents/runtime';
import { MODELS } from '../../web/lib/agents/models';
import { TOOL_FACTORIES } from '../../web/lib/agents/tools';
import {
  verifySlackSignature,
  parseSlackForm,
} from '../../web/lib/agents/channels/slack-verify';
import { parseAgentActionId } from '../../web/lib/agents/channels/slack';
import crypto from 'node:crypto';
import type { ToolCtx, AgentDef, ChannelName } from '../../web/lib/agents/types';
import type { SessionUser } from '../../web/lib/auth';

const SMOKE_AGENT = 'smoke-test';
const SMOKE_USER = 'smoke-user';
const SMOKE_TOOL = 'smoke.draftAsanaTask';

// ---------------------------------------------------------------------------
// Helpers used by the defineTool contract assertions.
// ---------------------------------------------------------------------------

function mockUser(opts: { channels?: string[]; allowedRoutes?: string[]; role?: 'admin' | 'standard' | 'client' } = {}): SessionUser {
  return {
    id: SMOKE_USER,
    email: 'smoke@vendodigital.co.uk',
    name: 'Smoke User',
    role: opts.role ?? 'admin',
    mustChangePassword: false,
    channels: opts.channels ?? [],
    allowedRoutes: opts.allowedRoutes ?? [],
    googleConnected: false,
    clientId: null,
    clientName: null,
  };
}

function mockCtx(runId: string, user: SessionUser, graduations: Set<string>): ToolCtx {
  return {
    runId,
    user,
    channel: 'cron' as ChannelName,
    conversationId: null,
    graduations,
  };
}

// Minimal AgentDef wrapper used to drive buildToolset() in smoke.
const TEST_AGENT: AgentDef = {
  name: SMOKE_AGENT,
  model: 'anthropic/claude-haiku-4.5',
  tools: ['searchClients', 'draftPushNotification'],
  systemPrompt: () => 'smoke',
};

async function reset(): Promise<void> {
  // Delete in dependency order. recommendations references runs; outcomes
  // cascades from recommendations; messages and tool_calls cascade from runs.
  await db.execute({
    sql: `DELETE FROM agent_outcomes WHERE recommendation_id IN
            (SELECT id FROM agent_recommendations WHERE agent = ?)`,
    args: [SMOKE_AGENT],
  });
  await db.execute({
    sql: `DELETE FROM agent_recommendations WHERE agent = ?`,
    args: [SMOKE_AGENT],
  });
  await db.execute({
    sql: `DELETE FROM agent_runs WHERE agent = ?`,
    args: [SMOKE_AGENT],
  });
  await db.execute({
    sql: `DELETE FROM agent_graduations WHERE agent = ?`,
    args: [SMOKE_AGENT],
  });
  await db.execute({
    sql: `DELETE FROM agent_memory_chunks WHERE scope_id LIKE 'smoke-%'`,
    args: [],
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error('  ✗', message);
    throw new Error('Smoke assertion failed: ' + message);
  }
  console.log('  ✓', message);
}

async function main(): Promise<void> {
  console.log('Resetting prior smoke rows...');
  await reset();

  console.log('\n[1] startRun');
  const runId = await startRun({
    agent: SMOKE_AGENT,
    user_id: SMOKE_USER,
    channel: 'cron',
    conversation_id: null,
    trigger: 'smoke-test',
    model: 'anthropic/claude-haiku-4.5',
  });
  assert(typeof runId === 'string' && runId.length > 0, 'returns a run id');

  console.log('\n[2] recordMessage × 2');
  await recordMessage({
    runId,
    step: 0,
    role: 'user',
    parts: [{ type: 'text', text: 'Draft a follow-up Asana task' }],
  });
  await recordMessage({
    runId,
    step: 1,
    role: 'assistant',
    parts: [{ type: 'text', text: 'Drafting...' }],
  });
  const messages = await getRunMessages(runId);
  assert(messages.length === 2, 'persisted 2 messages');

  console.log('\n[3] recordToolCall × 2 (start + end)');
  const callId = generateId();
  await recordToolCall({
    runId,
    callId,
    step: 1,
    toolName: SMOKE_TOOL,
    mode: 'dry-run',
    phase: 'start',
    input: { project: 'client-ops', title: 'Follow up with smoke client' },
  });
  await recordToolCall({
    runId,
    callId,
    step: 1,
    toolName: SMOKE_TOOL,
    mode: 'dry-run',
    phase: 'end',
    output: { mode: 'dry-run', payload: { title: 'Follow up' }, asanaUrl: null },
    durationMs: 12,
  });
  const toolCalls = await getRunToolCalls(runId);
  assert(toolCalls.length === 2, 'persisted 2 tool-call rows');
  assert(
    toolCalls[0].phase === 'start' && toolCalls[1].phase === 'end',
    'phases ordered start then end',
  );

  console.log('\n[4] endRun');
  await endRun({
    runId,
    status: 'completed',
    inputTokens: 120,
    outputTokens: 38,
    costUsd: 0.0009,
  });
  const run = (await getRun(runId)) as unknown as
    | { status: string; ended_at: string | null }
    | null;
  assert(run !== null, 'run row readable');
  assert(run!.status === 'completed', 'run status is completed');
  assert(run!.ended_at !== null, 'ended_at is populated');

  console.log('\n[5] createRecommendation');
  const recId = await createRecommendation({
    runId,
    agent: SMOKE_AGENT,
    userId: SMOKE_USER,
    title: 'Smoke: Draft Asana follow-up',
    reasoning: 'The smoke test asks us to draft a follow-up. Fictional context only.',
    toolName: SMOKE_TOOL,
    payload: { project: 'client-ops', title: 'Follow up' },
    sourceLinks: [{ label: 'Smoke source', url: 'https://example.com' }],
  });
  assert(typeof recId === 'string' && recId.length > 0, 'returns a recommendation id');

  console.log('\n[6] listPendingForInbox');
  const pending = await listPendingForInbox(SMOKE_USER);
  assert(pending.some(r => r.id === recId), 'recommendation appears in inbox');
  assert(pending[0].status === 'pending', 'status defaults to pending');

  console.log('\n[7] decide (edited)');
  const edited = await decide({
    id: recId,
    decidedBy: SMOKE_USER,
    decision: 'edited',
    editDiff: { title: { from: 'Follow up', to: 'Follow up — urgent' } },
  });
  assert(edited !== null, 'decided row readable');
  assert(edited!.status === 'edited', 'status updated to edited');
  assert(edited!.decided_by === SMOKE_USER, 'decided_by set');
  assert(edited!.edit_diff !== null, 'edit_diff captured');

  console.log('\n[8] markExecuted');
  await markExecuted(recId, { asanaUrl: 'https://app.asana.com/0/0/smoke' });
  const executed = await getById(recId);
  assert(executed?.executed_at !== null, 'executed_at set');
  assert(executed?.execute_result !== null, 'execute_result captured');

  console.log('\n[9] recordOutcome');
  await recordOutcome({
    recommendationId: recId,
    outcome: 'success',
    notes: 'Smoke run — outcome rated success.',
    reviewedBy: SMOKE_USER,
  });
  // recordOutcome upserts; running it twice should be safe.
  await recordOutcome({
    recommendationId: recId,
    outcome: 'neutral',
    notes: 'Smoke run — re-rated neutral (idempotency check).',
    reviewedBy: SMOKE_USER,
  });
  const outcomeRow = await db.execute({
    sql: `SELECT * FROM agent_outcomes WHERE recommendation_id = ?`,
    args: [recId],
  });
  assert(outcomeRow.rows.length === 1, 'exactly one outcome row (idempotent upsert)');
  assert(outcomeRow.rows[0].outcome === 'neutral', 'outcome reflects latest write');

  console.log('\n[10] decide on already-decided recommendation is a no-op');
  await decide({
    id: recId,
    decidedBy: 'someone-else',
    decision: 'rejected',
  });
  const stillEdited = await getById(recId);
  assert(stillEdited?.status === 'edited', 'second decide() did not change status');
  assert(stillEdited?.decided_by === SMOKE_USER, 'decided_by preserved');

  console.log('\n[11] acceptanceRate calculates correctly');
  const rate = await acceptanceRate({
    agent: SMOKE_AGENT,
    toolName: SMOKE_TOOL,
    windowDays: 30,
  });
  assert(rate.total === 1, 'one decided recommendation in window');
  assert(rate.approved === 1, 'edited counts toward approved');
  assert(rate.rate === 1, 'acceptance rate is 1.0');

  // -------------------------------------------------------------------------
  // defineTool contract — permission gate, graduation gate, dry-run vs execute
  // -------------------------------------------------------------------------

  const TOOL_CALL_OPTS = { toolCallId: generateId(), messages: [] as never[] };

  console.log('\n[12] defineTool — permission denied returns ToolErrorResult');
  {
    // Admin role bypasses capability gates, so test denial with a standard
    // user who has no channels granted.
    const ctx = mockCtx(runId, mockUser({ role: 'standard', channels: [] }), new Set());
    const tools = buildToolset(TEST_AGENT, ctx);
    const result = (await tools.searchClients.execute!(
      { query: 'smoke' },
      TOOL_CALL_OPTS,
    )) as { ok?: boolean; error?: string };
    assert(result.ok === false, 'returns ok=false');
    assert(result.error === 'permission_denied', 'error is permission_denied');
  }

  console.log('\n[13] defineTool — read tool succeeds with capability');
  {
    const ctx = mockCtx(runId, mockUser({ role: 'standard', channels: ['clients:read'] }), new Set());
    const tools = buildToolset(TEST_AGENT, ctx);
    const result = (await tools.searchClients.execute!(
      { query: '__smoke_test_no_match__' },
      TOOL_CALL_OPTS,
    )) as { hits?: unknown[] };
    assert(Array.isArray(result.hits), 'returns hits array');
  }

  console.log('\n[13a] defineTool — admin role bypasses capability gate');
  {
    const ctx = mockCtx(runId, mockUser({ role: 'admin', channels: [] }), new Set());
    const tools = buildToolset(TEST_AGENT, ctx);
    const result = (await tools.searchClients.execute!(
      { query: '__smoke_test_no_match__' },
      TOOL_CALL_OPTS,
    )) as { hits?: unknown[]; error?: string };
    assert(Array.isArray(result.hits), 'admin can call read tool with no channels');
    assert(result.error === undefined, 'no permission_denied for admin');
  }

  console.log('\n[14] graduation gate — execute coerced to dry-run when ungraduated');
  {
    const ctx = mockCtx(runId, mockUser({ channels: ['push:write'] }), new Set());
    const tools = buildToolset(TEST_AGENT, ctx);
    const result = (await tools.draftPushNotification.execute!(
      {
        mode: 'execute',
        userId: 'never-existed',
        title: 'smoke',
        body: 'smoke body',
        url: 'https://vendodigital.co.uk/',
      },
      TOOL_CALL_OPTS,
    )) as { mode?: string; sent?: boolean };
    assert(result.mode === 'dry-run', 'mode coerced from execute to dry-run');
    assert(result.sent === false, 'sent=false in dry-run');
  }

  console.log('\n[15] graduation gate — execute respected when graduated');
  {
    await graduate({
      agent: SMOKE_AGENT,
      toolName: 'draftPushNotification',
      graduatedBy: SMOKE_USER,
      notes: 'smoke-test graduation',
    });
    const graduations = await loadGraduations(SMOKE_AGENT);
    assert(graduations.has('draftPushNotification'), 'graduation row loadable');

    const ctx = mockCtx(runId, mockUser({ channels: ['push:write'] }), graduations);
    const tools = buildToolset(TEST_AGENT, ctx);
    const result = (await tools.draftPushNotification.execute!(
      {
        mode: 'execute',
        userId: 'never-existed',
        title: 'smoke graduated',
        body: 'smoke body',
        url: 'https://vendodigital.co.uk/',
      },
      TOOL_CALL_OPTS,
    )) as { mode?: string; sent?: boolean };
    assert(result.mode === 'execute', 'mode is execute when graduated');
    assert(typeof result.sent === 'boolean', 'sent is boolean');

    await revokeGraduation(SMOKE_AGENT, 'draftPushNotification');
    const after = await loadGraduations(SMOKE_AGENT);
    assert(!after.has('draftPushNotification'), 'revokeGraduation clears the row');
  }

  console.log('\n[16] tool error path is logged to agent_tool_calls');
  {
    const toolCalls = await db.execute({
      sql: `SELECT phase, error, tool_name FROM agent_tool_calls
            WHERE run_id = ? AND tool_name = 'searchClients' AND phase = 'error'`,
      args: [runId],
    });
    assert(
      toolCalls.rows.length >= 1,
      'permission_denied recorded as error phase in trace',
    );
    assert(
      String(toolCalls.rows[0].error).includes('permission_denied'),
      'error column carries permission_denied detail',
    );
  }

  // -------------------------------------------------------------------------
  // Channel adapters — render-time checks only (no network calls)
  // -------------------------------------------------------------------------

  console.log('\n[17] recToCard shape from a fresh recommendation row');
  {
    const fetched = await getById(recId);
    assert(fetched !== null, 'recommendation row readable');
    const card = recToCard(fetched!);
    assert(card.id === recId, 'card.id === recommendation id');
    assert(card.title === fetched!.title, 'card.title carried through');
    assert(card.reasoning === fetched!.reasoning, 'card.reasoning carried through');
    assert(Array.isArray(card.fields), 'card.fields is an array');
    assert(card.fields.length > 0, 'payload rendered as at least one field');
    assert(
      !card.fields.some(f => f.label === 'mode'),
      "internal 'mode' field excluded from card",
    );
    assert(
      Array.isArray(card.sourceLinks) && card.sourceLinks!.length === 1,
      'sourceLinks parsed from JSON column',
    );
  }

  console.log('\n[18] channel registry returns the right adapters');
  {
    const web = getChannel('web');
    const slack = getChannel('slack');
    const telegram = getChannel('telegram');
    assert(web.name === 'web', "getChannel('web') has name='web'");
    assert(slack.name === 'slack', "getChannel('slack') has name='slack'");
    assert(telegram.name === 'telegram', "getChannel('telegram') has name='telegram'");
    for (const c of [web, slack, telegram]) {
      assert(typeof c.sendMessage === 'function', `${c.name}.sendMessage exists`);
      assert(typeof c.requestApproval === 'function', `${c.name}.requestApproval exists`);
      assert(typeof c.deliverProactive === 'function', `${c.name}.deliverProactive exists`);
    }
  }

  console.log('\n[19] isDeliveryChannel narrows correctly');
  {
    assert(isDeliveryChannel('web') === true, "'web' is a delivery channel");
    assert(isDeliveryChannel('slack') === true, "'slack' is a delivery channel");
    assert(isDeliveryChannel('telegram') === true, "'telegram' is a delivery channel");
    assert(isDeliveryChannel('cron') === false, "'cron' is not a delivery channel");
    assert(isDeliveryChannel('garbage') === false, 'unknown name rejected');
  }

  // -------------------------------------------------------------------------
  // Long-term memory — round-trip via real embeddings if the gateway has a
  // key; logs "skipped" otherwise so dev environments without
  // AI_GATEWAY_API_KEY still run clean.
  // -------------------------------------------------------------------------

  console.log('\n[20] long-term memory: insert + searchSimilar round-trip');
  {
    const matchId = await insertChunk({
      scope: 'meeting',
      scope_id: 'smoke-match',
      content:
        'Smoke memory match: Meeting with Smile Dental about ad-spend pacing. The campaign overshot budget by 12% in October.',
      metadata: { client: 'Smile Dental' },
    });

    if (!matchId) {
      console.log('  ⚠ embedding unavailable (no AI_GATEWAY_API_KEY?) — skipping recall assertion');
    } else {
      assert(matchId === 'meeting:smoke-match', 'deterministic id derived from scope:scope_id');

      // Insert a deliberately-distant chunk so the ranking has something to differentiate.
      await insertChunk({
        scope: 'meeting',
        scope_id: 'smoke-distant',
        content:
          'Smoke memory distant: A Tuesday afternoon stand-up about office plant rotation policy. Nothing to do with marketing.',
      });

      const hits = await searchSimilar({
        query: 'Smile Dental ad spend overspend',
        scope: 'meeting',
        limit: 5,
      });
      assert(hits.length >= 1, 'searchSimilar returns at least one hit');
      assert(hits[0].scope_id === 'smoke-match', 'top hit is the matching chunk');
      assert(
        hits[0].distance < (hits[1]?.distance ?? Infinity),
        'matching chunk is strictly closer than the distant one',
      );
      assert(hits[0].metadata?.client === 'Smile Dental', 'metadata round-trips through JSON column');
    }

    // Clean up only smoke rows — never broader scope (seed data lives there)
    await db.execute({
      sql: `DELETE FROM agent_memory_chunks WHERE scope_id LIKE 'smoke-%'`,
      args: [],
    });
  }

  // -------------------------------------------------------------------------
  // Atlas — structural checks. Live model exercise is deferred to Block 7
  // (api/agent/chat.ts) where the React island consumes the stream.
  // -------------------------------------------------------------------------

  console.log('\n[21] Atlas agent definition is valid');
  {
    const a = atlasAgent;
    assert(a.name === 'atlas', "name === 'atlas'");
    assert(a.model === 'anthropic/claude-sonnet-4.6', 'model is Sonnet 4.6');
    assert(a.maxSteps === 8, 'maxSteps === 8');
    assert(Array.isArray(a.tools) && a.tools.length === 10, 'declares 10 tools');
    const expectedTools = [
      'searchMeetings', 'searchClients', 'getClientHealth',
      'getCampaignPerformance', 'queryDecisions', 'searchKnowledge',
      'draftAsanaTask', 'draftSlackMessage', 'draftPushNotification', 'draftEmail',
    ];
    for (const t of expectedTools) {
      assert(a.tools.includes(t), `tools[] includes ${t}`);
    }
  }

  console.log('\n[22] Atlas systemPrompt renders today + caller');
  {
    const ctx = mockCtx(runId, mockUser({ channels: ['meetings:read'] }), new Set());
    const prompt = atlasAgent.systemPrompt(ctx);
    const today = new Date().toISOString().slice(0, 10);
    assert(prompt.includes('Atlas'), "system prompt names 'Atlas'");
    assert(prompt.includes('UK English'), 'enforces UK English');
    assert(prompt.includes('Vendo Digital'), 'mentions Vendo Digital');
    assert(prompt.includes(today), "includes today's date");
    assert(prompt.includes('Smoke User'), "includes user's name");
    assert(prompt.includes(ctx.channel), 'includes channel');
  }

  console.log('\n[23] buildToolset(atlas, ctx) returns exactly the declared tools');
  {
    const ctx = mockCtx(runId, mockUser({ channels: ['meetings:read'] }), new Set());
    const tools = buildToolset(atlasAgent, ctx);
    const names = Object.keys(tools).sort();
    const expected = [...atlasAgent.tools].sort();
    assert(JSON.stringify(names) === JSON.stringify(expected), 'toolset matches declared list exactly');
  }

  console.log('\n[24] agents registry getAgent / listAgents');
  {
    assert(getAgent('atlas') === atlasAgent, "getAgent('atlas') returns atlasAgent");
    assert(getAgent('atlas-staff') === atlasStaffAgent, "getAgent('atlas-staff') returns staff");
    assert(getAgent('does-not-exist') === null, 'unknown agent returns null');
    assert(listAgents().includes('atlas'), 'listAgents includes atlas');
    assert(listAgents().includes('atlas-staff'), 'listAgents includes atlas-staff');
  }

  console.log('\n[24a] tier router: getAgentForUser');
  {
    const adminUser: SessionUser = { ...mockUser(), role: 'admin' };
    const standardUser: SessionUser = { ...mockUser(), role: 'standard' };
    const clientUser: SessionUser = { ...mockUser(), role: 'client' };
    assert(getAgentForUser(adminUser) === atlasAgent, "admin → atlasAgent");
    assert(getAgentForUser(standardUser) === atlasStaffAgent, "standard → atlasStaffAgent");
    assert(getAgentForUser(clientUser) === null, "client → null (no Atlas)");
  }

  console.log('\n[24b] staff agent has reduced toolset');
  {
    const adminTools = new Set(atlasAgent.tools);
    const staffTools = new Set(atlasStaffAgent.tools);
    assert(!staffTools.has('queryDecisions'), 'staff has no queryDecisions');
    assert(!staffTools.has('searchKnowledge'), 'staff has no searchKnowledge');
    assert(!staffTools.has('getClientHealth'), 'staff has no full getClientHealth');
    assert(staffTools.has('getClientHealthStaff'), 'staff has getClientHealthStaff');
    assert(staffTools.has('searchMeetings'), 'staff still has searchMeetings');
    assert(staffTools.has('getCampaignPerformance'), 'staff still has campaign perf');
    assert(adminTools.has('queryDecisions'), 'admin retains queryDecisions');
    assert(adminTools.has('searchKnowledge'), 'admin retains searchKnowledge');
    assert(adminTools.has('getClientHealth'), 'admin retains full getClientHealth');
  }

  console.log('\n[24c] staff getClientHealthStaff strips financial fields');
  {
    const ctx = mockCtx(
      runId,
      mockUser({ channels: ['health:read'] }),
      new Set(),
    );
    const tool = TOOL_FACTORIES.getClientHealthStaff(ctx);
    // Bogus client name — tool returns the "not found" shape, which still
    // exercises the output schema and proves financial fields aren't there.
    const result = (await tool.execute!(
      { clientName: '__smoke_no_match__' },
      { toolCallId: generateId(), messages: [] as never[] },
    )) as Record<string, unknown>;
    assert(typeof result === 'object' && result !== null, 'returned object');
    assert(!('financialScore' in result), "no 'financialScore' field");
    assert(!('prevScore' in result), "no 'prevScore' field");
    assert('performanceScore' in result, "still has 'performanceScore'");
    assert('relationshipScore' in result, "still has 'relationshipScore'");
  }

  // -------------------------------------------------------------------------
  // Live runtime — single Haiku call through runAgentBackground. Proves the
  // gateway is reachable, streamText/generateText actually run, and a row
  // lands in agent_runs with status='completed' + non-zero usage.
  //
  // ~$0.0005 per run (Haiku, ~50 tokens total). Skips with a notice if
  // we can't reach the gateway.
  // -------------------------------------------------------------------------

  console.log('\n[25] runtime: single Haiku call lands in agent_runs');
  {
    const tinyAgent: AgentDef = {
      name: SMOKE_AGENT,
      model: MODELS.HAIKU,
      maxSteps: 1,
      tools: [],
      systemPrompt: () => 'You are a smoke test. Answer in one short word.',
    };
    const ctx: ToolCtx = {
      runId: '',
      user: mockUser(),
      channel: 'cron' as ChannelName,
      conversationId: null,
      graduations: new Set(),
    };

    const result = await runAgentBackground({
      agent: tinyAgent,
      ctx,
      prompt: 'Reply with the single word: hello',
      trigger: 'smoke-runtime',
    });

    if (result.status === 'errored') {
      console.log(`  ⚠ runtime call errored (${result.error}) — skipping live-call assertions.`);
      console.log('     This usually means AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN is not set.');
    } else {
      assert(result.status === 'completed', 'status is completed');
      assert(typeof result.text === 'string' && result.text.length > 0, 'returned text');
      assert((result.inputTokens ?? 0) > 0, 'input tokens recorded');
      assert((result.outputTokens ?? 0) > 0, 'output tokens recorded');

      const persisted = await db.execute({
        sql: `SELECT status, input_tokens, output_tokens, cost_usd
              FROM agent_runs WHERE id = ?`,
        args: [result.runId],
      });
      assert(persisted.rows.length === 1, 'agent_runs row exists');
      assert(String(persisted.rows[0].status) === 'completed', 'persisted status');
      assert(Number(persisted.rows[0].input_tokens) > 0, 'persisted input_tokens');
      assert(persisted.rows[0].cost_usd !== null, 'persisted cost_usd');

      console.log(
        `     Haiku said: "${result.text.trim().slice(0, 60)}"  (${result.inputTokens}+${result.outputTokens} tok, $${result.costUsd?.toFixed(5)})`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Slack inbound — HMAC signature verification and action_id parsing.
  // No live Slack calls; all assertions are pure-local.
  // -------------------------------------------------------------------------

  console.log('\n[26] Slack HMAC verifySlackSignature');
  {
    const secret = 'smoke-signing-secret';
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"event_callback","event":{"type":"message"}}';
    const sig = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex');

    assert(
      verifySlackSignature({ signingSecret: secret, timestamp: ts, signature: sig, rawBody: body }),
      'accepts a valid signature',
    );

    assert(
      !verifySlackSignature({
        signingSecret: secret,
        timestamp: ts,
        signature: 'v0=deadbeef'.padEnd(sig.length, '0'),
        rawBody: body,
      }),
      'rejects a wrong signature',
    );

    const stale = String(Math.floor(Date.now() / 1000) - 60 * 60); // 1 hour ago
    const staleSig = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${stale}:${body}`).digest('hex');
    assert(
      !verifySlackSignature({
        signingSecret: secret,
        timestamp: stale,
        signature: staleSig,
        rawBody: body,
      }),
      'rejects a stale timestamp (replay protection)',
    );

    assert(
      !verifySlackSignature({
        signingSecret: secret,
        timestamp: 'not-a-number',
        signature: sig,
        rawBody: body,
      }),
      'rejects a non-numeric timestamp',
    );

    // Tampered body → recomputed sig differs.
    const tampered = body.replace('"event_callback"', '"url_verification"');
    assert(
      !verifySlackSignature({
        signingSecret: secret,
        timestamp: ts,
        signature: sig,
        rawBody: tampered,
      }),
      'rejects when body changed under the original signature',
    );
  }

  console.log('\n[27] Slack parseAgentActionId');
  {
    const approve = parseAgentActionId('agent:approve:rec_abc123');
    assert(approve !== null, 'parses approve');
    assert(approve!.decision === 'approved', 'maps approve → approved');
    assert(approve!.recId === 'rec_abc123', 'recovers rec id');

    const edit = parseAgentActionId('agent:edit:rec_abc123');
    assert(edit?.decision === 'edited', 'maps edit → edited');

    const reject = parseAgentActionId('agent:reject:rec_abc123');
    assert(reject?.decision === 'rejected', 'maps reject → rejected');

    assert(parseAgentActionId('add_to_asana') === null, 'returns null for add_to_asana');
    assert(parseAgentActionId('agent:approve:') === null, 'returns null when recId is empty');
    assert(parseAgentActionId('agent:unknown:rec_abc') === null, 'returns null for unknown verb');
    assert(parseAgentActionId('') === null, 'returns null for empty input');
  }

  console.log('\n[28] Slack parseSlackForm decodes urlencoded slash command body');
  {
    const body = 'command=%2Fvendo&text=hello+world&user_id=U123&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2Fxxx';
    const form = parseSlackForm(body);
    assert(form.command === '/vendo', 'percent-decoded command');
    assert(form.text === 'hello world', 'plus-encoded space → space');
    assert(form.user_id === 'U123', 'user_id preserved');
    assert(form.response_url === 'https://hooks.slack.com/commands/xxx', 'response_url decoded');
  }

  console.log('\n--- Smoke test passed.');
  console.log(`Run id: ${runId}`);
  console.log(`Recommendation id: ${recId}`);
  console.log(
    `Inspect: SELECT * FROM agent_runs WHERE id='${runId}';`,
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n--- Smoke test failed.');
    console.error(err);
    process.exit(1);
  });
