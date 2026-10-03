/**
 * Register the Frame.io right-click actions for AI edits (plans/2026-10-03-frameio-native-ai-edits.md, step 1).
 *
 *   npm run frameio:actions                 list the workspace's custom actions
 *   npm run frameio:actions -- create --yes create "AI First Cut" and "AI Revision" (skips ones that exist)
 *
 * The actions call https://vendo-os.vercel.app/api/frameio/action?token=<FRAMEIO_WEBHOOK_TOKEN>.
 * Frame.io shows each action's signing secret once; it is saved to ~/.vendo/frameio-action-secrets.json
 * (never printed) so they can be added to Vercel as FRAMEIO_ACTION_SECRETS (comma-separated).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BASE = 'https://vendo-os.vercel.app/api/frameio/action';

async function main() {
  const { getResource, listWorkspaces, sendJson } = await import('../web/lib/frameio/client.js');
  const { ACCOUNT_ID } = await import('../web/lib/frameio/media-io.js');
  const { ACTION_EVENTS } = await import('../web/lib/video-jobs/actions.js');
  const [ws] = await listWorkspaces(ACCOUNT_ID);
  const path = `/accounts/${ACCOUNT_ID}/workspaces/${ws.id}/actions`;
  const existing = (await getResource<Array<{ id: string; name: string; event: string; url: string }>>(path)) ?? [];

  if (process.argv[2] !== 'create') {
    console.log(existing.length ? existing.map((a) => `${a.name} | ${a.event} | ${a.id}`).join('\n') : 'No custom actions.');
    return;
  }
  if (!process.argv.includes('--yes')) throw new Error('Creating actions changes Frame.io for everyone: re-run with --yes');
  const token = process.env.FRAMEIO_WEBHOOK_TOKEN;
  if (!token) throw new Error('FRAMEIO_WEBHOOK_TOKEN is not set in .env.local');

  const wanted = [
    { name: 'AI First Cut', event: ACTION_EVENTS.first_cut, description: 'Make an AI first cut of this raw clip (v01 Internal)' },
    { name: 'AI Revision', event: ACTION_EVENTS.revision, description: 'Apply the open comments on this AI video as the next version' },
  ];
  const secretsFile = join(homedir(), '.vendo', 'frameio-action-secrets.json');
  mkdirSync(join(homedir(), '.vendo'), { recursive: true });
  const secrets: Record<string, string> = existsSync(secretsFile) ? JSON.parse(readFileSync(secretsFile, 'utf8')) : {};

  for (const a of wanted) {
    if (existing.some((e) => e.event === a.event)) { console.log(`exists: ${a.name}`); continue; }
    const created = await sendJson<{ id: string; secret?: string }>('POST', path, { data: { ...a, url: `${BASE}?token=${token}` } });
    if (!created) throw new Error(`Frame.io did not return the "${a.name}" action`);
    if (created.secret) secrets[a.event] = created.secret;
    console.log(`created: ${a.name} (${created.id})${created.secret ? ', secret saved' : ''}`);
  }
  writeFileSync(secretsFile, JSON.stringify(secrets, null, 2));
  chmodSync(secretsFile, 0o600);
}

main().catch((err) => {
  console.error('[frameio-actions]', (err as Error).message);
  process.exit(1);
});
