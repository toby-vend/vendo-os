/**
 * Strategy 2: Action item assignee email matching.
 * Extracts assignee.email from raw_action_items, looks up domains.
 */

import type { MatchResult, MeetingData, MatchContext } from '../types.js';
import { GENERIC_EMAIL_DOMAINS } from '../team.js';

export function match(meeting: MeetingData, ctx: MatchContext): MatchResult | null {
  if (!meeting.raw_action_items) return null;

  let items: Array<{ assignee?: { email?: string; name?: string } | null }>;
  try {
    items = JSON.parse(meeting.raw_action_items);
    if (!Array.isArray(items)) return null;
  } catch {
    return null;
  }

  const domains = new Set<string>();
  for (const item of items) {
    const email = item.assignee?.email;
    if (!email) continue;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) continue;
    if (ctx.teamEmails.has(domain) || GENERIC_EMAIL_DOMAINS.has(domain)) continue;
    domains.add(domain);
  }

  if (domains.size === 0) return null;

  const clientHits = new Map<string, string[]>();
  for (const domain of domains) {
    const clientName = ctx.emailDomainLookup.get(domain);
    if (clientName) {
      const existing = clientHits.get(clientName) || [];
      existing.push(domain);
      clientHits.set(clientName, existing);
    }
  }

  if (clientHits.size === 0) return null;

  if (clientHits.size === 1) {
    const [clientName, matched] = [...clientHits.entries()][0];
    return {
      client_name: clientName,
      confidence: 'medium',
      method: 'action_item_email',
      evidence: { domains: matched },
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
    method: 'action_item_email',
    evidence: { primary: bestClient, all_clients: Object.fromEntries(clientHits), multi_client: true },
  };
}
