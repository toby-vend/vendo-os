/**
 * AI Summary aggregator (stub).
 *
 * A6 fills this in: reads the existing exec_summary_md / wins_md /
 * risks_md / recommendations_md fields off the client_reports row and
 * reshapes them into the AiSummaryBlock structure (headline + Wins /
 * Watch / Focus pillars).
 *
 * No new Claude call here — we wrap the already-generated markdown.
 * Phase 4 may add a Regenerate button that calls generateReportInsights
 * with the structured numerical data the dashboard now has access to.
 */
import type { AiSummaryBlock } from '../dashboard-types.js';

export async function buildAiSummary(_reportId: number): Promise<AiSummaryBlock> {
  return {
    period: '',
    headlineMd: '',
    wins: [],
    watch: [],
    focus: [],
    generatedAt: null,
    confidence: 'medium',
  };
}
