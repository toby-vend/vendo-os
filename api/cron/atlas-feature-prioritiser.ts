/**
 * /api/cron/atlas-feature-prioritiser — weekly Vendo OS backlog ranker.
 *
 * Schedule: 0 11 * * 1 (Mon 11:00 UTC).
 *
 * Unlike the other Wave 1 cron handlers, this one fetches fresh
 * code_findings and recent Vendo-OS-themed concerns and feeds them in
 * as a prompt prefix — the agent itself doesn't read code_findings
 * directly (no tool for that yet).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

interface CodeFindingRow {
  id: number;
  file_path: string;
  line_start: number | null;
  finding_type: string;
  severity: string;
  source: string;
  title: string;
  description: string | null;
  proposed_fix: string | null;
  first_seen: string;
  occurrences: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Fetch up to 50 open P0/P1 code findings — the prompt is sized for ~50.
  let codeBlock = '';
  try {
    const r = await db.execute({
      sql: `SELECT id, file_path, line_start, finding_type, severity,
                   source, title, description, proposed_fix, first_seen,
                   occurrences
              FROM code_findings
             WHERE status = 'open'
               AND severity IN ('P0', 'P1')
          ORDER BY severity ASC, last_seen DESC
             LIMIT 50`,
      args: [],
    });
    const rows = r.rows as unknown as CodeFindingRow[];
    if (rows.length > 0) {
      codeBlock = '# Open code_findings (P0/P1, top 50)\n\n' +
        rows
          .map(
            f =>
              `[${f.severity}] ${f.file_path}${f.line_start ? ':' + f.line_start : ''} ` +
              `(${f.finding_type}, ${f.source}, seen ${f.occurrences}×) — ${f.title}`,
          )
          .join('\n');
    } else {
      codeBlock = '# Open code_findings: none P0/P1 right now.';
    }
  } catch (err) {
    codeBlock = `# Open code_findings: query failed (${err instanceof Error ? err.message : String(err)})`;
  }

  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-feature-prioritiser',
    promptPrefix: codeBlock,
    prompt:
      'Rank this week\'s Vendo OS backlog. Follow your system prompt: ' +
      'group the code_findings above with related meeting concerns and ' +
      'memory items into 5-8 themed items, score by leverage = impact ÷ ' +
      'effort, and record one finding per item via recordGrowthFinding. ' +
      'Final reply highlights the top 3 picks.',
  });
}
