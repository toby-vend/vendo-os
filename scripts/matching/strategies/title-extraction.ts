/**
 * Strategy 3: Title-based client extraction.
 * Ported from process-meetings.ts — extracts client name from
 * separator patterns like "Client x Vendo" then fuzzy-matches
 * against the client name lookup.
 */

import type { MatchResult, MeetingData, MatchContext } from '../types.js';
import { normaliseName } from '../build-match-context.js';

const CLIENT_SEPARATORS = [
  ' x Vendo', ' x vendo',
  ' / Vendo', ' / vendo',
  ' | Vendo', ' | vendo',
  ' - Vendo', ' - vendo',
  ' – Vendo', ' – vendo',
  ' — Vendo', ' — vendo',
  'Vendo x ', 'vendo x ',
  'Vendo / ', 'vendo / ',
  'Vendo | ', 'vendo | ',
  'Vendo - ', 'vendo - ',
  'Vendo Digital', 'vendo digital',
];

export function extractClientName(title: string): string | null {
  const lower = title.toLowerCase();

  // Skip non-client meeting types
  if (lower.includes('interview') || lower.includes('team meeting') || lower.includes('1 - 1') || lower.includes('1-1')) {
    return null;
  }

  // Try "Client x Vendo" or "Vendo x Client" patterns
  for (const sep of CLIENT_SEPARATORS) {
    const sepLower = sep.toLowerCase();
    const idx = lower.indexOf(sepLower);
    if (idx === -1) continue;

    if (sepLower.startsWith('vendo')) {
      const after = title.substring(idx + sep.length).trim();
      const cleaned = after.split(/[|–—:]/)[0].trim();
      if (cleaned.length > 1) return cleaned;
    } else {
      const before = title.substring(0, idx).trim();
      if (before.length > 1) return before;
    }
  }

  // Try generic separator: "ClientName | Meeting Type"
  const pipeMatch = title.match(/^(.+?)\s*[|–—]\s*.+$/);
  if (pipeMatch) {
    const candidate = pipeMatch[1].trim();
    if (candidate.length > 2 && !lower.includes('paid social') && !lower.includes('paid search') && !lower.includes('seo')) {
      return candidate;
    }
  }

  return null;
}

export function matchToClient(extracted: string, lookup: Map<string, string>): string | null {
  const norm = normaliseName(extracted);
  if (!norm) return null;

  // Exact normalised match
  if (lookup.has(norm)) return lookup.get(norm)!;

  // Substring match
  for (const [key, canonical] of lookup) {
    if (key.includes(norm) || norm.includes(key)) {
      return canonical;
    }
  }

  return null;
}

export function match(meeting: MeetingData, ctx: MatchContext): MatchResult | null {
  const extracted = extractClientName(meeting.title);
  if (!extracted) return null;

  const matched = matchToClient(extracted, ctx.clientNameLookup);
  if (!matched) {
    return {
      client_name: null,
      confidence: 'low',
      method: 'title',
      evidence: { extracted, matched: false },
    };
  }

  // Exact normalised match = high, substring = medium
  const norm = normaliseName(extracted);
  const isExact = ctx.clientNameLookup.get(norm) === matched;

  return {
    client_name: matched,
    confidence: isExact ? 'high' : 'medium',
    method: 'title',
    evidence: { extracted, matched: true, exact: isExact },
  };
}
