/**
 * LinkedIn Content Pipeline — generate, schedule, and track LinkedIn posts.
 *
 * Content pillars: Teach, Sell, Build Trust, Personal
 * Sources ideas from meeting transcripts, performance data, and industry trends.
 * Generates drafts via Claude with tone/style guidelines.
 *
 * Usage:
 *   npx tsx scripts/functions/linkedin-content.ts              # generate weekly content ideas
 *   npx tsx scripts/functions/linkedin-content.ts --draft       # draft pending ideas
 *   npx tsx scripts/functions/linkedin-content.ts --status      # show content calendar
 *   npx tsx scripts/functions/linkedin-content.ts --stats       # engagement stats
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

// --- Content pillars ---

const PILLARS = [
  { slug: 'teach', label: 'Teach', description: 'Share expertise, tips, frameworks — position as authority' },
  { slug: 'sell', label: 'Sell', description: 'Case studies, results, social proof — drive inbound leads' },
  { slug: 'trust', label: 'Build Trust', description: 'Behind-the-scenes, process, values — build relatability' },
  { slug: 'personal', label: 'Personal', description: 'Founder journey, lessons, opinions — humanise the brand' },
];

// --- Idea generation from meeting insights ---

async function generateIdeasFromMeetings(): Promise<{ pillar: string; topic: string; meetingId: string }[]> {
  const db = await getDb();

  // Get recent meeting summaries for content mining
  const meetings = db.exec(`
    SELECT id, title, summary, category
    FROM meetings
    WHERE summary IS NOT NULL
      AND date >= date('now', '-14 days')
      AND category IN ('client_catchup', 'strategy', 'discovery_sales', 'internal')
    ORDER BY date DESC
    LIMIT 10
  `);

  if (!meetings.length || !meetings[0].values.length) return [];

  const summaries = meetings[0].values.map((r: unknown[]) => ({
    id: r[0] as string,
    title: r[1] as string,
    summary: (r[2] as string).slice(0, 500),
  }));

  const summaryText = summaries
    .map((s: { id: string; title: string; summary: string }) => `Meeting: ${s.title}\nSummary: ${s.summary}`)
    .join('\n\n');

  const result = await aiCall('linkedin-ideas', {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    system: `You generate LinkedIn content ideas for a digital marketing agency founder. The agency (Vendo) specialises in paid media (Google Ads, Meta Ads) for SMBs. Content should be practical, direct, and avoid corporate jargon. UK English.`,
    messages: [{
      role: 'user',
      content: `Based on these recent meetings, generate 4 LinkedIn post ideas (one per pillar: Teach, Sell, Build Trust, Personal).

${summaryText}

Respond with JSON only:
[
  { "pillar": "teach|sell|trust|personal", "topic": "<post topic in one sentence>", "meeting_index": <0-based index of source meeting> }
]`,
    }],
  });

  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '[]') as { pillar: string; topic: string; meeting_index: number }[];
    return parsed.map((p) => ({
      pillar: p.pillar,
      topic: p.topic,
      meetingId: summaries[p.meeting_index]?.id ?? summaries[0].id,
    }));
  } catch {
    return [];
  }
}

// --- Draft generation ---

async function draftPost(id: number, pillar: string, topic: string): Promise<string> {
  const pillarInfo = PILLARS.find((p) => p.slug === pillar);

  const result = await aiCall('linkedin-draft', {
    model: 'claude-sonnet-4-6',
    maxTokens: 1000,
    system: `You write LinkedIn posts for Toby, founder of Vendo (a paid media agency). Style: conversational, direct, no fluff. Use short paragraphs and line breaks. End with a question or CTA. UK English. 150-250 words max.`,
    messages: [{
      role: 'user',
      content: `Write a LinkedIn post.

Pillar: ${pillarInfo?.label} — ${pillarInfo?.description}
Topic: ${topic}

Write the post text only, no title or metadata.`,
    }],
  });

  return result.text;
}

// --- Schedule helpers ---

function getNextWeekDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  // Next Mon, Tue, Wed, Thu
  const daysUntilMonday = ((1 - now.getDay()) + 7) % 7 || 7;
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + daysUntilMonday + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// --- Commands ---

async function generateIdeas(): Promise<void> {
  log('LINKEDIN', 'Generating content ideas from recent meetings...');

  const ideas = await generateIdeasFromMeetings();

  if (!ideas.length) {
    log('LINKEDIN', 'No ideas generated — check meeting data');
    return;
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const scheduleDates = getNextWeekDates();

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const scheduleDate = scheduleDates[i] ?? null;

    db.run(`
      INSERT INTO linkedin_content (pillar, topic, status, scheduled_date, source_meeting_id, created_at, updated_at)
      VALUES (?, ?, 'idea', ?, ?, ?, ?)
    `, [idea.pillar, idea.topic, scheduleDate, idea.meetingId, now, now]);

    log('LINKEDIN', `  [${idea.pillar}] ${idea.topic}${scheduleDate ? ' → ' + scheduleDate : ''}`);
  }

  saveDb();
  log('LINKEDIN', `${ideas.length} content ideas created for next week`);
}

async function draftPending(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const pending = db.exec(`
    SELECT id, pillar, topic FROM linkedin_content
    WHERE status = 'idea' AND draft IS NULL
    ORDER BY scheduled_date ASC
    LIMIT 5
  `);

  if (!pending.length || !pending[0].values.length) {
    log('LINKEDIN', 'No ideas pending drafting');
    return;
  }

  log('LINKEDIN', `Drafting ${pending[0].values.length} post(s)...`);

  for (const row of pending[0].values) {
    const [id, pillar, topic] = row as [number, string, string];

    log('LINKEDIN', `  Drafting: ${topic}`);
    const draft = await draftPost(id, pillar, topic);

    db.run(
      'UPDATE linkedin_content SET draft = ?, status = \'drafted\', updated_at = ? WHERE id = ?',
      [draft, now, id],
    );

    log('LINKEDIN', `  Drafted (${draft.length} chars)`);
  }

  saveDb();
}

async function showStatus(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT pillar, topic, status, scheduled_date, draft IS NOT NULL as has_draft
    FROM linkedin_content
    WHERE status NOT IN ('published', 'cancelled')
    ORDER BY scheduled_date ASC, created_at DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('LINKEDIN', 'No pending content');
    return;
  }

  console.log('\n=== LinkedIn Content Calendar ===\n');
  console.log('  Date         Pillar     Status     Topic');
  console.log('  ' + '-'.repeat(80));

  for (const row of result[0].values) {
    const [pillar, topic, status, date, hasDraft] = row as [string, string, string, string | null, number];
    const dateStr = date ? date.split('T')[0] : 'unscheduled';
    const statusStr = hasDraft ? status : status + ' (no draft)';
    console.log(
      `  ${dateStr.padEnd(12)} ${(pillar ?? '').padEnd(10)} ${statusStr.padEnd(18)} ${(topic ?? '').slice(0, 50)}`,
    );
  }

  // Pipeline summary
  const summary = db.exec(`
    SELECT status, COUNT(*) as count
    FROM linkedin_content
    WHERE status NOT IN ('published', 'cancelled')
    GROUP BY status
  `);

  if (summary.length && summary[0].values.length) {
    console.log('\n  Pipeline:');
    for (const row of summary[0].values) {
      console.log(`    ${(row[0] as string).padEnd(15)} ${row[1]}`);
    }
  }

  console.log('');
}

async function showStats(): Promise<void> {
  const db = await getDb();

  const stats = db.exec(`
    SELECT
      pillar,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      ROUND(AVG(CASE WHEN engagement_impressions > 0 THEN engagement_impressions END), 0) as avg_impressions,
      ROUND(AVG(CASE WHEN engagement_likes > 0 THEN engagement_likes END), 0) as avg_likes,
      ROUND(AVG(CASE WHEN engagement_comments > 0 THEN engagement_comments END), 0) as avg_comments
    FROM linkedin_content
    GROUP BY pillar
  `);

  if (!stats.length || !stats[0].values.length) {
    log('LINKEDIN', 'No content stats yet');
    return;
  }

  console.log('\n=== LinkedIn Content Stats ===\n');
  console.log('  Pillar       Total  Published  Avg Impressions  Avg Likes  Avg Comments');
  console.log('  ' + '-'.repeat(75));

  for (const row of stats[0].values) {
    const [pillar, total, published, impressions, likes, comments] = row as [string, number, number, number | null, number | null, number | null];
    console.log(
      `  ${(pillar ?? '').padEnd(12)} ${String(total).padStart(5)}  ${String(published).padStart(9)}  ` +
      `${String(impressions ?? '-').padStart(15)}  ${String(likes ?? '-').padStart(9)}  ${String(comments ?? '-').padStart(12)}`,
    );
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--draft')) {
    await draftPending();
  } else if (process.argv.includes('--status')) {
    await showStatus();
  } else if (process.argv.includes('--stats')) {
    await showStats();
  } else {
    await generateIdeas();
  }

  closeDb();
}

main().catch((err) => {
  logError('LINKEDIN', 'LinkedIn content failed', err);
  process.exit(1);
});
