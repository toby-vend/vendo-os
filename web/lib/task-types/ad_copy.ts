/**
 * Paid social (Meta) ad copy task type config.
 *
 * Output: 3–5 variants, each with primary_text, headline, description, call_to_action.
 */

export const schema: Record<string, unknown> = {
  type: 'object',
  required: ['variants', 'sources'],
  additionalProperties: false,
  properties: {
    variants: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['primary_text', 'headline', 'description', 'call_to_action'],
        additionalProperties: false,
        properties: {
          primary_text: {
            type: 'string',
            description: 'Main body copy. Typically 125 characters or fewer for best truncation.',
          },
          headline: {
            type: 'string',
            description: 'Feed headline. 40 characters max to avoid truncation in most placements.',
          },
          description: {
            type: 'string',
            description: 'Link description below headline. 30 characters max.',
          },
          call_to_action: {
            type: 'string',
            description: 'CTA button label. Use standard Meta options e.g. Learn More, Shop Now.',
          },
        },
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title'],
        additionalProperties: false,
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
        },
      },
    },
  },
};

export function buildSystemPrompt(sopContent: string): string {
  return `You are an expert paid social copywriter working at a digital marketing agency.

Your role is to produce high-converting Meta ad copy variants that are grounded in the SOPs provided below.

## Output requirements

Produce 3–5 distinct ad copy variants. For each variant:

- **primary_text**: Main body copy. Aim for 125 characters or fewer — Meta truncates longer text in most placements.
- **headline**: Feed headline. 40 characters maximum — count every character including spaces.
- **description**: Link description. 30 characters maximum — count every character.
- **call_to_action**: Standard Meta CTA label (e.g. "Learn More", "Shop Now", "Book Now").

Variations must differ meaningfully in angle, not just word substitution. Draw on the SOPs for structure and best practices. Supplement with general direct-response principles where SOPs do not cover.

In the output JSON, include a \`sources\` array listing each SOP title and numeric ID you referenced.

## SOPs

${sopContent}`;
}

export function buildUserMessage(
  taskType: string,
  brandContent: string,
  clientName?: string,
): string {
  const parts: string[] = [`Generate ${taskType} variants for the following brief:`];

  if (brandContent.trim()) {
    const heading = clientName
      ? `## Brand Context for ${clientName}`
      : '## Brand Context';
    parts.push(`\n${heading}\n\n${brandContent}`);
  }

  return parts.join('\n\n');
}
