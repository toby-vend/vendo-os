/**
 * Static layer — the cheap, deterministic checks that produce Findings
 * without consulting an LLM. These run on every scan; the repo has no
 * pre-existing typecheck / audit / dead-code job so the signal here
 * alone justifies the agent's existence.
 *
 * Each check is best-effort: if the underlying tool isn't installed or
 * the invocation fails, we record a single P3 'noise' finding pointing
 * at the failure and continue. A broken check should never sink the run.
 *
 * Each returned Finding carries a stable `title` so fingerprints don't
 * churn between scans — line numbers and messages can vary but the
 * (file, finding_type, title) tuple stays consistent.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Finding, FindingType, Severity } from './types.js';
import { REPO_ROOT } from './git.js';

const execFileP = promisify(execFile);

// Cap output size — `npm audit --json` and `knip --reporter json` can be
// many MB on a populated workspace; we only need the structured fields.
const MAX_BUF = 32 * 1024 * 1024;

/**
 * Run every static check and concatenate. Failures inside one check
 * don't abort the others.
 */
export async function runStaticChecks(): Promise<Finding[]> {
  const results = await Promise.allSettled([
    typecheck(),
    npmAudit(),
    knipDeadCode(),
    cronDrift(),
    todoScan(),
  ]);

  const findings: Finding[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') findings.push(...r.value);
    else findings.push(checkFailedFinding(r.reason));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// tsc --noEmit — surface every type error as a Finding. The repo has
// `strict: true` but no `npm run typecheck`, so this is the first time
// these errors land anywhere visible to a human.
// ---------------------------------------------------------------------------

async function typecheck(): Promise<Finding[]> {
  let stdout = '';
  let stderr = '';
  try {
    const out = await execFileP('npx', ['--no-install', 'tsc', '--noEmit', '--pretty', 'false'], {
      cwd: REPO_ROOT,
      maxBuffer: MAX_BUF,
    });
    stdout = out.stdout;
    stderr = out.stderr;
  } catch (err: unknown) {
    // tsc exits non-zero on type errors. Stdout still holds the diagnostics.
    const e = err as { stdout?: string; stderr?: string };
    stdout = e.stdout ?? '';
    stderr = e.stderr ?? '';
  }

  // Diagnostic line format: `path/to/file.ts(LINE,COL): error TSXXXX: message`
  const findings: Finding[] = [];
  const lineRe = /^([^()]+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;
  for (const raw of (stdout + '\n' + stderr).split('\n')) {
    const m = lineRe.exec(raw.trim());
    if (!m) continue;
    const [, file, lineStr, , code, message] = m;
    if (!file || !lineStr) continue;
    findings.push({
      file_path: normalisePath(file),
      line_start: Number(lineStr),
      line_end: Number(lineStr),
      finding_type: 'type',
      severity: 'P1',
      source: 'static:tsc',
      title: `${code}: ${message.slice(0, 120)}`,
      description: message,
      proposed_fix: null,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// npm audit --json — vulnerable dependencies. We only surface advisories
// rated moderate or higher.
// ---------------------------------------------------------------------------

interface AuditAdvisory {
  name: string;
  severity: string;
  via: unknown;
  effects?: string[];
}

async function npmAudit(): Promise<Finding[]> {
  let stdout = '';
  try {
    const out = await execFileP('npm', ['audit', '--json'], {
      cwd: REPO_ROOT,
      maxBuffer: MAX_BUF,
    });
    stdout = out.stdout;
  } catch (err: unknown) {
    // npm audit exits non-zero when vulns are found; stdout is still JSON.
    const e = err as { stdout?: string };
    stdout = e.stdout ?? '';
  }
  if (!stdout) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const vulns = (parsed as { vulnerabilities?: Record<string, AuditAdvisory> }).vulnerabilities;
  if (!vulns) return [];

  for (const [name, adv] of Object.entries(vulns)) {
    const sev = (adv.severity ?? 'low').toLowerCase();
    if (sev === 'low' || sev === 'info') continue;
    findings.push({
      file_path: 'package.json',
      line_start: null,
      line_end: null,
      finding_type: 'dependency',
      severity: sev === 'critical' || sev === 'high' ? 'P0' : 'P2',
      source: 'static:audit',
      title: `${name}: ${sev} vulnerability`,
      description: typeof adv.via === 'string' ? adv.via : JSON.stringify(adv.via),
      proposed_fix: `Run \`npm audit fix\` or upgrade \`${name}\` manually.`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// knip --reporter json — dead code and unused exports. Best-effort: knip
// isn't a project dep, so we use `npx` and a one-shot fetch. If knip
// can't run (no config, no network for npx), we swallow and skip.
// ---------------------------------------------------------------------------

interface KnipReport {
  files?: string[];
  exports?: Record<string, { line?: number; col?: number; name: string }[]>;
  types?: Record<string, { line?: number; col?: number; name: string }[]>;
}

async function knipDeadCode(): Promise<Finding[]> {
  let stdout = '';
  try {
    const out = await execFileP(
      'npx',
      ['--yes', 'knip@5', '--reporter', 'json', '--no-progress'],
      { cwd: REPO_ROOT, maxBuffer: MAX_BUF, timeout: 90_000 },
    );
    stdout = out.stdout;
  } catch (err: unknown) {
    // knip exits non-zero when issues are found.
    const e = err as { stdout?: string };
    stdout = e.stdout ?? '';
    if (!stdout) return [];
  }

  let parsed: KnipReport;
  try {
    parsed = JSON.parse(stdout) as KnipReport;
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  for (const file of parsed.files ?? []) {
    findings.push({
      file_path: normalisePath(file),
      line_start: null,
      line_end: null,
      finding_type: 'dead-code',
      severity: 'P2',
      source: 'static:knip',
      title: 'Unused file',
      description: 'knip reports this file is never imported.',
      proposed_fix: 'Delete the file, or wire it into an entry point.',
    });
  }
  for (const [file, items] of Object.entries(parsed.exports ?? {})) {
    for (const it of items) {
      findings.push({
        file_path: normalisePath(file),
        line_start: it.line ?? null,
        line_end: it.line ?? null,
        finding_type: 'dead-code',
        severity: 'P3',
        source: 'static:knip',
        title: `Unused export: ${it.name}`,
        description: `${it.name} is exported but never imported.`,
        proposed_fix: `Remove the export or use it.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Cron drift — every `vercel.json` cron path must map to an existing
// file under api/cron/. This is a known foot-gun: explicit-builds means
// a renamed handler still has a stale cron entry pointing at a 404.
// ---------------------------------------------------------------------------

async function cronDrift(): Promise<Finding[]> {
  const vercelJsonPath = resolve(REPO_ROOT, 'vercel.json');
  if (!existsSync(vercelJsonPath)) return [];
  let cfg: { crons?: { path: string; schedule: string }[]; builds?: { src: string }[] };
  try {
    cfg = JSON.parse(await readFile(vercelJsonPath, 'utf-8'));
  } catch {
    return [];
  }
  const findings: Finding[] = [];
  const builds = new Set((cfg.builds ?? []).map(b => b.src));
  const cronDir = resolve(REPO_ROOT, 'api/cron');
  const cronFiles = existsSync(cronDir) ? new Set(readdirSync(cronDir)) : new Set<string>();

  for (const cron of cfg.crons ?? []) {
    const handler = cron.path.replace(/^\/api\/cron\//, '');
    const tsFile = `${handler}.ts`;
    if (!cronFiles.has(tsFile)) {
      findings.push({
        file_path: 'vercel.json',
        line_start: null,
        line_end: null,
        finding_type: 'cron-drift',
        severity: 'P0',
        source: 'static:cron-drift',
        title: `Cron path has no handler: ${cron.path}`,
        description: `vercel.json declares a cron at ${cron.path} (schedule: ${cron.schedule}) but api/cron/${tsFile} does not exist. The cron will 404 on every fire.`,
        proposed_fix: `Either create api/cron/${tsFile} or remove the cron entry.`,
      });
    }
    // Build entry drift — every cron handler also needs an explicit build entry.
    const buildSrc = `api/cron/${tsFile}`;
    if (cronFiles.has(tsFile) && !builds.has(buildSrc)) {
      findings.push({
        file_path: 'vercel.json',
        line_start: null,
        line_end: null,
        finding_type: 'cron-drift',
        severity: 'P1',
        source: 'static:cron-drift',
        title: `Cron handler missing explicit build entry: ${buildSrc}`,
        description: `${buildSrc} exists and is wired as a cron but has no entry in vercel.json builds[]. Explicit-builds mode skips api/* auto-detection.`,
        proposed_fix: `Add { "src": "${buildSrc}", "use": "@vercel/node", "config": { "maxDuration": 300 } } to builds[].`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// TODO / FIXME / HACK markers across reviewable source. Baseline today is
// zero; tracking regressions is the value.
// ---------------------------------------------------------------------------

async function todoScan(): Promise<Finding[]> {
  let stdout = '';
  try {
    const out = await execFileP(
      'git',
      [
        'grep',
        '-nE',
        String.raw`(TODO|FIXME|HACK)([: ]|$)`,
        '--',
        'api/',
        'web/',
        'scripts/',
        ':!*.md',
        ':!*.json',
        ':!*.lock',
      ],
      { cwd: REPO_ROOT, maxBuffer: MAX_BUF },
    );
    stdout = out.stdout;
  } catch (err: unknown) {
    // `git grep` exits 1 when there are no matches — that's fine.
    const e = err as { code?: number; stdout?: string };
    if (e.code === 1) return [];
    stdout = e.stdout ?? '';
  }

  const findings: Finding[] = [];
  for (const raw of stdout.split('\n')) {
    const m = /^([^:]+):(\d+):(.*)$/.exec(raw);
    if (!m) continue;
    const [, file, lineStr, content] = m;
    findings.push({
      file_path: normalisePath(file),
      line_start: Number(lineStr),
      line_end: Number(lineStr),
      finding_type: 'todo',
      severity: 'P3',
      source: 'static:todo',
      title: content.trim().slice(0, 120),
      description: content.trim(),
      proposed_fix: null,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkFailedFinding(reason: unknown): Finding {
  const msg = reason instanceof Error ? reason.message : String(reason);
  return {
    file_path: '<static-checks>',
    line_start: null,
    line_end: null,
    finding_type: 'refactor',
    severity: 'P3',
    source: 'static:tsc',
    title: 'static check failed',
    description: msg.slice(0, 500),
    proposed_fix: null,
  };
}

function normalisePath(p: string): string {
  // Strip a leading "./" — keep paths repo-relative and consistent so
  // fingerprints match across runs.
  return p.replace(/^\.\//, '').trim();
}
