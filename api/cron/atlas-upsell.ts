/**
 * /api/cron/atlas-upsell — weekly expansion-opportunity scan.
 *
 * Schedule: 30 9 * * 3 (Wed 09:30 UTC).
 *
 * Replaces the existing /api/cron/upsell-detection script — that route
 * is removed from vercel.json::crons[] in the same commit.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-upsell',
    prompt:
      'Run this week\'s upsell scan. Follow your system prompt: identify ' +
      'mature clients with strong performance + health, delegate to the ' +
      'relevant paid-channel specialist for the campaign narrative and ' +
      'to atlas-am for the relationship read. Record one finding per ' +
      'credible candidate via recordGrowthFinding.',
  });
}
