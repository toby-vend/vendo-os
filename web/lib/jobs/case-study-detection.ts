/**
 * Case-study detection — weekly Wed 07:00 UTC.
 * Wave C / C4.
 *
 * Builds on the existing scanForCaseStudyWins() detection (already
 * filters out clients with case studies in the last 90 days) and adds
 * two milestone gates:
 *
 *   1. Tenure: client.first_invoice_date is 12+ months ago. We don't
 *      celebrate wins on accounts that haven't been with us long enough
 *      to call the outcome ours.
 *   2. Health: no high/critical concerns logged in the last 90 days.
 *      A glowing case study while we have an unresolved escalation
 *      reads wrong.
 *
 * Surviving wins get inserted into case_studies with status='identified'
 * via the existing insertCaseStudies helper. The growth UI surfaces them
 * for AM review + draft generation.
 */
import { db } from '../queries/base.js';
import { scanForCaseStudyWins } from '../growth-ai.js';
import { insertCaseStudies } from '../queries/growth.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'case-study-detection';
const TENURE_DAYS = 365;

export interface CaseStudyDetectionRow {
  clientName: string;
  winType: string;
  metric: string;
  tenureOk: boolean;
  healthOk: boolean;
  inserted: boolean;
  skipReason?: string;
}

export interface CaseStudyDetectionResult {
  scanned: number;
  inserted: number;
  skippedTenure: number;
  skippedHealth: number;
  durationMs: number;
  rows: CaseStudyDetectionRow[];
}

async function tenureMet(clientName: string): Promise<boolean> {
  // first_invoice_date is set during sync-xero. If null, we treat tenure
  // as not met (we can't celebrate a win on a client whose first invoice
  // isn't recorded — likely a manual-import or trial state).
  const r = await db.execute({
    sql: `SELECT 1 FROM clients
          WHERE name = ?
            AND first_invoice_date IS NOT NULL
            AND date(first_invoice_date, ?) <= date('now')
          LIMIT 1`,
    args: [clientName, `+${TENURE_DAYS} days`],
  });
  return r.rows.length > 0;
}

async function healthOk(clientName: string): Promise<boolean> {
  // No high/critical concerns in the last 90 days.
  const r = await db.execute({
    sql: `SELECT 1 FROM meeting_concerns mc
          JOIN meetings m ON m.id = mc.meeting_id
          WHERE m.client_name = ?
            AND mc.concern_detected = 1
            AND LOWER(COALESCE(mc.severity, '')) IN ('high', 'critical')
            AND m.date >= date('now', '-90 days')
          LIMIT 1`,
    args: [clientName],
  });
  return r.rows.length === 0;
}

export async function runCaseStudyDetection(): Promise<CaseStudyDetectionResult> {
  const start = Date.now();

  const wins = await scanForCaseStudyWins();
  const rows: CaseStudyDetectionRow[] = [];
  let skippedTenure = 0;
  let skippedHealth = 0;
  const toInsert: typeof wins = [];

  for (const w of wins) {
    let tenure = false;
    let health = false;
    try {
      tenure = await tenureMet(w.clientName);
      if (!tenure) {
        skippedTenure++;
        rows.push({
          clientName: w.clientName,
          winType: w.winType,
          metric: w.metric,
          tenureOk: false,
          healthOk: false,
          inserted: false,
          skipReason: 'tenure < 12 months',
        });
        continue;
      }
      health = await healthOk(w.clientName);
      if (!health) {
        skippedHealth++;
        rows.push({
          clientName: w.clientName,
          winType: w.winType,
          metric: w.metric,
          tenureOk: true,
          healthOk: false,
          inserted: false,
          skipReason: 'high/critical concern in last 90d',
        });
        continue;
      }
      toInsert.push(w);
      rows.push({
        clientName: w.clientName,
        winType: w.winType,
        metric: w.metric,
        tenureOk: true,
        healthOk: true,
        inserted: true,
      });
    } catch (err) {
      consoleLog(LOG_SOURCE, `Gate check failed for ${w.clientName}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (toInsert.length > 0) {
    try {
      await insertCaseStudies(toInsert);
    } catch (err) {
      consoleLog(LOG_SOURCE, `Insert failed: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  return {
    scanned: wins.length,
    inserted: toInsert.length,
    skippedTenure,
    skippedHealth,
    durationMs: Date.now() - start,
    rows,
  };
}
