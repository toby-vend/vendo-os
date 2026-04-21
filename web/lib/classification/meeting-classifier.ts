/**
 * Classifies a Fathom meeting into one of four routing classes. The result
 * drives the entire downstream pipeline — whether tasks are created, which
 * Asana projects they land in, whether we post to Slack, and whether Toby
 * gets a fail-safe DM.
 *
 *   DIRECTOR   — Vendo director / director bi-weekly meetings, or internal
 *                meetings where ONLY the four SLT members are on the call.
 *                Posted to #claude-director-meetings. No Asana tasks.
 *   SLT        — Title mentions SLT / Senior Leadership but isn't a directors-
 *                only meeting. Tasks go to the SLT Asana project ONLY.
 *   STANDARD   — Everything else. Current behaviour — normal multi-project
 *                routing and public concern alerts.
 *   FAILSAFE   — Title and attendees both failed to parse. DM Toby for
 *                manual review.
 *
 * The classifier is pure — no DB, no network, no Anthropic calls.
 */

export type Classification = 'DIRECTOR' | 'SLT' | 'STANDARD' | 'FAILSAFE';

export interface ClassificationResult {
  type: Classification;
  reason: string;
}

export interface ClassifierInvitee {
  name?: string | null;
  email?: string | null;
  is_external?: boolean;
}

const DIRECTOR_TITLE_PATTERNS: RegExp[] = [
  /vendo\s+director/i,
  /director\s+bi[-\s]?weekly/i,
];

const SLT_TITLE_PATTERNS: RegExp[] = [
  /\bSLT\b/,          // exact token, case-sensitive so we don't match "salt"
  /senior\s+leadership/i,
];

/**
 * SLT roster — must match BOTH full name AND a Vendo-domain email for a
 * DIRECTOR classification to fire via the attendees rule. This mirrors the
 * SLT_NAMES constant in sync-actions-to-asana.ts; keep them in sync.
 */
const SLT_ROSTER: Array<{ name: string; email: RegExp }> = [
  { name: 'toby raeburn',     email: /^toby@vendo/i      },
  { name: 'alfie wakelin',    email: /^alfie@vendo/i     },
  { name: 'max rivens',       email: /^max@vendo/i       },
  { name: 'rhiannon larkman', email: /^rhiannon@vendo/i  },
];

const VENDO_DOMAINS = new Set(['vendodigital.co.uk', 'vendodigital.com', 'vendo.digital']);

function emailDomain(email: string | undefined | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  return at === -1 ? null : email.slice(at + 1).toLowerCase().trim();
}

function isVendoDomain(email: string | undefined | null): boolean {
  const d = emailDomain(email);
  return !!d && VENDO_DOMAINS.has(d);
}

function normaliseName(name: string | null | undefined): string {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * True when every invitee is an SLT member verified by BOTH full name AND
 * a Vendo-domain email, the attendee list is non-empty, and nobody outside
 * the roster is present. "Full match & email to make sure" — Toby's spec.
 */
function isDirectorOnlyAttendance(invitees: ClassifierInvitee[]): boolean {
  if (!invitees.length) return false;
  for (const inv of invitees) {
    if (!isVendoDomain(inv.email)) return false;
    const name = normaliseName(inv.name);
    if (!name) return false;
    const matched = SLT_ROSTER.find(
      (m) => m.name === name && m.email.test((inv.email || '').toLowerCase()),
    );
    if (!matched) return false;
  }
  return true;
}

export function classifyMeeting(
  title: string | null | undefined,
  invitees: ClassifierInvitee[] | null | undefined,
): ClassificationResult {
  const titleTrim = (title || '').trim();
  const titleParsed = !!titleTrim && titleTrim.toLowerCase() !== 'untitled';
  const inviteeList = (invitees || []).filter((i) => !!i);
  const attendeesParsed = inviteeList.length > 0;

  // 1. Title matches director pattern.
  if (titleParsed && DIRECTOR_TITLE_PATTERNS.some((p) => p.test(titleTrim))) {
    return { type: 'DIRECTOR', reason: 'Title matches Vendo director pattern' };
  }

  // 2. Attendees are exclusively SLT members (name + Vendo email verified).
  if (attendeesParsed && isDirectorOnlyAttendance(inviteeList)) {
    return { type: 'DIRECTOR', reason: 'Attendees are only SLT members' };
  }

  // 3. Title mentions SLT / Senior Leadership.
  if (titleParsed && SLT_TITLE_PATTERNS.some((p) => p.test(titleTrim))) {
    return { type: 'SLT', reason: 'Title mentions SLT / Senior Leadership' };
  }

  // 4. Nothing parseable — bail to manual review.
  if (!titleParsed && !attendeesParsed) {
    return { type: 'FAILSAFE', reason: 'Title and attendees both unparseable' };
  }

  return { type: 'STANDARD', reason: 'No classification rules matched' };
}
