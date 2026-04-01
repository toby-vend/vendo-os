/**
 * Strategy 4: Attendee name matching.
 * Parses calendar_invitees for names, filters out team members,
 * matches remaining against Xero/GHL contact names.
 */

import type { MatchResult, MeetingData, MatchContext, Invitee } from '../types.js';
import { normaliseName } from '../build-match-context.js';

export function match(meeting: MeetingData, ctx: MatchContext): MatchResult | null {
  if (!meeting.calendar_invitees) return null;

  let invitees: Invitee[];
  try {
    invitees = JSON.parse(meeting.calendar_invitees);
    if (!Array.isArray(invitees)) return null;
  } catch {
    return null;
  }

  const clientHits = new Map<string, string[]>(); // client_name → [matched contact names]

  for (const inv of invitees) {
    if (!inv.name) continue;
    const normName = normaliseName(inv.name);
    if (!normName) continue;
    if (ctx.teamNames.has(inv.name.toLowerCase()) || ctx.teamNames.has(normName)) continue;

    const clientName = ctx.contactNameLookup.get(normName);
    if (clientName) {
      const existing = clientHits.get(clientName) || [];
      existing.push(inv.name);
      clientHits.set(clientName, existing);
    }
  }

  if (clientHits.size === 0) return null;

  if (clientHits.size === 1) {
    const [clientName, contacts] = [...clientHits.entries()][0];
    return {
      client_name: clientName,
      confidence: 'medium',
      method: 'attendee_name',
      evidence: { matched_contacts: contacts },
    };
  }

  // Multiple clients — pick best
  let bestClient = '';
  let bestCount = 0;
  for (const [clientName, contacts] of clientHits) {
    if (contacts.length > bestCount) {
      bestCount = contacts.length;
      bestClient = clientName;
    }
  }

  return {
    client_name: bestClient,
    confidence: 'low',
    method: 'attendee_name',
    evidence: { primary: bestClient, all_clients: Object.fromEntries(clientHits), multi_client: true },
  };
}
