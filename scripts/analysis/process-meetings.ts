import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, rebuildFts, log, logError } from '../utils/db.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const REPROCESS = process.argv.includes('--reprocess');
const REPORT_ONLY = process.argv.includes('--report-only');

// --- Team member normalisation (from context/team.md) ---
const TEAM_MEMBERS: Record<string, string[]> = {
  'Max Rivens': ['Max Rivens', 'Max'],
  'Toby Raeburn': ['Toby Raeburn', 'Toby R'],
  'Alfie Wakelin': ['Alfie Wakelin', 'Alfie'],
  'Sam Franks': ['Sam Franks', 'Sam'],
  'Ben Dyer': ['Ben Dyer', 'Ben D'],
  'Jake Dennis': ['Jake Dennis', 'Jake'],
  'Helen Walker': ['Helen Walker', 'Helen'],
  'Chris Tomkins': ['Chris Tomkins', 'Chris'],
  'Shaun Silverside': ['Shaun Silverside', 'Shaun'],
  'Amya Casallas': ['Amya Casallas', 'Amya', 'Amya Casillas'],
  'Benjamin Momo': ['Benjamin Momo', 'Benjamin', 'Momo', 'Ben Momo', 'Ben M'],
  'Faith Larkum': ['Faith Larkum', 'Faith'],
  'Rhiannon Larkman': ['Rhiannon Larkman', 'Rhiannon', 'Rhi'],
  'Matthew Potter': ['Matthew Potter', 'Matthew', 'Matt P'],
  'Holly Turner': ['Holly Turner', 'Holly'],
  'Dilith N': ['Dilith Nanayakkara', 'Dilith', 'Diliff'],
  'Charuka Shiran': ['Charuka Shiran', 'Charuka', 'Shuruka'],
  'Selvin Mendes': ['Selvin Mendes', 'Selvin'],
  'Naveen': ['Naveen'],
  'Sarah': ['Sarah'],
  'Caira': ['Caira'],
  'Sahan': ['Sahan'],
};

// Build reverse lookup: lowercase alias → canonical name
const ALIAS_TO_NAME: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(TEAM_MEMBERS)) {
  for (const alias of aliases) {
    ALIAS_TO_NAME[alias.toLowerCase()] = canonical;
  }
}

function normaliseAssignee(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  if (ALIAS_TO_NAME[lower]) return ALIAS_TO_NAME[lower];

  // Try partial match (first name only)
  for (const [alias, canonical] of Object.entries(ALIAS_TO_NAME)) {
    if (lower === alias.split(' ')[0]) return canonical;
  }
  return name.trim(); // Return original if no match — could be a client
}

// --- Meeting categorisation ---
interface CategoryRule {
  slug: string;
  keywords: string[];
  requiresClient?: boolean; // Only match if title looks like it has a client
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
        // Only match if there's a client separator in the title
        const hasClient = /[x|\/\-–—]/.test(title) && !lower.includes('team');
        if (!hasClient) continue;
      }
      return rule.slug;
    }
  }

  return 'other';
}

// --- Client name extraction ---
const CLIENT_SEPARATORS = [
  ' x Vendo', ' x vendo',
  ' / Vendo', ' / vendo',
  ' | Vendo', ' | vendo',
  ' - Vendo', ' - vendo',
  ' – Vendo', ' – vendo',
  ' — Vendo', ' — vendo',
  'Vendo x ', 'vendo x ',
  'Vendo / ', 'vendo / ',
  'Vendo | ', 'vendo | ',
  'Vendo - ', 'vendo - ',
  'Vendo Digital', 'vendo digital',
];

function extractClientName(title: string): string | null {
  const lower = title.toLowerCase();

  // Skip non-client meeting types
  if (lower.includes('interview') || lower.includes('team meeting') || lower.includes('1 - 1') || lower.includes('1-1')) {
    return null;
  }

  // Try to extract client from "Client x Vendo" or "Vendo x Client" patterns
  for (const sep of CLIENT_SEPARATORS) {
    const sepLower = sep.toLowerCase();
    const idx = lower.indexOf(sepLower);
    if (idx === -1) continue;

    if (sepLower.startsWith('vendo')) {
      // "Vendo x Client" pattern — client is after separator
      const after = title.substring(idx + sep.length).trim();
      const cleaned = after.split(/[|–—:]/)[0].trim();
      if (cleaned.length > 1) return cleaned;
    } else {
      // "Client x Vendo" pattern — client is before separator
      const before = title.substring(0, idx).trim();
      if (before.length > 1) return before;
    }
  }

  // Try generic separator patterns for titles like "ClientName | Meeting Type"
  const pipeMatch = title.match(/^(.+?)\s*[|–—]\s*.+$/);
  if (pipeMatch) {
    const candidate = pipeMatch[1].trim();
    // Only if it doesn't look like an internal meeting
    if (candidate.length > 2 && !lower.includes('paid social') && !lower.includes('paid search') && !lower.includes('seo')) {
      return candidate;
    }
  }

  return null;
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
  // Clean the summary first — strip all markdown links
  const cleaned = stripMarkdownLinks(summary);
  const decisions: string[] = [];
  for (const pattern of DECISION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      const text = match[0].trim();
      // Skip if it's just a URL fragment or too short
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

// --- Fuzzy client matching against Xero-sourced clients ---

/** Normalise a name for comparison: lowercase, strip common suffixes, punctuation */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|inc|uk|t\/a)\b/g, '')
    .replace(/\(.*?\)/g, '')           // strip parenthetical qualifiers
    .replace(/[^a-z0-9\s]/g, '')       // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a lookup of normalised Xero client names → canonical client name */
function buildClientLookup(db: any): Map<string, string> {
  const lookup = new Map<string, string>();

  const result = db.exec("SELECT name, aliases FROM clients WHERE source = 'xero'");
  if (!result.length) return lookup;

  for (const row of result[0].values) {
    const name = row[0] as string;
    const aliases = row[1] as string | null;

    // Add normalised full name
    lookup.set(normaliseName(name), name);

    // Add each word-boundary segment for partial matching
    // e.g. "Peak Dental (Shams Moopen Ltd)" → "peak dental"
    const norm = normaliseName(name);
    const words = norm.split(' ').filter(w => w.length > 2);
    // Add first 2-3 significant words as a key
    if (words.length >= 2) {
      lookup.set(words.slice(0, 2).join(' '), name);
      if (words.length >= 3) {
        lookup.set(words.slice(0, 3).join(' '), name);
      }
    }

    // Add aliases
    if (aliases) {
      try {
        const aliasList = JSON.parse(aliases) as string[];
        for (const alias of aliasList) {
          lookup.set(normaliseName(alias), name);
        }
      } catch { /* not JSON, treat as single alias */
        lookup.set(normaliseName(aliases), name);
      }
    }
  }

  return lookup;
}

/** Try to match an extracted meeting client name to a known Xero client */
function matchToXeroClient(extracted: string, lookup: Map<string, string>): string | null {
  const norm = normaliseName(extracted);
  if (!norm) return null;

  // 1. Exact normalised match
  if (lookup.has(norm)) return lookup.get(norm)!;

  // 2. Check if extracted name is a substring of any Xero name (or vice versa)
  for (const [key, canonical] of lookup) {
    if (key.includes(norm) || norm.includes(key)) {
      return canonical;
    }
  }

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

  // Build lookup of known Xero clients for matching
  const clientLookup = buildClientLookup(db);
  log('PROCESS', `Loaded ${clientLookup.size} client name variants from Xero`);

  // Get meetings to process
  const query = REPROCESS
    ? 'SELECT id, title, date, summary, raw_action_items FROM meetings'
    : 'SELECT id, title, date, summary, raw_action_items FROM meetings WHERE processed_at IS NULL';

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
  let unmatchedNames: string[] = [];
  let actionsParsed = 0;
  let decisionsExtracted = 0;

  for (const row of meetings) {
    const [id, title, date, summary, rawActionItems] = row as [string, string, string, string | null, string | null];

    // 1. Categorise
    const category = categoriseMeeting(title);
    categorised++;

    // 2. Extract and match client name
    const rawClientName = extractClientName(title);
    let matchedClientName: string | null = null;

    if (rawClientName) {
      matchedClientName = matchToXeroClient(rawClientName, clientLookup);
      if (matchedClientName) {
        clientsMatched++;
      } else {
        unmatchedNames.push(rawClientName);
      }
    }

    // 3. Update meeting — only set client_name if matched to a Xero client
    db.run('UPDATE meetings SET category = ?, client_name = ?, processed_at = ? WHERE id = ?',
      [category, matchedClientName, new Date().toISOString(), id]);

    // 4. Parse action items
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

    // 5. Extract decisions
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

  // Update meeting counts on Xero-sourced clients
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

  // Deduplicate unmatched names
  const uniqueUnmatched = [...new Set(unmatchedNames)];

  log('PROCESS', `Done: ${categorised} categorised, ${clientsMatched} matched to Xero clients, ${actionsParsed} action items, ${decisionsExtracted} decisions`);
  if (uniqueUnmatched.length) {
    log('PROCESS', `Unmatched meeting names (${uniqueUnmatched.length}): ${uniqueUnmatched.join(', ')}`);
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
