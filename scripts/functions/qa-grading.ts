/**
 * QA Grading — AI-assisted quality review for deliverables before they go live.
 *
 * Scans Asana tasks in QA/review sections, grades each deliverable against
 * type-specific criteria using Claude, and stores results in qa_grades.
 *
 * Grades: pass | conditional_pass | fail
 *
 * Usage:
 *   npx tsx scripts/functions/qa-grading.ts              # grade pending deliverables
 *   npx tsx scripts/functions/qa-grading.ts --stats       # show QA stats per team member
 *   npx tsx scripts/functions/qa-grading.ts --client "X"  # grade only for client X
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

// --- Deliverable types and their criteria ---

interface QaCriteria {
  type: string;
  label: string;
  criteria: string[];
}

const DELIVERABLE_CRITERIA: QaCriteria[] = [
  {
    type: 'ad_copy',
    label: 'Ad Copy',
    criteria: [
      'Clear value proposition in the first line',
      'Strong call-to-action present',
      'Matches brand tone of voice',
      'No spelling or grammar errors',
      'Within platform character limits',
      'Targets the correct audience segment',
      'Includes relevant keywords or pain points',
    ],
  },
  {
    type: 'landing_page',
    label: 'Landing Page',
    criteria: [
      'Headline matches ad messaging',
      'Clear and visible CTA above the fold',
      'Mobile-responsive design confirmed',
      'Page load speed acceptable (<3s)',
      'Tracking pixels and conversion events installed',
      'Form fields are minimal and relevant',
      'Trust signals present (testimonials, logos, guarantees)',
      'No broken links or images',
    ],
  },
  {
    type: 'campaign_setup',
    label: 'Campaign Setup',
    criteria: [
      'Correct campaign objective selected',
      'Budget set to approved amount',
      'Targeting matches the brief (location, demographics, interests)',
      'Ad schedule set correctly',
      'Conversion tracking verified and firing',
      'Negative keywords applied (search campaigns)',
      'Ad extensions configured (search campaigns)',
      'Naming conventions followed',
    ],
  },
  {
    type: 'creative_asset',
    label: 'Creative Asset',
    criteria: [
      'Matches brand guidelines (colours, fonts, logo usage)',
      'Correct dimensions for target placement',
      'Text overlay within platform limits (e.g. Meta 20% rule)',
      'Visual hierarchy draws eye to CTA',
      'High resolution and not pixelated',
      'Accessible contrast ratios',
    ],
  },
  {
    type: 'report',
    label: 'Client Report',
    criteria: [
      'Correct date range and client branding',
      'Key metrics accurately pulled from data sources',
      'Commentary explains performance, not just restates numbers',
      'Recommendations are specific and actionable',
      'No placeholder text or template artefacts',
      'Formatted consistently and professionally',
    ],
  },
];

// --- Detect deliverable type from Asana task context ---

function detectDeliverableType(taskName: string, sectionName: string | null): string {
  const text = `${taskName} ${sectionName ?? ''}`.toLowerCase();

  if (/copy|headline|ad text|caption/i.test(text)) return 'ad_copy';
  if (/landing|lp|page build|funnel/i.test(text)) return 'landing_page';
  if (/campaign.*setup|build.*campaign|launch/i.test(text)) return 'campaign_setup';
  if (/creative|design|banner|image|video|asset/i.test(text)) return 'creative_asset';
  if (/report|monthly.*review/i.test(text)) return 'report';

  return 'ad_copy'; // default
}

// --- Fetch brand context if available ---

async function getBrandContext(clientName: string): Promise<string | null> {
  const db = await getDb();
  const result = db.exec(
    'SELECT content FROM brand_hub WHERE client_name = ? LIMIT 1',
    [clientName],
  );
  if (result.length && result[0].values.length) {
    const content = result[0].values[0][0] as string;
    return content.slice(0, 2000); // keep it concise
  }
  return null;
}

// --- AI grading ---

async function gradeDeliverable(
  taskName: string,
  taskNotes: string,
  deliverableType: string,
  clientName: string | null,
): Promise<{ grade: string; score: number; feedback: string; callId: string }> {
  const criteria = DELIVERABLE_CRITERIA.find((c) => c.type === deliverableType);
  if (!criteria) throw new Error(`Unknown deliverable type: ${deliverableType}`);

  let brandContext = '';
  if (clientName) {
    const bc = await getBrandContext(clientName);
    if (bc) {
      brandContext = `\n\nBrand context for ${clientName}:\n${bc}`;
    }
  }

  const criteriaList = criteria.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const result = await aiCall('qa-grading', {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    system: `You are a QA reviewer for a digital marketing agency called Vendo. You grade deliverables against specific quality criteria. Be strict but fair. Output JSON only.`,
    messages: [
      {
        role: 'user',
        content: `Grade this ${criteria.label} deliverable against the criteria below.

Task: ${taskName}
Notes/Content:
${taskNotes || '(no notes provided)'}
${brandContext}

Criteria:
${criteriaList}

Respond with JSON only:
{
  "grade": "pass" | "conditional_pass" | "fail",
  "score": <0.0 to 1.0>,
  "criteria_results": [
    { "criterion": "<criterion text>", "met": true/false, "note": "<brief note>" }
  ],
  "summary": "<2-3 sentence overall assessment>",
  "action_required": "<what needs fixing, or 'none'>"
}`,
      },
    ],
  });

  // Parse the JSON response
  let parsed: { grade: string; score: number; summary: string; action_required: string };
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? result.text);
  } catch {
    // If AI output isn't valid JSON, treat as conditional pass with the raw text as feedback
    parsed = {
      grade: 'conditional_pass',
      score: 0.5,
      summary: 'AI response could not be parsed — manual review required.',
      action_required: result.text.slice(0, 500),
    };
  }

  return {
    grade: parsed.grade,
    score: parsed.score,
    feedback: JSON.stringify({ summary: parsed.summary, action_required: parsed.action_required }),
    callId: result.callId,
  };
}

// --- Find tasks needing QA ---

interface QaCandidate {
  gid: string;
  name: string;
  notes: string;
  sectionName: string | null;
  projectName: string | null;
  assigneeName: string | null;
}

async function findQaCandidates(clientFilter?: string): Promise<QaCandidate[]> {
  const db = await getDb();

  // Find tasks in QA/review-related sections that haven't been graded yet
  let query = `
    SELECT t.gid, t.name, t.notes, t.section_name, t.project_name, t.assignee_name
    FROM asana_tasks t
    WHERE t.completed = 0
      AND (
        t.section_name LIKE '%QA%'
        OR t.section_name LIKE '%review%'
        OR t.section_name LIKE '%approval%'
        OR t.section_name LIKE '%check%'
      )
      AND t.gid NOT IN (SELECT deliverable_ref FROM qa_grades)
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND t.project_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }

  query += ' ORDER BY t.modified_at DESC LIMIT 20';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) return [];

  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return {
      gid: obj.gid as string,
      name: obj.name as string,
      notes: (obj.notes as string) ?? '',
      sectionName: obj.section_name as string | null,
      projectName: obj.project_name as string | null,
      assigneeName: obj.assignee_name as string | null,
    };
  });
}

// --- Stats mode ---

async function showStats() {
  const db = await getDb();

  const stats = db.exec(`
    SELECT
      team_member,
      COUNT(*) as total,
      SUM(CASE WHEN grade = 'pass' THEN 1 ELSE 0 END) as passes,
      SUM(CASE WHEN grade = 'conditional_pass' THEN 1 ELSE 0 END) as conditionals,
      SUM(CASE WHEN grade = 'fail' THEN 1 ELSE 0 END) as fails,
      ROUND(AVG(score), 2) as avg_score
    FROM qa_grades
    WHERE created_at >= date('now', '-90 days')
    GROUP BY team_member
    ORDER BY avg_score DESC
  `);

  if (!stats.length || !stats[0].values.length) {
    log('QA', 'No QA grades recorded yet');
    return;
  }

  console.log('\n=== QA Grades — Last 90 Days ===\n');
  console.log('  Team Member            Total   Pass   Cond.   Fail   Avg Score');
  console.log('  ' + '-'.repeat(65));

  for (const row of stats[0].values) {
    const [member, total, passes, conds, fails, avg] = row as [string | null, number, number, number, number, number];
    const name = (member ?? 'unassigned').padEnd(22);
    console.log(`  ${name} ${String(total).padStart(5)}  ${String(passes).padStart(5)}  ${String(conds).padStart(6)}  ${String(fails).padStart(5)}   ${String(avg).padStart(9)}`);
  }

  // Type breakdown
  const byType = db.exec(`
    SELECT deliverable_type, COUNT(*) as total, ROUND(AVG(score), 2) as avg_score
    FROM qa_grades
    WHERE created_at >= date('now', '-90 days')
    GROUP BY deliverable_type
    ORDER BY total DESC
  `);

  if (byType.length && byType[0].values.length) {
    console.log('\n--- By Deliverable Type ---\n');
    for (const row of byType[0].values) {
      const [dtype, total, avg] = row as [string, number, number];
      console.log(`  ${dtype.padEnd(20)} ${total} graded, avg score ${avg}`);
    }
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--stats')) {
    await showStats();
    closeDb();
    return;
  }

  const clientFilter = process.argv.includes('--client')
    ? process.argv[process.argv.indexOf('--client') + 1]
    : undefined;

  const candidates = await findQaCandidates(clientFilter);

  if (!candidates.length) {
    log('QA', 'No deliverables pending QA review');
    closeDb();
    return;
  }

  log('QA', `Found ${candidates.length} deliverable(s) to grade`);
  const db = await getDb();
  const now = new Date().toISOString();

  let passed = 0;
  let conditional = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const deliverableType = detectDeliverableType(candidate.name, candidate.sectionName);
    const clientName = candidate.projectName; // project name is our best proxy for client

    log('QA', `Grading: ${candidate.name} [${deliverableType}]`);

    try {
      const result = await gradeDeliverable(
        candidate.name,
        candidate.notes,
        deliverableType,
        clientName,
      );

      db.run(
        `INSERT INTO qa_grades
          (deliverable_type, deliverable_ref, client_name, grader, grade, score, criteria, feedback, team_member, ai_call_id, created_at)
         VALUES (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliverableType,
          candidate.gid,
          clientName,
          result.grade,
          result.score,
          JSON.stringify(DELIVERABLE_CRITERIA.find((c) => c.type === deliverableType)?.criteria ?? []),
          result.feedback,
          candidate.assigneeName,
          result.callId,
          now,
        ],
      );

      const icon = result.grade === 'pass' ? 'PASS' : result.grade === 'conditional_pass' ? 'COND' : 'FAIL';
      log('QA', `  ${icon} (${result.score.toFixed(2)}) — ${candidate.name}`);

      if (result.grade === 'pass') passed++;
      else if (result.grade === 'conditional_pass') conditional++;
      else failed++;

    } catch (err) {
      logError('QA', `Failed to grade: ${candidate.name}`, err);
    }
  }

  saveDb();
  log('QA', `Grading complete — ${passed} pass, ${conditional} conditional, ${failed} fail`);
  closeDb();
}

main().catch((err) => {
  logError('QA', 'QA grading failed', err);
  process.exit(1);
});
