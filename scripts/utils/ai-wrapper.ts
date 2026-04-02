/**
 * AI Wrapper — retry, quality scoring, fallback mode, and audit logging.
 *
 * Wraps all Claude API calls with:
 *   - 3x exponential backoff retry on transient failures
 *   - Quality scoring of AI outputs
 *   - Fallback mode flag + Slack alert on degraded service
 *   - Full audit logging to ai_audit_log table
 *
 * Usage:
 *   import { aiCall } from '../utils/ai-wrapper.js';
 *   const result = await aiCall('qa-grading', { model: 'claude-sonnet-4-6', ... });
 *
 * Audit report:
 *   npx tsx scripts/utils/ai-wrapper.ts --audit
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createHash, randomUUID } from 'crypto';
import { getDb, initSchema, saveDb, closeDb, log, logError } from './db.js';
import { sendSlackAlert } from './slack-alert.js';

const client = new Anthropic();

// --- Types ---

export interface AiCallOptions {
  model?: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  temperature?: number;
  /** Minimum quality score (0-1) to accept output. Default 0.5 */
  qualityThreshold?: number;
}

export interface AiCallResult {
  callId: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  qualityScore: number;
  qualityFlags: string[];
  retryCount: number;
  fallbackUsed: boolean;
  model: string;
}

// --- Quality scoring ---

interface QualityCheck {
  flag: string;
  test: (text: string) => boolean;
  penalty: number;
}

const QUALITY_CHECKS: QualityCheck[] = [
  { flag: 'empty_response', test: (t) => t.trim().length === 0, penalty: 1.0 },
  { flag: 'too_short', test: (t) => t.trim().length < 20, penalty: 0.4 },
  { flag: 'refusal_detected', test: (t) => /i('m| am) (not able|unable) to|i can(not|'t) (help|assist)/i.test(t), penalty: 0.6 },
  { flag: 'hallucination_markers', test: (t) => /as an ai|i don't have access to|i cannot browse/i.test(t), penalty: 0.3 },
  { flag: 'truncated', test: (t) => t.endsWith('...') || t.endsWith('…'), penalty: 0.2 },
];

function scoreQuality(text: string): { score: number; flags: string[] } {
  let penalty = 0;
  const flags: string[] = [];

  for (const check of QUALITY_CHECKS) {
    if (check.test(text)) {
      penalty += check.penalty;
      flags.push(check.flag);
    }
  }

  return { score: Math.max(0, 1 - penalty), flags };
}

// --- Retry logic ---

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === 429 || err.status === 500 || err.status === 502 || err.status === 503 || err.status === 529;
  }
  if (err instanceof Error && err.message.includes('ECONNRESET')) return true;
  return false;
}

// --- Main call ---

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function aiCall(
  source: string,
  options: AiCallOptions,
): Promise<AiCallResult> {
  const callId = randomUUID();
  const model = options.model ?? 'claude-sonnet-4-6';
  const qualityThreshold = options.qualityThreshold ?? 0.5;

  const promptHash = createHash('sha256')
    .update(JSON.stringify(options.messages))
    .digest('hex')
    .slice(0, 16);

  let lastError: unknown;
  let retryCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retryCount = attempt;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log('AI', `Retry ${attempt}/${MAX_RETRIES} for ${source} in ${delay}ms`);
      await sleep(delay);
    }

    const start = Date.now();
    try {
      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0,
        system: options.system,
        messages: options.messages,
      });

      const durationMs = Date.now() - start;
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const { score, flags } = scoreQuality(text);

      const result: AiCallResult = {
        callId,
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        qualityScore: score,
        qualityFlags: flags,
        retryCount,
        fallbackUsed: false,
        model,
      };

      // Log to DB
      await logAudit(result, source, promptHash);

      // Quality gate
      if (score < qualityThreshold) {
        log('AI', `Quality below threshold (${score.toFixed(2)} < ${qualityThreshold}) for ${source}: [${flags.join(', ')}]`);
        await sendSlackAlert(
          source,
          `AI quality below threshold: ${score.toFixed(2)} — flags: ${flags.join(', ')}`,
          'warning',
        ).catch(() => {});
      }

      return result;

    } catch (err) {
      lastError = err;
      const durationMs = Date.now() - start;

      if (!isTransient(err) || attempt === MAX_RETRIES) {
        // Final failure — log and enter fallback
        const errorMsg = err instanceof Error ? err.message : String(err);
        logError('AI', `Call failed for ${source}`, err);

        await logAudit(
          {
            callId,
            text: '',
            inputTokens: 0,
            outputTokens: 0,
            durationMs,
            qualityScore: 0,
            qualityFlags: ['api_error'],
            retryCount,
            fallbackUsed: true,
            model,
          },
          source,
          promptHash,
          errorMsg,
        );

        await sendSlackAlert(
          source,
          `AI API failed after ${retryCount + 1} attempt(s): ${errorMsg}`,
        ).catch(() => {});

        throw err;
      }
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw lastError;
}

// --- Audit DB logging ---

async function logAudit(
  result: AiCallResult,
  source: string,
  promptHash: string,
  error?: string,
): Promise<void> {
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO ai_audit_log
        (call_id, source, prompt_hash, model, input_tokens, output_tokens, duration_ms,
         quality_score, quality_flags, status, error, fallback_used, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.callId,
        source,
        promptHash,
        result.model,
        result.inputTokens,
        result.outputTokens,
        result.durationMs,
        result.qualityScore,
        JSON.stringify(result.qualityFlags),
        error ? 'error' : 'success',
        error ?? null,
        result.fallbackUsed ? 1 : 0,
        result.retryCount,
        new Date().toISOString(),
      ],
    );
    saveDb();
  } catch {
    // Don't let audit logging failure break the caller
  }
}

// --- Audit report CLI ---

async function runAudit() {
  await initSchema();
  const db = await getDb();

  // Summary stats
  const summary = db.exec(`
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) as fallbacks,
      ROUND(AVG(quality_score), 3) as avg_quality,
      ROUND(AVG(duration_ms), 0) as avg_duration_ms,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(retry_count) as total_retries
    FROM ai_audit_log
    WHERE created_at >= date('now', '-30 days')
  `);

  if (!summary.length || !summary[0].values.length) {
    log('AI-AUDIT', 'No AI calls logged in the last 30 days');
    closeDb();
    return;
  }

  const cols = summary[0].columns;
  const row = summary[0].values[0];
  const stats: Record<string, unknown> = {};
  cols.forEach((c: string, i: number) => stats[c] = row[i]);

  console.log('\n=== AI Audit Report (Last 30 Days) ===\n');
  console.log(`  Total calls:      ${stats.total_calls}`);
  console.log(`  Successes:        ${stats.successes}`);
  console.log(`  Errors:           ${stats.errors}`);
  console.log(`  Fallbacks used:   ${stats.fallbacks}`);
  console.log(`  Avg quality:      ${stats.avg_quality}`);
  console.log(`  Avg duration:     ${stats.avg_duration_ms}ms`);
  console.log(`  Total input tkns: ${stats.total_input_tokens}`);
  console.log(`  Total output tkns:${stats.total_output_tokens}`);
  console.log(`  Total retries:    ${stats.total_retries}`);

  // Per-source breakdown
  const bySource = db.exec(`
    SELECT
      source,
      COUNT(*) as calls,
      ROUND(AVG(quality_score), 3) as avg_quality,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
    FROM ai_audit_log
    WHERE created_at >= date('now', '-30 days')
    GROUP BY source
    ORDER BY calls DESC
  `);

  if (bySource.length && bySource[0].values.length) {
    console.log('\n--- By Source ---\n');
    console.log('  Source                 Calls   Avg Quality   Errors');
    console.log('  ' + '-'.repeat(56));
    for (const r of bySource[0].values) {
      const [src, calls, avgQ, errs] = r as [string, number, number, number];
      console.log(`  ${(src ?? '').padEnd(22)} ${String(calls).padStart(5)}   ${String(avgQ).padStart(11)}   ${String(errs).padStart(6)}`);
    }
  }

  // Recent errors
  const recentErrors = db.exec(`
    SELECT source, error, created_at
    FROM ai_audit_log
    WHERE status = 'error'
      AND created_at >= date('now', '-7 days')
    ORDER BY created_at DESC
    LIMIT 10
  `);

  if (recentErrors.length && recentErrors[0].values.length) {
    console.log('\n--- Recent Errors (Last 7 Days) ---\n');
    for (const r of recentErrors[0].values) {
      const [src, err, at] = r as [string, string, string];
      console.log(`  [${at}] ${src}: ${err}`);
    }
  }

  // Quality drift check: compare this week vs last week
  const drift = db.exec(`
    SELECT
      CASE WHEN created_at >= date('now', '-7 days') THEN 'this_week' ELSE 'last_week' END as period,
      ROUND(AVG(quality_score), 3) as avg_quality,
      COUNT(*) as calls
    FROM ai_audit_log
    WHERE created_at >= date('now', '-14 days')
    GROUP BY period
  `);

  if (drift.length && drift[0].values.length >= 2) {
    const periods: Record<string, { avg: number; calls: number }> = {};
    for (const r of drift[0].values) {
      const [period, avg, calls] = r as [string, number, number];
      periods[period] = { avg, calls };
    }
    if (periods.this_week && periods.last_week) {
      const delta = periods.this_week.avg - periods.last_week.avg;
      const direction = delta >= 0 ? 'improved' : 'degraded';
      console.log(`\n--- Quality Drift ---\n`);
      console.log(`  Last week: ${periods.last_week.avg} (${periods.last_week.calls} calls)`);
      console.log(`  This week: ${periods.this_week.avg} (${periods.this_week.calls} calls)`);
      console.log(`  Change:    ${delta > 0 ? '+' : ''}${delta.toFixed(3)} (${direction})`);
      if (delta < -0.1) {
        console.log(`  ⚠ Significant quality degradation detected — review prompts`);
      }
    }
  }

  console.log('');
  closeDb();
}

// CLI entry point
if (process.argv.includes('--audit')) {
  runAudit().catch((err) => {
    logError('AI-AUDIT', 'Audit failed', err);
    process.exit(1);
  });
}
