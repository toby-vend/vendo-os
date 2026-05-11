/**
 * Detect client mentions in inbound agent messages.
 *
 * Used by the agent runtime (api/agent/chat.ts) to pre-load a client
 * briefing as a synthetic tool result before the model runs, so any
 * client-scoped conversation arrives with full context already in the
 * message history. The agent's system prompt instructs it to trust a
 * pre-loaded briefing and skip the redundant tool call.
 *
 * Match rules:
 *   - case-insensitive substring match against clients.name +
 *     clients.display_name + every value in clients.aliases (JSON array)
 *   - candidate strings under 3 chars are skipped (too noisy)
 *   - longest match wins (so "Smile Dental Group" beats "Smile Dental")
 *   - on tie, no match is returned (let the agent call searchClients)
 *   - returns up to N matches for multi-client messages (capped 2)
 *
 * Performance: client list cached in-memory for 60s. One DB query per
 * cache miss; lookup is O(clients × candidates) but typically <1ms for
 * 200 clients.
 */
import { rows } from '../queries/base.js';

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
  aliases: string | null; // JSON array
}

export interface ClientMatch {
  id: number;
  name: string;
  matched: string;     // the literal string in the message that matched
  needle: string;      // the canonical client label we matched against
}

interface LookupEntry {
  id: number;
  name: string;
  needles: string[];   // lowercase variants we look for
}

const CACHE_TTL_MS = 60_000;
let cachedTable: { entries: LookupEntry[]; loadedAt: number } | null = null;

async function loadClientTable(): Promise<LookupEntry[]> {
  if (cachedTable && Date.now() - cachedTable.loadedAt < CACHE_TTL_MS) {
    return cachedTable.entries;
  }

  const records = await rows<ClientRow>(
    `SELECT id, name, display_name, aliases
     FROM clients
     WHERE COALESCE(status, 'active') = 'active'`,
  );

  const entries: LookupEntry[] = [];
  for (const r of records) {
    const candidates = new Set<string>();
    if (r.name) candidates.add(r.name.toLowerCase().trim());
    if (r.display_name) candidates.add(r.display_name.toLowerCase().trim());
    if (r.aliases) {
      try {
        const arr = JSON.parse(r.aliases) as unknown;
        if (Array.isArray(arr)) {
          for (const a of arr) {
            if (typeof a === 'string' && a.trim()) {
              candidates.add(a.toLowerCase().trim());
            }
          }
        }
      } catch {
        /* ignore malformed aliases */
      }
    }
    const needles = [...candidates].filter((s) => s.length >= 3);
    if (needles.length > 0) {
      entries.push({
        id: r.id,
        name: r.display_name?.trim() || r.name.trim(),
        needles,
      });
    }
  }

  cachedTable = { entries, loadedAt: Date.now() };
  return entries;
}

/**
 * Optional cache nuke (call from admin tools after creating / renaming a
 * client so detection picks up the change immediately).
 */
export function invalidateClientCache(): void {
  cachedTable = null;
}

/**
 * Detect up to `max` distinct clients mentioned in the input text.
 * Returns an empty array if no confident match.
 */
export async function detectClients(text: string, max = 2): Promise<ClientMatch[]> {
  if (!text || text.length < 3) return [];
  const haystack = text.toLowerCase();
  const entries = await loadClientTable();

  // Pass 1: for each client, find the longest needle that appears in the haystack
  const hits: { entry: LookupEntry; needle: string; pos: number }[] = [];
  for (const entry of entries) {
    let best: { needle: string; pos: number } | null = null;
    for (const n of entry.needles) {
      const pos = haystack.indexOf(n);
      if (pos === -1) continue;
      if (!best || n.length > best.needle.length) {
        best = { needle: n, pos };
      }
    }
    if (best) hits.push({ entry, needle: best.needle, pos: best.pos });
  }
  if (hits.length === 0) return [];

  // Sort by needle length descending (longest match wins for overlapping clients)
  hits.sort((a, b) => b.needle.length - a.needle.length);

  // Dedupe overlapping ranges in the original text — if "Smile Dental Group"
  // matched, don't also surface the shorter "Smile Dental" as a separate hit.
  const claimedRanges: { start: number; end: number }[] = [];
  const accepted: ClientMatch[] = [];
  for (const hit of hits) {
    const start = hit.pos;
    const end = hit.pos + hit.needle.length;
    const overlap = claimedRanges.some((r) => !(end <= r.start || start >= r.end));
    if (overlap) continue;
    claimedRanges.push({ start, end });
    accepted.push({
      id: hit.entry.id,
      name: hit.entry.name,
      matched: text.slice(start, end),
      needle: hit.needle,
    });
    if (accepted.length >= max) break;
  }

  return accepted;
}
