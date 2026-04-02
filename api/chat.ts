import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { parseCookies, verifySessionToken } from '../web/lib/auth.js';
import { getSystemPrompt } from '../web/lib/chat-context.js';
import { trackUsage, enforceLimit } from '../web/lib/usage-tracker.js';

const MAX_HISTORY = 20;

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
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Enforce token limit
  const limitCheck = await enforceLimit(payload.userId);
  if (!limitCheck.allowed) {
    res.status(429).json({ error: 'limit_reached', message: limitCheck.message });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const { messages } = req.body as { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array required' });
    return;
  }

  // Cap history
  const trimmed = messages.slice(-MAX_HISTORY);

  const client = new Anthropic({ apiKey });
  const systemPrompt = getSystemPrompt();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5-20241022',
      max_tokens: 2048,
      system: systemPrompt,
      messages: trimmed,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // Track token usage after stream completes
    try {
      const finalMessage = await stream.finalMessage();
      trackUsage({
        userId: payload.userId,
        model: 'claude-sonnet-4-5-20241022',
        feature: 'chat',
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      });
    } catch (trackErr) {
      console.error('[chat] Failed to track usage:', trackErr);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: any) {
    console.error('Chat stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'Stream failed' })}\n\n`);
    res.end();
  }
}
