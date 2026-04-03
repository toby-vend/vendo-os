/**
 * Asana Overdue Task Monitor (#11)
 *
 * Checks for tasks overdue by 48+ hours and escalates:
 *   - 48hrs overdue: Slack DM to assignee
 *   - 72hrs overdue: escalate to SLT channel
 *
 * Usage:
 *   npx tsx scripts/monitors/asana-overdue.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackDM, sendSlackMessage } from '../utils/slack-alert.js';

const MONITOR_NAME = 'asana-overdue';
const PAT = process.env.ASANA_PAT;
const WORKSPACE_ID = process.env.ASANA_WORKSPACE_ID;
const SLT_CHANNEL = process.env.SLACK_CHANNEL_SLT || '#slt';
const BASE_URL = 'https://app.asana.com/api/1.0';

interface AsanaTask {
  gid: string;
  name: string;
  due_on: string | null;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
}

async function ensureAlertSchema(db: Database): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor TEXT NOT NULL,
      entity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(monitor, entity, alert_type, date(created_at))
    )
  `);
}

function alreadyAlerted(db: Database, entity: string, alertType: string): boolean {
  const result = db.exec(
    `SELECT COUNT(*) FROM monitor_alerts
     WHERE monitor = ? AND entity = ? AND alert_type = ? AND date(created_at) = date('now')`,
    [MONITOR_NAME, entity, alertType]
  );
  return result.length > 0 && (result[0].values[0][0] as number) > 0;
}

function recordAlert(db: Database, entity: string, alertType: string, message: string): void {
  db.run(
    `INSERT OR IGNORE INTO monitor_alerts (monitor, entity, alert_type, message)
     VALUES (?, ?, ?, ?)`,
    [MONITOR_NAME, entity, alertType, message]
  );
}

async function fetchOverdueTasks(): Promise<AsanaTask[]> {
  if (!PAT || !WORKSPACE_ID) {
    log(MONITOR_NAME, 'ASANA_PAT or ASANA_WORKSPACE_ID not set — skipping');
    return [];
  }

  const url = `${BASE_URL}/tasks?workspace=${WORKSPACE_ID}&completed_since=now&opt_fields=name,due_on,assignee,assignee.name,completed`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${PAT}` },
    });

    if (!res.ok) {
      logError(MONITOR_NAME, `Asana API returned ${res.status}`);
      return [];
    }

    const json = await res.json() as { data: AsanaTask[] };
    return json.data || [];
  } catch (err) {
    logError(MONITOR_NAME, 'Failed to fetch Asana tasks', err);
    return [];
  }
}

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const tasks = await fetchOverdueTasks();
  const now = Date.now();
  const HOURS_48 = 48 * 60 * 60 * 1000;
  const HOURS_72 = 72 * 60 * 60 * 1000;

  let checked = 0;
  let flagged = 0;

  for (const task of tasks) {
    if (task.completed || !task.due_on) continue;
    checked++;

    const dueDate = new Date(task.due_on + 'T23:59:59Z');
    const overdueMs = now - dueDate.getTime();

    if (overdueMs < HOURS_48) continue;

    const overdueDays = Math.round(overdueMs / (24 * 60 * 60 * 1000));
    const assigneeName = task.assignee?.name || 'Unassigned';

    if (overdueMs >= HOURS_72) {
      // 72hr escalation to SLT
      const alertType = '72hr-escalation';
      if (!alreadyAlerted(db, task.gid, alertType)) {
        const msg = `Overdue task (${overdueDays} days): "${task.name}" — assignee: ${assigneeName}`;
        await sendSlackMessage(SLT_CHANNEL, `:rotating_light: *Asana Escalation*\n${msg}`);
        recordAlert(db, task.gid, alertType, msg);
        log(MONITOR_NAME, `Escalated to SLT: ${task.name} (${overdueDays}d overdue)`);
        flagged++;
      }
    } else {
      // 48hr DM to assignee
      const alertType = '48hr-dm';
      if (!alreadyAlerted(db, task.gid, alertType)) {
        const msg = `Your task "${task.name}" is ${overdueDays} days overdue. Please update or complete it.`;
        if (task.assignee?.gid) {
          await sendSlackDM(task.assignee.gid, msg);
        }
        recordAlert(db, task.gid, alertType, msg);
        log(MONITOR_NAME, `DM sent for: ${task.name} — ${assigneeName} (${overdueDays}d overdue)`);
        flagged++;
      }
    }
  }

  saveDb();
  log(MONITOR_NAME, `Checked ${checked} incomplete overdue tasks, flagged ${flagged}`);
  return { checked, flagged };
}

async function main() {
  await run();
  closeDb();
}

main().catch(err => {
  logError(MONITOR_NAME, 'Failed', err);
  process.exit(1);
});
