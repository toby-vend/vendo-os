/**
 * Monthly client performance report generator.
 *
 * Pulls ad performance (Meta + Google Ads), meetings, action items, and
 * invoice data for a given client, then uses Claude to produce AI insights.
 *
 * Usage:
 *   npx tsx scripts/functions/generate-client-report.ts --client "Client Name"
 *   npx tsx scripts/functions/generate-client-report.ts --all
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, closeDb, log, logError } from '../utils/db.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const REPORTS_DIR = resolve(PROJECT_ROOT, 'outputs/reports');

function queryRows(db: any, sql: string, params: any[] = []): any[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj;
  });
}

function queryScalar(db: any, sql: string, params: any[] = []): any {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  return result[0].values[0][0];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface ReportData {
  clientName: string;
  period: string;
  metaAds: { impressions: number; clicks: number; spend: number; cpc: number; ctr: number };
  googleAds: { impressions: number; clicks: number; spend: number; cpc: number; ctr: number };
  totalSpend: number;
  meetings: { title: string; date: string }[];
  openActions: { description: string; assignee: string | null }[];
  invoiceSummary: { totalInvoiced: number; outstanding: number; overdueCount: number };
}

async function gatherReportData(db: any, clientName: string): Promise<ReportData> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nowIso = now.toISOString();

  // Meta Ads — match by account_name LIKE
  const metaImpressions = queryScalar(db, `SELECT COALESCE(SUM(impressions), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;
  const metaClicks = queryScalar(db, `SELECT COALESCE(SUM(clicks), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;
  const metaSpend = queryScalar(db, `SELECT COALESCE(SUM(spend), 0) FROM meta_insights WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;

  // Google Ads
  const gadsImpressions = queryScalar(db, `SELECT COALESCE(SUM(impressions), 0) FROM gads_campaign_spend WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;
  const gadsClicks = queryScalar(db, `SELECT COALESCE(SUM(clicks), 0) FROM gads_campaign_spend WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;
  const gadsSpend = queryScalar(db, `SELECT COALESCE(SUM(spend), 0) FROM gads_campaign_spend WHERE date >= ? AND account_name LIKE ?`, [thirtyDaysAgo, `%${clientName}%`]) || 0;

  // Meetings
  const meetings = queryRows(db, `SELECT title, date FROM meetings WHERE client_name = ? AND date >= ? ORDER BY date DESC`, [clientName, thirtyDaysAgo]);

  // Open action items
  const openActions = queryRows(db, `
    SELECT ai.description, ai.assignee
    FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id
    WHERE m.client_name = ? AND ai.completed = 0
    ORDER BY m.date DESC LIMIT 10
  `, [clientName]);

  // Invoice summary
  const totalInvoiced = queryScalar(db, `SELECT COALESCE(SUM(total), 0) FROM xero_invoices WHERE contact_name = ? AND type = 'ACCREC'`, [clientName]) || 0;
  const outstanding = queryScalar(db, `SELECT COALESCE(SUM(amount_due), 0) FROM xero_invoices WHERE contact_name = ? AND type = 'ACCREC' AND status = 'AUTHORISED'`, [clientName]) || 0;
  const overdueCount = queryScalar(db, `SELECT COUNT(*) FROM xero_invoices WHERE contact_name = ? AND status = 'AUTHORISED' AND due_date < ? AND amount_due > 0`, [clientName, nowIso]) || 0;

  const metaCpc = metaClicks > 0 ? Math.round((metaSpend / metaClicks) * 100) / 100 : 0;
  const metaCtr = metaImpressions > 0 ? Math.round((metaClicks / metaImpressions) * 10000) / 100 : 0;
  const gadsCpc = gadsClicks > 0 ? Math.round((gadsSpend / gadsClicks) * 100) / 100 : 0;
  const gadsCtr = gadsImpressions > 0 ? Math.round((gadsClicks / gadsImpressions) * 10000) / 100 : 0;

  return {
    clientName,
    period,
    metaAds: { impressions: metaImpressions, clicks: metaClicks, spend: Math.round(metaSpend * 100) / 100, cpc: metaCpc, ctr: metaCtr },
    googleAds: { impressions: gadsImpressions, clicks: gadsClicks, spend: Math.round(gadsSpend * 100) / 100, cpc: gadsCpc, ctr: gadsCtr },
    totalSpend: Math.round((metaSpend + gadsSpend) * 100) / 100,
    meetings,
    openActions,
    invoiceSummary: { totalInvoiced: Math.round(totalInvoiced * 100) / 100, outstanding: Math.round(outstanding * 100) / 100, overdueCount },
  };
}

async function generateInsights(data: ReportData): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return '_AI insights unavailable — ANTHROPIC_API_KEY not set._';
  }

  const client = new Anthropic();

  const prompt = `You are a digital marketing strategist at a performance marketing agency. Generate 3-5 bullet point insights for this client's monthly report. Be specific, actionable, and reference the numbers. Use UK English.

Client: ${data.clientName}
Period: Last 30 days

Meta Ads: £${data.metaAds.spend} spend, ${data.metaAds.impressions.toLocaleString()} impressions, ${data.metaAds.clicks.toLocaleString()} clicks, £${data.metaAds.cpc} CPC, ${data.metaAds.ctr}% CTR
Google Ads: £${data.googleAds.spend} spend, ${data.googleAds.impressions.toLocaleString()} impressions, ${data.googleAds.clicks.toLocaleString()} clicks, £${data.googleAds.cpc} CPC, ${data.googleAds.ctr}% CTR
Total spend: £${data.totalSpend}

Meetings this month: ${data.meetings.length}
Open action items: ${data.openActions.length}
${data.openActions.length > 0 ? 'Actions: ' + data.openActions.slice(0, 5).map(a => a.description).join('; ') : ''}

Outstanding invoices: £${data.invoiceSummary.outstanding} (${data.invoiceSummary.overdueCount} overdue)

Respond with bullet points only, no preamble.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0];
    return text.type === 'text' ? text.text : '_No insights generated._';
  } catch (err) {
    logError('REPORT', 'AI insights failed', err);
    return '_AI insights generation failed._';
  }
}

function formatReport(data: ReportData, insights: string): string {
  const now = new Date();
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return `# ${data.clientName} — Monthly Report
## ${monthName}

---

### Ad Performance (Last 30 Days)

| Platform | Spend | Impressions | Clicks | CPC | CTR |
|----------|-------|-------------|--------|-----|-----|
| Meta Ads | £${data.metaAds.spend.toLocaleString()} | ${data.metaAds.impressions.toLocaleString()} | ${data.metaAds.clicks.toLocaleString()} | £${data.metaAds.cpc} | ${data.metaAds.ctr}% |
| Google Ads | £${data.googleAds.spend.toLocaleString()} | ${data.googleAds.impressions.toLocaleString()} | ${data.googleAds.clicks.toLocaleString()} | £${data.googleAds.cpc} | ${data.googleAds.ctr}% |
| **Total** | **£${data.totalSpend.toLocaleString()}** | | | | |

### AI Insights

${insights}

### Activity

- **Meetings this month:** ${data.meetings.length}
${data.meetings.map(m => `  - ${m.date.split('T')[0]} — ${m.title}`).join('\n')}

### Open Action Items

${data.openActions.length === 0 ? '_No open action items._' : data.openActions.map(a => `- ${a.description}${a.assignee ? ` (${a.assignee})` : ''}`).join('\n')}

### Financial Summary

- **Total invoiced (all time):** £${data.invoiceSummary.totalInvoiced.toLocaleString()}
- **Outstanding:** £${data.invoiceSummary.outstanding.toLocaleString()}
${data.invoiceSummary.overdueCount > 0 ? `- **Overdue invoices:** ${data.invoiceSummary.overdueCount}` : '- No overdue invoices'}

---

_Generated by Vendo OS on ${now.toISOString().split('T')[0]}_
`;
}

async function generateForClient(db: any, clientName: string): Promise<void> {
  log('REPORT', `Generating report for ${clientName}...`);
  const data = await gatherReportData(db, clientName);
  const insights = await generateInsights(data);
  const report = formatReport(data, insights);

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = `${data.period}-${slugify(clientName)}.md`;
  const filepath = resolve(REPORTS_DIR, filename);
  writeFileSync(filepath, report, 'utf-8');
  log('REPORT', `  Written to outputs/reports/${filename}`);
}

async function main() {
  await initSchema();
  const db = await getDb();

  const args = process.argv.slice(2);
  const clientIdx = args.indexOf('--client');
  const runAll = args.includes('--all');

  if (clientIdx >= 0 && args[clientIdx + 1]) {
    const clientName = args[clientIdx + 1];
    await generateForClient(db, clientName);
  } else if (runAll) {
    const clients = queryRows(db, "SELECT name FROM clients WHERE status = 'active' ORDER BY name");
    log('REPORT', `Generating reports for ${clients.length} active clients...`);
    for (const c of clients) {
      await generateForClient(db, c.name);
    }
    log('REPORT', `Done — ${clients.length} reports generated`);
  } else {
    console.error('Usage: --client "Name" or --all');
    process.exit(1);
  }

  closeDb();
}

main().catch(err => {
  logError('REPORT', 'Failed', err);
  process.exit(1);
});
