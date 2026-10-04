/**
 * Background worker for AI video edits started from Frame.io (plans/2026-10-03-frameio-native-ai-edits.md, step 2).
 *
 *   npm run video:worker              runs forever (installed as a login item by video:worker:install)
 *   npm run video:worker -- --once    claims at most one job, then exits (testing)
 *
 * Every 30 seconds it checks in, puts back any of its own jobs left half-done by a laptop that was shut,
 * and claims the next job routed to this Mac's editor. It runs the same first-cut / revision scripts as the
 * command line, so all their checks (repo guard, loudness, SOP naming, AI never marks Final) still apply.
 *
 * Who this Mac belongs to comes from ~/.vendo-video-worker.json ({"email": "..."}), written at install.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
import { homedir, hostname } from 'os';
import { join, resolve } from 'path';

const POLL_MS = 30_000;
const HEARTBEAT_MS = 60_000;
const once = process.argv.includes('--once');
const repo = resolve('.');

function workerEmail(): string {
  const file = join(homedir(), '.vendo-video-worker.json');
  const fromArg = process.argv.includes('--email') ? process.argv[process.argv.indexOf('--email') + 1] : undefined;
  const email = fromArg ?? (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { email?: string }).email : undefined);
  if (!email) throw new Error('No editor email: run npm run video:worker:install -- --email you@vendodigital.co.uk');
  return email.toLowerCase();
}

const log = (msg: string) => console.log(`${new Date().toISOString().slice(0, 19).replace('T', ' ')} ${msg}`);

/** Run one of the npm video scripts, keeping the Mac awake, logging to the job folder, heartbeating meanwhile. */
function runScript(script: string, args: string[], logFile: string, onBeat: () => Promise<void>, jobId: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(logFile, { flags: 'a' });
    // caffeinate -i keeps the Mac from idle-sleeping while the edit runs (closing the lid still stops it).
    const child = spawn('caffeinate', ['-i', 'npx', 'tsx', script, ...args], { cwd: repo, env: { ...process.env, VIDEO_JOB_ID: String(jobId) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d: Buffer) => { out.write(d); tail = (tail + d.toString()).slice(-4000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const beat = setInterval(() => { onBeat().catch(() => {}); }, HEARTBEAT_MS);
    child.on('error', (err) => { clearInterval(beat); out.end(); reject(err); });
    child.on('close', (code) => {
      clearInterval(beat);
      out.end();
      if (code === 0) return resolvePromise();
      // The scripts print "[video-edit] <reason>" on failure; surface that line.
      const reason = tail.split('\n').reverse().find((l) => /^\[video-(edit|revise)\]/.test(l.trim())) ?? tail.trim().split('\n').pop() ?? '';
      reject(new Error(reason.replace(/^\[video-(edit|revise)\]\s*/, '').trim() || `exited with ${code}`));
    });
  });
}

/** Run one of the Python tools (export_layers.py) the same way: logged, heartbeating, Mac kept awake. */
function runPython(args: string[], logFile: string, onBeat: () => Promise<void>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const out = createWriteStream(logFile, { flags: 'a' });
    const child = spawn('caffeinate', ['-i', 'python3', ...args], { cwd: repo, env: { ...process.env, PRODUCER_BROWSER_GPU_MODE: 'hardware' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d: Buffer) => { out.write(d); tail = (tail + d.toString()).slice(-2000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const beat = setInterval(() => { onBeat().catch(() => {}); }, HEARTBEAT_MS);
    child.on('error', (err) => { clearInterval(beat); out.end(); reject(err); });
    child.on('close', (code) => {
      clearInterval(beat);
      out.end();
      if (code === 0) resolvePromise();
      else reject(new Error(tail.trim().split('\n').pop() || `exited with ${code}`));
    });
  });
}

interface Delivery { fileId: string; stackId?: string; view_url?: string; name: string; version: number }
const readDelivery = (dir: string): Delivery | null =>
  existsSync(join(dir, 'delivery.json')) ? (JSON.parse(readFileSync(join(dir, 'delivery.json'), 'utf8')) as Delivery) : null;

/** Every new AI version starts at In Progress: the editor works on it before Gate 1. Never fails the job. */
async function markInProgress(fileId: string): Promise<void> {
  try {
    const io = await import('../web/lib/frameio/media-io.js');
    const { setFileStatus, STATUS } = await import('../web/lib/video-jobs/gates.js');
    await setFileStatus((await io.getAsset(fileId)).project_id, fileId, STATUS.inProgress);
  } catch (err) {
    log(`could not set Status to In Progress: ${(err as Error).message}`);
  }
}

/** Slack: queued in Vendo OS and posted by Vercel within a minute, to the same channel as the gate messages. Never fails the job. */
async function notify(text: string): Promise<void> {
  try {
    const { queueSlack } = await import('../web/lib/video-jobs/store.js');
    await queueSlack(text);
    log(`slack: ${text.slice(0, 120)}`);
  } catch (err) {
    log(`Slack message not queued: ${(err as Error).message}`);
  }
}
/** "Organic | Vox Pops Episode (AI) | 9x16 | 50s | v05 | Internal.mp4" -> "Organic | Vox Pops Episode (AI)" */
const videoName = (fileName: string) => fileName.replace(/\.mp4$/i, '').replace(/\s*\|\s*(9x16|4x5|1x1|16x9)\b.*$/, '');
const tag = (n: number) => `v${String(n).padStart(2, '0')}`;
const macName = () => { const who = workerEmail().split('@')[0]; return `${who.charAt(0).toUpperCase()}${who.slice(1)}'s Mac`; };

async function runJob(job: import('../web/lib/video-jobs/store.js').VideoJob): Promise<void> {
  const store = await import('../web/lib/video-jobs/store.js');
  const io = await import('../web/lib/frameio/media-io.js');
  const beat = (m?: string) => store.heartbeatJob(job.id, m);
  log(`job ${job.id}: ${job.kind} for ${job.requested_by_name ?? job.requested_by_email}`);

  if (job.kind === 'first_cut') {
    const { pickShootFolder } = await import('../web/lib/video-jobs/destination.js');
    const params = JSON.parse(job.params) as import('../web/lib/video-jobs/store.js').FirstCutParams;
    const dir = join(homedir(), 'video-edits', `${params.section === 'Organic' ? 'organic' : 'social'}-job${job.id}`);
    mkdirSync(dir, { recursive: true });
    try {
      await beat('Finding the shoot folder');
      const source = await io.getAsset(job.source_file_id);
      await notify(`AI First Cut started: "${source.name}" (${params.section === 'Organic' ? 'Organic' : 'Social Ad'}), v01. Usually ready in 15 to 25 minutes. Job ${job.id}, ${macName()}.`);
      const shoot = pickShootFolder(await io.ancestorFolders(source));
      if (!shoot) throw new Error('the clip is not inside a shoot folder (expected <shoot> / Raw Footage / …)');
      await beat('Editing');
      await runScript('scripts/video-edit-run.ts', [
        '--source', job.source_file_id, '--dest', shoot, '--auto-name', '--section', params.section, '--brand', params.brand,
        '--notes', params.notes, '--job', dir, '--upload',
      ], join(dir, 'worker.log'), () => beat(), job.id);
      const d = readDelivery(dir);
      if (!d) throw new Error('the edit finished but nothing was delivered');
      await store.finishJob(job.id, { jobDir: dir, fileId: d.fileId, stackId: d.stackId ?? null, viewUrl: d.view_url ?? null, message: `Delivered "${d.name}"` });
      await markInProgress(d.fileId);
      await notify(`AI First Cut ready: "${videoName(d.name)}" ${tag(d.version)}. ${d.view_url ?? ''}`.trim());
      log(`job ${job.id}: delivered ${d.name}`);
    } catch (err) {
      const reason = (err as Error).message;
      await store.failJob(job.id, reason, dir);
      await io.createComment(job.source_file_id, `AI First Cut (job ${job.id}) didn't finish: ${reason}. Try again, or send the job number to the Lead Video Editor.`).catch(() => {});
      await notify(`AI First Cut failed (job ${job.id}): ${reason}`);
      log(`job ${job.id}: failed: ${reason}`);
    }
    return;
  }

  if (job.kind === 'export') {
    const dir = job.job_dir;
    try {
      if (!dir || !existsSync(join(dir, 'delivery.json'))) throw new Error("this Mac doesn't have the job folder for that video");
      const d = readDelivery(dir)!;
      const version = `v${String(d.version).padStart(2, '0')}`;
      const out = join(dir, `export-${version}`);
      await notify(`Export for Editing started: "${videoName(d.name)}" ${version}. Usually ready in about 5 minutes. Job ${job.id}, ${macName()}.`);
      await beat('Rendering layers');
      await runPython(['tools/video-edit/export_layers.py', dir, '--out', out], join(dir, 'worker.log'), () => beat());
      await beat('Uploading');
      const folderId = (d as Delivery & { folderId?: string }).folderId;
      if (!folderId) throw new Error('delivery.json has no folder to upload next to');
      const packId = await io.ensureFolderPath(folderId, [`Edit Pack ${version}`]);
      const extrasId = await io.ensureFolderPath(packId, ['extras']);
      const { readdirSync } = await import('fs');
      for (const f of readdirSync(out)) if (f !== 'extras') await io.uploadLocalFile(join(out, f), packId, f);
      for (const f of readdirSync(join(out, 'extras'))) await io.uploadLocalFile(join(out, 'extras', f), extrasId, f);
      await io.createComment(d.fileId, `Edit Pack ${version} is ready in the "Edit Pack ${version}" folder next to this video: picture, graphics (transparent), captions and a Premiere timeline. The README says how to open it in Premiere Pro or CapCut. After hand edits the AI can't revise this video any more.`).catch(() => {});
      await store.finishJob(job.id, { jobDir: dir, fileId: d.fileId, stackId: null, viewUrl: null, message: `Exported Edit Pack ${version}` });
      await notify(`Edit Pack ready: "${videoName(d.name)}" ${version}, in the "Edit Pack ${version}" folder next to the video. ${d.view_url ?? ''}`.trim());
      log(`job ${job.id}: exported Edit Pack ${version}`);
    } catch (err) {
      const reason = (err as Error).message;
      await store.failJob(job.id, reason, dir);
      await io.createComment(job.source_file_id, `Export for Editing (job ${job.id}) didn't finish: ${reason}.`).catch(() => {});
      await notify(`Export for Editing failed (job ${job.id}): ${reason}`);
      log(`job ${job.id}: failed: ${reason}`);
    }
    return;
  }

  // revision: runs in the job folder this Mac made for the first cut
  const dir = job.job_dir;
  try {
    if (!dir || !existsSync(join(dir, 'delivery.json'))) throw new Error("this Mac doesn't have the job folder for that video (it was made on another Mac, or deleted)");
    const before = readDelivery(dir)!;
    await notify(`AI Revision started: "${videoName(before.name)}" ${tag(before.version)} to ${tag(before.version + 1)}. Usually ready in 5 to 15 minutes. Job ${job.id}, ${macName()}.`);
    await beat('Applying comments');
    await runScript('scripts/video-edit-revise.ts', ['--job', dir, '--upload'], join(dir, 'worker.log'), () => beat(), job.id);
    const after = readDelivery(dir)!;
    if (after.version === before.version) {
      await io.createComment(before.fileId, 'AI Revision: there were no open comments to apply, so nothing changed.').catch(() => {});
      await store.finishJob(job.id, { jobDir: dir, fileId: before.fileId, stackId: before.stackId ?? null, viewUrl: before.view_url ?? null, message: 'No open comments' });
      await notify(`AI Revision: "${videoName(before.name)}" ${tag(before.version)} had no open comments, so nothing changed.`);
      log(`job ${job.id}: no open comments`);
      return;
    }
    await store.finishJob(job.id, { jobDir: dir, fileId: after.fileId, stackId: after.stackId ?? null, viewUrl: after.view_url ?? null, message: `Delivered "${after.name}"` });
    await markInProgress(after.fileId);
    await notify(`AI Revision ready: "${videoName(after.name)}" ${tag(after.version)}. ${after.view_url ?? ''}`.trim());
    log(`job ${job.id}: delivered ${after.name}`);
  } catch (err) {
    const reason = (err as Error).message;
    await store.failJob(job.id, reason, dir);
    await io.createComment(job.source_file_id, `AI Revision (job ${job.id}) didn't finish: ${reason}. Your comments are still open.`).catch(() => {});
    await notify(`AI Revision failed (job ${job.id}): ${reason}. The comments are still open.`);
    log(`job ${job.id}: failed: ${reason}`);
  }
}

async function main() {
  const email = workerEmail();
  const store = await import('../web/lib/video-jobs/store.js');
  log(`AI edit worker for ${email} on ${hostname()}${once ? ' (once)' : ''}`);
  for (;;) {
    try {
      await store.touchWorker(email, hostname());
      const requeued = await store.requeueStale(email);
      if (requeued) log(`put ${requeued} interrupted job(s) back in the queue`);
      const job = await store.claimNextJob(email);
      if (job) await runJob(job);
      else if (once) { log('no jobs'); return; }
      if (once) return;
      if (job) continue; // check straight away for the next one
    } catch (err) {
      log(`error: ${(err as Error).message}`);
      if (once) process.exit(1);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error('[video-worker]', (err as Error).message);
  process.exit(1);
});
