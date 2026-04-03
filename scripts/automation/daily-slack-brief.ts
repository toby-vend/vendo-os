/**
 * Daily Slack Morning Briefing
 *
 * Posts a formatted morning brief to Slack with Block Kit:
 * - Today's priority actions
 * - Yesterday's wins
 * - Flagged challenges
 *
 * Requires: SLACK_WEBHOOK_URL (or SLACK_BRIEF_WEBHOOK_URL for dedicated channel)
 *
 * Usage:
 *   npx tsx scripts/automation/daily-slack-brief.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, closeDb, log, logError } from '../utils/db.js';

const WEBHOOK_URL = process.env.SLACK_BRIEF_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || '';

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

interface BriefSection {
  title: string;
  items: string[];
}

async function gatherPriorityActions(): Promise<string[]> {
  const db = await getDb();
  const items: string[] = [];

  // Overdue action items
  const overdueResult = db.exec(`
    SELECT ai.description, ai.assignee, m.client_name
    FROM action_items ai
    JOIN meetings m ON ai.meeting_id = m.id
    WHERE ai.completed = 0
    ORDER BY m.date DESC
    LIMIT 10
  `);

  if (overdueResult.length && overdueResult[0].values.length) {
    for (const row of overdueResult[0].values) {
      const [desc, assignee, client] = row as [string, string | null, string | null];
      const parts: string[] = [];
      if (client) parts.push(`[${client}]`);
      parts.push(desc.slice(0, 80));
      if (assignee) parts.push(`(${assignee})`);
      items.push(parts.join(' '));
    }
  }

  // Overdue invoices
  const invoiceResult = db.exec(`
    SELECT contact_name, invoice_number, ROUND(amount_due, 2), due_date
    FROM xero_invoices
    WHERE status = 'AUTHORISED' AND amount_due > 0 AND due_date < ?
    ORDER BY amount_due DESC
    LIMIT 5
  `, [today()]);

  if (invoiceResult.length && invoiceResult[0].values.length) {
    for (const row of invoiceResult[0].values) {
      const [contact, invNum, amount, due] = row as [string, string, number, string];
      items.push(`Invoice ${invNum} (${contact}): GBP ${amount} overdue since ${due}`);
    }
  }

  // Red/amber clients needing attention
  const healthResult = db.exec(`
    SELECT client_name, score
    FROM client_health
    WHERE period = (SELECT MAX(period) FROM client_health) AND score < 40
    ORDER BY score ASC
    LIMIT 3
  `);

  if (healthResult.length && healthResult[0].values.length) {
    for (const row of healthResult[0].values) {
      const [name, score] = row as [string, number];
      items.push(`RED client: ${name} (score ${score}/100) — needs immediate attention`);
    }
  }

  return items;
}

async function gatherYesterdayWins(): Promise<string[]> {
  const db = await getDb();
  const items: string[] = [];
  const yd = yesterday();

  // Meetings held yesterday
  const meetingResult = db.exec(`
    SELECT title, client_name FROM meetings WHERE date >= ? AND date < ? LIMIT 5
  `, [yd, today()]);

  if (meetingResult.length && meetingResult[0].values.length) {
    const count = meetingResult[0].values.length;
    items.push(`${count} meeting${count > 1 ? 's' : ''} held yesterday`);
  }

  // Invoices paid recently
  const paidResult = db.exec(`
    SELECT COUNT(*) FROM xero_invoices
    WHERE status = 'PAID' AND updated_at >= ?
  `, [yd]);

  if (paidResult.length && paidResult[0].values.length) {
    const count = paidResult[0].values[0][0] as number;
    if (count > 0) items.push(`${count} invoice${count > 1 ? 's' : ''} paid`);
  }

  // New pipeline opportunities
  const oppResult = db.exec(`
    SELECT COUNT(*), COALESCE(SUM(monetary_value), 0) FROM ghl_opportunities
    WHERE created_at >= ?
  `, [yd]);

  if (oppResult.length && oppResult[0].values.length) {
    const [count, value] = oppResult[0].values[0] as [number, number];
    if (count > 0) items.push(`${count} new pipeline opportunit${count > 1 ? 'ies' : 'y'} (GBP ${value.toLocaleString()})`);
  }

  // Upsell opportunities found
  const upsellResult = db.exec(`
    SELECT COUNT(*) FROM upsell_opportunities WHERE created_at >= ?
  `, [yd]);

  if (upsellResult.length && upsellResult[0].values.length) {
    const count = upsellResult[0].values[0][0] as number;
    if (count > 0) items.push(`${count} upsell opportunit${count > 1 ? 'ies' : 'y'} identified`);
  }

  return items;
}

async function gatherChallenges(): Promise<string[]> {
  const db = await getDb();
  const items: string[] = [];

  // Clients with no meeting in 30+ days
  const staleResult = db.exec(`
    SELECT name FROM clients
    WHERE status = 'active' AND last_meeting_date < ? AND display_name IS NOT NULL
    ORDER BY last_meeting_date ASC
    LIMIT 5
  `, [daysAgo(30)]);

  if (staleResult.length && staleResult[0].values.length) {
    const names = staleResult[0].values.map((r: unknown[]) => r[0] as string);
    items.push(`No meeting in 30+ days: ${names.join(', ')}`);
  }

  // Total outstanding receivables
  const arResult = db.exec(`
    SELECT ROUND(SUM(amount_due), 0)
    FROM xero_invoices
    WHERE status = 'AUTHORISED' AND amount_due > 0 AND type = 'ACCREC'
  `);

  if (arResult.length && arResult[0].values.length) {
    const total = arResult[0].values[0][0] as number;
    if (total > 0) items.push(`Total outstanding receivables: GBP ${total.toLocaleString()}`);
  }

  // Client offboardings in progress
  const offboardResult = db.exec(`
    SELECT client_name FROM client_offboarding WHERE status = 'pending'
  `);

  if (offboardResult.length && offboardResult[0].values.length) {
    const names = offboardResult[0].values.map((r: unknown[]) => r[0] as string);
    items.push(`Active offboardings: ${names.join(', ')}`);
  }

  return items;
}

function buildBlocks(sections: BriefSection[]): unknown[] {
  const blocks: unknown[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `Morning Brief — ${today()}`, emoji: true },
  });

  blocks.push({ type: 'divider' });

  for (const section of sections) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${section.title}*`,
      },
    });

    if (section.items.length > 0) {
      const bulletList = section.items.map(item => `  *  ${item}`).join('\n');
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: bulletList },
      });
    } else {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_Nothing to report_' },
      });
    }

    blocks.push({ type: 'divider' });
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: 'Generated by Vendo OS' },
    ],
  });

  return blocks;
}

async function postToSlack(blocks: unknown[]): Promise<void> {
  if (!WEBHOOK_URL) {
    log('DAILY-BRIEF', 'No Slack webhook configured — skipping post');
    return;
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack API ${res.status}: ${body}`);
  }
}

async function main() {
  await initSchema();

  const [priorities, wins, challenges] = await Promise.all([
    gatherPriorityActions(),
    gatherYesterdayWins(),
    gatherChallenges(),
  ]);

  const sections: BriefSection[] = [
    { title: ':dart: Today\'s Priority Actions', items: priorities },
    { title: ':trophy: Yesterday\'s Wins', items: wins },
    { title: ':warning: Flagged Challenges', items: challenges },
  ];

  // Log to console
  for (const section of sections) {
    log('DAILY-BRIEF', `\n--- ${section.title} ---`);
    if (section.items.length === 0) {
      log('DAILY-BRIEF', '  Nothing to report');
    } else {
      for (const item of section.items) {
        log('DAILY-BRIEF', `  - ${item}`);
      }
    }
  }

  // Post to Slack
  const blocks = buildBlocks(sections);
  await postToSlack(blocks);

  log('DAILY-BRIEF', '\nSlack brief posted successfully');
  closeDb();
}

main().catch((err) => {
  logError('DAILY-BRIEF', 'Failed', err);
  process.exit(1);
});
