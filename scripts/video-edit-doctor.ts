/**
 * Checks a Mac is ready to run AI video edits (npm run video:edit / video:revise).
 *
 *   npm run video:doctor
 *
 * Prints a tick or a cross per check with the fix in plain English. Exit code 1 if anything required fails.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, readdirSync, statfsSync } from 'fs';
import { homedir, platform } from 'os';
import { join, resolve } from 'path';

type Result = { ok: boolean; label: string; detail?: string; fix?: string; optional?: boolean };
const results: Result[] = [];
const add = (r: Result) => {
  results.push(r);
  const mark = r.ok ? '✓' : r.optional ? '!' : '✗';
  console.log(`${mark} ${r.label}${r.detail ? `: ${r.detail}` : ''}`);
  if (!r.ok && r.fix) console.log(`    → ${r.fix}`);
};

function version(cmd: string, args: string[] = ['-version']): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr).split('\n')[0].trim();
}

async function main() {
  const repo = resolve('.');
  console.log('AI video edit: checking this Mac\n');

  add({ ok: platform() === 'darwin', label: 'macOS', detail: platform(), fix: 'These tools are set up for macOS.' });

  const major = Number(process.versions.node.split('.')[0]);
  add({ ok: major >= 22, label: 'Node.js 22 or newer', detail: process.versions.node, fix: 'brew install node@22 (then open a new terminal)' });

  const ff = version('ffmpeg');
  add({ ok: !!ff, label: 'ffmpeg', detail: ff?.slice(0, 40) ?? 'not found', fix: 'brew install ffmpeg' });
  add({ ok: !!version('ffprobe'), label: 'ffprobe', fix: 'comes with ffmpeg: brew install ffmpeg' });

  const py = version('python3', ['--version']);
  add({ ok: !!py, label: 'Python 3', detail: py ?? 'not found', fix: 'xcode-select --install (or brew install python)' });

  add({
    ok: existsSync('/Applications/Google Chrome.app'), label: 'Google Chrome', optional: true,
    fix: 'Install Chrome from google.com/chrome (HyperFrames renders with it; it can also fetch its own browser)',
  });

  add({
    ok: existsSync(join(repo, 'tools/video-edit/compose.py')) && existsSync(join(repo, '.claude/skills/vendo-video-edit/SKILL.md')),
    label: 'Vendo-OS edit tools present', fix: 'git pull in your Vendo-OS folder, and check you are on the branch with tools/video-edit',
  });

  // .env.local: names only, never print values
  const needed = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'TOKEN_ENCRYPTION_KEY', 'ADOBE_CLIENT_ID', 'ADOBE_CLIENT_SECRET'];
  const missing = needed.filter((k) => !process.env[k]);
  add({
    ok: existsSync(join(repo, '.env.local')) && missing.length === 0, label: '.env.local settings for Frame.io',
    detail: missing.length ? `missing ${missing.join(', ')}` : 'all present',
    fix: 'Ask Toby or Max for the Vendo-OS .env.local (never commit it)',
  });

  // Frame.io: a real API call through the shared connection
  if (missing.length === 0) {
    try {
      const { getMe } = await import('../web/lib/frameio/client.js');
      const me = await getMe();
      add({ ok: !!me, label: 'Frame.io connection', detail: me?.email ? `signed in as ${me.email}` : 'connected' });
    } catch (err) {
      add({ ok: false, label: 'Frame.io connection', detail: (err as Error).message.slice(0, 120), fix: 'If it says 401, the Frame.io sign-in needs reconnecting in Vendo OS (/admin/frameio-mapping)' });
    }
  }

  // Claude Code: installed and signed in (runs one tiny prompt on the local login, like the edit runner does)
  const claudeVersion = version('claude', ['--version']);
  if (!claudeVersion) {
    add({ ok: false, label: 'Claude Code', detail: 'not found', fix: 'curl -fsSL https://claude.ai/install.sh | bash, then run claude once to sign in' });
  } else {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const r = spawnSync('claude', ['-p', 'Reply with the single word OK', '--output-format', 'text'], { encoding: 'utf8', env, timeout: 90_000, stdio: ['ignore', 'pipe', 'pipe'] });
    const ok = r.status === 0 && /\bOK\b/.test(r.stdout);
    add({ ok, label: 'Claude Code signed in', detail: ok ? claudeVersion : (r.stderr || r.stdout || 'no reply').trim().slice(0, 120), fix: 'Run claude in a terminal and sign in with your own Claude plan' });
  }

  // HyperFrames: renderer and its browser
  const hf = spawnSync('npx', ['-y', 'hyperframes', 'doctor'], { encoding: 'utf8', cwd: repo, timeout: 300_000 });
  const hfText = `${hf.stdout}\n${hf.stderr}`;
  const hfFails = hfText.split('\n').filter((l) => /^\s*✗/.test(l) && !/heygen|kokoro|docker|musicgen/i.test(l));
  add({ ok: hf.status === 0 || hfFails.length === 0, label: 'HyperFrames renderer', detail: hfFails.length ? hfFails.map((l) => l.trim()).join('; ').slice(0, 160) : 'ready', fix: 'Run npx hyperframes doctor and follow its fixes (optional items like HeyGen can be ignored)' });

  // Disk space for footage and renders
  const st = statfsSync(homedir());
  const freeGb = (st.bavail * st.bsize) / 1e9;
  add({ ok: freeGb >= 20, label: 'Free disk space', detail: `${freeGb.toFixed(0)} GB`, fix: 'Free up at least 20 GB: raw 4K clips are 0.5 to 2 GB each', optional: freeGb >= 10 });

  // Downloads folder (only matters if you pull B-roll through the browser)
  let downloadsOk = true;
  try { readdirSync(join(homedir(), 'Downloads')); } catch { downloadsOk = false; }
  add({
    ok: downloadsOk, label: 'Terminal can read Downloads', optional: true,
    fix: 'System Settings > Privacy & Security > Files and Folders > your terminal app > Downloads folder on (or keep B-roll in Frame.io)',
  });

  const blocking = results.filter((r) => !r.ok && !r.optional);
  console.log(blocking.length ? `\n${blocking.length} thing(s) to fix before running an edit.` : '\nReady: you can run npm run video:edit.');
  if (blocking.length) process.exit(1);
}

main().catch((err) => {
  console.error('[video-doctor]', (err as Error).message);
  process.exit(1);
});
