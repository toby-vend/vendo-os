/**
 * Model registry — the agent runtime hands these slugs straight to ai SDK 6,
 * which routes through Vercel AI Gateway when OIDC / AI_GATEWAY_API_KEY is
 * available, otherwise falls back to the provider's own SDK + env var.
 *
 * Three tiers, picked by complexity rather than vendor:
 *   - HAIKU   — routing, classification, structured-output passes (low cost)
 *   - SONNET  — default for conversation + tool use (quality / cost balance)
 *   - OPUS    — daily synthesis, deep reasoning (most expensive; reserved
 *               for agents that genuinely benefit from it, e.g. Daily Brief)
 *
 * Model IDs follow the gateway's `<provider>/<model>` convention. Keep this
 * file as the single source of truth — agents reference MODELS.* not raw
 * strings, so a model bump is one edit here.
 */

export const MODELS = {
  HAIKU: 'anthropic/claude-haiku-4.5',
  SONNET: 'anthropic/claude-sonnet-4.6',
  OPUS: 'anthropic/claude-opus-4.6',
} as const;

export type ModelSlug = (typeof MODELS)[keyof typeof MODELS];

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

/** Resolve a tier to its current canonical slug. Use this in agent defs
 *  rather than hard-coding the slug, so a tier-wide swap is one change. */
export function modelFor(tier: ModelTier): ModelSlug {
  switch (tier) {
    case 'haiku':
      return MODELS.HAIKU;
    case 'sonnet':
      return MODELS.SONNET;
    case 'opus':
      return MODELS.OPUS;
  }
}

/**
 * Embedding model — used by the long-term vector memory in Block 5.
 * 1536 dimensions to match agent_memory_chunks.embedding column.
 */
export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
