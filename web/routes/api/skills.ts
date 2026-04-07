/**
 * Local dev equivalents of the Vercel serverless skills API functions.
 * On Vercel, these are handled by api/skills-*.ts directly.
 */
import type { FastifyPluginAsync } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { rows, db } from '../../lib/queries/base.js';
import { searchSkills } from '../../lib/queries/drive.js';
import { trackUsage } from '../../lib/usage-tracker.js';
import type { SessionUser } from '../../lib/auth.js';

interface SkillRow {
  slug: string;
  title: string;
  description: string;
  content: string;
}

export const skillsApiRoutes: FastifyPluginAsync = async (app) => {
  // POST /generate — stream AI content
  app.post('/generate', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.code(401).send({ error: 'Unauthorised' }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { reply.code(500).send({ error: 'ANTHROPIC_API_KEY not configured' }); return; }

    const { skill, client_id, inputs } = request.body as {
      skill: string;
      client_id: number;
      inputs: Record<string, string>;
    };

    if (!skill || !client_id || !inputs) {
      reply.code(400).send({ error: 'Missing skill, client_id, or inputs' });
      return;
    }

    const skillRows = await rows<SkillRow>('SELECT slug, title, description, content FROM skills_library WHERE slug = ?', [skill]);
    if (!skillRows.length) { reply.code(404).send({ error: 'Skill not found' }); return; }
    const skillRow = skillRows[0];

    const clientRows = await rows<{ name: string; vertical: string | null }>(
      'SELECT COALESCE(display_name, name) as name, vertical FROM clients WHERE id = ?', [client_id]
    );
    if (!clientRows.length) { reply.code(404).send({ error: 'Client not found' }); return; }
    const client = clientRows[0];

    // Search Drive SOPs for relevant knowledge (skill slug maps to channel-like terms)
    const sopChannel = skill.includes('social') ? 'paid_social' : skill.includes('seo') ? 'seo' : skill.includes('ads') || skill.includes('ppc') || skill.includes('rsa') ? 'paid_ads' : 'general';
    let sopSection = '';
    try {
      const sopResponse = await searchSkills(skillRow.title, sopChannel, 3);
      if (sopResponse.results.length > 0) {
        const sopText = sopResponse.results
          .map(s => `### ${s.title}\n${s.content.slice(0, 2000)}`)
          .join('\n\n');
        sopSection = `\n\n=== AGENCY SOPs & BEST PRACTICES ===\n\nThe following SOPs from Vendo Digital's knowledge base are relevant. Follow these standards when generating content.\n\n${sopText}`;
      }
    } catch { /* SOPs unavailable — proceed without */ }

    const systemPrompt = `You are a specialist content generator for Vendo Digital, a marketing agency. You are executing the following skill for a specific client. Follow the instructions, output format, and quality checks exactly as described.\n\nUse UK English throughout. Be specific and actionable — no placeholder text or generic filler.\n\n=== SKILL INSTRUCTIONS ===\n\n${skillRow.content}\n\n=== CLIENT CONTEXT ===\n\nClient: ${client.name}\nVertical: ${client.vertical || 'Not specified'}${sopSection}`;

    const inputLines = Object.entries(inputs)
      .filter(([key]) => key !== 'skill' && key !== 'client_id')
      .map(([key, value]) => `- **${key.replace(/_/g, ' ')}:** ${value}`)
      .join('\n');

    const userMessage = `Generate the ${skillRow.title} output for ${client.name}.\n\nInputs:\n${inputLines}`;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

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
          reply.raw.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      try {
        const finalMessage = await stream.finalMessage();
        trackUsage({ userId: user.id, model: 'claude-sonnet-4-6', feature: 'task_generation', inputTokens: finalMessage.usage.input_tokens, outputTokens: finalMessage.usage.output_tokens });
      } catch {}

      reply.raw.write(`data: [DONE]\n\n`);
      reply.raw.end();
    } catch (err: any) {
      reply.raw.write(`data: ${JSON.stringify({ error: err.message || 'Stream failed' })}\n\n`);
      reply.raw.end();
    }
  });

  // POST /save — save generated output
  app.post('/save', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.code(401).send({ error: 'Unauthorised' }); return; }

    const { skill_slug, client_id, inputs, output } = request.body as {
      skill_slug: string;
      client_id: number;
      inputs: Record<string, string>;
      output: string;
    };

    if (!skill_slug || !client_id || !output) {
      reply.code(400).send({ error: 'Missing skill_slug, client_id, or output' });
      return;
    }

    await db.execute({ sql: `CREATE TABLE IF NOT EXISTS skill_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug TEXT NOT NULL, skill_title TEXT NOT NULL,
      client_id INTEGER NOT NULL, client_name TEXT NOT NULL,
      inputs TEXT NOT NULL, output TEXT NOT NULL,
      created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, args: [] });

    const skillRows = await rows<{ title: string }>('SELECT title FROM skills_library WHERE slug = ?', [skill_slug]);
    const clientRows = await rows<{ name: string }>('SELECT COALESCE(display_name, name) as name FROM clients WHERE id = ?', [client_id]);

    const result = await db.execute({
      sql: `INSERT INTO skill_outputs (skill_slug, skill_title, client_id, client_name, inputs, output, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [skill_slug, skillRows[0]?.title ?? skill_slug, client_id, clientRows[0]?.name ?? 'Unknown', JSON.stringify(inputs), output, user.name],
    });

    reply.send({ ok: true, id: Number(result.lastInsertRowid) });
  });

  // GET /outputs — list saved outputs
  app.get('/outputs', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.code(401).send({ error: 'Unauthorised' }); return; }

    const q = request.query as Record<string, string>;
    let sql = `SELECT id, skill_slug, skill_title, client_id, client_name, SUBSTR(output, 1, 200) as output, created_by, created_at FROM skill_outputs WHERE 1=1`;
    const args: (string | number)[] = [];

    if (q.client_id) { sql += ' AND client_id = ?'; args.push(parseInt(q.client_id, 10)); }
    if (q.skill_slug) { sql += ' AND skill_slug = ?'; args.push(q.skill_slug); }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    try {
      const results = await rows(sql, args);
      reply.send({ outputs: results });
    } catch {
      reply.send({ outputs: [] });
    }
  });
};
