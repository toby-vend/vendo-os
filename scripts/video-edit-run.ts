/**
 * Run one AI video edit end to end (Phase 2 of plans/2026-10-03-frameio-ai-video-edits.md).
 *
 *   npm run video:edit -- --source <frame.io asset url|id> --dest <frame.io folder url|id> \
 *       --name "Organic | Vox Pops Episode" [--brand vendo] [--notes "…"] [--job <existing job dir>] [--upload]
 *
 * 1. downloads the original from Frame.io into ~/video-edits/<job>/source.<ext>
 * 2. writes brief.json and runs a headless Claude Code session with the vendo-video-edit skill
 * 3. checks output.mp4 + notes.md exist and the duration is sane
 * 4. with --upload: uploads "<name> | 9x16 | <len>s | v01 | Internal.mp4" into --dest
 *    and posts notes.md as a comment. Without --upload it stops after step 3 (dry run).
 *
 * The AI never marks anything Final: the status in the filename is always Internal.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { spawn, execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { extname, join, resolve } from 'path';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/**
 * Run the edit as a headless Claude Code session working INSIDE the job folder. The skill is passed as an
 * appended system prompt (rather than loaded from the repo) so the session never needs the repo as its
 * working directory; git is blocked, and main() checks the repo is untouched afterwards.
 */
function runClaude(prompt: string, jobDir: string, skill: string, logFile: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const args = [
      '-p', prompt,
      '--append-system-prompt', skill,
      '--allowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
      '--disallowedTools', 'Bash(git:*)', 'Bash(gh:*)',
      '--permission-mode', 'acceptEdits',
      '--output-format', 'text',
    ];
    const cwd = jobDir;
    // .env.local carries an ANTHROPIC_API_KEY for the web app; it would override the machine's Claude Code
    // login (and the Vendo-OS key is known to 401), so the edit session runs on the local login instead.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => { log += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { log += d; process.stderr.write(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      writeFileSync(logFile, log);
      code === 0 ? resolvePromise() : reject(new Error(`claude exited with ${code} (log: ${logFile})`));
    });
  });
}

/**
 * Fingerprint of the edit pipeline's own files: the last commit touching them plus their working-tree state.
 * Scoped to these paths only, so other sessions committing unrelated work (or hooks touching other skills)
 * while an edit runs don't trip the guard.
 */
const GUARDED = ['tools/video-edit', '.claude/skills/vendo-video-edit', 'scripts/video-edit-run.ts', 'web/lib/frameio'];
function repoState(repo: string): string {
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a]).toString();
  return git('log', '-1', '--format=%H', '--', ...GUARDED) + git('status', '--porcelain', '--untracked-files=all', '--', ...GUARDED);
}

async function main() {
  const source = arg('--source');
  const dest = arg('--dest');
  const name = arg('--name');
  const brand = arg('--brand') ?? 'vendo';
  const notes = arg('--notes') ?? '';
  const upload = process.argv.includes('--upload');
  if (!source || !dest || !name) throw new Error('Usage: --source <asset> --dest <folder> --name "<Persona | Angle | Offer>" [--brand vendo] [--notes …] [--upload]');
  if (/\|\s*(Final|Client Review)\s*$/i.test(name)) throw new Error('--name is the concept part only; the runner adds ratio, length, version and status');

  const io = await import('../web/lib/frameio/media-io.js');
  const repo = resolve('.');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const job = arg('--job') ? resolve(arg('--job')!) : join(homedir(), 'video-edits', `${slug}-${stamp}`);
  mkdirSync(job, { recursive: true });
  console.log(`[video-edit] job ${job}`);

  // 1. download the original (skipped when --job points at a folder that already has it)
  const asset = await io.getAsset(io.idFrom(source));
  const fileId = io.playableFileId(asset);
  const srcPath = join(job, `source${extname(asset.head_version?.name ?? asset.name) || '.mp4'}`);
  if (existsSync(srcPath) && asset.file_size && statSync(srcPath).size === (asset.head_version?.file_size ?? asset.file_size)) {
    console.log('[video-edit] original already downloaded');
  } else {
    const dl = await io.downloadOriginal(fileId, srcPath);
    console.log(`[video-edit] downloaded "${dl.name}" (${(dl.bytes / 1e6).toFixed(0)} MB)`);
  }

  // 2. brief + headless edit
  const brief = { mode: 'first_cut', source: srcPath, brand, concept: name, ratio: '9x16', notes, frameio: { asset: asset.id, file: fileId, dest: io.idFrom(dest) } };
  writeFileSync(join(job, 'brief.json'), JSON.stringify(brief, null, 2));
  const skill = readFileSync(join(repo, '.claude/skills/vendo-video-edit/SKILL.md'), 'utf8')
    .replace(/^---[\s\S]*?---\n/, '')
    .replaceAll('tools/video-edit/', `${repo}/tools/video-edit/`);
  const prompt = [
    `Make the first cut for the job in this folder (${job}), following the Vendo video edit instructions in your system prompt.`,
    `Read brief.json first. The tools are in ${repo}/tools/video-edit/ (run them with python3 and their absolute paths).`,
    'Write files only inside this job folder. Never edit, create or commit anything in the Vendo-OS repo, even to fix a tool:',
    'if a tool misbehaves, work around it inside the job folder and describe it under "Tool issues" in notes.md.',
    'Finish with output.mp4, edit.json and notes.md in this folder. Do not upload anything.',
  ].join(' ');
  const before = repoState(repo);
  await runClaude(prompt, job, skill, join(job, 'claude.log'));
  const after = repoState(repo);
  if (before !== after) {
    throw new Error(`The edit session changed the Vendo-OS repo (HEAD or tools/skill files). Review with git before delivering anything from ${job}.`);
  }

  // 3. verify
  const out = join(job, 'output.mp4');
  const notesPath = join(job, 'notes.md');
  if (!existsSync(out) || !existsSync(notesPath)) throw new Error(`Edit did not produce output.mp4 and notes.md in ${job}`);
  // SFX are mixed on top of the levelled voice, which can nudge the peak past -1.5 dBTP; a final limiter
  // pass (video stream copied, untouched) keeps every delivery inside the platform loudness spec.
  const limited = join(job, 'output.limited.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-c:v', 'copy', '-af', 'alimiter=limit=0.84:level=false', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', limited]);
  renameSync(limited, out);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  if (!(seconds > 3)) throw new Error(`output.mp4 looks wrong (${seconds}s)`);
  const length = Math.max(5, Math.round(seconds / 5) * 5);
  const fileName = `${name} | 9x16 | ${length}s | v01 | Internal.mp4`;
  console.log(`[video-edit] output ${seconds.toFixed(1)}s → "${fileName}"`);

  if (!upload) {
    console.log('[video-edit] dry run: not uploaded. Re-run with --upload to send v01 to Frame.io.');
    return;
  }
  // 4. upload v01 + notes comment
  const file = await io.uploadLocalFile(out, io.idFrom(dest), fileName);
  const body = `AI first cut (v01, Internal). Notes for review:\n\n${readFileSync(notesPath, 'utf8').trim()}`;
  await io.createComment(file.id, body.slice(0, 9000));
  writeFileSync(join(job, 'delivery.json'), JSON.stringify({ fileId: file.id, name: fileName, view_url: file.view_url, version: 1 }, null, 2));
  console.log(`[video-edit] uploaded ${file.view_url}`);
}

main().catch((err) => {
  console.error('[video-edit]', (err as Error).message);
  process.exit(1);
});
