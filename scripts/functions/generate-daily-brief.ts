import { config } from 'dotenv';
// Load .env.local, but don't override existing shell env vars
config({ path: '.env.local', override: false });

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, initSchema, closeDb, log, logError } from '../utils/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

// --- Config ---
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY!;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!;
const FATHOM_API_KEY = process.env.FATHOM_API_KEY!;

// --- Helpers ---
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// --- GHL Data ---
interface GhlPipelineStage {
  id: string;
  name: string;
}

interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
}

interface GhlOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastStageChangeAt: string;
  contact: {
    name: string;
    companyName: string;
    email: string;
    phone: string;
  };
}

const ghlHeaders: Record<string, string> = {
  'Authorization': `Bearer ${GHL_API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

async function fetchGhlPipelines(): Promise<GhlPipeline[]> {
  const resp = await fetch(`${GHL_BASE_URL}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`, { headers: ghlHeaders });
  if (!resp.ok) throw new Error(`GHL pipelines ${resp.status}`);
  const data = await resp.json() as { pipelines: GhlPipeline[] };
  return data.pipelines;
}

async function fetchGhlOpportunities(pipelineId: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = [];
  let startAfterId = '';
  let startAfter = '';

  while (true) {
    let url = `${GHL_BASE_URL}/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
    if (startAfterId) {
      url += `&startAfterId=${startAfterId}&startAfter=${startAfter}`;
    }
    const resp = await fetch(url, { headers: ghlHeaders });
    if (!resp.ok) throw new Error(`GHL opps ${resp.status}`);
    const data = await resp.json() as { opportunities: GhlOpportunity[]; meta: { startAfterId?: string; startAfter?: number; total: number } };
    all.push(...data.opportunities);
    if (!data.meta.startAfterId || data.opportunities.length === 0) break;
    startAfterId = data.meta.startAfterId;
    startAfter = String(data.meta.startAfter || '');
  }
  return all;
}

async function getPipelineData(): Promise<string> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return 'GHL not configured — no pipeline data available.';

  try {
    const pipelines = await fetchGhlPipelines();
    const stageNames: Record<string, string> = {};
    for (const p of pipelines) {
      for (const s of p.stages) stageNames[s.id] = s.name;
    }

    let allOpps: GhlOpportunity[] = [];
    for (const p of pipelines) {
      const opps = await fetchGhlOpportunities(p.id);
      allOpps.push(...opps);
    }

    const active = allOpps.filter(o => o.status === 'open');
    const totalActiveValue = active.reduce((s, o) => s + (o.monetaryValue || 0), 0);

    // New leads (created in last 7 days)
    const weekAgo = daysAgo(7);
    const newLeads = allOpps.filter(o => o.createdAt >= weekAgo);

    // Stalled deals (no stage change in 14+ days)
    const twoWeeksAgo = daysAgo(14);
    const stalled = active.filter(o => o.lastStageChangeAt && o.lastStageChangeAt < twoWeeksAgo);

    // Won this month
    const monthStart = today().slice(0, 7);
    const wonThisMonth = allOpps.filter(o => o.status === 'won' && o.updatedAt?.startsWith(monthStart));
    const wonValue = wonThisMonth.reduce((s, o) => s + (o.monetaryValue || 0), 0);

    // Lost this month
    const lostThisMonth = allOpps.filter(o => o.status === 'lost' && o.updatedAt?.startsWith(monthStart));

    // By stage breakdown
    const byStage: Record<string, { count: number; value: number; deals: string[] }> = {};
    for (const o of active) {
      const stage = stageNames[o.pipelineStageId] || 'Unknown';
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0, deals: [] };
      byStage[stage].count++;
      byStage[stage].value += o.monetaryValue || 0;
      if (byStage[stage].deals.length < 5) {
        byStage[stage].deals.push(`${o.contact?.companyName || o.name} (£${(o.monetaryValue || 0).toLocaleString()})`);
      }
    }

    let output = `## Pipeline & Sales Data\n\n`;
    output += `- **Active pipeline:** ${active.length} deals worth £${totalActiveValue.toLocaleString()}\n`;
    output += `- **New leads (7 days):** ${newLeads.length}\n`;
    output += `- **Won this month:** ${wonThisMonth.length} (£${wonValue.toLocaleString()})\n`;
    output += `- **Lost this month:** ${lostThisMonth.length}\n`;
    output += `- **Stalled deals (14+ days no movement):** ${stalled.length}\n\n`;

    output += `### Active by Stage\n`;
    for (const [stage, data] of Object.entries(byStage).sort((a, b) => b[1].value - a[1].value)) {
      output += `\n**${stage}** — ${data.count} deals, £${data.value.toLocaleString()}\n`;
      for (const d of data.deals) output += `  - ${d}\n`;
      if (data.count > 5) output += `  - ...+${data.count - 5} more\n`;
    }

    if (stalled.length > 0) {
      output += `\n### Stalled Deals (Need Attention)\n`;
      for (const o of stalled.slice(0, 10)) {
        const daysSinceMove = Math.floor((Date.now() - new Date(o.lastStageChangeAt).getTime()) / 86400000);
        output += `- **${o.contact?.companyName || o.name}** — ${stageNames[o.pipelineStageId] || '?'} — ${daysSinceMove} days since last movement — £${(o.monetaryValue || 0).toLocaleString()}\n`;
      }
    }

    return output;
  } catch (err) {
    logError('BRIEF', 'Failed to fetch GHL data', err);
    return `Pipeline data unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// --- Meeting Data (SQLite) ---
async function getMeetingData(): Promise<string> {
  try {
    await initSchema();
    const db = await getDb();

    const yesterdayDate = yesterday();
    const todayDate = today();

    // Yesterday's meetings
    const yesterdayMeetings = db.exec(
      `SELECT title, summary, category, client_name, duration_seconds
       FROM meetings
       WHERE date >= ? AND date < ?
       ORDER BY date DESC`,
      [yesterdayDate + 'T00:00:00', todayDate + 'T00:00:00']
    );

    // Open action items
    const openActions = db.exec(
      `SELECT ai.description, ai.assignee, ai.created_at, m.title AS meeting_title, m.client_name
       FROM action_items ai
       JOIN meetings m ON ai.meeting_id = m.id
       WHERE ai.completed = 0
       ORDER BY ai.created_at DESC
       LIMIT 30`
    );

    // Recent meetings (last 3 days for context)
    const recentMeetings = db.exec(
      `SELECT title, summary, client_name, date, category
       FROM meetings
       WHERE date >= ?
       ORDER BY date DESC
       LIMIT 20`,
      [daysAgo(3) + 'T00:00:00']
    );

    // Meeting stats
    const weekStats = db.exec(
      `SELECT COUNT(*) as count, category
       FROM meetings
       WHERE date >= ?
       GROUP BY category
       ORDER BY count DESC`,
      [daysAgo(7) + 'T00:00:00']
    );

    let output = '## Meeting Data\n\n';

    // Yesterday's meetings
    output += `### Yesterday's Meetings (${yesterdayDate})\n`;
    if (yesterdayMeetings.length > 0 && yesterdayMeetings[0].values.length > 0) {
      for (const row of yesterdayMeetings[0].values) {
        const [title, summary, category, client, duration] = row;
        const mins = duration ? Math.round(Number(duration) / 60) : '?';
        output += `\n**${title}**${client ? ` — ${client}` : ''} (${mins} min, ${category || 'uncategorised'})\n`;
        if (summary) {
          // Truncate long summaries
          const summaryStr = String(summary);
          output += summaryStr.length > 500 ? summaryStr.slice(0, 500) + '...\n' : summaryStr + '\n';
        }
      }
    } else {
      output += 'No meetings recorded yesterday.\n';
    }

    // Open action items
    output += `\n### Open Action Items (${openActions.length > 0 ? openActions[0].values.length : 0} total)\n`;
    if (openActions.length > 0 && openActions[0].values.length > 0) {
      const byAssignee: Record<string, string[]> = {};
      for (const row of openActions[0].values) {
        const [desc, assignee, createdAt, meetingTitle, client] = row;
        const key = String(assignee || 'Unassigned');
        if (!byAssignee[key]) byAssignee[key] = [];
        byAssignee[key].push(`${desc}${client ? ` (${client})` : ''} — from ${meetingTitle}`);
      }
      for (const [assignee, items] of Object.entries(byAssignee)) {
        output += `\n**${assignee}** (${items.length}):\n`;
        for (const item of items.slice(0, 5)) output += `- ${item}\n`;
        if (items.length > 5) output += `- ...+${items.length - 5} more\n`;
      }
    } else {
      output += 'No open action items.\n';
    }

    // This week's meeting volume
    if (weekStats.length > 0 && weekStats[0].values.length > 0) {
      output += `\n### This Week's Meeting Volume\n`;
      let total = 0;
      for (const row of weekStats[0].values) {
        const [count, cat] = row;
        output += `- ${cat || 'Uncategorised'}: ${count}\n`;
        total += Number(count);
      }
      output += `- **Total:** ${total}\n`;
    }

    return output;
  } catch (err) {
    logError('BRIEF', 'Failed to fetch meeting data', err);
    return `Meeting data unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// --- Fathom: Today's upcoming meetings ---
async function getTodaysMeetings(): Promise<string> {
  if (!FATHOM_API_KEY) return 'Fathom not configured — no upcoming meeting data.';

  try {
    const todayDate = today();

    const resp = await fetch(
      `https://api.fathom.ai/external/v1/meetings?created_after=${todayDate}T00:00:00Z&include_summary=false&include_action_items=false`,
      { headers: { 'X-Api-Key': FATHOM_API_KEY } }
    );
    if (!resp.ok) return 'Could not fetch today\'s meetings from Fathom.';
    const data = await resp.json() as { items: Array<{ title: string; created_at: string; scheduled_start_time: string | null }> };

    if (!data.items || data.items.length === 0) return '## Today\'s Meetings\nNo meetings scheduled/recorded yet today.\n';

    let output = '## Today\'s Meetings\n';
    for (const m of data.items) {
      const time = m.scheduled_start_time ? new Date(m.scheduled_start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '?';
      output += `- **${time}** — ${m.title}\n`;
    }
    return output;
  } catch (err) {
    logError('BRIEF', 'Failed to fetch today\'s meetings', err);
    return 'Today\'s meeting data unavailable.';
  }
}

// --- Main: collect all data and save raw output ---
async function main() {
  const date = today();
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  log('BRIEF', `Collecting data for Daily Brief — ${date}`);

  // Fetch all data in parallel
  const [pipelineData, meetingData, todaysMeetings] = await Promise.all([
    getPipelineData(),
    getMeetingData(),
    getTodaysMeetings(),
  ]);

  log('BRIEF', 'Data collected');

  // Assemble raw data file
  const rawData = `# Daily Brief Data — ${dayName} ${date}

> Raw data collected at ${new Date().toISOString()}. To be synthesised by Claude Code.

${pipelineData}

${meetingData}

${todaysMeetings}
`;

  // Save raw data
  const briefsDir = resolve(PROJECT_ROOT, 'outputs/briefs');
  if (!existsSync(briefsDir)) mkdirSync(briefsDir, { recursive: true });
  const dataPath = resolve(briefsDir, `${date}-data.md`);
  writeFileSync(dataPath, rawData);
  log('BRIEF', `Raw data saved to ${dataPath}`);

  // Close DB
  closeDb();

  log('BRIEF', 'Done — run /brief to synthesise');
}

main().catch(err => {
  logError('BRIEF', 'Data collection failed', err);
  closeDb();
  process.exit(1);
});
