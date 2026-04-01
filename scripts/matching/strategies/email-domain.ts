/**
 * Strategy 1: Email domain matching.
 * Parses calendar_invitees, extracts non-team email domains,
 * and looks them up against the contact_email_domains table.
 */

import type { MatchResult, MeetingData, MatchContext, Invitee } from '../types.js';
import { GENERIC_EMAIL_DOMAINS } from '../team.js';

export function match(meeting: MeetingData, ctx: MatchContext): MatchResult | null {
  const invitees = parseInvitees(meeting.calendar_invitees);
  if (!invitees.length) return null;

  const clientHits = new Map<string, string[]>(); // client_name → [domains]

  for (const inv of invitees) {
    const domain = inv.domain || (inv.email ? inv.email.split('@')[1]?.toLowerCase() : null);
    if (!domain) continue;
    if (ctx.teamEmails.has(domain)) continue;
    if (GENERIC_EMAIL_DOMAINS.has(domain)) continue;

    const clientName = ctx.emailDomainLookup.get(domain);
    if (clientName) {
      const existing = clientHits.get(clientName) || [];
      existing.push(domain);
      clientHits.set(clientName, existing);
    }
  }

  if (clientHits.size === 0) return null;

  if (clientHits.size === 1) {
    const [clientName, domains] = [...clientHits.entries()][0];
    return {
      client_name: clientName,
      confidence: 'high',
      method: 'email_domain',
      evidence: { domains, invitee_count: invitees.length },
    };
  }

  // Multiple clients found — pick the one with most attendee domains, flag for review
  let bestClient = '';
  let bestCount = 0;
  const allClients: Record<string, string[]> = {};

  for (const [clientName, domains] of clientHits) {
    allClients[clientName] = domains;
    if (domains.length > bestCount) {
      bestCount = domains.length;
      bestClient = clientName;
    }
  }

  return {
    client_name: bestClient,
    confidence: 'medium',
    method: 'email_domain',
    evidence: { primary: bestClient, all_clients: allClients, multi_client: true },
  };
}

function parseInvitees(json: string | null): Invitee[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
