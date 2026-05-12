/**
 * Orchestrator — wires the static layer, the LLM review layer, and the
 * findings store together into one runnable scan. Returns a RunSummary
 * the caller (cron handler or preview script) can use to drive the
 * Slack ping and the dashboard.
 *
 * Failure model: each layer is wrapped in try/catch. If the static layer
 * errors entirely we still try the LLM layer (and vice versa) — the run
 * status flips to 'partial'. Only a complete failure to write any row
 * to code_findings produces 'failed'.
 */
import { runStaticChecks } from './static-checks.js';
import { reviewFiles, estimateCostUsd } from './llm-review.js';
import {
  upsertFindings,
  resolveStaleFindings,
  startRunRow,
  finishRunRow,
  getTopOpenFindings,
} from './findings-store.js';
import { getChangedFiles, getHeadSha } from './git.js';
import type { Finding, FindingSource, RunSummary } from './types.js';

export interface RunScanInput {
  /** Where the run was triggered from — 'cron' or 'manual'. */
  trigger: 'cron' | 'manual';
  /** Skip DB writes + Slack — useful for `--dry` testing. */
  dryRun?: boolean;
  /** Override the changed-files window. Default 7 days. */
  sinceDays?: number;
  /** Override the LLM file cap. Default 50. */
  fileCap?: number;
  /** Concurrency cap for the LLM review layer. Default 5. */
  concurrency?: number;
  /** Skip the LLM layer entirely (static-only run). */
  staticOnly?: boolean;
}

export async function runScan(input: RunScanInput): Promise<RunSummary> {
  const t0 = Date.now();
  const sinceDays = input.sinceDays ?? 7;
  const fileCap = input.fileCap ?? 50;
  const concurrency = input.concurrency ?? 5;

  let runId: number | null = null;
  if (!input.dryRun) runId = await startRunRow(input.trigger);

  const sourcesRun: FindingSource[] = [];
  const allFindings: Finding[] = [];
  let layerError: string | null = null;
  let filesScanned = 0;
  let llmInputTokens = 0;
  let llmOutputTokens = 0;

  // -- Static layer --------------------------------------------------------
  try {
    const staticFindings = await runStaticChecks();
    allFindings.push(...staticFindings);
    sourcesRun.push(
      'static:tsc',
      'static:audit',
      'static:knip',
      'static:gitleaks',
      'static:cron-drift',
      'static:todo',
    );
  } catch (err) {
    layerError = `static: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[code-health/scan] static layer threw:', err);
  }

  // -- LLM layer -----------------------------------------------------------
  if (!input.staticOnly) {
    try {
      const files = await getChangedFiles({ sinceDays, cap: fileCap });
      filesScanned = files.length;
      if (files.length > 0) {
        const { findings, inputTokens, outputTokens } = await reviewFiles(files, concurrency);
        allFindings.push(...findings);
        llmInputTokens = inputTokens;
        llmOutputTokens = outputTokens;
        sourcesRun.push('llm:review');
      }
    } catch (err) {
      const msg = `llm: ${err instanceof Error ? err.message : String(err)}`;
      layerError = layerError ? `${layerError}; ${msg}` : msg;
      console.error('[code-health/scan] llm layer threw:', err);
    }
  }

  const costUsd = estimateCostUsd(llmInputTokens, llmOutputTokens);

  // -- Persist -------------------------------------------------------------
  let newCount = 0;
  let persistingCount = 0;
  let resolvedCount = 0;
  let writeError: string | null = null;
  if (!input.dryRun) {
    try {
      const up = await upsertFindings(allFindings);
      newCount = up.newCount;
      persistingCount = up.persistingCount;

      const commitSha = await getHeadSha();
      // `asOf` is the run start — every open finding with `last_seen`
      // older than this start that's also from a source we just ran is
      // stale, and gets flipped to resolved.
      const asOfIso = new Date(t0).toISOString().replace('T', ' ').slice(0, 19);
      resolvedCount = await resolveStaleFindings({
        asOfIso,
        sourcesRun,
        commitSha,
      });
    } catch (err) {
      writeError = err instanceof Error ? err.message : String(err);
      console.error('[code-health/scan] persistence threw:', err);
    }
  } else {
    // Dry-run: derive new/persisting counts heuristically by counting
    // distinct (file, type, title) tuples. Resolved is unknowable
    // without a DB read.
    newCount = allFindings.length;
  }

  // -- Status --------------------------------------------------------------
  let status: 'ok' | 'partial' | 'failed' = 'ok';
  let error: string | null = null;
  if (writeError) {
    status = 'failed';
    error = writeError;
  } else if (layerError) {
    status = 'partial';
    error = layerError;
  }

  const durationMs = Date.now() - t0;

  if (!input.dryRun && runId !== null) {
    await finishRunRow({
      id: runId,
      filesScanned,
      findingsNew: newCount,
      findingsPersisting: persistingCount,
      findingsResolved: resolvedCount,
      durationMs,
      costUsd: costUsd || null,
      status,
      error,
    });
  }

  const topFindings = input.dryRun ? [] : await getTopOpenFindings(10);

  return {
    filesScanned,
    findingsNew: newCount,
    findingsPersisting: persistingCount,
    findingsResolved: resolvedCount,
    durationMs,
    costUsd: costUsd || null,
    status,
    error,
    topFindings,
    runId,
  };
}
