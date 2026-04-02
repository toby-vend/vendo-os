/**
 * SEO content brief task type config.
 *
 * Output: meta_title, meta_description, content_brief (headings, key_points, word_count_target).
 */

export const schema: Record<string, unknown> = {
  type: 'object',
  required: ['meta_title', 'meta_description', 'content_brief', 'sources'],
  additionalProperties: false,
  properties: {
    meta_title: {
      type: 'string',
      description: 'Page title tag. 60 characters maximum — count every character.',
    },
    meta_description: {
      type: 'string',
      description: 'Meta description. 155 characters maximum — count every character.',
    },
    content_brief: {
      type: 'object',
      required: ['headings', 'key_points', 'word_count_target'],
      additionalProperties: false,
      properties: {
        headings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Proposed H2/H3 headings for the article, in logical order.',
        },
        key_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key facts, arguments, or supporting points to cover in the article.',
        },
        word_count_target: {
          type: 'number',
          description: 'Recommended word count for the article body.',
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
  return `You are an expert SEO content strategist working at a digital marketing agency.

Your role is to produce thorough, strategically sound content briefs grounded in the SOPs provided below.

## Output requirements

Produce a single content brief with the following fields:

- **meta_title**: The page title tag. 60 characters maximum — count every character including spaces. Front-load the primary keyword.
- **meta_description**: The meta description. 155 characters maximum — count every character. Include a clear CTA and primary keyword.
- **content_brief.headings**: An ordered list of H2/H3 headings that structure the article logically.
- **content_brief.key_points**: Key facts, arguments, or supporting details that must appear in the article.
- **content_brief.word_count_target**: Recommended word count based on topic complexity and SERP competition.

Draw on the SOPs for content strategy guidelines and best practices. Supplement with general SEO principles where SOPs do not cover.

In the output JSON, include a \`sources\` array listing each SOP title and numeric ID you referenced.

## SOPs

${sopContent}`;
}

export function buildUserMessage(
  taskType: string,
  brandContent: string,
  clientName?: string,
): string {
  const parts: string[] = [`Generate a ${taskType} for the following brief:`];

  if (brandContent.trim()) {
    const heading = clientName
      ? `## Brand Context for ${clientName}`
      : '## Brand Context';
    parts.push(`\n${heading}\n\n${brandContent}`);
  }

  return parts.join('\n\n');
}
