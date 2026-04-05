import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, rebuildFts, log, logError } from '../utils/db.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normaliseAssignee } from '../matching/team.js';
import { buildMatchContext } from '../matching/build-match-context.js';
import { matchMeeting } from '../matching/waterfall-matcher.js';
import { learnDomains, loadExistingDomains } from '../matching/domain-learner.js';
import type { MeetingData } from '../matching/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const REPROCESS = process.argv.includes('--reprocess');
const REPORT_ONLY = process.argv.includes('--report-only');
const SKIP_AI = process.argv.includes('--skip-ai');

// --- Meeting categorisation ---
interface CategoryRule {
  slug: string;
  keywords: string[];
  requiresClient?: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  { slug: 'interview', keywords: ['interview', 'hiring'] },
  { slug: 'onboarding', keywords: ['onboarding', 'onboard'] },
  { slug: 'internal', keywords: ['team meeting', 'team call', 'management meeting', '1 - 1', '1-1'] },
  { slug: 'discovery_sales', keywords: ['discovery', 'initial call', 'enquiry', 'inquiry', 'proposal'] },
  { slug: 'website_design', keywords: ['website', 'web design', 'design feedback', 'design review', 'pdp'] },
  { slug: 'strategy', keywords: ['strategy', 'audit'] },
  { slug: 'service_specific', keywords: ['paid social team', 'paid search team', 'paid social management', 'paid search |', 'seo catch up'] },
  { slug: 'client_catchup', keywords: ['catch up', 'catch-up', 'catchup', 'monthly', 'bi-weekly', 'bi weekly', 'update', 'review'], requiresClient: true },
];

function categoriseMeeting(title: string): string {
  const lower = title.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const matches = rule.keywords.some(kw => lower.includes(kw));
    if (matches) {
      if (rule.requiresClient) {
        const hasClient = /[x|\/\-–—]/.test(title) && !lower.includes('team');
        if (!hasClient) continue;
      }
      return rule.slug;
    }
  }

  return 'other';
}

// --- Decision extraction from summaries ---
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
}

const DECISION_PATTERNS = [
  /(?:decided to|agreed to|will proceed with|confirmed that|the decision is to)\s+(.{10,200}?)(?:\.|$)/gi,
];

function extractDecisions(summary: string): string[] {
  if (!summary) return [];
  const cleaned = stripMarkdownLinks(summary);
  const decisions: string[] = [];
  for (const pattern of DECISION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      const text = match[0].trim();
      if (text.length < 20 || text.includes('fathom.video')) continue;
      decisions.push(text);
    }
  }
  return [...new Set(decisions)];
}

// --- Vertical detection ---
function detectVertical(clientName: string): string | null {
  const lower = clientName.toLowerCase();
  if (lower.includes('dental') || lower.includes('ortho') || lower.includes('smile') || lower.includes('dent')) return 'dental';
  if (lower.includes('sword') || lower.includes('moulding') || lower.includes('label') || lower.includes('veltuff')) return 'ecommerce';
  if (lower.includes('aps') || lower.includes('plant') || lower.includes('hire')) return 'plant_hire';
  if (lower.includes('glide') || lower.includes('studio') || lower.includes('pilates')) return 'fitness';
  if (lower.includes('colbran')) return 'removals';
  return null;
}

// --- Main processing ---
async function processMeetings() {
  await initSchema();
  const db = await getDb();

  if (REPORT_ONLY) {
    await generateReport();
    closeDb();
    return;
  }

  // Build waterfall match context
  const ctx = buildMatchContext(db);
  log('PROCESS', `Match context: ${ctx.emailDomainLookup.size} email domains, ${ctx.clientNameLookup.size} client name variants, ${ctx.contactNameLookup.size} contact names`);

  // Load existing domain mappings for dedup
  const existingDomains = loadExistingDomains(db);

  // Get meetings to process
  const query = REPROCESS
    ? 'SELECT id, title, date, summary, transcript, raw_action_items, calendar_invitees, invitee_domains_type FROM meetings'
    : 'SELECT id, title, date, summary, transcript, raw_action_items, calendar_invitees, invitee_domains_type FROM meetings WHERE processed_at IS NULL';

  const results = db.exec(query);
  if (!results.length || !results[0].values.length) {
    log('PROCESS', 'No meetings to process');
    closeDb();
    return;
  }

  const meetings = results[0].values;
  log('PROCESS', `Processing ${meetings.length} meetings...`);

  let categorised = 0;
  let clientsMatched = 0;
  let domainsLearned = 0;
  let actionsParsed = 0;
  let decisionsExtracted = 0;
  const methodCounts: Record<string, number> = {};

  for (const row of meetings) {
    const [id, title, date, summary, transcript, rawActionItems, calendarInvitees, inviteeDomainsType] =
      row as [string, string, string, string | null, string | null, string | null, string | null, string | null];

    // 1. Categorise
    const category = categoriseMeeting(title);
    categorised++;

    // 2. Waterfall client matching
    const meetingData: MeetingData = {
      id, title, summary, transcript,
      calendar_invitees: calendarInvitees,
      raw_action_items: rawActionItems,
      invitee_domains_type: inviteeDomainsType,
    };

    const matchResult = await matchMeeting(meetingData, ctx, { skipAi: SKIP_AI });

    if (matchResult.client_name) {
      clientsMatched++;
    }
    methodCounts[matchResult.method] = (methodCounts[matchResult.method] || 0) + 1;

    // 3. Update meeting
    db.run(`
      UPDATE meetings SET
        category = ?, client_name = ?, match_method = ?, match_confidence = ?,
        needs_review = ?, processed_at = ?
      WHERE id = ?
    `, [
      category, matchResult.client_name, matchResult.method, matchResult.confidence,
      matchResult.method === 'unmatched' || (matchResult.evidence as any)?.multi_client ? 1 : 0,
      new Date().toISOString(), id,
    ]);

    // 4. Write match log (upsert)
    if (REPROCESS) {
      db.run('DELETE FROM meeting_match_log WHERE meeting_id = ?', [id]);
    }
    db.run(`
      INSERT OR REPLACE INTO meeting_match_log (meeting_id, client_name, method, confidence, evidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, matchResult.client_name, matchResult.method, matchResult.confidence,
        JSON.stringify(matchResult.evidence), new Date().toISOString()]);

    // 5. Learn new domain mappings
    domainsLearned += learnDomains(db, meetingData, matchResult, existingDomains);

    // 6. Parse action items
    if (rawActionItems) {
      try {
        const items = JSON.parse(rawActionItems);
        if (Array.isArray(items)) {
          if (REPROCESS) {
            db.run('DELETE FROM action_items WHERE meeting_id = ?', [id]);
          }

          for (const item of items) {
            const desc = item.description || '';
            if (!desc) continue;

            const assigneeName = item.assignee?.name || null;
            const normalised = assigneeName ? normaliseAssignee(assigneeName) : null;
            const completed = item.completed ? 1 : 0;

            const existing = db.exec(
              'SELECT id FROM action_items WHERE meeting_id = ? AND description = ?',
              [id, desc]
            );
            if (existing.length > 0 && existing[0].values.length > 0) continue;

            db.run(
              'INSERT INTO action_items (meeting_id, description, assignee, completed, created_at) VALUES (?, ?, ?, ?, ?)',
              [id, desc, normalised, completed, date]
            );
            actionsParsed++;
          }
        }
      } catch {
        logError('PROCESS', `Failed to parse action items for meeting ${id}`);
      }
    }

    // 7. Extract decisions
    if (summary) {
      if (REPROCESS) {
        db.run('DELETE FROM key_decisions WHERE meeting_id = ?', [id]);
      }

      const decisions = extractDecisions(summary);
      for (const decision of decisions) {
        db.run(
          'INSERT INTO key_decisions (meeting_id, description, created_at) VALUES (?, ?, ?)',
          [id, decision, date]
        );
        decisionsExtracted++;
      }
    }
  }

  // Update meeting counts on clients
  db.run(`
    UPDATE clients SET
      meeting_count = (SELECT COUNT(*) FROM meetings WHERE meetings.client_name = clients.name),
      first_meeting_date = (SELECT MIN(date) FROM meetings WHERE meetings.client_name = clients.name),
      last_meeting_date = (SELECT MAX(date) FROM meetings WHERE meetings.client_name = clients.name)
    WHERE source = 'xero'
  `);

  // Clean out old Fathom-only clients that have no Xero backing
  db.run("DELETE FROM clients WHERE source = 'fathom' OR source IS NULL");

  saveDb();

  log('PROCESS', `Done: ${categorised} categorised, ${clientsMatched} matched to clients, ${actionsParsed} action items, ${decisionsExtracted} decisions, ${domainsLearned} domains learned`);
  log('PROCESS', `Match methods: ${Object.entries(methodCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // AI concern detection (runs after all meetings have client_name populated)
  if (!SKIP_AI) {
    const { run: runConcerns } = await import('./detect-concerns.js');
    const r = await runConcerns();
    log('PROCESS', `Concerns: ${r.checked} analysed, ${r.flagged} flagged`);
  }

  await generateReport();
  closeDb();
}

// --- Report generation ---
async function generateReport() {
  const db = await getDb();
  const now = new Date().toISOString().slice(0, 10);

  // Stats
  const totalMeetings = db.exec('SELECT COUNT(*) FROM meetings')[0].values[0][0] as number;
  const dateRange = db.exec('SELECT MIN(date), MAX(date) FROM meetings')[0].values[0] as [string, string];

  // Category breakdown
  const categories = db.exec(`
    SELECT category, COUNT(*) as cnt FROM meetings
    GROUP BY category ORDER BY cnt DESC
  `);

  // Match method breakdown
  const matchMethods = db.exec(`
    SELECT match_method, match_confidence, COUNT(*) as cnt FROM meetings
    WHERE match_method IS NOT NULL
    GROUP BY match_method, match_confidence ORDER BY cnt DESC
  `);

  // Monthly volume (last 6 months)
  const monthly = db.exec(`
    SELECT substr(date, 1, 7) as month, COUNT(*) as cnt
    FROM meetings
    WHERE date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `);

  // Top clients by meeting count
  const topClients = db.exec(`
    SELECT name, meeting_count, vertical, last_meeting_date
    FROM clients ORDER BY meeting_count DESC LIMIT 20
  `);

  // Open action items by assignee
  const openActions = db.exec(`
    SELECT assignee, COUNT(*) as cnt
    FROM action_items WHERE completed = 0 AND assignee IS NOT NULL
    GROUP BY assignee ORDER BY cnt DESC
  `);

  // Recent onboardings
  const recentOnboardings = db.exec(`
    SELECT title, date, client_name FROM meetings
    WHERE category = 'onboarding' AND date >= date('now', '-60 days')
    ORDER BY date DESC
  `);

  // Recent interviews
  const recentInterviews = db.exec(`
    SELECT title, date FROM meetings
    WHERE category = 'interview' AND date >= date('now', '-60 days')
    ORDER BY date DESC
  `);

  // Key decisions (last 30 days)
  const recentDecisions = db.exec(`
    SELECT kd.description, m.title, m.date, m.client_name
    FROM key_decisions kd
    JOIN meetings m ON kd.meeting_id = m.id
    WHERE m.date >= date('now', '-30 days')
    ORDER BY m.date DESC
    LIMIT 30
  `);

  // Needs review count
  const needsReview = db.exec('SELECT COUNT(*) FROM meetings WHERE needs_review = 1');
  const reviewCount = needsReview.length ? needsReview[0].values[0][0] as number : 0;

  // Build report
  let report = `# Meeting Intelligence Report\n\n`;
  report += `_Generated: ${now} | ${totalMeetings} meetings | ${dateRange[0]?.slice(0, 10)} to ${dateRange[1]?.slice(0, 10)}_\n\n---\n\n`;

  // Category breakdown
  report += `## Meeting Categories\n\n| Category | Count | % |\n|----------|-------|---|\n`;
  if (categories.length && categories[0].values.length) {
    for (const row of categories[0].values) {
      const pct = Math.round((row[1] as number) / totalMeetings * 100);
      report += `| ${row[0] || 'uncategorised'} | ${row[1]} | ${pct}% |\n`;
    }
  }

  // Match method breakdown
  report += `\n## Match Method Breakdown\n\n| Method | Confidence | Count |\n|--------|-----------|-------|\n`;
  if (matchMethods.length && matchMethods[0].values.length) {
    for (const row of matchMethods[0].values) {
      report += `| ${row[0]} | ${row[1]} | ${row[2]} |\n`;
    }
  }
  report += `\n_Meetings needing review: ${reviewCount}_\n`;

  // Monthly volume
  report += `\n## Monthly Volume\n\n| Month | Meetings |\n|-------|----------|\n`;
  if (monthly.length && monthly[0].values.length) {
    for (const row of monthly[0].values) {
      report += `| ${row[0]} | ${row[1]} |\n`;
    }
  }

  // Top clients
  report += `\n## Top Clients\n\n| Client | Meetings | Vertical | Last Meeting |\n|--------|----------|----------|-------------|\n`;
  if (topClients.length && topClients[0].values.length) {
    for (const row of topClients[0].values) {
      report += `| ${row[0]} | ${row[1]} | ${row[2] || '—'} | ${(row[3] as string)?.slice(0, 10) || '—'} |\n`;
    }
  }

  // Open action items
  report += `\n## Open Action Items by Assignee\n\n| Person | Open Items |\n|--------|------------|\n`;
  if (openActions.length && openActions[0].values.length) {
    for (const row of openActions[0].values) {
      report += `| ${row[0]} | ${row[1]} |\n`;
    }
  }

  // Recent onboardings
  if (recentOnboardings.length && recentOnboardings[0].values.length) {
    report += `\n## Recent Onboardings (60 days)\n\n`;
    for (const row of recentOnboardings[0].values) {
      report += `- **${(row[1] as string).slice(0, 10)}** — ${row[2] || row[0]}\n`;
    }
  }

  // Recent interviews
  if (recentInterviews.length && recentInterviews[0].values.length) {
    report += `\n## Recent Interviews (60 days)\n\n`;
    for (const row of recentInterviews[0].values) {
      report += `- **${(row[1] as string).slice(0, 10)}** — ${row[0]}\n`;
    }
  }

  // Recent decisions
  if (recentDecisions.length && recentDecisions[0].values.length) {
    report += `\n## Key Decisions (30 days)\n\n`;
    for (const row of recentDecisions[0].values) {
      const client = row[3] ? ` (${row[3]})` : '';
      report += `- **${(row[2] as string).slice(0, 10)}**${client}: ${row[0]}\n`;
    }
  }

  // Write report
  const outputPath = resolve(PROJECT_ROOT, `outputs/analyses/${now}-meeting-intelligence.md`);
  writeFileSync(outputPath, report);
  log('PROCESS', `Report written to ${outputPath}`);
}

processMeetings().catch(err => {
  logError('PROCESS', 'Processing failed', err);
  process.exit(1);
});
