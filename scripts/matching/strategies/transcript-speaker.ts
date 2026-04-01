/**
 * Strategy 5: Transcript speaker name matching.
 * Parses "[timestamp] Speaker Name: text" lines from transcript,
 * extracts unique non-team speaker names, matches against contacts.
 */

import type { MatchResult, MeetingData, MatchContext } from '../types.js';
import { normaliseName } from '../build-match-context.js';

const TRANSCRIPT_LINE = /^\[.*?\]\s+(.+?):\s/;

export function match(meeting: MeetingData, ctx: MatchContext): MatchResult | null {
  if (!meeting.transcript) return null;

  const speakers = new Set<string>();
  const lines = meeting.transcript.split('\n');

  for (const line of lines) {
    const m = TRANSCRIPT_LINE.exec(line);
    if (m) speakers.add(m[1]);
  }

  if (speakers.size === 0) return null;

  const clientHits = new Map<string, string[]>();

  for (const speaker of speakers) {
    if (ctx.teamNames.has(speaker.toLowerCase())) continue;
    const normName = normaliseName(speaker);
    if (!normName || ctx.teamNames.has(normName)) continue;

    const clientName = ctx.contactNameLookup.get(normName);
    if (clientName) {
      const existing = clientHits.get(clientName) || [];
      existing.push(speaker);
      clientHits.set(clientName, existing);
    }
  }

  if (clientHits.size === 0) return null;

  if (clientHits.size === 1) {
    const [clientName, speakers] = [...clientHits.entries()][0];
    return {
      client_name: clientName,
      confidence: 'low',
      method: 'transcript_speaker',
      evidence: { matched_speakers: speakers },
    };
  }

  // Multiple — pick best
  let bestClient = '';
  let bestCount = 0;
  for (const [clientName, matched] of clientHits) {
    if (matched.length > bestCount) {
      bestCount = matched.length;
      bestClient = clientName;
    }
  }

  return {
    client_name: bestClient,
    confidence: 'low',
    method: 'transcript_speaker',
    evidence: { primary: bestClient, all_clients: Object.fromEntries(clientHits) },
  };
}
