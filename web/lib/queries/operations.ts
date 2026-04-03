import { rows, scalar, db } from './base.js';

export interface MonitorAlert {
  monitor: string;
  entity: string;
  alert_type: string;
  message: string;
  created_at: string;
}

export interface MonitorAlertStats {
  total: number;
  critical: number;
  lastRun: string | null;
}

export async function getMonitorAlerts(limit = 50): Promise<MonitorAlert[]> {
  try {
    return await rows<MonitorAlert>(
      `SELECT monitor, entity, alert_type, message, created_at FROM monitor_alerts ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
  } catch {
    // Table may not exist yet
    return [];
  }
}

export async function getMonitorAlertStats(): Promise<MonitorAlertStats> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const total = await scalar<number>(
      `SELECT COUNT(*) FROM monitor_alerts WHERE created_at >= ?`,
      [sevenDaysAgo],
    ) ?? 0;

    const critical = await scalar<number>(
      `SELECT COUNT(*) FROM monitor_alerts WHERE created_at >= ? AND alert_type IN ('high-cpl', 'high-cpa', 'low-roas', 'overdue', 'pacing-over')`,
      [sevenDaysAgo],
    ) ?? 0;

    const lastRun = await scalar<string>(
      `SELECT MAX(created_at) FROM monitor_alerts`,
    ) ?? null;

    return { total, critical, lastRun };
  } catch {
    // Table may not exist yet
    return { total: 0, critical: 0, lastRun: null };
  }
}

export async function logOperationRun(script: string): Promise<void> {
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS operation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'running'
      )`,
      args: [],
    });
    await db.execute({
      sql: `INSERT INTO operation_runs (script) VALUES (?)`,
      args: [script],
    });
  } catch (err) {
    console.error('[operations] Failed to log operation run:', err);
  }
}

export async function getOperationRuns(limit = 20): Promise<{ script: string; started_at: string; status: string }[]> {
  try {
    return await rows<{ script: string; started_at: string; status: string }>(
      `SELECT script, started_at, status FROM operation_runs ORDER BY started_at DESC LIMIT ?`,
      [limit],
    );
  } catch {
    return [];
  }
}
