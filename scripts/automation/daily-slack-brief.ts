/**
 * Daily Slack Morning Brief — Day-Aware
 *
 * Posts a formatted morning brief to Slack with Block Kit.
 * Content varies by day of week:
 *   - Monday:   Week ahead — tasks, priorities, pipeline focus
 *   - Friday:   Week recap — wins, carry-forward, utilisation
 *   - Tue–Thu:  Full business intelligence — financials, pipeline, team, clients
 *
 * Cron: 30 7 * * 1-5 (7:30 UTC = 8:30 BST in summer; 7:30 GMT in winter)
 *
 * Usage:
 *   npx tsx scripts/automation/daily-slack-brief.ts
 *   DAY_OVERRIDE=monday npx tsx scripts/automation/daily-slack-brief.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, closeDb, log, logError } from '../utils/db.js';

const WEBHOOK_URL = process.env.SLACK_BRIEF_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || '';

// Vendo's own GHL location — filters out client sub-accounts
const VENDO_GHL_LOCATION = 'IqXxEPhxyRi8uv1SvjN8';

// ─── Date helpers ────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // Skip weekends for "yesterday" — if Mon, use Fri
  if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sun → Fri
  if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Sat → Fri
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function monthStart(): string {
  return today().slice(0, 7) + '-01';
}

function lastMonthRange(): { start: string; end: string; label: string } {
  const d = new Date();
  d.setDate(1); // first of this month
  const end = new Date(d);
  end.setDate(end.getDate() - 1); // last day of prev month
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const label = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label };
}

function thisMonthLabel(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function isFirstWeekdayOfMonth(): boolean {
  const d = new Date();
  const dayOfMonth = d.getDate();
  const dayOfWeek = d.getDay();
  // It's the 1st-3rd AND a weekday, AND no earlier weekday this month
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  // Walk back to find if there's an earlier weekday
  for (let i = 1; i < dayOfMonth; i++) {
    const check = new Date(d.getFullYear(), d.getMonth(), i);
    const dow = check.getDay();
    if (dow >= 1 && dow <= 5) return false; // earlier weekday exists
  }
  return true;
}

function isLastWeekdayOfMonth(): boolean {
  const d = new Date();
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // Walk forward to find if there's a later weekday
  for (let i = d.getDate() + 1; i <= lastDay; i++) {
    const check = new Date(d.getFullYear(), d.getMonth(), i);
    const dow = check.getDay();
    if (dow >= 1 && dow <= 5) return false; // later weekday exists
  }
  return true;
}

type DayType = 'month-start' | 'month-end' | 'monday' | 'friday' | 'midweek';

function getDayType(): DayType {
  const override = process.env.DAY_OVERRIDE?.toLowerCase();
  if (override === 'month-start' || override === 'month-end' ||
      override === 'monday' || override === 'friday' || override === 'midweek') return override as DayType;
  // Month boundaries take priority
  if (isFirstWeekdayOfMonth()) return 'month-start';
  if (isLastWeekdayOfMonth()) return 'month-end';
  const day = new Date().getDay();
  if (day === 1) return 'monday';
  if (day === 5) return 'friday';
  return 'midweek';
}

function dayName(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long' });
}

function dateRange(): string {
  const mon = mondayOfThisWeek();
  const fri = new Date(mon);
  fri.setDate(fri.getDate() + 4);
  return `${mon} to ${fri.toISOString().slice(0, 10)}`;
}

// ─── Data gatherers ──────────────────────────────────────────────

interface FinancialData {
  mtdRevenue: number;
  mtdInvoicesRaised: number;
  outstandingReceivables: number;
  overdueInvoices: { contact: string; invNum: string; amount: number; dueDate: string }[];
  invoicesPaidYesterday: number;
  invoicesPaidThisWeek: number;
  lastMonthRevenue: number;
}

async function gatherFinancials(): Promise<FinancialData> {
  const db = await getDb();
  const ms = monthStart();
  const yd = yesterday();
  const weekStart = mondayOfThisWeek();

  const data: FinancialData = {
    mtdRevenue: 0,
    mtdInvoicesRaised: 0,
    outstandingReceivables: 0,
    overdueInvoices: [],
    invoicesPaidYesterday: 0,
    invoicesPaidThisWeek: 0,
    lastMonthRevenue: 0,
  };

  // MTD revenue from invoices (ACCREC = sales invoices)
  const mtdResult = db.exec(
    `SELECT COALESCE(SUM(total), 0), COUNT(*)
     FROM xero_invoices
     WHERE type = 'ACCREC' AND date >= ? AND status IN ('AUTHORISED','PAID')`,
    [ms]
  );
  if (mtdResult.length && mtdResult[0].values.length) {
    data.mtdRevenue = mtdResult[0].values[0][0] as number;
    data.mtdInvoicesRaised = mtdResult[0].values[0][1] as number;
  }

  // Outstanding receivables
  const arResult = db.exec(
    `SELECT COALESCE(SUM(amount_due), 0)
     FROM xero_invoices WHERE type = 'ACCREC' AND status = 'AUTHORISED' AND amount_due > 0`
  );
  if (arResult.length && arResult[0].values.length) {
    data.outstandingReceivables = arResult[0].values[0][0] as number;
  }

  // Overdue invoices
  const overdueResult = db.exec(
    `SELECT contact_name, invoice_number, ROUND(amount_due, 2), due_date
     FROM xero_invoices
     WHERE type = 'ACCREC' AND status = 'AUTHORISED' AND amount_due > 0 AND due_date < ?
     ORDER BY amount_due DESC LIMIT 8`,
    [today()]
  );
  if (overdueResult.length && overdueResult[0].values.length) {
    data.overdueInvoices = overdueResult[0].values.map(r => ({
      contact: r[0] as string, invNum: r[1] as string, amount: r[2] as number, dueDate: r[3] as string,
    }));
  }

  // Invoices paid yesterday
  const paidYdResult = db.exec(
    `SELECT COUNT(*) FROM xero_invoices WHERE status = 'PAID' AND updated_at >= ?`,
    [yd]
  );
  if (paidYdResult.length && paidYdResult[0].values.length) {
    data.invoicesPaidYesterday = paidYdResult[0].values[0][0] as number;
  }

  // Invoices paid this week
  const paidWeekResult = db.exec(
    `SELECT COUNT(*) FROM xero_invoices WHERE status = 'PAID' AND updated_at >= ?`,
    [weekStart]
  );
  if (paidWeekResult.length && paidWeekResult[0].values.length) {
    data.invoicesPaidThisWeek = paidWeekResult[0].values[0][0] as number;
  }

  // Last month's P&L revenue for comparison
  const lastMonthResult = db.exec(
    `SELECT total_income FROM xero_pnl_monthly ORDER BY period_start DESC LIMIT 1`
  );
  if (lastMonthResult.length && lastMonthResult[0].values.length) {
    data.lastMonthRevenue = lastMonthResult[0].values[0][0] as number;
  }

  return data;
}

interface PipelineData {
  activeDeals: number;
  activeValue: number;
  newLeads7d: number;
  stalledDeals: { name: string; stage: string; daysSinceMove: number; value: number }[];
  wonThisMonth: number;
  wonValue: number;
  lostThisMonth: number;
  byStage: { stage: string; count: number; value: number }[];
  proposalsSent: number;
}

async function gatherPipeline(): Promise<PipelineData> {
  const db = await getDb();

  const data: PipelineData = {
    activeDeals: 0, activeValue: 0, newLeads7d: 0,
    stalledDeals: [], wonThisMonth: 0, wonValue: 0,
    lostThisMonth: 0, byStage: [], proposalsSent: 0,
  };

  // Stage name lookup
  const stageMap: Record<string, string> = {};
  const stagesResult = db.exec(`SELECT id, name FROM ghl_stages`);
  if (stagesResult.length) {
    for (const row of stagesResult[0].values) {
      stageMap[row[0] as string] = row[1] as string;
    }
  }

  // Active deals
  const activeResult = db.exec(
    `SELECT COUNT(*), COALESCE(SUM(monetary_value), 0)
     FROM ghl_opportunities WHERE status = 'open' AND location_id = ?`,
    [VENDO_GHL_LOCATION]
  );
  if (activeResult.length && activeResult[0].values.length) {
    data.activeDeals = activeResult[0].values[0][0] as number;
    data.activeValue = activeResult[0].values[0][1] as number;
  }

  // New leads (7 days)
  const newResult = db.exec(
    `SELECT COUNT(*) FROM ghl_opportunities WHERE created_at >= ? AND location_id = ?`,
    [daysAgo(7), VENDO_GHL_LOCATION]
  );
  if (newResult.length && newResult[0].values.length) {
    data.newLeads7d = newResult[0].values[0][0] as number;
  }

  // Won this month
  const wonResult = db.exec(
    `SELECT COUNT(*), COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities
     WHERE status = 'won' AND updated_at >= ? AND location_id = ?`,
    [monthStart(), VENDO_GHL_LOCATION]
  );
  if (wonResult.length && wonResult[0].values.length) {
    data.wonThisMonth = wonResult[0].values[0][0] as number;
    data.wonValue = wonResult[0].values[0][1] as number;
  }

  // Lost this month
  const lostResult = db.exec(
    `SELECT COUNT(*) FROM ghl_opportunities WHERE status = 'lost' AND updated_at >= ? AND location_id = ?`,
    [monthStart(), VENDO_GHL_LOCATION]
  );
  if (lostResult.length && lostResult[0].values.length) {
    data.lostThisMonth = lostResult[0].values[0][0] as number;
  }

  // Stalled deals (14+ days no stage change)
  const stalledResult = db.exec(
    `SELECT contact_company, contact_name, stage_id, last_stage_change_at, monetary_value
     FROM ghl_opportunities
     WHERE status = 'open' AND last_stage_change_at IS NOT NULL AND last_stage_change_at < ? AND location_id = ?
     ORDER BY monetary_value DESC LIMIT 8`,
    [daysAgo(14), VENDO_GHL_LOCATION]
  );
  if (stalledResult.length && stalledResult[0].values.length) {
    data.stalledDeals = stalledResult[0].values.map(r => ({
      name: (r[0] || r[1] || 'Unknown') as string,
      stage: stageMap[r[2] as string] || 'Unknown',
      daysSinceMove: Math.floor((Date.now() - new Date(r[3] as string).getTime()) / 86400000),
      value: (r[4] || 0) as number,
    }));
  }

  // By stage breakdown
  const stageResult = db.exec(
    `SELECT stage_id, COUNT(*), COALESCE(SUM(monetary_value), 0)
     FROM ghl_opportunities WHERE status = 'open' AND location_id = ?
     GROUP BY stage_id ORDER BY COUNT(*) DESC`,
    [VENDO_GHL_LOCATION]
  );
  if (stageResult.length && stageResult[0].values.length) {
    data.byStage = stageResult[0].values.map(r => ({
      stage: stageMap[r[0] as string] || 'Unknown',
      count: r[1] as number,
      value: r[2] as number,
    }));
  }

  // Proposals sent (stage name matching)
  const proposalStageIds = Object.entries(stageMap)
    .filter(([, name]) => name.toLowerCase().includes('proposal'))
    .map(([id]) => id);
  if (proposalStageIds.length) {
    const placeholders = proposalStageIds.map(() => '?').join(',');
    const propResult = db.exec(
      `SELECT COUNT(*) FROM ghl_opportunities WHERE status = 'open' AND location_id = ? AND stage_id IN (${placeholders})`,
      [VENDO_GHL_LOCATION, ...proposalStageIds]
    );
    if (propResult.length && propResult[0].values.length) {
      data.proposalsSent = propResult[0].values[0][0] as number;
    }
  }

  return data;
}

interface UtilisationRow {
  name: string;
  totalHours: number;
  billableHours: number;
  billablePct: number;
  target: number;
}

async function gatherTeamUtilisation(since: string): Promise<UtilisationRow[]> {
  const db = await getDb();

  // Management staff (60% target) — identify by role patterns
  const mgmtNames = new Set<string>();
  const usersResult = db.exec(
    `SELECT TRIM(first_name || ' ' || last_name), roles FROM harvest_users WHERE is_active = 1`
  );
  if (usersResult.length) {
    for (const row of usersResult[0].values) {
      const name = row[0] as string;
      const roles = (row[1] as string || '').toLowerCase();
      if (roles.includes('manager') || roles.includes('lead') || roles.includes('director')) {
        mgmtNames.add(name);
      }
    }
  }

  const utilResult = db.exec(
    `SELECT user_name,
            SUM(hours) AS total_hours,
            SUM(CASE WHEN billable = 1 THEN hours ELSE 0 END) AS billable_hours
     FROM harvest_time_entries
     WHERE spent_date >= ?
     GROUP BY user_name
     ORDER BY total_hours DESC`,
    [since]
  );

  if (!utilResult.length || !utilResult[0].values.length) return [];

  return utilResult[0].values.map(r => {
    const name = r[0] as string;
    const totalHours = r[1] as number;
    const billableHours = r[2] as number;
    const pct = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
    const target = mgmtNames.has(name) ? 60 : 80;
    return { name, totalHours: Math.round(totalHours * 10) / 10, billableHours: Math.round(billableHours * 10) / 10, billablePct: pct, target };
  });
}

interface MeetingData {
  meetings: { title: string; client: string | null; durationMins: number; summary: string | null }[];
  meetingCount: number;
}

async function gatherMeetings(since: string, until: string): Promise<MeetingData> {
  const db = await getDb();

  const result = db.exec(
    `SELECT title, client_name, duration_seconds, summary
     FROM meetings WHERE date >= ? AND date < ?
     ORDER BY date DESC LIMIT 15`,
    [since + 'T00:00:00', until + 'T00:00:00']
  );

  if (!result.length || !result[0].values.length) {
    return { meetings: [], meetingCount: 0 };
  }

  return {
    meetingCount: result[0].values.length,
    meetings: result[0].values.map(r => ({
      title: r[0] as string,
      client: r[1] as string | null,
      durationMins: r[2] ? Math.round((r[2] as number) / 60) : 0,
      summary: r[3] as string | null,
    })),
  };
}

interface ActionItemData {
  totalOpen: number;
  byAssignee: { assignee: string; items: string[] }[];
}

async function gatherActionItems(): Promise<ActionItemData> {
  const db = await getDb();

  const countResult = db.exec(`SELECT COUNT(*) FROM action_items WHERE completed = 0`);
  const totalOpen = (countResult.length && countResult[0].values.length) ? countResult[0].values[0][0] as number : 0;

  const result = db.exec(
    `SELECT ai.assignee, ai.description, m.client_name
     FROM action_items ai
     JOIN meetings m ON ai.meeting_id = m.id
     WHERE ai.completed = 0
     ORDER BY ai.created_at DESC
     LIMIT 40`
  );

  const byAssigneeMap: Record<string, string[]> = {};
  if (result.length && result[0].values.length) {
    for (const row of result[0].values) {
      const assignee = (row[0] as string) || 'Unassigned';
      const desc = row[1] as string;
      const client = row[2] as string | null;
      if (!byAssigneeMap[assignee]) byAssigneeMap[assignee] = [];
      if (byAssigneeMap[assignee].length < 5) {
        byAssigneeMap[assignee].push(client ? `[${client}] ${desc.slice(0, 70)}` : desc.slice(0, 80));
      }
    }
  }

  const byAssignee = Object.entries(byAssigneeMap).map(([assignee, items]) => ({ assignee, items }));
  return { totalOpen, byAssignee };
}

interface ClientHealthData {
  atRisk: { name: string; score: number }[];
  offboardings: string[];
  staleClients: string[];
}

async function gatherClientHealth(): Promise<ClientHealthData> {
  const db = await getDb();
  const data: ClientHealthData = { atRisk: [], offboardings: [], staleClients: [] };

  // At-risk clients (score < 40)
  const healthResult = db.exec(
    `SELECT client_name, score FROM client_health
     WHERE period = (SELECT MAX(period) FROM client_health) AND score < 40
     ORDER BY score ASC LIMIT 5`
  );
  if (healthResult.length && healthResult[0].values.length) {
    data.atRisk = healthResult[0].values.map(r => ({ name: r[0] as string, score: r[1] as number }));
  }

  // Active offboardings
  const offboardResult = db.exec(
    `SELECT client_name FROM client_offboarding WHERE status = 'pending'`
  );
  if (offboardResult.length && offboardResult[0].values.length) {
    data.offboardings = offboardResult[0].values.map(r => r[0] as string);
  }

  // Stale clients (no meeting in 30+ days)
  const staleResult = db.exec(
    `SELECT name FROM clients
     WHERE status = 'active' AND last_meeting_date < ? AND display_name IS NOT NULL
     ORDER BY last_meeting_date ASC LIMIT 8`,
    [daysAgo(30)]
  );
  if (staleResult.length && staleResult[0].values.length) {
    data.staleClients = staleResult[0].values.map(r => r[0] as string);
  }

  return data;
}

interface WeekWinsData {
  invoicesPaid: number;
  dealsWon: number;
  dealsWonValue: number;
  meetingsHeld: number;
  newLeads: number;
  upsells: number;
}

async function gatherWeekWins(): Promise<WeekWinsData> {
  const db = await getDb();
  const weekStart = mondayOfThisWeek();
  const data: WeekWinsData = { invoicesPaid: 0, dealsWon: 0, dealsWonValue: 0, meetingsHeld: 0, newLeads: 0, upsells: 0 };

  const paidResult = db.exec(
    `SELECT COUNT(*) FROM xero_invoices WHERE status = 'PAID' AND updated_at >= ?`,
    [weekStart]
  );
  if (paidResult.length && paidResult[0].values.length) data.invoicesPaid = paidResult[0].values[0][0] as number;

  const wonResult = db.exec(
    `SELECT COUNT(*), COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities
     WHERE status = 'won' AND updated_at >= ? AND location_id = ?`,
    [weekStart, VENDO_GHL_LOCATION]
  );
  if (wonResult.length && wonResult[0].values.length) {
    data.dealsWon = wonResult[0].values[0][0] as number;
    data.dealsWonValue = wonResult[0].values[0][1] as number;
  }

  const meetResult = db.exec(
    `SELECT COUNT(*) FROM meetings WHERE date >= ?`,
    [weekStart + 'T00:00:00']
  );
  if (meetResult.length && meetResult[0].values.length) data.meetingsHeld = meetResult[0].values[0][0] as number;

  const leadResult = db.exec(
    `SELECT COUNT(*) FROM ghl_opportunities WHERE created_at >= ? AND location_id = ?`,
    [weekStart, VENDO_GHL_LOCATION]
  );
  if (leadResult.length && leadResult[0].values.length) data.newLeads = leadResult[0].values[0][0] as number;

  const upsellResult = db.exec(
    `SELECT COUNT(*) FROM upsell_opportunities WHERE created_at >= ?`,
    [weekStart]
  );
  if (upsellResult.length && upsellResult[0].values.length) data.upsells = upsellResult[0].values[0][0] as number;

  return data;
}

// ─── Formatters ──────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

function pctBar(pct: number, target: number): string {
  const status = pct >= target ? 'On target' : pct >= target - 15 ? 'Below' : 'Critical';
  return `${pct}% (target ${target}%) — ${status}`;
}

// ─── Block Kit builders ──────────────────────────────────────────

type Block = Record<string, unknown>;

function headerBlock(text: string): Block {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function divider(): Block {
  return { type: 'divider' };
}

function section(text: string): Block {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function contextBlock(text: string): Block {
  return { type: 'context', elements: [{ type: 'mrkdwn', text }] };
}

function addSection(blocks: Block[], title: string, lines: string[]): void {
  blocks.push(section(`*${title}*`));
  if (lines.length > 0) {
    blocks.push(section(lines.map(l => `  •  ${l}`).join('\n')));
  } else {
    blocks.push(section('_Nothing to report_'));
  }
  blocks.push(divider());
}

// ─── Brief builders ──────────────────────────────────────────────

async function buildMondayBrief(): Promise<Block[]> {
  const [fin, pipeline, util, actions, health] = await Promise.all([
    gatherFinancials(),
    gatherPipeline(),
    gatherTeamUtilisation(daysAgo(7)), // Last week's utilisation
    gatherActionItems(),
    gatherClientHealth(),
  ]);

  const blocks: Block[] = [];
  blocks.push(headerBlock(`Week Ahead — ${dateRange()}`));
  blocks.push(divider());

  // Key numbers
  addSection(blocks, 'Key Numbers', [
    `MTD Revenue: *£${fmt(fin.mtdRevenue)}* (${fin.mtdInvoicesRaised} invoices raised)`,
    `Outstanding Receivables: *£${fmt(fin.outstandingReceivables)}*`,
    `Active Pipeline: *${pipeline.activeDeals} deals* worth *£${fmt(pipeline.activeValue)}*`,
    `Open Action Items: *${actions.totalOpen}*`,
  ]);

  // Priority actions
  const priorityLines: string[] = [];
  if (fin.overdueInvoices.length) {
    priorityLines.push(`*${fin.overdueInvoices.length} overdue invoice(s):*`);
    for (const inv of fin.overdueInvoices.slice(0, 5)) {
      priorityLines.push(`  ${inv.contact} — £${fmt(inv.amount)} (due ${inv.dueDate})`);
    }
  }
  if (health.atRisk.length) {
    for (const c of health.atRisk) {
      priorityLines.push(`RED client: ${c.name} (score ${c.score}/100)`);
    }
  }
  if (health.offboardings.length) {
    priorityLines.push(`Active offboardings: ${health.offboardings.join(', ')}`);
  }
  addSection(blocks, 'Priority Actions This Week', priorityLines);

  // Pipeline focus
  const pipelineLines: string[] = [];
  if (pipeline.byStage.length) {
    for (const s of pipeline.byStage) {
      pipelineLines.push(`${s.stage}: ${s.count} deals (£${fmt(s.value)})`);
    }
  }
  if (pipeline.proposalsSent > 0) {
    pipelineLines.push(`Proposals awaiting response: ${pipeline.proposalsSent}`);
  }
  if (pipeline.stalledDeals.length) {
    pipelineLines.push(`*${pipeline.stalledDeals.length} stalled deal(s) (14+ days):*`);
    for (const d of pipeline.stalledDeals.slice(0, 5)) {
      pipelineLines.push(`  ${d.name} — ${d.stage} — ${d.daysSinceMove}d stale — £${fmt(d.value)}`);
    }
  }
  addSection(blocks, 'Pipeline Focus', pipelineLines);

  // Last week's utilisation
  const utilLines: string[] = [];
  const belowTarget = util.filter(u => u.billablePct < u.target);
  if (util.length) {
    for (const u of util) {
      const flag = u.billablePct < u.target ? ' :warning:' : '';
      utilLines.push(`${u.name}: ${pctBar(u.billablePct, u.target)}${flag}`);
    }
  }
  addSection(blocks, 'Team Utilisation (Last Week)', utilLines);

  // Action items by assignee
  const actionLines: string[] = [];
  for (const a of actions.byAssignee) {
    actionLines.push(`*${a.assignee}* (${a.items.length}+):`);
    for (const item of a.items.slice(0, 3)) {
      actionLines.push(`  ${item}`);
    }
  }
  addSection(blocks, 'Open Action Items', actionLines);

  // Client alerts
  const clientLines: string[] = [];
  if (health.staleClients.length) {
    clientLines.push(`No meeting in 30+ days: ${health.staleClients.join(', ')}`);
  }
  if (clientLines.length) addSection(blocks, 'Client Alerts', clientLines);

  blocks.push(contextBlock('Generated by Vendo OS — Monday Week Ahead'));
  return blocks;
}

async function buildFridayBrief(): Promise<Block[]> {
  const [fin, pipeline, util, actions, health, wins, meetings] = await Promise.all([
    gatherFinancials(),
    gatherPipeline(),
    gatherTeamUtilisation(mondayOfThisWeek()),
    gatherActionItems(),
    gatherClientHealth(),
    gatherWeekWins(),
    gatherMeetings(mondayOfThisWeek(), today()),
  ]);

  const blocks: Block[] = [];
  blocks.push(headerBlock(`Week in Review — ${dateRange()}`));
  blocks.push(divider());

  // Wins this week
  const winLines: string[] = [];
  if (wins.invoicesPaid > 0) winLines.push(`${wins.invoicesPaid} invoice(s) paid`);
  if (wins.dealsWon > 0) winLines.push(`${wins.dealsWon} deal(s) won — £${fmt(wins.dealsWonValue)}`);
  if (wins.meetingsHeld > 0) winLines.push(`${wins.meetingsHeld} meetings held`);
  if (wins.newLeads > 0) winLines.push(`${wins.newLeads} new lead(s) entered pipeline`);
  if (wins.upsells > 0) winLines.push(`${wins.upsells} upsell opportunity(s) identified`);
  addSection(blocks, 'Wins This Week', winLines);

  // Financial position
  addSection(blocks, 'Financial Position', [
    `MTD Revenue: *£${fmt(fin.mtdRevenue)}* (${fin.mtdInvoicesRaised} invoices)`,
    `Last month total: £${fmt(fin.lastMonthRevenue)}`,
    `Outstanding Receivables: *£${fmt(fin.outstandingReceivables)}*`,
    ...(fin.overdueInvoices.length
      ? [`Overdue: ${fin.overdueInvoices.map(i => `${i.contact} £${fmt(i.amount)}`).join(', ')}`]
      : []),
  ]);

  // Pipeline movement
  const pipelineLines: string[] = [
    `Active: ${pipeline.activeDeals} deals — £${fmt(pipeline.activeValue)}`,
    `New leads this week: ${pipeline.newLeads7d}`,
    `Won this month: ${pipeline.wonThisMonth} (£${fmt(pipeline.wonValue)})`,
    `Lost this month: ${pipeline.lostThisMonth}`,
  ];
  if (pipeline.stalledDeals.length) {
    pipelineLines.push(`*${pipeline.stalledDeals.length} stalled (14+ days):*`);
    for (const d of pipeline.stalledDeals.slice(0, 4)) {
      pipelineLines.push(`  ${d.name} — ${d.stage} — ${d.daysSinceMove}d — £${fmt(d.value)}`);
    }
  }
  addSection(blocks, 'Pipeline Movement', pipelineLines);

  // Team utilisation this week
  const utilLines: string[] = [];
  for (const u of util) {
    const flag = u.billablePct < u.target ? ' :warning:' : '';
    utilLines.push(`${u.name}: ${u.billableHours}h / ${u.totalHours}h — ${u.billablePct}%${flag}`);
  }
  addSection(blocks, 'Team Utilisation (This Week)', utilLines);

  // Meetings this week
  if (meetings.meetingCount > 0) {
    const meetLines = meetings.meetings.slice(0, 10).map(m =>
      `${m.title}${m.client ? ` (${m.client})` : ''} — ${m.durationMins}min`
    );
    addSection(blocks, `Meetings This Week (${meetings.meetingCount})`, meetLines);
  }

  // Carry forward
  const carryLines: string[] = [];
  if (actions.totalOpen > 0) carryLines.push(`${actions.totalOpen} open action items`);
  if (pipeline.stalledDeals.length) carryLines.push(`${pipeline.stalledDeals.length} stalled pipeline deals`);
  if (health.atRisk.length) carryLines.push(`At-risk clients: ${health.atRisk.map(c => c.name).join(', ')}`);
  if (health.offboardings.length) carryLines.push(`Active offboardings: ${health.offboardings.join(', ')}`);
  if (health.staleClients.length) carryLines.push(`No contact 30+ days: ${health.staleClients.slice(0, 5).join(', ')}`);
  if (fin.overdueInvoices.length) carryLines.push(`${fin.overdueInvoices.length} overdue invoice(s) — £${fmt(fin.overdueInvoices.reduce((s, i) => s + i.amount, 0))}`);
  addSection(blocks, 'Carry Forward to Next Week', carryLines);

  blocks.push(contextBlock('Generated by Vendo OS — Friday Week in Review'));
  return blocks;
}

async function buildMidweekBrief(): Promise<Block[]> {
  const yd = yesterday();
  const [fin, pipeline, util, actions, health, ydMeetings] = await Promise.all([
    gatherFinancials(),
    gatherPipeline(),
    gatherTeamUtilisation(mondayOfThisWeek()),
    gatherActionItems(),
    gatherClientHealth(),
    gatherMeetings(yd, today()),
  ]);

  const blocks: Block[] = [];
  blocks.push(headerBlock(`Morning Brief — ${dayName()} ${today()}`));
  blocks.push(divider());

  // Priority actions
  const priorityLines: string[] = [];
  if (fin.overdueInvoices.length) {
    priorityLines.push(`*${fin.overdueInvoices.length} overdue invoice(s):*`);
    for (const inv of fin.overdueInvoices.slice(0, 5)) {
      priorityLines.push(`  ${inv.contact} — £${fmt(inv.amount)} (due ${inv.dueDate})`);
    }
  }
  if (health.atRisk.length) {
    for (const c of health.atRisk) {
      priorityLines.push(`RED client: ${c.name} (score ${c.score}/100)`);
    }
  }
  if (health.offboardings.length) {
    priorityLines.push(`Active offboardings: ${health.offboardings.join(', ')}`);
  }
  addSection(blocks, 'Priority Actions', priorityLines);

  // Yesterday's meetings
  if (ydMeetings.meetingCount > 0) {
    const meetLines = ydMeetings.meetings.slice(0, 8).map(m => {
      let line = `*${m.title}*${m.client ? ` — ${m.client}` : ''} (${m.durationMins}min)`;
      if (m.summary) {
        const short = m.summary.replace(/\n/g, ' ').slice(0, 120);
        line += `\n    _${short}${m.summary.length > 120 ? '...' : ''}_`;
      }
      return line;
    });
    addSection(blocks, `Yesterday's Meetings (${ydMeetings.meetingCount})`, meetLines);
  }

  // Open action items
  const actionLines: string[] = [`*${actions.totalOpen} total open*`];
  for (const a of actions.byAssignee.slice(0, 6)) {
    actionLines.push(`*${a.assignee}:*`);
    for (const item of a.items.slice(0, 3)) {
      actionLines.push(`  ${item}`);
    }
  }
  addSection(blocks, 'Open Action Items', actionLines);

  // Pipeline & sales
  addSection(blocks, 'Pipeline & Sales', [
    `Active: *${pipeline.activeDeals} deals* — *£${fmt(pipeline.activeValue)}*`,
    `New leads (7d): ${pipeline.newLeads7d}`,
    `Won this month: ${pipeline.wonThisMonth} (£${fmt(pipeline.wonValue)})`,
    `Lost this month: ${pipeline.lostThisMonth}`,
    ...(pipeline.stalledDeals.length
      ? [`*${pipeline.stalledDeals.length} stalled (14+ days):*`,
         ...pipeline.stalledDeals.slice(0, 4).map(d => `  ${d.name} — ${d.stage} — ${d.daysSinceMove}d — £${fmt(d.value)}`)]
      : []),
  ]);

  // Financial snapshot
  addSection(blocks, 'Financial Snapshot', [
    `MTD Revenue: *£${fmt(fin.mtdRevenue)}* (${fin.mtdInvoicesRaised} invoices)`,
    `Outstanding Receivables: *£${fmt(fin.outstandingReceivables)}*`,
    `Invoices paid yesterday: ${fin.invoicesPaidYesterday}`,
    `Last month total: £${fmt(fin.lastMonthRevenue)}`,
  ]);

  // Team utilisation (WTD)
  const utilLines: string[] = [];
  for (const u of util) {
    const flag = u.billablePct < u.target ? ' :warning:' : '';
    utilLines.push(`${u.name}: ${u.billableHours}h / ${u.totalHours}h — ${u.billablePct}%${flag}`);
  }
  addSection(blocks, 'Team Utilisation (WTD)', utilLines);

  // Client alerts
  const clientLines: string[] = [];
  if (health.staleClients.length) {
    clientLines.push(`No meeting in 30+ days: ${health.staleClients.join(', ')}`);
  }
  if (clientLines.length) addSection(blocks, 'Client Alerts', clientLines);

  // Yesterday's wins
  const winLines: string[] = [];
  if (fin.invoicesPaidYesterday > 0) winLines.push(`${fin.invoicesPaidYesterday} invoice(s) paid`);
  if (pipeline.newLeads7d > 0) winLines.push(`${pipeline.newLeads7d} new leads (last 7 days)`);
  if (winLines.length) addSection(blocks, "Yesterday's Wins", winLines);

  blocks.push(contextBlock(`Generated by Vendo OS — ${dayName()} Brief`));
  return blocks;
}

// ─── Monthly data gatherers ──────────────────────────────────────

interface MonthlyPnL {
  income: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  margin: number;
}

async function gatherMonthlyPnL(periodStart: string): Promise<MonthlyPnL | null> {
  const db = await getDb();
  const result = db.exec(
    `SELECT total_income, total_cost_of_sales, gross_profit, total_expenses, net_profit
     FROM xero_pnl_monthly WHERE period_start = ? LIMIT 1`,
    [periodStart]
  );
  if (!result.length || !result[0].values.length) return null;
  const [income, cogs, grossProfit, expenses, netProfit] = result[0].values[0] as number[];
  return {
    income, cogs, grossProfit, expenses, netProfit,
    margin: income > 0 ? Math.round((netProfit / income) * 100) : 0,
  };
}

interface MonthlyPipelineStats {
  won: number;
  wonValue: number;
  lost: number;
  newLeads: number;
}

async function gatherMonthlyPipeline(since: string, until: string): Promise<MonthlyPipelineStats> {
  const db = await getDb();
  const data: MonthlyPipelineStats = { won: 0, wonValue: 0, lost: 0, newLeads: 0 };

  const wonResult = db.exec(
    `SELECT COUNT(*), COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities
     WHERE status = 'won' AND updated_at >= ? AND updated_at < ? AND location_id = ?`,
    [since, until, VENDO_GHL_LOCATION]
  );
  if (wonResult.length && wonResult[0].values.length) {
    data.won = wonResult[0].values[0][0] as number;
    data.wonValue = wonResult[0].values[0][1] as number;
  }

  const lostResult = db.exec(
    `SELECT COUNT(*) FROM ghl_opportunities
     WHERE status = 'lost' AND updated_at >= ? AND updated_at < ? AND location_id = ?`,
    [since, until, VENDO_GHL_LOCATION]
  );
  if (lostResult.length && lostResult[0].values.length) {
    data.lost = lostResult[0].values[0][0] as number;
  }

  const leadResult = db.exec(
    `SELECT COUNT(*) FROM ghl_opportunities
     WHERE created_at >= ? AND created_at < ? AND location_id = ?`,
    [since, until, VENDO_GHL_LOCATION]
  );
  if (leadResult.length && leadResult[0].values.length) {
    data.newLeads = leadResult[0].values[0][0] as number;
  }

  return data;
}

interface MonthlyClientMovement {
  newClients: string[];
  churnedClients: string[];
  activeCount: number;
}

async function gatherClientMovement(since: string): Promise<MonthlyClientMovement> {
  const db = await getDb();
  const data: MonthlyClientMovement = { newClients: [], churnedClients: [], activeCount: 0 };

  const newResult = db.exec(
    `SELECT name FROM clients WHERE first_invoice_date >= ? AND status = 'active' ORDER BY name LIMIT 15`,
    [since]
  );
  if (newResult.length && newResult[0].values.length) {
    data.newClients = newResult[0].values.map(r => r[0] as string);
  }

  const churnResult = db.exec(
    `SELECT client_name FROM client_offboarding WHERE created_at >= ? ORDER BY created_at DESC LIMIT 10`,
    [since]
  );
  if (churnResult.length && churnResult[0].values.length) {
    data.churnedClients = churnResult[0].values.map(r => r[0] as string);
  }

  const countResult = db.exec(`SELECT COUNT(*) FROM clients WHERE status = 'active'`);
  if (countResult.length && countResult[0].values.length) {
    data.activeCount = countResult[0].values[0][0] as number;
  }

  return data;
}

// ─── Month-start brief (first weekday) ──────────────────────────

async function buildMonthStartBrief(): Promise<Block[]> {
  const lastMonth = lastMonthRange();
  const [fin, pipeline, lastPnL, lastPipeline, util, actions, health, clients] = await Promise.all([
    gatherFinancials(),
    gatherPipeline(),
    gatherMonthlyPnL(lastMonth.start),
    gatherMonthlyPipeline(lastMonth.start, monthStart()),
    gatherTeamUtilisation(lastMonth.start),
    gatherActionItems(),
    gatherClientHealth(),
    gatherClientMovement(lastMonth.start),
  ]);

  const blocks: Block[] = [];
  blocks.push(headerBlock(`Month Kickoff — ${thisMonthLabel()}`));
  blocks.push(divider());

  // Last month recap
  if (lastPnL) {
    addSection(blocks, `${lastMonth.label} — Financial Summary`, [
      `Revenue: *£${fmt(lastPnL.income)}*`,
      `COGS: £${fmt(lastPnL.cogs)} | Gross Profit: £${fmt(lastPnL.grossProfit)}`,
      `Operating Expenses: £${fmt(lastPnL.expenses)}`,
      `*Net Profit: £${fmt(lastPnL.netProfit)} (${lastPnL.margin}% margin)*`,
    ]);
  }

  // Last month pipeline
  addSection(blocks, `${lastMonth.label} — Pipeline Results`, [
    `Deals won: ${lastPipeline.won} — £${fmt(lastPipeline.wonValue)}`,
    `Deals lost: ${lastPipeline.lost}`,
    `New leads entered: ${lastPipeline.newLeads}`,
  ]);

  // Last month utilisation (top-level summary)
  if (util.length) {
    const totalHrs = util.reduce((s, u) => s + u.totalHours, 0);
    const billHrs = util.reduce((s, u) => s + u.billableHours, 0);
    const avgPct = totalHrs > 0 ? Math.round((billHrs / totalHrs) * 100) : 0;
    const belowTarget = util.filter(u => u.billablePct < u.target);
    addSection(blocks, `${lastMonth.label} — Team Utilisation`, [
      `Overall: ${fmt(billHrs)}h billable / ${fmt(totalHrs)}h total — *${avgPct}%*`,
      ...(belowTarget.length
        ? [`*Below target (${belowTarget.length}):*`,
           ...belowTarget.slice(0, 8).map(u => `  ${u.name}: ${pctBar(u.billablePct, u.target)}`)]
        : ['All staff on or above target']),
    ]);
  }

  // Client movement
  const clientLines: string[] = [`Active clients: *${clients.activeCount}*`];
  if (clients.newClients.length) clientLines.push(`New last month: ${clients.newClients.join(', ')}`);
  if (clients.churnedClients.length) clientLines.push(`Offboarded: ${clients.churnedClients.join(', ')}`);
  addSection(blocks, 'Client Movement', clientLines);

  // Entering this month
  addSection(blocks, `Entering ${thisMonthLabel()}`, [
    `Active pipeline: *${pipeline.activeDeals} deals* — *£${fmt(pipeline.activeValue)}*`,
    `Outstanding receivables: *£${fmt(fin.outstandingReceivables)}*`,
    `Open action items: ${actions.totalOpen}`,
    ...(fin.overdueInvoices.length
      ? [`Overdue invoices: ${fin.overdueInvoices.length} — £${fmt(fin.overdueInvoices.reduce((s, i) => s + i.amount, 0))}`]
      : []),
  ]);

  // At-risk clients
  if (health.atRisk.length || health.offboardings.length) {
    const riskLines: string[] = [];
    for (const c of health.atRisk) riskLines.push(`RED: ${c.name} (score ${c.score}/100)`);
    if (health.offboardings.length) riskLines.push(`Active offboardings: ${health.offboardings.join(', ')}`);
    addSection(blocks, 'Client Risk Watch', riskLines);
  }

  // Pipeline by stage
  if (pipeline.byStage.length) {
    addSection(blocks, 'Pipeline by Stage', pipeline.byStage.map(s =>
      `${s.stage}: ${s.count} deals — £${fmt(s.value)}`
    ));
  }

  blocks.push(contextBlock(`Generated by Vendo OS — ${thisMonthLabel()} Kickoff`));
  return blocks;
}

// ─── Month-end brief (last weekday) ─────────────────────────────

async function buildMonthEndBrief(): Promise<Block[]> {
  const [fin, pipeline, thisPnL, thisPipeline, util, actions, health, clients] = await Promise.all([
    gatherFinancials(),
    gatherPipeline(),
    gatherMonthlyPnL(monthStart()),
    gatherMonthlyPipeline(monthStart(), today()),
    gatherTeamUtilisation(monthStart()),
    gatherActionItems(),
    gatherClientHealth(),
    gatherClientMovement(monthStart()),
  ]);

  const blocks: Block[] = [];
  blocks.push(headerBlock(`Month-End Review — ${thisMonthLabel()}`));
  blocks.push(divider());

  // Financial summary
  const finLines = [
    `Revenue (invoiced): *£${fmt(fin.mtdRevenue)}* (${fin.mtdInvoicesRaised} invoices)`,
    `Last month total: £${fmt(fin.lastMonthRevenue)}`,
  ];
  if (thisPnL) {
    finLines.push(`COGS: £${fmt(thisPnL.cogs)} | OpEx: £${fmt(thisPnL.expenses)}`);
    finLines.push(`*Net Profit: £${fmt(thisPnL.netProfit)} (${thisPnL.margin}% margin)*`);
  }
  finLines.push(`Outstanding receivables: *£${fmt(fin.outstandingReceivables)}*`);
  if (fin.overdueInvoices.length) {
    finLines.push(`*${fin.overdueInvoices.length} overdue invoice(s):*`);
    for (const inv of fin.overdueInvoices.slice(0, 5)) {
      finLines.push(`  ${inv.contact} — £${fmt(inv.amount)} (due ${inv.dueDate})`);
    }
  }
  addSection(blocks, `${thisMonthLabel()} — Financial Summary`, finLines);

  // Pipeline this month
  addSection(blocks, `${thisMonthLabel()} — Pipeline Performance`, [
    `Active: *${pipeline.activeDeals} deals* — *£${fmt(pipeline.activeValue)}*`,
    `Deals won: ${thisPipeline.won} — £${fmt(thisPipeline.wonValue)}`,
    `Deals lost: ${thisPipeline.lost}`,
    `New leads: ${thisPipeline.newLeads}`,
    ...(pipeline.stalledDeals.length
      ? [`*${pipeline.stalledDeals.length} stalled (14+ days):*`,
         ...pipeline.stalledDeals.slice(0, 5).map(d => `  ${d.name} — ${d.stage} — ${d.daysSinceMove}d — £${fmt(d.value)}`)]
      : []),
  ]);

  // Team utilisation (full month)
  if (util.length) {
    const totalHrs = util.reduce((s, u) => s + u.totalHours, 0);
    const billHrs = util.reduce((s, u) => s + u.billableHours, 0);
    const avgPct = totalHrs > 0 ? Math.round((billHrs / totalHrs) * 100) : 0;
    const utilLines: string[] = [
      `Overall: ${fmt(billHrs)}h billable / ${fmt(totalHrs)}h total — *${avgPct}%*`,
    ];
    for (const u of util) {
      const flag = u.billablePct < u.target ? ' :warning:' : '';
      utilLines.push(`${u.name}: ${u.billableHours}h / ${u.totalHours}h — ${u.billablePct}%${flag}`);
    }
    addSection(blocks, `${thisMonthLabel()} — Team Utilisation`, utilLines);
  }

  // Client movement
  const clientLines: string[] = [`Active clients: *${clients.activeCount}*`];
  if (clients.newClients.length) clientLines.push(`New this month: ${clients.newClients.join(', ')}`);
  if (clients.churnedClients.length) clientLines.push(`Offboarded: ${clients.churnedClients.join(', ')}`);
  addSection(blocks, 'Client Movement', clientLines);

  // Client health
  if (health.atRisk.length || health.offboardings.length || health.staleClients.length) {
    const riskLines: string[] = [];
    for (const c of health.atRisk) riskLines.push(`RED: ${c.name} (score ${c.score}/100)`);
    if (health.offboardings.length) riskLines.push(`Active offboardings: ${health.offboardings.join(', ')}`);
    if (health.staleClients.length) riskLines.push(`No meeting 30+ days: ${health.staleClients.slice(0, 6).join(', ')}`);
    addSection(blocks, 'Client Health Watch', riskLines);
  }

  // Carry into next month
  const carryLines: string[] = [];
  if (actions.totalOpen > 0) carryLines.push(`${actions.totalOpen} open action items`);
  if (pipeline.stalledDeals.length) carryLines.push(`${pipeline.stalledDeals.length} stalled deals to chase`);
  if (fin.overdueInvoices.length) carryLines.push(`£${fmt(fin.overdueInvoices.reduce((s, i) => s + i.amount, 0))} overdue to collect`);
  if (health.offboardings.length) carryLines.push(`${health.offboardings.length} offboarding(s) to complete`);
  addSection(blocks, 'Carry Into Next Month', carryLines);

  blocks.push(contextBlock(`Generated by Vendo OS — ${thisMonthLabel()} Month-End`));
  return blocks;
}

// ─── Slack posting ───────────────────────────────────────────────

async function postToSlack(blocks: Block[]): Promise<void> {
  if (!WEBHOOK_URL) {
    log('DAILY-BRIEF', 'No Slack webhook configured — skipping post');
    return;
  }

  // Slack limit: 50 blocks per message. Truncate if needed.
  const safeBlocks = blocks.slice(0, 50);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks: safeBlocks }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook ${res.status}: ${body}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  await initSchema();

  const dayType = getDayType();
  log('DAILY-BRIEF', `Day type: ${dayType} (${dayName()} ${today()})`);

  let blocks: Block[];
  switch (dayType) {
    case 'month-start':
      blocks = await buildMonthStartBrief();
      break;
    case 'month-end':
      blocks = await buildMonthEndBrief();
      break;
    case 'monday':
      blocks = await buildMondayBrief();
      break;
    case 'friday':
      blocks = await buildFridayBrief();
      break;
    default:
      blocks = await buildMidweekBrief();
      break;
  }

  log('DAILY-BRIEF', `Built ${blocks.length} blocks`);

  await postToSlack(blocks);
  log('DAILY-BRIEF', 'Slack brief posted successfully');

  closeDb();
}

main().catch((err) => {
  logError('DAILY-BRIEF', 'Failed', err);
  closeDb();
  process.exit(1);
});
