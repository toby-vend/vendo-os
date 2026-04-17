import { db } from '../queries/base.js';

/**
 * Turso-native helpers for monitor scripts. Replaces the sql.js-based
 * pattern in scripts/monitors/* — every helper here is a direct Turso
 * operation so monitors can run inside the Vercel serverless function.
 */

export async function alreadyAlerted(
  monitor: string,
  entity: string,
  alertType: string,
): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT 1 FROM monitor_alerts
          WHERE monitor = ? AND entity = ? AND alert_type = ?
            AND date(created_at) = date('now')
          LIMIT 1`,
    args: [monitor, entity, alertType],
  });
  return result.rows.length > 0;
}

export async function recordAlert(
  monitor: string,
  entity: string,
  alertType: string,
  message: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO monitor_alerts (monitor, entity, alert_type, message)
          VALUES (?, ?, ?, ?)`,
    args: [monitor, entity, alertType, message],
  });
}

export interface MonitorRunResult {
  checked: number;
  flagged: number;
}

export type MonitorLogger = (source: string, msg: string) => void;
export const consoleLog: MonitorLogger = (source, msg) => console.log(`[${source}] ${msg}`);
