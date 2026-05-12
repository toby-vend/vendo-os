/**
 * Atlas Brief Preview — run the per-user morning brief for a list of
 * users WITHOUT delivering to Slack. Prints each user's brief to stdout
 * so you can sanity-check that the personalisation is actually working.
 *
 * Usage (must load .env.local before imports so Turso + AI Gateway init):
 *   node --env-file=.env.local --import tsx/esm scripts/test/atlas-brief-preview.ts
 *
 * Defaults: previews Toby, Alfie, Max, Dilith.
 * Override by passing a comma-separated email list:
 *   node --env-file=.env.local --import tsx/esm scripts/test/atlas-brief-preview.ts \
 *     toby@vendodigital.co.uk,max@vendodigital.co.uk
 */
import { db } from '../../web/lib/queries/base.js';
import { userRowToSessionUser, type UserRow } from '../../web/lib/queries/auth.js';
import { atlasBriefAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { slackifyAgentOutput } from '../../web/lib/agents/format/slackify.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

const DEFAULT_EMAILS = [
  'toby@vendodigital.co.uk',
  'alfie@vendodigital.co.uk',
  'max@vendodigital.co.uk',
  'dilith@vendodigital.co.uk',
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadUser(email: string): Promise<UserRow | null> {
  const r = await db.execute({
    sql: `SELECT id, email, name, password_hash, role, must_change_password,
                 created_at, updated_at
            FROM users WHERE email = ? LIMIT 1`,
    args: [email],
  });
  if (!r.rows.length) return null;
  return r.rows[0] as unknown as UserRow;
}

async function previewFor(row: UserRow): Promise<void> {
  const user = userRowToSessionUser(row);
  const ctx: ToolCtx = {
    runId: '',
    agent: atlasBriefAgent.name,
    user,
    channel: 'cron' as ChannelName,
    conversationId: `atlas-brief-preview:${user.id}:${todayKey()}`,
    graduations: new Set(),
  };

  const banner = `─── ${user.name} (${user.email}) ───`;
  console.log('\n' + banner);
  const t0 = Date.now();
  try {
    const result = await runAgentBackground({
      agent: atlasBriefAgent,
      ctx,
      prompt: `Generate today's morning briefing for ${user.name}.`,
      trigger: 'preview:atlas-brief',
      conversationId: ctx.conversationId,
    });
    const ms = Date.now() - t0;
    if (result.status !== 'completed' || !result.text?.trim()) {
      console.log(`[preview] FAILED (${ms}ms): ${result.error ?? 'no text'}`);
      return;
    }
    const slackBody = slackifyAgentOutput(result.text);
    console.log(`[preview] OK (${ms}ms, runId=${result.runId}, ${result.text.length}→${slackBody.length} chars)\n`);
    console.log('--- AS SLACK WILL RECEIVE IT ---');
    console.log(slackBody);
    console.log('\n' + '─'.repeat(banner.length));
  } catch (err) {
    console.log(`[preview] THREW: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const emails = arg
    ? arg.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EMAILS;

  console.log(`Previewing Atlas morning brief for ${emails.length} user(s)…`);

  for (const email of emails) {
    const row = await loadUser(email);
    if (!row) {
      console.log(`\n[preview] user not found: ${email}`);
      continue;
    }
    // Sequential rather than parallel so output stays readable.
    await previewFor(row);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[preview] fatal:', err);
  process.exit(1);
});
