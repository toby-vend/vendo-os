/**
 * Shared pieces of the AI video-edit runners (first cut: scripts/video-edit-run.ts,
 * revisions: scripts/video-edit-revise.ts).
 */
import { spawn, execFileSync } from 'child_process';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** The vendo-video-edit skill as a system prompt, with tool paths made absolute for a session run in the job folder. */
export function loadSkill(repo: string): string {
  return readFileSync(join(repo, '.claude/skills/vendo-video-edit/SKILL.md'), 'utf8')
    .replace(/^---[\s\S]*?---\n/, '')
    .replaceAll('tools/video-edit/', `${repo}/tools/video-edit/`);
}

/** Rules every edit session gets, whatever the mode. */
export function sessionRules(repo: string): string {
  return [
    `The tools are in ${repo}/tools/video-edit/ (run them with python3 and their absolute paths).`,
    'Write files only inside this job folder. Never edit, create or commit anything in the Vendo-OS repo, even to fix a tool:',
    'if a tool misbehaves, work around it inside the job folder and describe it under "Tool issues" in notes.md.',
    'Do not upload anything.',
  ].join(' ');
}

/**
 * Run the edit as a headless Claude Code session working INSIDE the job folder. The skill is passed as an
 * appended system prompt (rather than loaded from the repo) so the session never needs the repo as its
 * working directory; git is blocked, and callers check the repo is untouched afterwards.
 */
export function runClaude(prompt: string, jobDir: string, skill: string, logFile: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const args = [
      '-p', prompt,
      '--append-system-prompt', skill,
      '--allowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
      '--disallowedTools', 'Bash(git:*)', 'Bash(gh:*)',
      '--permission-mode', 'acceptEdits',
      '--output-format', 'text',
    ];
    // .env.local carries an ANTHROPIC_API_KEY for the web app; it would override the machine's Claude Code
    // login (and the Vendo-OS key is known to 401), so the edit session runs on the local login instead.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    const child = spawn('claude', args, { cwd: jobDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
const GUARDED = ['tools/video-edit', '.claude/skills/vendo-video-edit', 'scripts/video-edit-run.ts', 'scripts/video-edit-revise.ts', 'scripts/lib/video-edit.ts', 'web/lib/frameio'];
export function repoState(repo: string): string {
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a]).toString();
  return git('log', '-1', '--format=%H', '--', ...GUARDED) + git('status', '--porcelain', '--untracked-files=all', '--', ...GUARDED);
}

/** Run an edit session and refuse to continue if it touched the pipeline's own files. */
export async function runGuarded(prompt: string, repo: string, job: string, logName: string): Promise<void> {
  const before = repoState(repo);
  await runClaude(prompt, job, loadSkill(repo), join(job, logName));
  if (repoState(repo) !== before) {
    throw new Error(`The edit session changed the Vendo-OS repo (pipeline files). Review with git before delivering anything from ${job}.`);
  }
}

/**
 * Final delivery pass: SFX mixed on top of the levelled voice can nudge the peak past -1.5 dBTP, so a limiter
 * pass (video stream copied, untouched) keeps every delivery in spec. Returns the duration in seconds.
 */
export function finaliseOutput(out: string): number {
  const limited = out.replace(/\.mp4$/, '.limited.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-c:v', 'copy', '-af', 'alimiter=limit=0.84:level=false', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', limited]);
  renameSync(limited, out);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  if (!(seconds > 3)) throw new Error(`${out} looks wrong (${seconds}s)`);
  return seconds;
}

/** SOP length field: nearest 5 seconds. */
export function lengthLabel(seconds: number): string {
  return `${Math.max(5, Math.round(seconds / 5) * 5)}s`;
}

/** "m:ss" for comment summaries. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
