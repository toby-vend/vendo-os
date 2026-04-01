/**
 * Strategy 6: AI-assisted classification.
 * Uses Claude Haiku to identify the client from title + summary.
 * Only called when all deterministic strategies fail.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MatchResult, MeetingData, MatchContext } from '../types.js';
import { normaliseName } from '../build-match-context.js';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

export async function match(meeting: MeetingData, ctx: MatchContext): Promise<MatchResult | null> {
  const client = getClient();
  if (!client) return null;
  if (ctx.allClientNames.length === 0) return null;

  const summarySnippet = meeting.summary ? meeting.summary.slice(0, 500) : '';
  if (!summarySnippet && !meeting.title) return null;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      temperature: 0,
      system: 'You are a meeting classifier for Vendo Digital, a UK digital marketing agency. Given a meeting title and summary, identify which client company the meeting is about. Respond with ONLY the client name exactly as it appears in the known clients list, or INTERNAL for team meetings, or UNKNOWN if you cannot determine.',
      messages: [{
        role: 'user',
        content: `Title: ${meeting.title}\nSummary: ${summarySnippet}\n\nKnown clients:\n${ctx.allClientNames.join('\n')}`,
      }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    if (!text || text === 'UNKNOWN') return null;

    if (text === 'INTERNAL') {
      return {
        client_name: null,
        confidence: 'low',
        method: 'ai',
        evidence: { ai_response: 'INTERNAL' },
      };
    }

    // Verify AI response matches a known client
    const norm = normaliseName(text);
    const matched = ctx.clientNameLookup.get(norm);
    if (!matched) {
      // Try substring match
      for (const [key, canonical] of ctx.clientNameLookup) {
        if (key.includes(norm) || norm.includes(key)) {
          return {
            client_name: canonical,
            confidence: 'low',
            method: 'ai',
            evidence: { ai_response: text, matched_to: canonical },
          };
        }
      }
      return null; // AI suggested unknown client
    }

    return {
      client_name: matched,
      confidence: 'low',
      method: 'ai',
      evidence: { ai_response: text },
    };
  } catch {
    return null; // API failure — don't block the pipeline
  }
}
