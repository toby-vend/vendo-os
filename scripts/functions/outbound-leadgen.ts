/**
 * Outbound Lead Gen — ICP targeting, personalised outreach, sequence tracking.
 *
 * Manages the outbound pipeline:
 *   - ICP match scoring against target criteria
 *   - AI-generated personalised outreach messages
 *   - Multi-step sequence tracking (email/LinkedIn DM)
 *   - Conversion funnel reporting
 *
 * Usage:
 *   npx tsx scripts/functions/outbound-leadgen.ts                    # show pipeline status
 *   npx tsx scripts/functions/outbound-leadgen.ts --add "Name" "Company" "email"  # add prospect
 *   npx tsx scripts/functions/outbound-leadgen.ts --draft            # generate outreach drafts
 *   npx tsx scripts/functions/outbound-leadgen.ts --funnel           # conversion funnel report
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

// --- ICP definition ---

const ICP = {
  industries: ['ecommerce', 'saas', 'professional services', 'healthcare', 'education', 'finance', 'retail', 'hospitality'],
  minRevenue: 500000,  // £500k+
  maxRevenue: 50000000, // up to £50M
  teamSize: '10-200',
  painPoints: ['low ROAS', 'scaling paid media', 'no in-house marketing team', 'agency dissatisfaction', 'entering new markets'],
  disqualifiers: ['no budget', 'in-house team >5', 'competitor agency locked in'],
};

function scoreIcpMatch(company: string | null, notes: string | null): number {
  if (!company && !notes) return 30; // baseline
  const text = `${company ?? ''} ${notes ?? ''}`.toLowerCase();

  let score = 40; // base

  // Industry match
  if (ICP.industries.some((i) => text.includes(i))) score += 20;

  // Pain point signals
  const painMatches = ICP.painPoints.filter((p) => text.includes(p.toLowerCase()));
  score += painMatches.length * 10;

  // Disqualifiers
  if (ICP.disqualifiers.some((d) => text.includes(d.toLowerCase()))) score -= 30;

  return Math.max(0, Math.min(100, score));
}

// --- Add prospect ---

async function addProspect(name: string, company: string | null, email: string | null): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const icpScore = scoreIcpMatch(company, null);

  db.run(`
    INSERT INTO outbound_campaigns
      (prospect_name, prospect_company, prospect_email, icp_match_score, channel, sequence_step, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'email', 0, 'queued', ?, ?)
  `, [name, company, email, icpScore, now, now]);

  saveDb();
  log('OUTBOUND', `Added: ${name} (${company ?? 'no company'}) — ICP score: ${icpScore}`);
}

// --- Generate outreach drafts ---

async function generateDrafts(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const prospects = db.exec(`
    SELECT id, prospect_name, prospect_company, prospect_email, icp_match_score, sequence_step, notes
    FROM outbound_campaigns
    WHERE status IN ('queued', 'sent')
      AND sequence_step < 3
    ORDER BY icp_match_score DESC
    LIMIT 10
  `);

  if (!prospects.length || !prospects[0].values.length) {
    log('OUTBOUND', 'No prospects needing outreach');
    return;
  }

  log('OUTBOUND', `Generating drafts for ${prospects[0].values.length} prospect(s)...`);

  for (const row of prospects[0].values) {
    const [id, name, company, email, icpScore, step, notes] = row as [number, string, string | null, string | null, number, number, string | null];

    const nextStep = step + 1;
    const sequenceType = nextStep === 1 ? 'initial outreach' : nextStep === 2 ? 'follow-up' : 'final follow-up';

    const result = await aiCall('outbound-draft', {
      model: 'claude-sonnet-4-6',
      maxTokens: 800,
      system: `You write cold outreach emails for Vendo, a paid media agency specialising in Google Ads and Meta Ads for growing businesses. Style: direct, value-first, no fluff. Keep emails under 100 words. UK English.`,
      messages: [{
        role: 'user',
        content: `Write a ${sequenceType} email.

Prospect: ${name}
Company: ${company ?? 'Unknown'}
ICP score: ${icpScore}/100
${notes ? 'Context: ' + notes : ''}
${nextStep > 1 ? 'This is follow-up #' + nextStep + ' — reference previous outreach without being pushy.' : ''}

Write subject line and email body only. Format:
Subject: ...

Body text...`,
      }],
    });

    // Store the draft in notes
    const draftNote = `[Step ${nextStep} draft]\n${result.text}`;
    const existingNotes = notes ? notes + '\n\n' : '';

    db.run(
      'UPDATE outbound_campaigns SET notes = ?, sequence_step = ?, status = \'drafted\', updated_at = ? WHERE id = ?',
      [existingNotes + draftNote, nextStep, now, id],
    );

    log('OUTBOUND', `  Drafted step ${nextStep} for ${name} (${company ?? ''})`);
  }

  saveDb();
}

// --- Pipeline status ---

async function showPipeline(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT prospect_name, prospect_company, icp_match_score, channel, sequence_step, status, response_type, meeting_booked, converted, updated_at
    FROM outbound_campaigns
    ORDER BY
      CASE status
        WHEN 'responded' THEN 1
        WHEN 'meeting_booked' THEN 2
        WHEN 'drafted' THEN 3
        WHEN 'sent' THEN 4
        WHEN 'queued' THEN 5
        ELSE 6
      END,
      icp_match_score DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('OUTBOUND', 'No prospects in pipeline');
    return;
  }

  console.log('\n=== Outbound Pipeline ===\n');
  console.log('  Name                    Company                  ICP   Step  Status       Response');
  console.log('  ' + '-'.repeat(90));

  for (const row of result[0].values) {
    const [name, company, icp, _channel, step, status, response, meeting, converted] = row as [string, string | null, number, string, number, string, string | null, number, number];
    const extras = [];
    if (meeting) extras.push('MTG');
    if (converted) extras.push('WON');

    console.log(
      `  ${(name ?? '').slice(0, 23).padEnd(23)} ` +
      `${(company ?? '').slice(0, 24).padEnd(24)} ` +
      `${String(icp).padStart(3)}   ` +
      `${String(step).padStart(4)}  ` +
      `${(status ?? '').padEnd(12)} ` +
      `${(response ?? '-').padEnd(10)} ` +
      `${extras.join(' ')}`,
    );
  }

  console.log('');
}

// --- Conversion funnel ---

async function showFunnel(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status != 'queued' THEN 1 ELSE 0 END) as contacted,
      SUM(CASE WHEN response_type IS NOT NULL THEN 1 ELSE 0 END) as responded,
      SUM(CASE WHEN response_type = 'interested' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN meeting_booked = 1 THEN 1 ELSE 0 END) as meetings,
      SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted
    FROM outbound_campaigns
  `);

  if (!result.length || !result[0].values.length) {
    log('OUTBOUND', 'No funnel data');
    return;
  }

  const [total, contacted, responded, interested, meetings, converted] = result[0].values[0] as number[];

  console.log('\n=== Outbound Conversion Funnel ===\n');

  const stages = [
    { label: 'Total prospects', count: total ?? 0 },
    { label: 'Contacted', count: contacted ?? 0 },
    { label: 'Responded', count: responded ?? 0 },
    { label: 'Interested', count: interested ?? 0 },
    { label: 'Meeting booked', count: meetings ?? 0 },
    { label: 'Converted', count: converted ?? 0 },
  ];

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : '0';
    const bar = '█'.repeat(Math.max(1, Math.round(s.count / Math.max(total, 1) * 30)));
    const convRate = i > 0 && stages[i - 1].count > 0
      ? ` (${((s.count / stages[i - 1].count) * 100).toFixed(0)}% from prev)`
      : '';
    console.log(`  ${s.label.padEnd(20)} ${String(s.count).padStart(4)}  ${pct.padStart(5)}%  ${bar}${convRate}`);
  }

  // Average ICP score for converted vs not
  const icpComp = db.exec(`
    SELECT
      ROUND(AVG(CASE WHEN converted = 1 THEN icp_match_score END), 1) as converted_avg,
      ROUND(AVG(CASE WHEN converted = 0 THEN icp_match_score END), 1) as not_converted_avg
    FROM outbound_campaigns
  `);

  if (icpComp.length && icpComp[0].values.length) {
    const [convAvg, notConvAvg] = icpComp[0].values[0] as [number | null, number | null];
    if (convAvg !== null) {
      console.log(`\n  Avg ICP score (converted): ${convAvg} vs (not converted): ${notConvAvg ?? '-'}`);
    }
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--add')) {
    const addIdx = process.argv.indexOf('--add');
    const name = process.argv[addIdx + 1];
    const company = process.argv[addIdx + 2] ?? null;
    const email = process.argv[addIdx + 3] ?? null;
    if (!name) {
      logError('OUTBOUND', 'Usage: --add "Name" "Company" "email@example.com"');
      process.exit(1);
    }
    await addProspect(name, company, email);
  } else if (process.argv.includes('--draft')) {
    await generateDrafts();
  } else if (process.argv.includes('--funnel')) {
    await showFunnel();
  } else {
    await showPipeline();
  }

  closeDb();
}

main().catch((err) => {
  logError('OUTBOUND', 'Outbound lead gen failed', err);
  process.exit(1);
});
