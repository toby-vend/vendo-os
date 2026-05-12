/**
 * /api/cron/atlas-profitability — daily per-client margin watchdog.
 *
 * Schedule: 0 4 * * * (daily 04:00 UTC, alongside the existing
 * client-profitability sync at the same hour — runs after the sync
 * row has refreshed).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-profitability',
    prompt:
      'Run the daily margin watch. Follow your system prompt: compute ' +
      'hours-vs-contracted and gross margin MTD per client, delegate to ' +
      'atlas-am to distinguish strategic loss-leaders from real ' +
      'problems, and draft an internal note (never client-facing) for ' +
      'each trigger. Record one finding per flagged client.',
  });
}
