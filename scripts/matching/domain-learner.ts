/**
 * Domain learner — after a successful match, checks if any new
 * email domain → client mappings were discovered and persists them.
 */

import type { Database } from 'sql.js';
import type { MatchResult, MeetingData, Invitee } from './types.js';
import { VENDO_TEAM_DOMAINS, GENERIC_EMAIL_DOMAINS } from './team.js';

export function learnDomains(
  db: Database,
  meeting: MeetingData,
  result: MatchResult,
  existingDomains: Set<string>,
): number {
  if (!result.client_name) return 0;
  if (!meeting.calendar_invitees) return 0;

  let invitees: Invitee[];
  try {
    invitees = JSON.parse(meeting.calendar_invitees);
    if (!Array.isArray(invitees)) return 0;
  } catch {
    return 0;
  }

  let learned = 0;
  const now = new Date().toISOString();

  for (const inv of invitees) {
    const email = inv.email;
    if (!email) continue;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) continue;
    if (VENDO_TEAM_DOMAINS.has(domain)) continue;
    if (GENERIC_EMAIL_DOMAINS.has(domain)) continue;
    if (existingDomains.has(`${domain}:${result.client_name}`)) continue;

    try {
      db.run(
        `INSERT OR IGNORE INTO contact_email_domains (domain, client_name, source, contact_email, created_at)
         VALUES (?, ?, 'learned', ?, ?)`,
        [domain, result.client_name, email, now],
      );
      existingDomains.add(`${domain}:${result.client_name}`);
      learned++;
    } catch { /* duplicate — ignore */ }
  }

  return learned;
}

/** Load existing domain:client pairs into a Set for dedup during batch runs */
export function loadExistingDomains(db: Database): Set<string> {
  const pairs = new Set<string>();
  const result = db.exec('SELECT domain, client_name FROM contact_email_domains');
  if (result.length) {
    for (const row of result[0].values) {
      pairs.add(`${row[0]}:${row[1]}`);
    }
  }
  return pairs;
}
