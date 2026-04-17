import { sendSlackDM, sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'asana-overdue';
const BASE_URL = 'https://app.asana.com/api/1.0';

interface AsanaTask {
  gid: string;
  name: string;
  due_on: string | null;
  completed: boolean;
  assignee: { gid: string; name: string } | null;
}

async function fetchOverdueTasks(): Promise<AsanaTask[]> {
  const pat = process.env.ASANA_PAT;
  const workspaceId = process.env.ASANA_WORKSPACE_ID;
  if (!pat || !workspaceId) {
    consoleLog(MONITOR_NAME, 'ASANA_PAT or ASANA_WORKSPACE_ID not set — skipping');
    return [];
  }
  const url = `${BASE_URL}/tasks?workspace=${workspaceId}&completed_since=now&opt_fields=name,due_on,assignee,assignee.name,completed`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    if (!res.ok) {
      consoleLog(MONITOR_NAME, `Asana API returned ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { data: AsanaTask[] };
    return json.data || [];
  } catch (err) {
    consoleLog(MONITOR_NAME, `Failed to fetch Asana tasks: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function run(): Promise<MonitorRunResult> {
  const sltChannel = process.env.SLACK_CHANNEL_SLT || '#slt';
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
      const alertType = '72hr-escalation';
      if (await alreadyAlerted(MONITOR_NAME, task.gid, alertType)) continue;
      const msg = `Overdue task (${overdueDays} days): "${task.name}" — assignee: ${assigneeName}`;
      await sendSlackMessage(sltChannel, `:rotating_light: *Asana Escalation*\n${msg}`);
      await recordAlert(MONITOR_NAME, task.gid, alertType, msg);
      flagged++;
    } else {
      const alertType = '48hr-dm';
      if (await alreadyAlerted(MONITOR_NAME, task.gid, alertType)) continue;
      const msg = `Your task "${task.name}" is ${overdueDays} days overdue. Please update or complete it.`;
      if (task.assignee?.gid) await sendSlackDM(task.assignee.gid, msg);
      await recordAlert(MONITOR_NAME, task.gid, alertType, msg);
      flagged++;
    }
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} overdue tasks, flagged ${flagged}`);
  return { checked, flagged };
}
