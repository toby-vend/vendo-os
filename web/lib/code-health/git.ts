/**
 * Git helpers for the code-health scanner — selecting which files to feed
 * into the LLM review layer.
 *
 * We want the agent's per-file review budget spent on code that actually
 * moves. Files touched in the last 7 days are the natural priority
 * target: that's where bugs land and that's where the design is fresh
 * enough to refactor. Files that haven't changed in months are stable
 * and already well-shaken; reviewing them again every day is waste.
 *
 * `getChangedFiles({ sinceDays, cap })` returns the top N files by
 * churn weight (number of commits touching the file in the window),
 * filtered to TypeScript / JavaScript / Eta / SQL and excluding generated
 * and vendored paths.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root — three levels up from web/lib/code-health/. */
export const REPO_ROOT = resolve(__dirname, '../../../');

const ALLOWED_EXT = /\.(ts|tsx|js|mjs|cjs|eta|sql)$/;
const EXCLUDE_PREFIX = [
  'node_modules/',
  '.planning/',
  '.claude/',
  'dist/',
  'build/',
  'public/assets/agent-chat',  // generated bundle
  'outputs/',
  'data/',
  'web/public/',                // legacy CSS path; production CSS lives in public/
  'web/client/agent-chat/dist',
];

/**
 * Return the files touched in the last `sinceDays` days, ordered by
 * commit-count desc, capped at `cap`. Filtered to reviewable text files
 * and pruned against generated paths.
 *
 * Files that have since been deleted are excluded (we can't review a
 * file that isn't on disk).
 */
export async function getChangedFiles(opts: {
  sinceDays: number;
  cap: number;
}): Promise<string[]> {
  const { sinceDays, cap } = opts;

  // `git log` with `--name-only` prints each commit's touched files; we
  // then aggregate by file → commit-count for churn-weight ranking.
  const { stdout } = await execFileP(
    'git',
    [
      'log',
      `--since=${sinceDays}.days`,
      '--name-only',
      '--pretty=format:',
      'HEAD',
    ],
    { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 },
  );

  const counts = new Map<string, number>();
  for (const line of stdout.split('\n')) {
    const p = line.trim();
    if (!p) continue;
    if (!ALLOWED_EXT.test(p)) continue;
    if (EXCLUDE_PREFIX.some(prefix => p.startsWith(prefix))) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }

  // Sort by churn desc, then path asc for stable ordering. Drop files
  // that no longer exist on disk (renamed/deleted in HEAD).
  const ranked = Array.from(counts.entries())
    .filter(([p]) => {
      try {
        return existsSync(resolve(REPO_ROOT, p)) && statSync(resolve(REPO_ROOT, p)).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([p]) => p);

  return ranked;
}

/** Current HEAD short sha — used to stamp `resolved_commit` when a finding clears. */
export async function getHeadSha(): Promise<string | null> {
  try {
    const { stdout } = await execFileP('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
