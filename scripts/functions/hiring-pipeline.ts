/**
 * Hiring Pipeline — role spec, posting, application tracking, interview scorecards.
 *
 * Usage:
 *   npx tsx scripts/functions/hiring-pipeline.ts --open "Paid Media Specialist"
 *   npx tsx scripts/functions/hiring-pipeline.ts --status
 *   npx tsx scripts/functions/hiring-pipeline.ts --spec "Paid Media Specialist"  # AI-generate job spec
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

async function openRole(roleTitle: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO hiring_pipeline (role_title, status, created_at, updated_at) VALUES (?, \'open\', ?, ?)',
    [roleTitle, now, now],
  );
  saveDb();
  log('HIRING', `Role opened: ${roleTitle}`);
  log('HIRING', '  Run --spec to generate a job specification');
}

async function generateSpec(roleTitle: string): Promise<void> {
  const db = await getDb();

  // Check if role exists in registry for context
  const roleData = db.exec('SELECT responsibilities, kpis, tools FROM roles WHERE title LIKE ?', [`%${roleTitle}%`]);
  let context = '';
  if (roleData.length && roleData[0].values.length) {
    const [resp, kpis, tools] = roleData[0].values[0] as string[];
    context = `\nExisting role data:\nResponsibilities: ${resp}\nKPIs: ${kpis}\nTools: ${tools}`;
  }

  const result = await aiCall('hiring-spec', {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    system: 'You write job specifications for Vendo, a UK paid media agency. Be specific, avoid generic filler. UK English.',
    messages: [{
      role: 'user',
      content: `Write a job specification for: ${roleTitle}\n\nCompany: Vendo — UK-based paid media agency specialising in Google Ads and Meta Ads for growing businesses. Team of ~5-10.${context}\n\nInclude: Role summary, Key responsibilities, Requirements (must-have and nice-to-have), What we offer. Keep it under 500 words.`,
    }],
  });

  const now = new Date().toISOString();
  db.run(
    'UPDATE hiring_pipeline SET job_spec = ?, updated_at = ? WHERE role_title = ? AND status = \'open\'',
    [result.text, now, roleTitle],
  );
  saveDb();

  console.log(`\n=== Job Specification: ${roleTitle} ===\n`);
  console.log(result.text);
  console.log('');
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT role_title, status, applications, shortlisted, interviewed, offered, hired, created_at
    FROM hiring_pipeline ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, created_at DESC
  `);

  if (!result.length || !result[0].values.length) { log('HIRING', 'No roles in pipeline'); return; }

  console.log('\n=== Hiring Pipeline ===\n');
  console.log('  Role                         Status   Apps  Short  Intv  Offered   Hired');
  console.log('  ' + '-'.repeat(75));

  for (const row of result[0].values) {
    const [title, status, apps, short, intv, offered, hired] = row as [string, string, number, number, number, string | null, string | null];
    console.log(
      `  ${(title ?? '').slice(0, 28).padEnd(28)} ` +
      `${(status ?? '').padEnd(8)} ` +
      `${String(apps ?? 0).padStart(4)}  ${String(short ?? 0).padStart(5)}  ${String(intv ?? 0).padStart(4)}  ` +
      `${(offered ?? '-').toString().padEnd(9)} ${hired ?? '-'}`,
    );
  }
  console.log('');
}

async function main() {
  await initSchema();
  if (process.argv.includes('--open')) {
    const title = process.argv[process.argv.indexOf('--open') + 1];
    if (!title) { logError('HIRING', 'Usage: --open "Role Title"'); process.exit(1); }
    await openRole(title);
  } else if (process.argv.includes('--spec')) {
    const title = process.argv[process.argv.indexOf('--spec') + 1];
    if (!title) { logError('HIRING', 'Usage: --spec "Role Title"'); process.exit(1); }
    await generateSpec(title);
  } else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('HIRING', 'Failed', err); process.exit(1); });
