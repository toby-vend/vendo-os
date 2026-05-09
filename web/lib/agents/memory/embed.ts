/**
 * Embedding wrapper — single source of truth for going from text to a
 * 1536-dim vector. Routes through Vercel AI Gateway via plain
 * provider/model slug (no @ai-sdk/openai dependency).
 *
 * Returns plain `number[]` per input. On failure (gateway down, missing
 * key, value too long, etc.) the corresponding slot is `null` so callers
 * can decide whether to skip or retry — we never throw at this layer
 * because the seed script processes thousands of values and one bad row
 * shouldn't abort the whole job.
 */
import { embedMany } from 'ai';
import { EMBEDDING_MODEL } from '../models.js';

export const EMBEDDING_DIM = 1536;

/**
 * Maximum characters per text passed to the embedder. text-embedding-3-small
 * has an 8192-token context (~32k chars at 4 chars/token) but agents
 * typically only need salient passages, and shorter inputs embed faster.
 * Anything longer is truncated; the seed script chunks at the source.
 */
export const EMBEDDING_MAX_CHARS = 16000;

export async function embedTexts(values: string[]): Promise<(number[] | null)[]> {
  if (values.length === 0) return [];
  const truncated = values.map(v => (v.length > EMBEDDING_MAX_CHARS ? v.slice(0, EMBEDDING_MAX_CHARS) : v));
  try {
    const result = await embedMany({
      model: EMBEDDING_MODEL,
      values: truncated,
    });
    return result.embeddings.map(e => Array.from(e));
  } catch (err: unknown) {
    console.error(
      '[agent-memory] embedMany failed:',
      err instanceof Error ? err.message : String(err),
    );
    return values.map(() => null);
  }
}

export async function embedOne(value: string): Promise<number[] | null> {
  const [vec] = await embedTexts([value]);
  return vec ?? null;
}

/**
 * Serialise a number[] to the JSON string libSQL's `vector()` accepts.
 * The vector must be exactly EMBEDDING_DIM elements; throws otherwise so
 * mismatched dimensions never silently land in the DB.
 */
export function serialiseVector(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `vector dim mismatch: got ${vec.length}, expected ${EMBEDDING_DIM}`,
    );
  }
  return '[' + vec.join(',') + ']';
}
