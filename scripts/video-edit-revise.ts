/**
 * Apply Frame.io review comments to a delivered AI edit and deliver the next version
 * (Phase 2 of plans/2026-10-03-frameio-ai-video-edits.md).
 *
 *   npm run video:revise -- --job ~/video-edits/<job> [--upload]
 *   npm run video:revise -- --job ~/video-edits/<job> --deliver-only   (deliver a revision already made in a dry run)
 *
 * 1. reads delivery.json (what was delivered last) and pulls the open review comments from that version
 * 2. keeps the delivered files as output-vNN.mp4 / edit-vNN.json / notes-vNN.md
 * 3. runs a headless edit session in apply_comments mode (inputs/ holds any material the comments need)
 * 4. checks revision.json + the new output.mp4
 * 5. with --upload: uploads "<concept> | 9x16 | <len>s | vNN+1 | Internal.mp4", stacks it on the delivered
 *    version, ticks off the comments it handled and posts one summary comment (Frame.io's API has no replies).
 *
 * The AI never marks anything Final. Comments it couldn't do stay open, with the reason in the summary.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { arg, clock, finaliseOutput, lengthLabel, runGuarded, sessionRules } from './lib/video-edit.js';

interface Delivery { fileId: string; folderId?: string; stackId?: string; name: string; version: number; history?: Array<{ version: number; fileId: string }> }
interface RevisionItem { id: string; done: boolean; what: string }

async function main() {
  const jobArg = arg('--job');
  if (!jobArg) throw new Error('Usage: npm run video:revise -- --job <job dir> [--upload]');
  const job = resolve(jobArg.replace(/^~/, process.env.HOME ?? '~'));
  const upload = process.argv.includes('--upload');
  const repo = resolve('.');
  const io = await import('../web/lib/frameio/media-io.js');

  const delivery = JSON.parse(readFileSync(join(job, 'delivery.json'), 'utf8')) as Delivery;
  const base = JSON.parse(readFileSync(join(job, 'base.json'), 'utf8')) as { fps: number };
  const v = delivery.version;
  const tag = (n: number) => `v${String(n).padStart(2, '0')}`;

  // --deliver-only: the revision was already made and checked (dry run); just deliver it.
  if (process.argv.includes('--deliver-only')) {
    const out = join(job, 'output.mp4');
    const revision = JSON.parse(readFileSync(join(job, 'revision.json'), 'utf8')) as RevisionItem[];
    const summary = readFileSync(join(job, `summary-${tag(v + 1)}.md`), 'utf8');
    const seconds = Number((await import('child_process')).execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
    const fileName = nextName(delivery.name, seconds, tag(v + 1));
    await deliver(io, job, delivery, out, fileName, revision, summary);
    return;
  }

  // 1. open review comments on the delivered version (skip the AI's own notes comments)
  const comments = (await io.listComments(delivery.fileId))
    .filter((c) => !c.completed_at && !/^AI (first cut|revision)/.test(c.text.trim()))
    .map((c) => ({ id: c.id, text: c.text.trim(), at: typeof c.timestamp === 'number' ? Math.round((c.timestamp / base.fps) * 100) / 100 : null }));
  if (!comments.length) {
    console.log(`[video-revise] no open comments on ${tag(v)}; nothing to do`);
    return;
  }
  console.log(`[video-revise] ${comments.length} open comment(s) on ${tag(v)}`);
  comments.forEach((c) => console.log(`  ${c.at === null ? '—' : clock(c.at)} ${c.text}`));

  // 2. keep what was delivered
  for (const [f, ext] of [['output', 'mp4'], ['edit', 'json'], ['notes', 'md']] as const) {
    const src = join(job, `${f}.${ext}`);
    const dst = join(job, `${f}-${tag(v)}.${ext}`);
    if (existsSync(src) && !existsSync(dst)) copyFileSync(src, dst);
  }

  // 3. brief + headless revision
  const brief = JSON.parse(readFileSync(join(job, 'brief.json'), 'utf8'));
  brief.mode = 'apply_comments';
  brief.revising = tag(v);
  brief.comments = comments;
  brief.inputs = existsSync(join(job, 'inputs')) ? 'inputs/ (see inputs/README.md)' : null;
  writeFileSync(join(job, 'brief.json'), JSON.stringify(brief, null, 2));
  const startedAt = Date.now();
  const prompt = [
    `Apply the review comments for the job in this folder (${job}), following the "Revise" section of the Vendo video edit instructions in your system prompt.`,
    `Read brief.json first: comments[].at is seconds on the delivered cut (${tag(v)}, kept as output-${tag(v)}.mp4).`,
    brief.inputs ? 'Material the comments ask for (clips, logos) is in inputs/; read inputs/README.md.' : '',
    sessionRules(repo),
    `Finish with a new output.mp4, the updated edit.json and notes.md, and revision.json covering every comment id.`,
  ].join(' ');
  await runGuarded(prompt, repo, job, `claude-${tag(v + 1)}.log`);

  // 4. verify
  const out = join(job, 'output.mp4');
  const revPath = join(job, 'revision.json');
  if (!existsSync(revPath) || statSync(out).mtimeMs < startedAt) throw new Error(`Revision did not produce a new output.mp4 and revision.json in ${job}`);
  const revision = JSON.parse(readFileSync(revPath, 'utf8')) as RevisionItem[];
  const missing = comments.filter((c) => !revision.some((r) => r.id === c.id));
  if (missing.length) throw new Error(`revision.json does not cover comment(s): ${missing.map((m) => m.id).join(', ')}`);
  const seconds = finaliseOutput(out);
  const fileName = nextName(delivery.name, seconds, tag(v + 1));
  console.log(`[video-revise] output ${seconds.toFixed(1)}s → "${fileName}"`);
  const summary = [
    `AI revision (${tag(v + 1)}, Internal). Your notes on ${tag(v)}:`,
    '',
    ...comments.map((c) => {
      const r = revision.find((x) => x.id === c.id)!;
      return `${r.done ? '✓' : '✗'} ${c.at === null ? '' : clock(c.at) + ' '}"${c.text}": ${r.what}`;
    }),
  ].join('\n');
  writeFileSync(join(job, `summary-${tag(v + 1)}.md`), summary);
  console.log(summary);

  if (!upload) {
    console.log(`[video-revise] dry run: not uploaded. Re-run with --upload to deliver ${tag(v + 1)}.`);
    return;
  }

  await deliver(io, job, delivery, out, fileName, revision, summary);
}

/** SOP name for the next version: new length, next version number, status back to Internal. */
function nextName(name: string, seconds: number, version: string): string {
  return name
    .replace(/\|\s*\d+s\s*\|/, `| ${lengthLabel(seconds)} |`)
    .replace(/\|\s*v\d{2,}\s*\|/, `| ${version} |`)
    .replace(/\|\s*(Final|Client Review)\.mp4$/i, '| Internal.mp4');
}

/** Upload next to the delivered version, stack it, tick handled comments, post the summary, record the delivery. */
async function deliver(
  io: typeof import('../web/lib/frameio/media-io.js'), job: string, delivery: Delivery, out: string,
  fileName: string, revision: RevisionItem[], summary: string,
): Promise<void> {
  const v = delivery.version;
  const delivered = await io.getAsset(delivery.stackId ?? delivery.fileId);
  const folderId = delivered.type === 'version_stack' ? delivered.parent_id! : (delivery.folderId ?? delivered.parent_id!);
  const file = await io.uploadLocalFile(out, folderId, fileName);
  const stack = await io.stackNewVersion(delivery.stackId ?? delivery.fileId, file.id);
  for (const r of revision) if (r.done) await io.setCommentCompleted(r.id);
  await io.createComment(file.id, summary.slice(0, 9000));
  const next: Delivery = {
    ...delivery, fileId: file.id, folderId, stackId: stack.id, name: fileName, version: v + 1,
    history: [...(delivery.history ?? [{ version: v, fileId: delivery.fileId }]), { version: v + 1, fileId: file.id }],
  };
  writeFileSync(join(job, 'delivery.json'), JSON.stringify(next, null, 2));
  console.log(`[video-revise] delivered "${fileName}" on the stack ${stack.view_url}`);
}

main().catch((err) => {
  console.error('[video-revise]', (err as Error).message);
  process.exit(1);
});
