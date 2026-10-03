/**
 * Run one AI video edit end to end (Phase 2 of plans/2026-10-03-frameio-ai-video-edits.md).
 *
 *   npm run video:edit -- --source <frame.io asset url|id> --dest <frame.io folder url|id> \
 *       --name "Organic | Vox Pops Episode" [--brand vendo] [--notes "…"] [--upload]
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { extname, join, resolve } from 'path';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function runClaude(prompt: string, cwd: string, jobDir: string, logFile: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const args = [
      '-p', prompt,
      '--add-dir', jobDir,
      '--allowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill',
      '--permission-mode', 'acceptEdits',
      '--output-format', 'text',
    ];
    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const job = join(homedir(), 'video-edits', `${slug}-${stamp}`);
  mkdirSync(job, { recursive: true });
  console.log(`[video-edit] job ${job}`);

  // 1. download the original
  const asset = await io.getAsset(io.idFrom(source));
  const fileId = io.playableFileId(asset);
  const srcPath = join(job, `source${extname(asset.head_version?.name ?? asset.name) || '.mp4'}`);
  const dl = await io.downloadOriginal(fileId, srcPath);
  console.log(`[video-edit] downloaded "${dl.name}" (${(dl.bytes / 1e6).toFixed(0)} MB)`);

  // 2. brief + headless edit
  const brief = { mode: 'first_cut', source: srcPath, brand, concept: name, ratio: '9x16', notes, frameio: { asset: asset.id, file: fileId, dest: io.idFrom(dest) } };
  writeFileSync(join(job, 'brief.json'), JSON.stringify(brief, null, 2));
  const prompt = [
    `Use the vendo-video-edit skill (.claude/skills/vendo-video-edit/SKILL.md) to make the first cut for the job in ${job}.`,
    `Read ${job}/brief.json first. Work only inside that job folder and tools/video-edit/.`,
    `Finish with ${job}/output.mp4, ${job}/edit.json and ${job}/notes.md. Do not upload anything.`,
  ].join(' ');
  await runClaude(prompt, repo, job, join(job, 'claude.log'));

  // 3. verify
  const out = join(job, 'output.mp4');
  const notesPath = join(job, 'notes.md');
  if (!existsSync(out) || !existsSync(notesPath)) throw new Error(`Edit did not produce output.mp4 and notes.md in ${job}`);
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
