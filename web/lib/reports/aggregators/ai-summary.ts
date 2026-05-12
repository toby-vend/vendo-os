/**
 * AI Summary aggregator.
 *
 * Reads the existing markdown blocks off the `client_reports` row and
 * reshapes them into the AiSummaryBlock structure that the v2
 * dashboard's Summary tab consumes (headline + Wins / Watch / Focus
 * pillars). NO new Claude call here — we just wrap what the existing
 * editor flow has already generated.
 *
 * Mapping (per plan §4.4 / dashboard-types.ts):
 *   period      ← report.period_label
 *   headlineMd  ← report.exec_summary_md (falls back to '' when empty)
 *   wins        ← parsed list from report.wins_md
 *   watch       ← parsed list from report.risks_md
 *   focus       ← parsed list from report.recommendations_md, then
 *                 entries from report.focus_next_md appended
 *   generatedAt ← report.ai_generated_at (ISO string or null)
 *   confidence  ← derived from how many blocks are populated AND how
 *                 fresh `ai_generated_at` is.
 *
 * Phase 4 may add a "Regenerate" button that calls generateReportInsights
 * with the structured numerical data the dashboard now has access to.
 */
import { getReport } from '../../queries/reports.js';
import type { AiSummaryBlock } from '../dashboard-types.js';

/** Anything older than this many days drops confidence one notch. */
const FRESHNESS_DAYS = 30;

export async function buildAiSummary(reportId: number): Promise<AiSummaryBlock> {
  const report = await getReport(reportId);
  if (!report) {
    return {
      period: '',
      headlineMd: '',
      wins: [],
      watch: [],
      focus: [],
      generatedAt: null,
      confidence: 'low',
    };
  }

  const headlineMd = (report.exec_summary_md || '').trim();
  const wins = parseMarkdownList(report.wins_md);
  const watch = parseMarkdownList(report.risks_md);

  // Focus is recommendations + focus_next_md so both AI-authored and
  // human-edited next-steps land in the one pillar.
  const focusFromRecs = parseMarkdownList(report.recommendations_md);
  const focusFromNext = parseMarkdownList(report.focus_next_md);
  const focus = dedupePreservingOrder([...focusFromRecs, ...focusFromNext]);

  const generatedAt = report.ai_generated_at || null;
  const confidence = scoreConfidence({
    headlineMd,
    wins,
    watch,
    focus,
    generatedAt,
  });

  return {
    period: report.period_label || '',
    headlineMd,
    wins,
    watch,
    focus,
    generatedAt,
    confidence,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Parse a markdown blob into a flat string array.
 *
 * - If the text contains bullet markers (`-`, `*`, or numbered `1.`),
 *   split into lines and pick off each bullet as one entry.
 * - Otherwise treat the whole blob as a single-paragraph item.
 *
 * Empty input → empty array. Markdown formatting inside each entry
 * stays as-is — the React layer handles rendering.
 */
export function parseMarkdownList(md: string | null | undefined): string[] {
  if (!md) return [];
  const text = md.trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const bulleted = lines
    .map(line => stripBulletMarker(line))
    .filter((item): item is string => item !== null);

  if (bulleted.length > 0) {
    return bulleted.map(s => s.trim()).filter(s => s.length > 0);
  }

  // No bullets — return the whole paragraph as a single entry.
  return [text];
}

/**
 * If the line begins with a markdown bullet marker (`-`, `*`, `+`) or
 * a numbered marker (`1.`, `2)`), return the line with the marker
 * stripped. Otherwise return null so the caller knows it wasn't a
 * bullet.
 */
function stripBulletMarker(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
  if (bullet) return bullet[1];
  const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
  if (numbered) return numbered[1];
  return null;
}

function dedupePreservingOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

interface ConfidenceInputs {
  headlineMd: string;
  wins: string[];
  watch: string[];
  focus: string[];
  generatedAt: string | null;
}

/**
 * Map the four content fields + freshness onto a 3-level confidence
 * signal. Rules:
 *   - 'high'   — all four content slots populated AND generated within
 *                the last 30 days.
 *   - 'medium' — at least one content slot populated (the typical
 *                "we have something to show" case).
 *   - 'low'    — every content slot is empty.
 */
function scoreConfidence(inputs: ConfidenceInputs): 'high' | 'medium' | 'low' {
  const populated = [
    inputs.headlineMd.length > 0,
    inputs.wins.length > 0,
    inputs.watch.length > 0,
    inputs.focus.length > 0,
  ];
  const populatedCount = populated.filter(Boolean).length;

  if (populatedCount === 0) return 'low';

  if (populatedCount === populated.length && isFresh(inputs.generatedAt)) {
    return 'high';
  }
  return 'medium';
}

function isFresh(generatedAt: string | null): boolean {
  if (!generatedAt) return false;
  const ts = Date.parse(generatedAt);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays <= FRESHNESS_DAYS;
}
