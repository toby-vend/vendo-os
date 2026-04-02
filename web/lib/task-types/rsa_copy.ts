/**
 * Paid ads (Google Ads) RSA copy task type config.
 *
 * Output: headlines array, descriptions array, optional sitelink_extensions.
 */

export const schema: Record<string, unknown> = {
  type: 'object',
  required: ['headlines', 'descriptions', 'sources'],
  additionalProperties: false,
  properties: {
    headlines: {
      type: 'array',
      minItems: 3,
      maxItems: 15,
      items: {
        type: 'string',
        description: 'RSA headline. 30 characters MAXIMUM — count every character including spaces.',
      },
    },
    descriptions: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'string',
        description:
          'RSA description. 90 characters MAXIMUM — count every character including spaces.',
      },
    },
    sitelink_extensions: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        required: ['title', 'description'],
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
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
  return `You are an expert Google Ads copywriter working at a digital marketing agency.

Your role is to produce Responsive Search Ad (RSA) copy grounded in the SOPs provided below.

## CRITICAL: Character limits

Google Ads enforces hard character limits. Every character counts — including spaces and punctuation.

- **Headlines: 30 characters maximum each.** Before writing each headline, count: if it exceeds 30 characters, it will be rejected. Aim for 25–30 characters.
- **Descriptions: 90 characters maximum each.** Count carefully. Aim for 80–90 characters.

Do not exceed these limits under any circumstances.

## Output requirements

Produce RSA copy with:

- **headlines**: 3–15 headlines (minimum 3 required, 15 maximum). Each must be ≤ 30 characters. Write headlines that are distinct in angle (benefit, feature, social proof, urgency, question) so Google can test combinations effectively.
- **descriptions**: 2–4 descriptions. Each must be ≤ 90 characters. Include a clear benefit and CTA.
- **sitelink_extensions**: Optional array of sitelink title + description pairs. Leave as empty array if not applicable.

Draw on the SOPs for messaging strategy and best practices. Supplement with general PPC principles where SOPs do not cover.

In the output JSON, include a \`sources\` array listing each SOP title and numeric ID you referenced.

## SOPs

${sopContent}`;
}

export function buildUserMessage(
  taskType: string,
  brandContent: string,
  clientName?: string,
): string {
  const parts: string[] = [`Generate ${taskType} for the following brief:`];

  if (brandContent.trim()) {
    const heading = clientName
      ? `## Brand Context for ${clientName}`
      : '## Brand Context';
    parts.push(`\n${heading}\n\n${brandContent}`);
  }

  return parts.join('\n\n');
}
