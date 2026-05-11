/**
 * Specialist digest runner — shared infra for Wave C / C1.
 *
 * Loops a set of active clients, runs a specialist agent with the client's
 * briefing pre-loaded in the prompt, and posts the result to a Slack
 * channel. Idempotent within a 24h window per (agent, client) via the
 * `specialist_digest_runs` table.
 *
 * Pilot: routes to SLACK_CHANNEL_SPECIALIST_DIGESTS (fallback to ALERTS)
 * so Toby can review the daily output before broadening to per-AM DMs.
 *
 * Cost guard: caps per-run at 8 clients by default. Each agent call is
 * ~$0.02–$0.10; 5 specialists × 8 clients × 30 working days ≈ $25–$120/mo.
 */
import { db } from '../queries/base.js';
import { runAgentBackground } from '../agents/runtime.js';
import { generateBriefing } from '../client-knowledge/briefing.js';
import { renderBriefingMarkdown } from '../client-knowledge/render.js';
import { getUserByEmail } from '../queries/auth.js';
import { userRowToSessionUser } from '../queries/auth.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import type { AgentDef } from '../agents/types.js';
import type { ToolCtx, ChannelName } from '../agents/types.js';

export interface SpecialistDigestInput {
  /** The AgentDef to invoke. */
  agent: AgentDef;
  /** Stable short label for the digest (e.g. 'paid-social'). Used in
   *  conversationId, idempotency key, and Slack header. */
  digestKey: string;
  /** Selects which clients to run for. Returns a list of `{id, name}` rows. */
  selectClients: () => Promise<Array<{ id: number; name: string }>>;
  /** Renders the per-client prompt; the briefing markdown is concatenated. */
  buildPrompt: (clientName: string) => string;
  /** Header line for each Slack post (e.g. 'Paid Social — daily snapshot'). */
  slackHeader: string;
  /** Optional per-run client cap (default 8). */
  perRunLimit?: number;
}

export interface SpecialistDigestRow {
  clientId: number;
  clientName: string;
  ok: boolean;
  posted: boolean;
  runId?: string;
  error?: string;
}

export interface SpecialistDigestResult {
  digestKey: string;
  totalClients: number;
  attempted: number;
  posted: number;
  skipped: number;
  durationMs: number;
  rows: SpecialistDigestRow[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS specialist_digest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      digest_key TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      run_id TEXT,
      posted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_specialist_digest_lookup
      ON specialist_digest_runs(digest_key, client_id, created_at)
  `);
}

async function alreadyRunToday(digestKey: string, clientId: number): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM specialist_digest_runs
          WHERE digest_key = ? AND client_id = ?
            AND created_at >= datetime('now', '-23 hours')
          LIMIT 1`,
    args: [digestKey, clientId],
  });
  return r.rows.length > 0;
}

const PILOT_RECIPIENT = 'toby@vendodigital.co.uk';

export async function runSpecialistDigest(input: SpecialistDigestInput): Promise<SpecialistDigestResult> {
  const start = Date.now();
  await ensureSchema();

  // Resolve the SessionUser the agent will be attributed to. We use Toby's
  // account in the pilot phase; specialist outputs all land in his DM /
  // a single review channel until the format is validated.
  const userRow = await getUserByEmail(PILOT_RECIPIENT);
  if (!userRow) {
    throw new Error(`Pilot recipient ${PILOT_RECIPIENT} not found in users table`);
  }
  const user = userRowToSessionUser(userRow);

  const clients = await input.selectClients();
  const limit = input.perRunLimit ?? 8;
  const channel = process.env.SLACK_CHANNEL_SPECIALIST_DIGESTS
    || process.env.SLACK_CHANNEL_ALERTS
    || '#alerts';

  const rows: SpecialistDigestRow[] = [];
  let attempted = 0;
  let posted = 0;
  let skipped = 0;

  for (const c of clients) {
    if (attempted >= limit) break;
    if (await alreadyRunToday(input.digestKey, c.id)) {
      skipped++;
      continue;
    }
    attempted++;

    // Pre-fetch the briefing so the prompt is hydrated. Cheaper than
    // letting the agent call getClientBriefing(): one fewer model
    // round-trip per client.
    let briefingMd = '';
    try {
      const b = await generateBriefing(c.id);
      if (b) briefingMd = renderBriefingMarkdown(b);
    } catch (err) {
      console.error(`[specialist-digest:${input.digestKey}] briefing failed for ${c.name}:`,
        err instanceof Error ? err.message : String(err));
    }

    const prompt = [
      input.buildPrompt(c.name),
      '',
      '— Pre-loaded client briefing (read-only context) —',
      briefingMd || '(no briefing available)',
    ].join('\n');

    const ctx: ToolCtx = {
      runId: '',
      agent: input.agent.name,
      user,
      channel: 'cron' as ChannelName,
      conversationId: `${input.digestKey}:${c.id}:${new Date().toISOString().slice(0, 10)}`,
      graduations: new Set(),
    };

    let runId: string | undefined;
    let ok = false;
    let postedThis = false;
    let error: string | undefined;

    try {
      const result = await runAgentBackground({
        agent: input.agent,
        ctx,
        prompt,
        trigger: `cron:specialist-digest:${input.digestKey}`,
        conversationId: ctx.conversationId,
      });
      runId = result.runId;
      ok = result.status === 'completed' && Boolean(result.text?.trim());
      if (!ok) {
        error = result.error ?? 'agent did not produce text';
      } else {
        const text = result.text!.trim();
        // Skip very-short outputs (the agent said nothing useful) so we
        // don't spam the channel with one-liners.
        if (text.length < 60) {
          error = 'output too short — skipped post';
        } else {
          const lines = [
            `:bar_chart: *${input.slackHeader} — ${c.name}*`,
            '',
            text,
          ].join('\n');
          try {
            await sendSlackMessage(channel, lines);
            postedThis = true;
            posted++;
          } catch (postErr) {
            error = `slack post failed: ${postErr instanceof Error ? postErr.message : String(postErr)}`;
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    await db.execute({
      sql: `INSERT INTO specialist_digest_runs
              (digest_key, client_id, run_id, posted, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [input.digestKey, c.id, runId ?? null, postedThis ? 1 : 0, new Date().toISOString()] as (string | number | null)[],
    });

    rows.push({ clientId: c.id, clientName: c.name, ok, posted: postedThis, runId, error });
  }

  return {
    digestKey: input.digestKey,
    totalClients: clients.length,
    attempted,
    posted,
    skipped,
    durationMs: Date.now() - start,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Client selectors — share across specialist handlers.
// ---------------------------------------------------------------------------

/**
 * Active clients with recent Google Ads spend.
 */
export async function selectClientsWithRecentGoogleAdsSpend(daysBack = 30): Promise<Array<{ id: number; name: string }>> {
  const r = await db.execute(`
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN gads_campaign_spend s ON s.account_name = c.name
    WHERE s.date >= date('now', '-${daysBack} days')
      AND COALESCE(c.status, 'active') = 'active'
    ORDER BY c.name
  `);
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
}

/**
 * Active clients with recent Meta spend (paid-social).
 */
export async function selectClientsWithRecentMetaSpend(daysBack = 30): Promise<Array<{ id: number; name: string }>> {
  const r = await db.execute(`
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN meta_insights s ON s.account_name = c.name
    WHERE s.date >= date('now', '-${daysBack} days')
      AND COALESCE(c.status, 'active') = 'active'
    ORDER BY c.name
  `);
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
}

/**
 * Active clients with recent GSC data (organic search). Joins gsc_daily
 * via client_source_mappings(source='gsc') since gsc_daily.site_id is the
 * GSC property id, not the client_id.
 */
export async function selectClientsWithRecentOrganic(daysBack = 30): Promise<Array<{ id: number; name: string }>> {
  const r = await db.execute(`
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN client_source_mappings m ON m.client_id = c.id AND m.source = 'gsc'
    JOIN gsc_daily g ON g.site_id = m.external_id
    WHERE g.date >= date('now', '-${daysBack} days')
      AND COALESCE(c.status, 'active') = 'active'
    ORDER BY c.name
  `);
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
}

/**
 * Active clients with recent Frame.io creative events. Joins via
 * client_source_mappings(source='frameio') because frameio_events stores
 * project_id, not client_id directly.
 */
export async function selectClientsWithRecentCreative(daysBack = 14): Promise<Array<{ id: number; name: string }>> {
  const r = await db.execute(`
    SELECT DISTINCT c.id, c.name
    FROM clients c
    JOIN client_source_mappings m ON m.client_id = c.id AND m.source = 'frameio'
    JOIN frameio_events e ON e.project_id = m.external_id
    WHERE e.received_at >= datetime('now', '-${daysBack} days')
      AND COALESCE(c.status, 'active') = 'active'
    ORDER BY c.name
  `);
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
}

/**
 * All active clients — used by atlas-am (digest spans the entire book).
 */
export async function selectAllActiveClients(): Promise<Array<{ id: number; name: string }>> {
  const r = await db.execute(`
    SELECT id, name FROM clients
    WHERE COALESCE(status, 'active') = 'active'
    ORDER BY name
  `);
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
}
