/**
 * /api/cron/atlas-case-study — weekly milestone detector + drafter.
 *
 * Schedule: 0 7 * * 3 (Wed 07:00 UTC).
 *
 * Replaces the existing /api/cron/case-study-detection script.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-case-study',
    prompt:
      'Find clients hitting milestones worth a public case study this ' +
      'week. Follow your system prompt: 3+ months sustained ROAS gain, ' +
      'lead volume or organic-search wins, named outcomes in meetings. ' +
      'Delegate to atlas-paid-social/atlas-paid-search for the campaign ' +
      'narrative and atlas-creative for tone. Draft each case study ' +
      'end-to-end. Record findings via recordGrowthFinding.',
  });
}
