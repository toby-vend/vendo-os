import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ContentBlockParam,
  Tool,
} from '@anthropic-ai/sdk/resources/messages/messages.js';

import type { ChatTurn, StructuredOutput, SuggestionScope } from './queries/suggestions.js';

// --- Model ---

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 1024;

// --- Tool definition ---

export const SUBMIT_SUGGESTION_TOOL: Tool = {
  name: 'submit_suggestion',
  description:
    'Call this tool ONCE you have enough detail across every field to hand the suggestion to a developer. ' +
    'Do not call it while fields are still vague — keep asking. Required coverage: problem, where in app, ' +
    'desired outcome, user journey, acceptance criteria, edge cases, priority signal.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short headline, 3-10 words.' },
      problem: { type: 'string', description: 'What pain does this solve? In the submitter\'s words.' },
      where_in_app: { type: 'string', description: 'Section(s) / route(s) affected.' },
      desired_outcome: { type: 'string', description: 'What "done" looks like.' },
      user_journey: {
        type: 'array',
        items: { type: 'string' },
        description: 'Step-by-step user flow. Empty array if non-UI.',
      },
      examples: { type: 'string', description: 'References to similar features or visual examples. Empty string if none.' },
      acceptance_criteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concrete checkable outcomes. Always provide 2-6.',
      },
      out_of_scope: { type: 'string', description: 'What is explicitly NOT part of this. Empty string if not discussed.' },
      edge_cases: { type: 'string', description: 'Unusual scenarios to consider. Empty string if none surfaced.' },
      priority_signal: { type: 'string', description: 'Urgency / impact in the submitter\'s words.' },
    },
    required: [
      'title',
      'problem',
      'where_in_app',
      'desired_outcome',
      'user_journey',
      'examples',
      'acceptance_criteria',
      'out_of_scope',
      'edge_cases',
      'priority_signal',
    ],
  },
};

// --- System prompt ---

export interface PromptContext {
  scope: SuggestionScope;
  pageUrl: string | null;
  pageLabel: string | null;
  submitterName: string;
  submitterRole: string;
  /** Human-readable list of existing app sections (label + href). */
  sections: Array<{ label: string; href: string }>;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sectionsList = ctx.sections.slice(0, 40).map(s => `- ${s.label} (${s.href})`).join('\n');

  const scopeBlock = ctx.scope === 'page'
    ? `The submitter opened the widget on **${ctx.pageLabel ?? ctx.pageUrl ?? 'an unknown page'}** (${ctx.pageUrl ?? 'unknown'}). They said this suggestion is about THIS page specifically, so you already know where in the app it lives — don't re-ask that.`
    : `The submitter chose site-wide scope, so this suggestion is not tied to one page. Confirm which area/section of the app it affects if it isn't obvious.`;

  return [
    `You are the Vendo OS Suggestions intake assistant. A team member (${ctx.submitterName}, role: ${ctx.submitterRole}) has an idea for improving the internal dashboard. Your job is to extract every detail a developer needs to hand this straight to Claude Code for implementation.`,
    ``,
    `Context — existing app sections you can reference by name:`,
    sectionsList || '(sections unavailable)',
    ``,
    scopeBlock,
    ``,
    `Rules:`,
    `- Ask ONE focused question per turn. 3–6 turns total. Never more than 6.`,
    `- Cover across the conversation: problem being solved, exact location in the app (if sitewide), desired outcome, step-by-step user journey, references to similar features, priority, acceptance criteria, edge cases.`,
    `- Anchor every question to specifics the submitter has already said or shown. Never ask a vague "can you tell me more?"`,
    `- If the submitter attaches an image, briefly describe what you can see back to them in your next question so they can correct any misreading. Ground follow-ups in what's visible (e.g. "I can see a red error banner at the top — is that the bug?").`,
    `- Keep responses short — 1–3 sentences. The question is the point.`,
    `- When you have enough, call the \`submit_suggestion\` tool with the structured JSON. Do NOT keep chatting after calling the tool. Do NOT summarise — just call the tool.`,
    `- Use UK English (colour, organise, behaviour).`,
  ].join('\n');
}

// --- Claude message assembly ---

/**
 * Convert our stored ChatTurn[] + new user turn (with attachments) into the
 * MessageParam[] the Anthropic SDK expects.
 *
 * `attachmentUrls` are the Vercel Blob URLs for images uploaded SINCE the last
 * assistant turn — they're attached to the *new* user turn so Claude sees them
 * alongside the user's text.
 */
export function buildMessages(params: {
  transcript: ChatTurn[];
  newUserMessage: string;
  newAttachmentUrls: string[];
}): MessageParam[] {
  const messages: MessageParam[] = params.transcript.map(turn => ({
    role: turn.role,
    content: turn.content,
  }));

  const content: ContentBlockParam[] = [];
  if (params.newUserMessage.trim()) {
    content.push({ type: 'text', text: params.newUserMessage });
  }
  for (const url of params.newAttachmentUrls) {
    content.push({
      type: 'image',
      source: { type: 'url', url },
    });
  }
  // If the only thing the user did was attach an image (no text), Claude still needs text context
  if (content.length === 0 || (content.length > 0 && !content.some(c => c.type === 'text'))) {
    content.unshift({ type: 'text', text: params.newAttachmentUrls.length > 0 ? '(See attached screenshot.)' : '(continue)' });
  }

  messages.push({ role: 'user', content });
  return messages;
}

// --- Turn handler ---

export interface TurnResult {
  kind: 'question' | 'submit';
  /** When kind='question': Claude's next question text. */
  question?: string;
  /** When kind='submit': the parsed structured output. */
  structured?: StructuredOutput;
}

const anthropicClient = (() => {
  let instance: Anthropic | null = null;
  return () => {
    if (!instance) instance = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return instance;
  };
})();

/**
 * Run one turn of the intake conversation. Returns either the assistant's next
 * question (for the UI to render) or the final structured output (when Claude
 * decides it has enough detail).
 *
 * Throws on missing API key or malformed SDK responses — caller should catch
 * and return a 500 with a user-friendly message.
 */
export async function runIntakeTurn(params: {
  systemPrompt: string;
  transcript: ChatTurn[];
  newUserMessage: string;
  newAttachmentUrls: string[];
  /** Attachment metadata for the structured output when Claude submits. */
  allAttachments: Array<{ url: string; filename: string | null; content_type: string }>;
  scope: SuggestionScope;
  pageUrl: string | null;
  pageLabel: string | null;
}): Promise<TurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = anthropicClient();

  const messages = buildMessages({
    transcript: params.transcript,
    newUserMessage: params.newUserMessage,
    newAttachmentUrls: params.newAttachmentUrls,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: params.systemPrompt,
    tools: [SUBMIT_SUGGESTION_TOOL],
    messages,
  });

  // Check for a tool_use block first — that's the "done" signal.
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'submit_suggestion') {
    const input = toolUse.input as Omit<StructuredOutput, 'scope' | 'page_url' | 'page_label' | 'attachments'>;
    const structured: StructuredOutput = {
      ...input,
      scope: params.scope,
      page_url: params.pageUrl,
      page_label: params.pageLabel,
      attachments: params.allAttachments.map(a => ({
        url: a.url,
        filename: a.filename ?? 'screenshot',
        content_type: a.content_type,
      })),
    };
    return { kind: 'submit', structured };
  }

  // Otherwise pick the text block.
  const textBlock = response.content.find(c => c.type === 'text');
  const question = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  if (!question) {
    throw new Error('Claude returned no text and no tool call');
  }
  return { kind: 'question', question };
}
