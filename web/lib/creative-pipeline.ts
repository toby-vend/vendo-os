/**
 * Creative Pipeline bridge — runs the Paid Social Agent's persona-to-creative
 * pipeline (~/Paid Social Agent/system/10-persona-creative-pipeline.md) from
 * VendoOS via a headless `claude -p` job, and reads brand folders for the
 * gallery.
 *
 * Runs execute on this machine using the Claude Code CLI (subscription auth,
 * no API key), cwd'd into the Paid Social Agent repo so its CLAUDE.md, agents
 * and schemas load. The two pipeline gates (campaign focus + prices) are
 * satisfied by the form fields, which are baked into the run prompt.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const PAID_SOCIAL_DIR = path.join(os.homedir(), 'Paid Social Agent');
const RUNS_DIR = path.join(process.cwd(), 'data', 'creative-pipeline-runs');
const CLAUDE_BIN = path.join(os.homedir(), '.local', 'bin', 'claude');

export type RunStage = 'full' | 'research' | 'concepts' | 'creatives';

export interface RunRequest {
  client: string; // brand slug (existing) or empty when websiteUrl given
  websiteUrl?: string; // new-client onboarding source
  treatments: string; // free text, from the campaign-focus gate
  prices: string; // approved figures, from the build gate
  stage: RunStage;
  notes?: string;
}

export interface RunRecord {
  id: string;
  client: string;
  websiteUrl?: string;
  treatments: string;
  prices: string;
  stage: RunStage;
  notes?: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  pid?: number;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function listBrands(): { slug: string; exportCount: number; hasConceptMap: boolean }[] {
  const brandsDir = path.join(PAID_SOCIAL_DIR, 'brands');
  if (!fs.existsSync(brandsDir)) return [];
  return fs
    .readdirSync(brandsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLUG_RE.test(d.name))
    .map((d) => {
      const dir = path.join(brandsDir, d.name);
      const exportsDir = path.join(dir, 'creatives', 'exports', 'png');
      const exportCount = fs.existsSync(exportsDir)
        ? fs.readdirSync(exportsDir).filter((f) => f.endsWith('.png')).length
        : 0;
      return {
        slug: d.name,
        exportCount,
        hasConceptMap: fs.existsSync(path.join(dir, 'concept-map.md')),
      };
    })
    .sort((a, b) => b.exportCount - a.exportCount || a.slug.localeCompare(b.slug));
}

export function listExports(slug: string): string[] {
  if (!SLUG_RE.test(slug)) return [];
  const dir = path.join(PAID_SOCIAL_DIR, 'brands', slug, 'creatives', 'exports', 'png');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^[A-Za-z0-9._-]+\.png$/.test(f)).sort();
}

export function exportPath(slug: string, file: string): string | null {
  if (!SLUG_RE.test(slug) || !/^[A-Za-z0-9._-]+\.png$/.test(file)) return null;
  const p = path.join(PAID_SOCIAL_DIR, 'brands', slug, 'creatives', 'exports', 'png', file);
  return fs.existsSync(p) ? p : null;
}

function stageInstruction(stage: RunStage): string {
  switch (stage) {
    case 'research':
      return 'Run Stage 1 (onboarding, if brand files are missing), Stage 1b (brand cheat sheet) and Stage 2 (persona research) only. Stop before concepts.';
    case 'concepts':
      return 'Assume Stages 1-2 are done. Run Stage 3 only: build or update the concept map.';
    case 'creatives':
      return 'Assume Stages 1-3 are done. Run Stage 4: build the creatives with the local template kit, render PNGs, and mirror to the client Claude Design project.';
    default:
      return 'Run the full pipeline: Stages 1, 1b, 2, 3 and 4, ending with rendered PNGs and the Claude Design mirror.';
  }
}

function buildPrompt(req: RunRequest): string {
  const target = req.websiteUrl
    ? `New client from website: ${req.websiteUrl}. Derive the brand slug from the practice/business name.`
    : `Client: brands/${req.client}/`;
  return [
    'You are running the persona-to-creative pipeline defined in system/10-persona-creative-pipeline.md.',
    'Follow this repo\'s CLAUDE.md. This run was triggered from VendoOS with the gates pre-answered:',
    `- Campaign focus gate (Stage 3): treatments/offers to push: ${req.treatments}`,
    `- Build gate (Stage 4 step 0b): approved prices and finance figures for ad copy: ${req.prices}`,
    'Treat those as the user\'s sign-off; do not re-ask. Anything NOT covered by them stays [CONFIRM_WITH_CLIENT].',
    target,
    stageInstruction(req.stage),
    req.notes ? `Additional notes from the user: ${req.notes}` : '',
    'Constraints: never run scripts/sync.sh; commit locally with conventional messages but do NOT push.',
    'Finish with a concise summary: what was produced, file paths, the Claude Design project URL if one exists, and anything still needing client confirmation.',
  ]
    .filter(Boolean)
    .join('\n');
}

function runFile(id: string): string {
  return path.join(RUNS_DIR, `${id}.json`);
}

export function logFile(id: string): string {
  return path.join(RUNS_DIR, `${id}.log`);
}

function saveRun(rec: RunRecord): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(runFile(rec.id), JSON.stringify(rec, null, 2));
}

export function getRun(id: string): RunRecord | null {
  if (!/^[0-9TZ.-]+$/.test(id)) return null;
  const p = runFile(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as RunRecord;
}

export function listRuns(): RunRecord[] {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), 'utf8')) as RunRecord)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function readLogTail(id: string, bytes = 8192): string {
  const p = logFile(id);
  if (!fs.existsSync(p)) return '';
  const size = fs.statSync(p).size;
  const start = Math.max(0, size - bytes);
  const fd = fs.openSync(p, 'r');
  try {
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** Tools the headless run may use without prompting. Everything else is denied. */
const ALLOWED_TOOLS = [
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'Bash(node:*)', 'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', 'Bash(curl:*)',
  'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git checkout:*)',
];

export function startRun(req: RunRequest): RunRecord {
  const id = new Date().toISOString().replace(/[:]/g, '-');
  const rec: RunRecord = {
    id,
    client: req.client,
    websiteUrl: req.websiteUrl || undefined,
    treatments: req.treatments,
    prices: req.prices,
    stage: req.stage,
    notes: req.notes || undefined,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const out = fs.openSync(logFile(id), 'a');

  const child = spawn(
    CLAUDE_BIN,
    ['-p', buildPrompt(req), '--allowedTools', ...ALLOWED_TOOLS],
    { cwd: PAID_SOCIAL_DIR, stdio: ['ignore', out, out], detached: true },
  );
  rec.pid = child.pid;
  saveRun(rec);

  child.on('exit', (code) => {
    const done = getRun(id);
    if (done) {
      done.status = code === 0 ? 'completed' : 'failed';
      done.exitCode = code ?? -1;
      done.finishedAt = new Date().toISOString();
      saveRun(done);
    }
    fs.closeSync(out);
  });
  child.unref();
  return rec;
}
