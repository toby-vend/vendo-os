import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, closeDb } from '../utils/db.js';

// --- Argument parsing ---
const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const searchTerm = getArg('search');
const clientFilter = getArg('client');
const assigneeFilter = getArg('assignee');
const categoryFilter = getArg('category');
const fromDate = getArg('from');
const toDate = getArg('to');
const limit = parseInt(getArg('limit') || '10', 10);

const showStats = hasFlag('stats');
const showClients = hasFlag('clients');
const showActionItems = hasFlag('action-items');
const showDecisions = hasFlag('decisions');
const showOpen = hasFlag('open');
const showHelp = hasFlag('help') || args.length === 0;

async function main() {
  if (showHelp) {
    printHelp();
    return;
  }

  await initSchema();
  const db = await getDb();

  try {
    if (showStats) {
      printStats(db);
    } else if (showClients) {
      printClients(db);
    } else if (showActionItems) {
      printActionItems(db);
    } else if (showDecisions) {
      printDecisions(db);
    } else if (searchTerm) {
      searchMeetings(db);
    } else if (clientFilter) {
      searchByClient(db);
    } else {
      printHelp();
    }
  } finally {
    closeDb();
  }
}

function printHelp() {
  console.log(`
Meeting Search — Query Vendo meeting intelligence

Usage:
  npx tsx scripts/query/search-meetings.ts [options]

Search:
  --search "term"          Full-text search across titles, summaries, transcripts
  --client "Name"          Filter by client name (partial match)
  --assignee "Name"        Filter action items by assignee
  --category "slug"        Filter by category (client_catchup, onboarding, interview, etc.)
  --from "YYYY-MM-DD"      Filter by start date
  --to "YYYY-MM-DD"        Filter by end date
  --limit N                Max results (default: 10)

Views:
  --stats                  Overview statistics
  --clients                List all clients with meeting counts
  --action-items           List action items (combine with --assignee, --open)
  --decisions              List key decisions (combine with --from, --to)
  --open                   Show only open/incomplete items

Combine filters:
  --client "APS" --search "pricing"
  --action-items --assignee "Sam Franks" --open
  --decisions --from "2026-03-01"
`);
}

function printStats(db: import('sql.js').Database) {
  const total = db.exec('SELECT COUNT(*) FROM meetings')[0].values[0][0];
  const range = db.exec('SELECT MIN(date), MAX(date) FROM meetings')[0].values[0];
  const withTranscript = db.exec('SELECT COUNT(*) FROM meetings WHERE transcript IS NOT NULL')[0].values[0][0];
  const processed = db.exec('SELECT COUNT(*) FROM meetings WHERE processed_at IS NOT NULL')[0].values[0][0];
  const totalActions = db.exec('SELECT COUNT(*) FROM action_items')[0].values[0][0];
  const openActions = db.exec('SELECT COUNT(*) FROM action_items WHERE completed = 0')[0].values[0][0];
  const totalDecisions = db.exec('SELECT COUNT(*) FROM key_decisions')[0].values[0][0];
  const totalClients = db.exec('SELECT COUNT(*) FROM clients')[0].values[0][0];

  console.log(`## Meeting Database Stats\n`);
  console.log(`| Metric | Value |`);
  console.log(`|--------|-------|`);
  console.log(`| Total meetings | ${total} |`);
  console.log(`| Date range | ${(range[0] as string)?.slice(0, 10)} to ${(range[1] as string)?.slice(0, 10)} |`);
  console.log(`| With transcript | ${withTranscript} |`);
  console.log(`| Processed | ${processed} |`);
  console.log(`| Total action items | ${totalActions} |`);
  console.log(`| Open action items | ${openActions} |`);
  console.log(`| Key decisions | ${totalDecisions} |`);
  console.log(`| Unique clients | ${totalClients} |`);

  // Category breakdown
  const cats = db.exec('SELECT category, COUNT(*) FROM meetings GROUP BY category ORDER BY COUNT(*) DESC');
  if (cats.length && cats[0].values.length) {
    console.log(`\n### Categories\n`);
    for (const row of cats[0].values) {
      console.log(`- ${row[0] || 'uncategorised'}: ${row[1]}`);
    }
  }

  // Monthly trend (last 6)
  const monthly = db.exec(`
    SELECT substr(date, 1, 7), COUNT(*)
    FROM meetings WHERE date >= date('now', '-6 months')
    GROUP BY 1 ORDER BY 1
  `);
  if (monthly.length && monthly[0].values.length) {
    console.log(`\n### Monthly Trend\n`);
    for (const row of monthly[0].values) {
      console.log(`- ${row[0]}: ${row[1]} meetings`);
    }
  }
}

function printClients(db: import('sql.js').Database) {
  const clients = db.exec(`
    SELECT name, meeting_count, vertical, status, first_meeting_date, last_meeting_date
    FROM clients ORDER BY meeting_count DESC
  `);
  if (!clients.length || !clients[0].values.length) {
    console.log('No clients found. Run process-meetings.ts first.');
    return;
  }

  console.log(`## Clients (${clients[0].values.length} total)\n`);
  console.log(`| Client | Meetings | Vertical | Status | First | Last |`);
  console.log(`|--------|----------|----------|--------|-------|------|`);
  for (const row of clients[0].values) {
    console.log(`| ${row[0]} | ${row[1]} | ${row[2] || '—'} | ${row[3]} | ${(row[4] as string)?.slice(0, 10) || '—'} | ${(row[5] as string)?.slice(0, 10) || '—'} |`);
  }
}

function searchMeetings(db: import('sql.js').Database) {
  // Build date filter conditions
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (clientFilter) {
    conditions.push('m.client_name LIKE ?');
    params.push(`%${clientFilter}%`);
  }
  if (categoryFilter) {
    conditions.push('m.category = ?');
    params.push(categoryFilter);
  }
  if (fromDate) {
    conditions.push('m.date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('m.date <= ?');
    params.push(toDate + 'T23:59:59Z');
  }

  const whereClause = conditions.length ? 'AND ' + conditions.join(' AND ') : '';

  // FTS4 search
  const ftsQuery = searchTerm!
    .replace(/['"]/g, '') // strip quotes for safety
    .split(/\s+/)
    .map(w => w + '*') // prefix matching
    .join(' ');

  const query = `
    SELECT m.id, m.title, m.date, m.category, m.client_name, m.duration_seconds,
           snippet(meetings_fts, '<b>', '</b>', '...', -1, 40) as excerpt
    FROM meetings_fts fts
    JOIN meetings m ON m.rowid = fts.rowid
    WHERE meetings_fts MATCH ?
    ${whereClause}
    ORDER BY m.date DESC
    LIMIT ?
  `;

  const results = db.exec(query, [ftsQuery, ...params, limit]);
  if (!results.length || !results[0].values.length) {
    console.log(`No results for "${searchTerm}"`);
    return;
  }

  console.log(`## Search: "${searchTerm}" (${results[0].values.length} results)\n`);

  for (const row of results[0].values) {
    const [id, title, date, category, client, duration, excerpt] = row as [string, string, string, string, string, number, string];
    const durMin = duration ? Math.round(duration / 60) : '?';
    const clientStr = client ? ` | **Client:** ${client}` : '';

    console.log(`### ${title} — ${(date || '').slice(0, 10)}`);
    console.log(`**Category:** ${category || '—'} | **Duration:** ${durMin} min${clientStr}`);
    if (excerpt) {
      const cleanExcerpt = excerpt.replace(/<\/?b>/g, '**').replace(/\n/g, ' ');
      console.log(`**Match:** ${cleanExcerpt}`);
    }

    // Show action items from this meeting
    const actions = db.exec(
      'SELECT description, assignee, completed FROM action_items WHERE meeting_id = ? LIMIT 5',
      [id]
    );
    if (actions.length && actions[0].values.length) {
      console.log(`**Action items:**`);
      for (const a of actions[0].values) {
        const check = a[2] ? '[x]' : '[ ]';
        const who = a[1] ? ` (${a[1]})` : '';
        console.log(`  - ${check} ${a[0]}${who}`);
      }
    }
    console.log('');
  }
}

function searchByClient(db: import('sql.js').Database) {
  const conditions: string[] = ['m.client_name LIKE ?'];
  const params: (string | number)[] = [`%${clientFilter}%`];

  if (fromDate) {
    conditions.push('m.date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('m.date <= ?');
    params.push(toDate + 'T23:59:59Z');
  }

  const query = `
    SELECT m.id, m.title, m.date, m.category, m.duration_seconds, m.summary
    FROM meetings m
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.date DESC
    LIMIT ?
  `;

  const results = db.exec(query, [...params, limit]);
  if (!results.length || !results[0].values.length) {
    console.log(`No meetings found for client "${clientFilter}"`);
    return;
  }

  console.log(`## Client: "${clientFilter}" (${results[0].values.length} meetings)\n`);

  for (const row of results[0].values) {
    const [id, title, date, category, duration, summary] = row as [string, string, string, string, number, string];
    const durMin = duration ? Math.round(duration / 60) : '?';

    console.log(`### ${(date || '').slice(0, 10)} — ${title}`);
    console.log(`**Category:** ${category || '—'} | **Duration:** ${durMin} min`);

    // Key takeaways from summary
    if (summary) {
      const lines = summary.split('\n');
      const takeaways: string[] = [];
      let inTakeaways = false;
      for (const line of lines) {
        if (line.includes('Key Takeaway')) { inTakeaways = true; continue; }
        if (inTakeaways && line.startsWith('## ') && !line.includes('Takeaway')) break;
        if (inTakeaways && line.trim().startsWith('- ')) {
          const clean = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
          takeaways.push(clean.slice(0, 150));
        }
      }
      if (takeaways.length) {
        for (const t of takeaways.slice(0, 4)) console.log(`  ${t}`);
      }
    }

    // Action items
    const actions = db.exec(
      'SELECT description, assignee, completed FROM action_items WHERE meeting_id = ? LIMIT 5',
      [id]
    );
    if (actions.length && actions[0].values.length) {
      console.log(`**Actions:**`);
      for (const a of actions[0].values) {
        const check = a[2] ? '[x]' : '[ ]';
        const who = a[1] ? ` (${a[1]})` : '';
        console.log(`  - ${check} ${a[0]}${who}`);
      }
    }
    console.log('');
  }
}

function printActionItems(db: import('sql.js').Database) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (assigneeFilter) {
    conditions.push('ai.assignee LIKE ?');
    params.push(`%${assigneeFilter}%`);
  }
  if (showOpen) {
    conditions.push('ai.completed = 0');
  }
  if (fromDate) {
    conditions.push('ai.created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('ai.created_at <= ?');
    params.push(toDate + 'T23:59:59Z');
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  // Summary by assignee
  const summary = db.exec(`
    SELECT ai.assignee, COUNT(*) as cnt,
           SUM(CASE WHEN ai.completed = 0 THEN 1 ELSE 0 END) as open_cnt
    FROM action_items ai
    ${whereClause}
    GROUP BY ai.assignee
    ORDER BY cnt DESC
  `, params);

  if (summary.length && summary[0].values.length) {
    const totalItems = summary[0].values.reduce((sum, row) => sum + (row[1] as number), 0);
    const openItems = summary[0].values.reduce((sum, row) => sum + (row[2] as number), 0);
    console.log(`## Action Items (${totalItems} total, ${openItems} open)\n`);
    console.log(`| Assignee | Total | Open |`);
    console.log(`|----------|-------|------|`);
    for (const row of summary[0].values) {
      console.log(`| ${row[0] || 'Unassigned'} | ${row[1]} | ${row[2]} |`);
    }
  }

  // Detailed list if filtered
  if (assigneeFilter) {
    const detailed = db.exec(`
      SELECT ai.description, ai.completed, m.title, m.date
      FROM action_items ai
      JOIN meetings m ON ai.meeting_id = m.id
      ${whereClause}
      ORDER BY m.date DESC
      LIMIT ?
    `, [...params, limit]);

    if (detailed.length && detailed[0].values.length) {
      console.log(`\n### Items for ${assigneeFilter}\n`);
      for (const row of detailed[0].values) {
        const check = row[1] ? '[x]' : '[ ]';
        console.log(`- ${check} ${row[0]}`);
        console.log(`  _from: ${row[2]} (${(row[3] as string)?.slice(0, 10)})_`);
      }
    }
  }
}

function printDecisions(db: import('sql.js').Database) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (fromDate) {
    conditions.push('m.date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('m.date <= ?');
    params.push(toDate + 'T23:59:59Z');
  }
  if (clientFilter) {
    conditions.push('m.client_name LIKE ?');
    params.push(`%${clientFilter}%`);
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const results = db.exec(`
    SELECT kd.description, m.title, m.date, m.client_name
    FROM key_decisions kd
    JOIN meetings m ON kd.meeting_id = m.id
    ${whereClause}
    ORDER BY m.date DESC
    LIMIT ?
  `, [...params, limit]);

  if (!results.length || !results[0].values.length) {
    console.log('No decisions found matching criteria');
    return;
  }

  console.log(`## Key Decisions (${results[0].values.length} results)\n`);
  for (const row of results[0].values) {
    const client = row[3] ? ` (${row[3]})` : '';
    console.log(`- **${(row[2] as string)?.slice(0, 10)}**${client}: ${row[0]}`);
    console.log(`  _from: ${row[1]}_`);
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
