/**
 * SOP Creation and Management — auto-generate, version, and review SOPs.
 *
 * Usage:
 *   npx tsx scripts/functions/sop-management.ts --create "Campaign Launch Process" "Specialist"
 *   npx tsx scripts/functions/sop-management.ts --status
 *   npx tsx scripts/functions/sop-management.ts --stale       # show SOPs due for review
 *   npx tsx scripts/functions/sop-management.ts --generate "Campaign Launch Process"  # AI-generate
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

async function createSop(title: string, owner: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const reviewDue = new Date();
  reviewDue.setMonth(reviewDue.getMonth() + 3);

  db.run(`
    INSERT INTO sops (title, owner, steps, last_reviewed, review_due, status, created_at, updated_at)
    VALUES (?, ?, '[]', ?, ?, 'active', ?, ?)
    ON CONFLICT(title) DO UPDATE SET owner = excluded.owner, updated_at = excluded.updated_at
  `, [title, owner, now, reviewDue.toISOString().split('T')[0], now, now]);

  saveDb();
  log('SOP', `Created: ${title} (owner: ${owner}, review due: ${reviewDue.toISOString().split('T')[0]})`);
}

async function generateSop(title: string): Promise<void> {
  const db = await getDb();

  const result = await aiCall('sop-generation', {
    model: 'claude-sonnet-4-6',
    maxTokens: 2000,
    system: 'You write Standard Operating Procedures for Vendo, a UK paid media agency. SOPs must be clear, actionable, step-by-step. UK English.',
    messages: [{
      role: 'user',
      content: `Write an SOP for: ${title}\n\nContext: Vendo runs Google Ads and Meta Ads campaigns for ~150 clients. Team includes AMs, Specialists, Ops Manager (Sarah), and Founder (Toby).\n\nFormat as JSON:\n{\n  "purpose": "...",\n  "steps": [\n    { "step": 1, "action": "...", "owner": "...", "notes": "..." }\n  ],\n  "exceptions": ["..."],\n  "related_sops": ["..."]\n}`,
    }],
  });

  let steps = '[]';
  let purpose = '';
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    steps = JSON.stringify(parsed.steps ?? []);
    purpose = parsed.purpose ?? '';
  } catch {
    steps = JSON.stringify([{ step: 1, action: result.text.slice(0, 2000), owner: 'TBD', notes: '' }]);
  }

  const now = new Date().toISOString();
  db.run(
    'UPDATE sops SET steps = ?, purpose = ?, updated_at = ? WHERE title = ?',
    [steps, purpose, now, title],
  );
  saveDb();

  log('SOP', `Generated SOP for: ${title}`);
  const parsedSteps = JSON.parse(steps) as { step: number; action: string; owner: string }[];
  for (const s of parsedSteps) {
    console.log(`  ${s.step}. ${s.action} (${s.owner})`);
  }
  console.log('');
}

async function showStatus(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT title, owner, purpose, last_reviewed, review_due, status FROM sops
    WHERE status = 'active' ORDER BY title
  `);

  if (!result.length || !result[0].values.length) { log('SOP', 'No SOPs'); return; }

  console.log('\n=== SOPs ===\n');
  console.log('  Title                                  Owner          Last Reviewed  Review Due');
  console.log('  ' + '-'.repeat(85));

  for (const row of result[0].values) {
    const [title, owner, _purpose, reviewed, due] = row as string[];
    const overdue = due && new Date(due) < new Date() ? ' OVERDUE' : '';
    console.log(
      `  ${(title ?? '').slice(0, 38).padEnd(38)} ` +
      `${(owner ?? '').padEnd(14)} ` +
      `${(reviewed ?? '').split('T')[0].padEnd(14)} ` +
      `${(due ?? '')}${overdue}`,
    );
  }
  console.log('');
}

async function showStale(): Promise<void> {
  const db = await getDb();
  const result = db.exec(`
    SELECT title, owner, review_due FROM sops
    WHERE status = 'active' AND review_due <= date('now')
    ORDER BY review_due
  `);

  if (!result.length || !result[0].values.length) { log('SOP', 'All SOPs up to date'); return; }

  console.log('\n=== SOPs Due for Review ===\n');
  for (const row of result[0].values) {
    const [title, owner, due] = row as string[];
    console.log(`  ${title} (owner: ${owner}) — due: ${due}`);
  }
  console.log('');
}

async function main() {
  await initSchema();
  if (process.argv.includes('--create')) {
    const idx = process.argv.indexOf('--create');
    const title = process.argv[idx + 1]; const owner = process.argv[idx + 2] ?? 'TBD';
    if (!title) { logError('SOP', 'Usage: --create "Title" "Owner"'); process.exit(1); }
    await createSop(title, owner);
  } else if (process.argv.includes('--generate')) {
    const title = process.argv[process.argv.indexOf('--generate') + 1];
    if (!title) { logError('SOP', 'Usage: --generate "Title"'); process.exit(1); }
    await generateSop(title);
  } else if (process.argv.includes('--stale')) { await showStale(); }
  else { await showStatus(); }
  closeDb();
}

main().catch((err) => { logError('SOP', 'Failed', err); process.exit(1); });
