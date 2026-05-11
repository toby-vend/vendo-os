/**
 * NPS survey auto-trigger — daily 09:00 UTC.
 * Wave V / V3.
 *
 * Finds clients hitting their 90-day anniversary (counted from
 * `first_invoice_date`) today and pings the AM with a Slack DM to send an
 * NPS survey. Logs to `nps_surveys_sent` to prevent re-prompting.
 *
 * Why this shape (Slack ping, not auto-send): VendoOS has no Resend wiring
 * and no GHL-form-trigger path yet. Until that infra lands, the AM still
 * needs to *know* when a client crosses 90 days — which today happens
 * never. This job closes that gap. The actual auto-send is a follow-up
 * iteration once Resend lands.
 *
 * Idempotent: a row in `nps_surveys_sent` for (client_id, '90-day') blocks
 * re-prompting. Status starts as 'detected'; when a real send path exists
 * a future job can flip it to 'sent'.
 */
import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { getClientAM } from '../asana/assignee.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'nps-trigger';

export interface NpsTriggerCandidate {
  clientId: number;
  clientName: string;
  firstInvoiceDate: string;
  am: string;
}

export interface NpsTriggerResult {
  candidates: number;
  prompted: number;
  durationMs: number;
  rows: NpsTriggerCandidate[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nps_surveys_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'detected',
      channel TEXT,
      sent_at TEXT NOT NULL,
      UNIQUE (client_id, trigger_type)
    )
  `);
}

export async function runNpsTrigger(): Promise<NpsTriggerResult> {
  const start = Date.now();
  await ensureSchema();
  const nowIso = new Date().toISOString();
  const channel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';

  // 90-day anniversary today. Match by julianday diff to handle leap years
  // robustly. Also requires the client be active and have a first invoice
  // (skips trial/lapsed clients).
  const due = await db.execute(`
    SELECT c.id, c.name, c.first_invoice_date
    FROM clients c
    LEFT JOIN nps_surveys_sent n
      ON n.client_id = c.id AND n.trigger_type = '90-day'
    WHERE c.first_invoice_date IS NOT NULL
      AND date(c.first_invoice_date, '+90 days') = date('now')
      AND COALESCE(c.status, 'active') != 'lapsed'
      AND n.id IS NULL
  `);

  const candidates: NpsTriggerCandidate[] = [];
  for (const row of due.rows) {
    const clientId = Number(row.id);
    const clientName = String(row.name);
    const am = (await getClientAM(clientName)) || 'Unassigned';
    candidates.push({
      clientId,
      clientName,
      firstInvoiceDate: String(row.first_invoice_date),
      am,
    });
  }

  // Group by AM so each AM gets a single ping rather than N noisy pings
  let prompted = 0;
  const byAm = new Map<string, NpsTriggerCandidate[]>();
  for (const c of candidates) {
    const list = byAm.get(c.am) || [];
    list.push(c);
    byAm.set(c.am, list);
  }

  for (const [am, list] of byAm) {
    const lines = [
      `:bar_chart: *NPS surveys due today — ${am}* (${list.length} client${list.length === 1 ? '' : 's'})`,
      ...list.map((c) => `  • ${c.clientName} — 90 days since first invoice (${c.firstInvoiceDate.slice(0, 10)})`),
      '',
      'Send the standard NPS survey. Detractor follow-ups will auto-flow to Asana.',
    ];
    try {
      await sendSlackMessage(channel, lines.join('\n'));
      prompted += list.length;
    } catch (err) {
      consoleLog(LOG_SOURCE, `Failed to post NPS digest for ${am}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Log every detected candidate even if Slack post failed — that way
  // we don't re-prompt tomorrow when the date no longer matches and the
  // client falls off the daily query window.
  if (candidates.length > 0) {
    const stmts = candidates.map((c) => ({
      sql: `INSERT OR IGNORE INTO nps_surveys_sent
              (client_id, client_name, trigger_type, status, channel, sent_at)
            VALUES (?, ?, '90-day', 'detected', 'slack-am-ping', ?)`,
      args: [c.clientId, c.clientName, nowIso] as (string | number | null)[],
    }));
    await db.batch(stmts, 'write');
  }

  return {
    candidates: candidates.length,
    prompted,
    durationMs: Date.now() - start,
    rows: candidates,
  };
}
