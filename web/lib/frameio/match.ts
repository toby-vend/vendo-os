import { db } from '../queries/base.js';

/**
 * Frame.io project name → VendoOS client matcher.
 *
 * Algorithm: normalise both sides (lowercase, strip punctuation/legal-suffixes,
 * collapse whitespace), then score by:
 *   1. exact normalised match            → 1.00
 *   2. one is a prefix/suffix of the other
 *      (after token boundary)            → 0.92
 *   3. Jaccard token overlap             → 0..0.85
 *
 * Anything ≥ AUTO_MATCH_THRESHOLD is auto-applied. Below that, the project
 * stays unmapped and surfaces in the admin queue for manual review.
 */

const AUTO_MATCH_THRESHOLD = 0.85;
const STOP_TOKENS = new Set([
  'ltd', 'limited', 'inc', 'incorporated', 'llc', 'gmbh', 'plc', 'co', 'corp',
  'group', 'holdings', 'the', 'and', '&',
]);

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')           // strip apostrophes
    .replace(/[^a-z0-9\s-]/g, ' ')        // strip other punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(name: string): Set<string> {
  return new Set(
    normalise(name)
      .split(/[\s-]+/)
      .filter((t) => t && !STOP_TOKENS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface ClientCandidate {
  id: number;
  name: string;
  aliases: string | null;
}

export interface MatchResult {
  clientId: number;
  clientName: string;
  confidence: number;
  method: 'exact' | 'prefix' | 'token_overlap';
  autoApplied: boolean;
}

export async function findBestClientMatch(projectName: string): Promise<MatchResult | null> {
  const r = await db.execute('SELECT id, name, aliases FROM clients');
  const candidates = r.rows as unknown as ClientCandidate[];
  if (candidates.length === 0) return null;

  const projNorm = normalise(projectName);
  const projTokens = tokens(projectName);
  let best: MatchResult | null = null;

  for (const c of candidates) {
    const names = [c.name];
    if (c.aliases) {
      try {
        const parsed = JSON.parse(c.aliases) as unknown;
        if (Array.isArray(parsed)) for (const a of parsed) if (typeof a === 'string') names.push(a);
      } catch {
        // aliases stored as plain string fallback
        for (const a of c.aliases.split(/[,;|]/)) if (a.trim()) names.push(a.trim());
      }
    }

    for (const candidateName of names) {
      const candNorm = normalise(candidateName);
      if (!candNorm) continue;

      // Exact (normalised) match
      if (candNorm === projNorm) {
        return {
          clientId: c.id,
          clientName: c.name,
          confidence: 1.0,
          method: 'exact',
          autoApplied: true,
        };
      }

      // Prefix / suffix at token boundary
      if (
        (candNorm.startsWith(projNorm + ' ') || candNorm.endsWith(' ' + projNorm) ||
         projNorm.startsWith(candNorm + ' ') || projNorm.endsWith(' ' + candNorm))
      ) {
        const score = 0.92;
        if (!best || score > best.confidence) {
          best = {
            clientId: c.id,
            clientName: c.name,
            confidence: score,
            method: 'prefix',
            autoApplied: score >= AUTO_MATCH_THRESHOLD,
          };
        }
      }

      // Token overlap (Jaccard)
      const score = jaccard(projTokens, tokens(candidateName));
      if (score > 0 && (!best || score > best.confidence)) {
        best = {
          clientId: c.id,
          clientName: c.name,
          confidence: score,
          method: 'token_overlap',
          autoApplied: score >= AUTO_MATCH_THRESHOLD,
        };
      }
    }
  }

  return best;
}

export const _testing = { normalise, tokens, jaccard, AUTO_MATCH_THRESHOLD };
