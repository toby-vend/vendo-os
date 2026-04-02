/**
 * SOP QA judge using Haiku LLM.
 *
 * runSOPCheck evaluates a draft against SOP content using claude-haiku.
 * Returns a pass/fail result with an optional critique string.
 *
 * The SOP content is capped at 1500 chars before being embedded in the
 * system prompt (defensive — Haiku context is large but be consistent).
 */

import Anthropic from '@anthropic-ai/sdk';
import { trackUsage } from './usage-tracker.js';

const SOP_CAP = 1500;

/**
 * Evaluate a draft against SOP content using a Haiku LLM judge.
 *
 * @param draftText - The serialised draft output to evaluate
 * @param sopContent - The SOP content the draft was generated against
 * @returns { pass: true, critique: null } if the draft meets SOP criteria,
 *          { pass: false, critique: "..." } if it fails with issue details
 */
export async function runSOPCheck(
  draftText: string,
  sopContent: string,
  userId: string | null = null,
): Promise<{ pass: boolean; critique: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — cannot call Haiku for QA check');
  }

  // Cap SOP content to avoid bloating the prompt
  const cappedSop =
    sopContent.length > SOP_CAP ? sopContent.slice(0, SOP_CAP) : sopContent;

  const systemPrompt = `You are a QA judge for marketing content. Your job is to evaluate whether a draft meets the SOP (Standard Operating Procedure) criteria.

## SOPs
${cappedSop}

## Evaluation Criteria
Evaluate the draft against:
1. Adherence to SOP instructions and guidelines
2. Correct output structure and format
3. Completeness of required fields
4. Character limit compliance (where specified in SOPs)
5. Tone and style alignment with SOP requirements

## Response Format
Respond with a JSON object in this exact format:
{
  "pass": boolean,
  "issues": [
    {
      "criterion": "name of the criterion that failed",
      "description": "specific description of what failed and why"
    }
  ]
}

If the draft passes all criteria, set "pass": true and "issues": [].
If the draft fails any criteria, set "pass": false and list each issue.`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Evaluate this draft:\n\n${draftText}` }],
    // @ts-expect-error — output_config is not yet in the SDK types
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            pass: { type: 'boolean' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterion: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['criterion', 'description'],
                additionalProperties: false,
              },
            },
          },
          required: ['pass', 'issues'],
          additionalProperties: false,
        },
      },
    },
  });

  // Track token usage
  trackUsage({
    userId,
    model: 'claude-haiku-4-5-20251001',
    feature: 'qa_check',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const textBlock = response.content.find(
    (b: { type: string }) => b.type === 'text',
  ) as { type: 'text'; text: string } | undefined;

  if (!textBlock) {
    throw new Error('No text block in Haiku QA response');
  }

  const parsed = JSON.parse(textBlock.text) as {
    pass: boolean;
    issues: Array<{ criterion: string; description: string }>;
  };

  if (parsed.pass) {
    return { pass: true, critique: null };
  }

  // Serialise issues into a human-readable critique string
  const critique = parsed.issues
    .map(issue => `[${issue.criterion}] ${issue.description}`)
    .join('\n');

  return { pass: false, critique };
}
