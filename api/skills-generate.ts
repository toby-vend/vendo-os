import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { parseCookies, verifySessionToken } from '../web/lib/auth.js';
import { rows, db } from '../web/lib/queries/base.js';
import { trackUsage } from '../web/lib/usage-tracker.js';

interface SkillRow {
  slug: string;
  title: string;
  description: string;
  content: string;
}

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
  vertical: string | null;
  services: string | null;
  am: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth check
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['vendo_session'];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const { skill, client_id, inputs } = req.body as {
    skill: string;
    client_id: number;
    inputs: Record<string, string>;
  };

  if (!skill || !client_id || !inputs) {
    res.status(400).json({ error: 'Missing skill, client_id, or inputs' });
    return;
  }

  // Load skill content from DB
  let skillRow: SkillRow;
  try {
    const skillRows = await rows<SkillRow>('SELECT slug, title, description, content FROM skills_library WHERE slug = ?', [skill]);
    if (!skillRows.length) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    skillRow = skillRows[0];
  } catch {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }

  // Load client data
  let client: ClientRow;
  try {
    const clientRows = await rows<ClientRow>(
      'SELECT id, COALESCE(display_name, name) as name, display_name, vertical, services, am FROM clients WHERE id = ?',
      [client_id],
    );
    if (!clientRows.length) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    client = clientRows[0];
  } catch {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  // Build system prompt from skill markdown content + client context
  const systemPrompt = `You are a specialist content generator for Vendo Digital, a marketing agency. You are executing the following skill for a specific client. Follow the instructions, output format, and quality checks exactly as described.

Use UK English throughout. Be specific and actionable — no placeholder text or generic filler.

=== SKILL INSTRUCTIONS ===

${skillRow.content}

=== CLIENT CONTEXT ===

Client: ${client.name}
Vertical: ${client.vertical || 'Not specified'}
Services: ${client.services || 'Not specified'}
Account Manager: ${client.am || 'Not specified'}`;

  // Build user message from inputs
  const inputLines = Object.entries(inputs)
    .filter(([key]) => key !== 'skill' && key !== 'client_id')
    .map(([key, value]) => `- **${key.replace(/_/g, ' ')}:** ${value}`)
    .join('\n');

  const userMessage = `Generate the ${skillRow.title} output for ${client.name}.\n\nInputs:\n${inputLines}`;

  // Stream response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const anthropic = new Anthropic({ apiKey });

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // Track usage
    try {
      const finalMessage = await stream.finalMessage();
      trackUsage({
        userId: payload.userId,
        model: 'claude-sonnet-4-6',
        feature: 'task_generation',
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      });
    } catch (trackErr) {
      console.error('[skills-generate] Failed to track usage:', trackErr);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: any) {
    console.error('[skills-generate] Stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Stream failed' })}\n\n`);
    res.end();
  }
}
