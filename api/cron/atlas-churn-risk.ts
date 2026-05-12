/**
 * /api/cron/atlas-churn-risk — daily retention scan.
 *
 * Schedule: 0 9 * * 1-5 (weekdays 09:00 UTC).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-churn-risk',
    prompt:
      'Run today\'s churn-risk scan. Follow your system prompt: combine ' +
      'health-score deltas, meeting concerns, Asana drift, invoice lag, ' +
      'and time-spent signals. Use invokeAgent on atlas-am when the ' +
      'relationship picture is unclear. Record one finding per at-risk ' +
      'client via recordGrowthFinding.',
  });
}
