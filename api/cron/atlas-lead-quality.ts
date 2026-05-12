/**
 * /api/cron/atlas-lead-quality — daily inbound-lead scorer.
 *
 * Schedule: 0 8 * * 1-5 (weekdays 08:00 UTC).
 *
 * Replaces the existing /api/cron/lead-scoring script.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGrowthCron } from './_growth-cron.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await runGrowthCron({
    req,
    res,
    agentName: 'atlas-lead-quality',
    prompt:
      'Score new GHL opportunities from the last 24-48 hours. Follow ' +
      'your system prompt: rate each P0-P3, delegate to the relevant ' +
      'vertical specialist for the "what would good look like" framing, ' +
      'and draft a personalised first-reply for each. Record one ' +
      'finding per lead via recordGrowthFinding.',
  });
}
