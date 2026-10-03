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

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { extname, join, resolve } from 'path';
import { arg, finaliseOutput, lengthLabel, runGuarded, sessionRules } from './lib/video-edit.js';

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
  const prompt = [
    `Make the first cut for the job in this folder (${job}), following the Vendo video edit instructions in your system prompt.`,
    'Read brief.json first.', sessionRules(repo),
    'Finish with output.mp4, edit.json and notes.md in this folder.',
  ].join(' ');
  await runGuarded(prompt, repo, job, 'claude.log');

  // 3. verify
  const out = join(job, 'output.mp4');
  const notesPath = join(job, 'notes.md');
  if (!existsSync(out) || !existsSync(notesPath)) throw new Error(`Edit did not produce output.mp4 and notes.md in ${job}`);
  const seconds = finaliseOutput(out);
  const length = lengthLabel(seconds);
  const fileName = `${name} | 9x16 | ${length} | v01 | Internal.mp4`;
  console.log(`[video-edit] output ${seconds.toFixed(1)}s → "${fileName}"`);

  if (!upload) {
    console.log('[video-edit] dry run: not uploaded. Re-run with --upload to send v01 to Frame.io.');
    return;
  }
  // 4. upload v01 + notes comment
  const file = await io.uploadLocalFile(out, io.idFrom(dest), fileName);
  const body = `AI first cut (v01, Internal). Notes for review:\n\n${readFileSync(notesPath, 'utf8').trim()}`;
  await io.createComment(file.id, body.slice(0, 9000));
  writeFileSync(join(job, 'delivery.json'), JSON.stringify({ fileId: file.id, folderId: io.idFrom(dest), name: fileName, view_url: file.view_url, version: 1, history: [{ version: 1, fileId: file.id }] }, null, 2));
  console.log(`[video-edit] uploaded ${file.view_url}`);
}

main().catch((err) => {
  console.error('[video-edit]', (err as Error).message);
  process.exit(1);
});
