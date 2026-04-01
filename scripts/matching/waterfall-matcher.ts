/**
 * Waterfall meeting matcher — runs strategies in priority order,
 * stops at the first high-confidence match.
 *
 * Waterfall order:
 *   0. Pre-check: internal meeting
 *   1. Email domain match (calendar invitees)
 *   2. Action item assignee emails
 *   3. Title separator extraction
 *   4. Attendee name match
 *   5. Transcript speaker match
 *   6. AI classification (Haiku) — async, batched
 *   7. Fallback: unmatched
 */

import type { MatchResult, MeetingData, MatchContext } from './types.js';
import { match as emailDomainMatch } from './strategies/email-domain.js';
import { match as actionItemEmailMatch } from './strategies/action-item-email.js';
import { match as titleMatch } from './strategies/title-extraction.js';
import { match as attendeeNameMatch } from './strategies/attendee-name.js';
import { match as transcriptSpeakerMatch } from './strategies/transcript-speaker.js';
import { match as aiClassify } from './strategies/ai-classify.js';

const INTERNAL_KEYWORDS = [
  'team meeting', 'team call', 'management meeting',
  '1-1', '1 - 1', 'standup', 'stand-up', 'all hands',
];

function isInternalMeeting(meeting: MeetingData, _ctx: MatchContext): boolean {
  const lower = meeting.title.toLowerCase();

  // Title-based detection — reliable signal
  if (INTERNAL_KEYWORDS.some(kw => lower.includes(kw))) return true;

  // Fathom's own classification — authoritative
  if (meeting.invitee_domains_type === 'internal') return true;

  // Note: we do NOT infer internal from "all calendar_invitees are team domains"
  // because our invitee data comes from transcript speaker matching, which is
  // biased towards Vendo staff (clients' emails often aren't matched by Fathom).

  return false;
}

export async function matchMeeting(
  meeting: MeetingData,
  ctx: MatchContext,
  options?: { skipAi?: boolean },
): Promise<MatchResult> {
  // Step 0: Internal meeting check
  if (isInternalMeeting(meeting, ctx)) {
    return {
      client_name: null,
      confidence: 'high',
      method: 'internal',
      evidence: { title: meeting.title, invitee_domains_type: meeting.invitee_domains_type },
    };
  }

  // Run deterministic strategies in order
  const strategies = [
    emailDomainMatch,
    actionItemEmailMatch,
    titleMatch,
    attendeeNameMatch,
    transcriptSpeakerMatch,
  ];

  let bestResult: MatchResult | null = null;

  for (const strategy of strategies) {
    const result = strategy(meeting, ctx);
    if (!result) continue;
    if (result.client_name === null) continue; // skip non-matches

    // High confidence — stop immediately
    if (result.confidence === 'high') return result;

    // Track the best medium/low result
    if (!bestResult || confidenceRank(result.confidence) > confidenceRank(bestResult.confidence)) {
      bestResult = result;
    }
  }

  // If we have a medium result, use it without AI
  if (bestResult && bestResult.confidence === 'medium') return bestResult;

  // Step 6: AI classification (async)
  if (!options?.skipAi) {
    try {
      const aiResult = await aiClassify(meeting, ctx);
      if (aiResult && aiResult.client_name) {
        if (!bestResult || confidenceRank(aiResult.confidence) >= confidenceRank(bestResult.confidence)) {
          return aiResult;
        }
      }
    } catch { /* AI failure — continue with what we have */ }
  }

  // Return best low-confidence result or unmatched
  if (bestResult && bestResult.client_name) return bestResult;

  return {
    client_name: null,
    confidence: 'low',
    method: 'unmatched',
    evidence: { title: meeting.title },
  };
}

function confidenceRank(confidence: string): number {
  switch (confidence) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}
