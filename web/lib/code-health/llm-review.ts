/**
 * LLM review layer — Sonnet reads each changed file and returns a list
 * of structured Findings. Stateless per file: no conversation, no tools,
 * no shared context across files. This is the most expensive layer of
 * the scan, so the orchestrator caps the file count before calling here.
 *
 * The model returns a JSON array; we validate at the boundary and
 * silently drop malformed entries (rare — Sonnet sticks to the schema —
 * but we'd rather drop one finding than fail the whole file).
 *
 * Cost: ~$0.01 per file with the current Sonnet tariff. 50 files → ~$0.50/run.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateText, type LanguageModel } from 'ai';
import { MODELS } from '../agents/models.js';
import { REPO_ROOT } from './git.js';
import type { Finding, FindingType, Severity } from './types.js';

const VALID_TYPES: FindingType[] = [
  'bug', 'perf', 'refactor', 'security', 'style', 'dead-code', 'type',
];
const VALID_SEV: Severity[] = ['P0', 'P1', 'P2', 'P3'];

// Files longer than this are truncated to keep per-call cost predictable.
// 1500 lines covers ~98% of the codebase; outliers get reviewed in chunks
// of their first 1500 lines and skip the rest. Better than skipping
// entirely, and matches the "where bugs land" hypothesis (top of file).
const MAX_LINES = 1500;

const SYSTEM_PROMPT = `You are a senior TypeScript reviewer for the Vendo OS codebase — a Vercel-hosted Node.js / TypeScript monolith with libsql/Turso storage and an Anthropic agent runtime.

You are given ONE file at a time. Return ONLY a JSON array of findings. No prose, no markdown, no code fences. Empty array is valid — and preferred over weak findings.

Schema for each finding:
{
  "line_start": <integer | null>,
  "line_end":   <integer | null>,
  "finding_type": "bug" | "perf" | "refactor" | "security" | "style" | "dead-code" | "type",
  "severity": "P0" | "P1" | "P2" | "P3",
  "title":   <string, <= 120 chars>,
  "description": <string, <= 400 chars>,
  "proposed_fix": <string, <= 400 chars; or null>
}

Severity rubric:
  P0 — production bug or security risk affecting users today
  P1 — high-value perf, refactor, or latent bug
  P2 — quality improvement, mild perf, error-handling gap
  P3 — style or nit

Be selective. 3 strong findings beat 15 weak ones. Skip stylistic preferences, formatting nits, and "could be more idiomatic" notes — those are noise.

Look for:
  - Unhandled rejections, missing try/catch around external I/O
  - Race conditions, off-by-ones, wrong error swallowing
  - SQL injection, missing CSRF, leaked secrets in logs
  - N+1 queries, blocking I/O on the hot path
  - Dead branches, unreachable code, redundant checks
  - Type lies (\`as any\`, \`@ts-ignore\` without justification)
  - Functions doing two things; obvious refactor opportunities

Do not flag:
  - Comments or doc style
  - File length
  - Import order
  - Naming preferences (\`foo\` vs \`fooData\`)
  - Things only fixable by adding tests (tests are out of scope for this scan)`;

interface RawFinding {
  line_start?: unknown;
  line_end?: unknown;
  finding_type?: unknown;
  severity?: unknown;
  title?: unknown;
  description?: unknown;
  proposed_fix?: unknown;
}

/**
 * Review one file and return its findings. Catches and logs failures —
 * a broken LLM call shouldn't fail the run.
 *
 * @returns Findings + the token usage for cost accounting.
 */
export async function reviewFile(filePath: string): Promise<{
  findings: Finding[];
  inputTokens: number;
  outputTokens: number;
}> {
  let content: string;
  try {
    content = await readFile(resolve(REPO_ROOT, filePath), 'utf-8');
  } catch (err) {
    console.warn(`[code-health/llm-review] cannot read ${filePath}:`, err);
    return { findings: [], inputTokens: 0, outputTokens: 0 };
  }

  // Number lines for the model so it can cite line_start / line_end.
  const lines = content.split('\n');
  const truncated = lines.length > MAX_LINES;
  const numbered = lines
    .slice(0, MAX_LINES)
    .map((l, i) => `${(i + 1).toString().padStart(5, ' ')}  ${l}`)
    .join('\n');

  const userPrompt =
    `File: ${filePath}${truncated ? ` (first ${MAX_LINES} of ${lines.length} lines)` : ''}\n\n` +
    `\`\`\`\n${numbered}\n\`\`\`\n\n` +
    `Return your JSON array now.`;

  try {
    const result = await generateText({
      model: MODELS.SONNET as unknown as LanguageModel,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });
    const findings = parseFindings(result.text, filePath);
    return {
      findings,
      inputTokens: result.totalUsage.inputTokens ?? 0,
      outputTokens: result.totalUsage.outputTokens ?? 0,
    };
  } catch (err) {
    console.warn(`[code-health/llm-review] ${filePath} review failed:`, err instanceof Error ? err.message : String(err));
    return { findings: [], inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * Run the LLM review across many files with a concurrency cap. Returns
 * the union of findings plus aggregate token usage for cost accounting.
 */
export async function reviewFiles(
  filePaths: string[],
  concurrency = 5,
): Promise<{ findings: Finding[]; inputTokens: number; outputTokens: number }> {
  const findings: Finding[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  // Simple worker pool. We avoid a heavier dep here; this is short and clear.
  let idx = 0;
  async function worker() {
    while (idx < filePaths.length) {
      const i = idx++;
      const file = filePaths[i];
      const res = await reviewFile(file);
      findings.push(...res.findings);
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, filePaths.length) }, worker));
  return { findings, inputTokens, outputTokens };
}

// ---------------------------------------------------------------------------
// Boundary parsing — tolerant of stray prose, code fences, BOM. Drops
// malformed entries silently (logged once for the file).
// ---------------------------------------------------------------------------

function parseFindings(raw: string, filePath: string): Finding[] {
  const stripped = stripJsonNoise(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.warn(`[code-health/llm-review] ${filePath}: model returned non-JSON; skipping.`);
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: Finding[] = [];
  for (const item of parsed as RawFinding[]) {
    const ft = String(item.finding_type ?? '');
    const sev = String(item.severity ?? '');
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;
    if (!VALID_TYPES.includes(ft as FindingType)) continue;
    if (!VALID_SEV.includes(sev as Severity)) continue;

    out.push({
      file_path: filePath,
      line_start: numOrNull(item.line_start),
      line_end: numOrNull(item.line_end) ?? numOrNull(item.line_start),
      finding_type: ft as FindingType,
      severity: sev as Severity,
      source: 'llm:review',
      title: title.slice(0, 200),
      description: typeof item.description === 'string' ? item.description.slice(0, 1000) : null,
      proposed_fix: typeof item.proposed_fix === 'string' ? item.proposed_fix.slice(0, 1000) : null,
    });
  }
  return out;
}

function stripJsonNoise(s: string): string {
  // Remove BOM, leading "Here's …" prose, code fences.
  let t = s.replace(/^﻿/, '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  // Find the first '[' and last ']' — model occasionally wraps the array
  // with explanatory prose despite the instruction.
  const open = t.indexOf('[');
  const close = t.lastIndexOf(']');
  if (open !== -1 && close !== -1 && close > open) return t.slice(open, close + 1);
  return t;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
}

// ---------------------------------------------------------------------------
// Cost — Sonnet 4.6 tariff per 1M tokens. Kept in sync with
// web/lib/agents/runtime.ts COST_PER_M_TOKENS.
// ---------------------------------------------------------------------------

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
