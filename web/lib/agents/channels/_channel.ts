/**
 * Channel interface — the surface every adapter (web/Slack/Telegram)
 * implements. Channels are renderers + delivery mechanisms; they do not
 * create recommendation rows. Callers persist a recommendation via
 * web/lib/agents/recommendations.create() first, then ask the channel to
 * deliver an ApprovalCard built from that row.
 *
 * The interface lives in web/lib/agents/types — re-exported here so all
 * channel code imports from a single namespace.
 */
export type {
  Channel,
  ApprovalCard,
  ApprovalCardField,
  ChannelName,
} from '../types';

import type { ApprovalCard } from '../types';
import type { RecommendationRow } from '../types';

// ---------------------------------------------------------------------------
// recToCard — turn a recommendation row into the channel-facing ApprovalCard.
// Renders payload as alphabetised key→value fields (truncated to 200 chars
// each so a Slack/Telegram message stays compact). Source links are parsed
// from the rec.source_links JSON column.
// ---------------------------------------------------------------------------

export function recToCard(rec: RecommendationRow): ApprovalCard {
  const fields = payloadToFields(rec.payload);
  const sourceLinks = parseSourceLinks(rec.source_links);
  return {
    id: rec.id,
    title: rec.title,
    reasoning: rec.reasoning,
    fields,
    sourceLinks,
    expiresAt: rec.expires_at ?? undefined,
  };
}

function payloadToFields(payloadJson: string): ApprovalCard['fields'] {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return [{ label: 'payload', value: payloadJson.slice(0, 200) }];
  }

  return Object.entries(obj)
    .filter(([k]) => k !== 'mode') // mode is a runtime field, not a user-facing detail
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({
      label,
      value: stringifyForCard(value),
    }));
}

function parseSourceLinks(json: string | null): ApprovalCard['sourceLinks'] {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as { label: string; url: string }[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringifyForCard(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.length > 200 ? v.slice(0, 197) + '...' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 197) + '...' : s;
  } catch {
    return '[unserialisable]';
  }
}

// ---------------------------------------------------------------------------
// Permanent log line shape used by all channels so observability stays
// consistent. Channels call `logChannel('slack', 'requestApproval', { ... })`.
// ---------------------------------------------------------------------------

export function logChannel(
  channel: 'web' | 'slack' | 'telegram',
  op: string,
  details: Record<string, unknown> = {},
): void {
  console.log(`[channel:${channel}] ${op}`, details);
}
