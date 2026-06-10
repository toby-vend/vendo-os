/**
 * Re-match unmatched meetings against the configured DB (Turso in prod when
 * TURSO_DATABASE_URL is set, local data/vendo.db otherwise).
 *
 * Why this exists: the real-time Fathom webhook path (web/routes/
 * fathom-webhook.ts → enrichMeeting) runs only the deterministic waterfall —
 * the AI fallback is deliberately disabled there for latency. Meetings that
 * don't match deterministically stay unmatched forever, so client reports
 * silently lose their meeting context (narrative-context.ts links meetings to
 * reports via meetings.client_name).
 *
 * This script runs the FULL waterfall (including the Haiku AI fallback) over
 * unmatched, non-internal meetings and writes back any matches it finds.
 * It never overwrites an existing client_name.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/matching/rematch-meetings.ts            # last 90 days
 *   node --env-file=.env.local --import tsx/esm scripts/matching/rematch-meetings.ts --all      # entire table
 *   node --env-file=.env.local --import tsx/esm scripts/matching/rematch-meetings.ts --dry-run  # report only
 */
import { db, rows } from '../../web/lib/queries/base.js';
import { getMatchContext } from '../../web/lib/meeting-enrichment.js';
import { matchMeeting } from './waterfall-matcher.js';
import type { MeetingData } from './types.js';

const ALL = process.argv.includes('--all');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Words too generic to verify an AI match on their own. Includes our own
 * brand — an AI match to "Vendo Digital" is a recruitment/internal call,
 * not a client call.
 */
const GENERIC_WORDS = new Set([
  'dental', 'dentistry', 'dentists', 'practice', 'clinic', 'wellness',
  'group', 'studio', 'limited', 'ltd', 'llp', 'company', 'services',
  'associates', 'health', 'care', 'vendo', 'digital', 'monthly', 'media',
]);

/**
 * Hallucination gate for AI matches: the dry run showed Haiku guessing a
 * favourite client for person-name-only meetings (e.g. "X and Max Rivens" →
 * DK Dental). Accept an AI match only when a distinctive word from the
 * client's name actually appears in the meeting title or summary.
 */
function aiMatchVerified(clientName: string, m: { title: string; summary: string | null }): boolean {
  const haystack = `${m.title} ${m.summary ?? ''}`.toLowerCase();
  const tokens = clientName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !GENERIC_WORDS.has(w));
  return tokens.some(t => haystack.includes(t));
}

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  summary: string | null;
  transcript: string | null;
  calendar_invitees: string | null;
  raw_action_items: string | null;
  invitee_domains_type: string | null;
}

/** Normalise for canonical-name comparison (mirrors build-match-context). */
function normForCompare(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|inc|uk|t\/a)\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a matched name to the canonical clients.name. Some strategies
 * (attendee_name, GHL-derived lookups) return near-miss names like
 * "Thornbury Dental Wellness" for the client "Thornbury Dental Wellness
 * Clinic" — reports link meetings by exact clients.name, so a near-miss is
 * as bad as no match. Exact match wins; otherwise a unique prefix-normalised
 * match; otherwise keep the original.
 */
async function canonicaliseClientName(name: string): Promise<string> {
  const exact = await rows<{ name: string }>(`SELECT name FROM clients WHERE name = ? LIMIT 1`, [name]);
  if (exact.length) return name;

  const all = await rows<{ name: string }>(`SELECT name FROM clients`);
  const target = normForCompare(name);
  if (!target) return name;
  const hits = all.filter(c => {
    const cn = normForCompare(c.name);
    return cn === target || cn.startsWith(`${target} `) || target.startsWith(`${cn} `);
  });
  return hits.length === 1 ? hits[0].name : name;
}

async function main() {
  const dateFilter = ALL ? '' : "AND date >= date('now', '-90 days')";
  const meetings = await rows<MeetingRow>(
    `SELECT id, title, date, summary, transcript, calendar_invitees,
            raw_action_items, invitee_domains_type
     FROM meetings
     WHERE (client_name IS NULL OR length(trim(client_name)) = 0)
       AND COALESCE(match_method, 'unmatched') != 'internal'
       ${dateFilter}
     ORDER BY date DESC`,
  );
  console.log(`${meetings.length} unmatched meetings to re-match${DRY_RUN ? ' (dry run)' : ''}`);

  const ctx = await getMatchContext();
  let matched = 0;
  let internal = 0;
  let stillUnmatched = 0;

  for (const m of meetings) {
    const data: MeetingData = {
      id: m.id,
      title: m.title,
      summary: m.summary,
      transcript: m.transcript,
      calendar_invitees: m.calendar_invitees,
      raw_action_items: m.raw_action_items,
      invitee_domains_type: m.invitee_domains_type,
    };

    let result;
    try {
      result = await matchMeeting(data, ctx);
    } catch (err) {
      console.error(`  ✗ ${m.id} "${m.title}": ${err instanceof Error ? err.message : err}`);
      continue;
    }

    if (result.method === 'internal') {
      internal++;
      if (!DRY_RUN) {
        await db.execute({
          sql: `UPDATE meetings SET match_method = 'internal', match_confidence = 'high', needs_review = 0 WHERE id = ?`,
          args: [m.id],
        });
      }
      continue;
    }

    if (!result.client_name) {
      stillUnmatched++;
      continue;
    }

    if (result.method === 'ai' && !aiMatchVerified(result.client_name, m)) {
      console.log(
        `  ? ${m.date.slice(0, 10)} "${m.title}" → ${result.client_name} ` +
        `[ai/unverified — name not in title/summary, skipped]`,
      );
      stillUnmatched++;
      continue;
    }

    const canonicalName = await canonicaliseClientName(result.client_name);

    matched++;
    console.log(
      `  ✓ ${m.date.slice(0, 10)} "${m.title}" → ${canonicalName} ` +
      `[${result.method}/${result.confidence}]` +
      (canonicalName !== result.client_name ? ` (canonicalised from "${result.client_name}")` : ''),
    );
    if (!DRY_RUN) {
      await db.execute({
        sql: `UPDATE meetings
              SET client_name = ?, match_method = ?, match_confidence = ?,
                  needs_review = ?
              WHERE id = ? AND (client_name IS NULL OR length(trim(client_name)) = 0)`,
        args: [
          canonicalName,
          result.method,
          result.confidence,
          result.confidence === 'high' ? 0 : 1,
          m.id,
        ],
      });
    }
  }

  console.log(`\nDone: ${matched} matched, ${internal} marked internal, ${stillUnmatched} still unmatched.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
