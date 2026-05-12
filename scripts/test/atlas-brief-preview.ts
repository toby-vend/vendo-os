/**
 * Atlas Brief Preview — run the per-user morning brief for a list of
 * users. Prints each user's brief to stdout. Optionally also delivers
 * via Slack DM (pass --deliver) so you can verify the live formatting
 * end-to-end.
 *
 * Usage (must load .env.local before imports so Turso + AI Gateway init):
 *   # Preview only — no Slack delivery (default 4 admins):
 *   node --env-file=.env.local --import tsx/esm scripts/test/atlas-brief-preview.ts
 *
 *   # Specific email(s):
 *   node --env-file=.env.local --import tsx/esm scripts/test/atlas-brief-preview.ts \
 *     toby@vendodigital.co.uk,max@vendodigital.co.uk
 *
 *   # Preview AND DM via Slack:
 *   node --env-file=.env.local --import tsx/esm scripts/test/atlas-brief-preview.ts \
 *     toby@vendodigital.co.uk --deliver
 */
import { db } from '../../web/lib/queries/base.js';
import { userRowToSessionUser, type UserRow } from '../../web/lib/queries/auth.js';
import { atlasBriefAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { slackifyAgentOutput } from '../../web/lib/agents/format/slackify.js';
import { slackChannel } from '../../web/lib/agents/channels/slack.js';
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

async function previewFor(row: UserRow, deliver: boolean): Promise<void> {
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

    if (deliver) {
      const todayWords = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      try {
        await slackChannel.deliverProactive(user.id, {
          title: `Morning brief — ${todayWords} (test)`,
          body: slackBody,
        });
        console.log(`\n[preview] ✅ DM delivered to ${user.email}`);
      } catch (err) {
        console.log(`\n[preview] ❌ Slack DM failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log('\n' + '─'.repeat(banner.length));
  } catch (err) {
    console.log(`[preview] THREW: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const deliver = args.includes('--deliver');
  const emailArg = args.find((a) => !a.startsWith('--'));
  const emails = emailArg
    ? emailArg.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EMAILS;

  console.log(`Previewing Atlas morning brief for ${emails.length} user(s)${deliver ? ' (with Slack DM delivery)' : ''}…`);

  for (const email of emails) {
    const row = await loadUser(email);
    if (!row) {
      console.log(`\n[preview] user not found: ${email}`);
      continue;
    }
    // Sequential rather than parallel so output stays readable.
    await previewFor(row, deliver);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[preview] fatal:', err);
  process.exit(1);
});
