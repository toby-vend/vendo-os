/**
 * Pre-load a Client Knowledge briefing into the conversation history when
 * the user's latest message mentions a known client by name.
 *
 * The agent's system prompt instructs it to trust pre-loaded briefings and
 * skip the redundant tool call. This means a single user turn like "How is
 * Kana doing this week?" arrives at the model with the briefing already in
 * context — no tool-use round-trip needed.
 *
 * Implementation: detect → fetch → prepend a synthetic assistant message
 * before the user's current turn, carrying the briefing markdown.
 */
import type { UIMessage } from 'ai';
import { detectClients, type ClientMatch } from './client-detect.js';
import { generateBriefing } from '../client-knowledge/briefing.js';
import { renderBriefingMarkdown } from '../client-knowledge/render.js';

const PRELOAD_HEADER = '[Auto-detected client context — pre-loaded by the runtime]';
const MAX_BRIEFINGS_PER_TURN = 2;

interface UIMessageWithParts {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  parts?: Array<{ type: string; text?: string }>;
  content?: string | unknown;
}

function extractUserText(message: UIMessageWithParts): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('\n');
  }
  return '';
}

/**
 * If the latest user message mentions any known client, fetch their
 * briefings and prepend them as synthetic assistant messages.
 *
 * Returns the (possibly modified) messages array and the list of clients
 * pre-loaded (for audit logging by the caller).
 */
export async function preloadClientContext(
  uiMessages: UIMessage[],
): Promise<{ messages: UIMessage[]; preloaded: ClientMatch[] }> {
  if (uiMessages.length === 0) return { messages: uiMessages, preloaded: [] };

  // Find the last user message
  let lastUserIdx = -1;
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    if ((uiMessages[i] as UIMessageWithParts).role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return { messages: uiMessages, preloaded: [] };

  const lastUserText = extractUserText(uiMessages[lastUserIdx] as UIMessageWithParts);
  if (!lastUserText.trim()) return { messages: uiMessages, preloaded: [] };

  const matches = await detectClients(lastUserText, MAX_BRIEFINGS_PER_TURN);
  if (matches.length === 0) return { messages: uiMessages, preloaded: [] };

  // Fetch briefings (60s cached). Tolerate individual failures.
  const briefings: { match: ClientMatch; markdown: string }[] = [];
  for (const m of matches) {
    try {
      const b = await generateBriefing(m.id);
      if (b) briefings.push({ match: m, markdown: renderBriefingMarkdown(b) });
    } catch (err) {
      console.error(
        '[preload-client-context] briefing failed for',
        m.id,
        m.name,
        ':',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  if (briefings.length === 0) return { messages: uiMessages, preloaded: [] };

  // Build synthetic assistant messages — one per client briefing.
  const synthetic: UIMessage[] = briefings.map((b, idx) => ({
    id: `preload-${Date.now()}-${idx}`,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text:
          `${PRELOAD_HEADER}\n\n` +
          `The user appears to be asking about **${b.match.name}** ` +
          `(matched "${b.match.matched}"). The current client briefing follows ` +
          `— treat it as authoritative context and answer grounded in it; ` +
          `do not re-call getClientBriefing for this client unless you need ` +
          `data not in the briefing.\n\n---\n\n` +
          b.markdown,
      },
    ],
  })) as unknown as UIMessage[];

  // Insert synthetic messages just before the latest user message.
  const out: UIMessage[] = [
    ...uiMessages.slice(0, lastUserIdx),
    ...synthetic,
    ...uiMessages.slice(lastUserIdx),
  ];

  return {
    messages: out,
    preloaded: briefings.map((b) => b.match),
  };
}
