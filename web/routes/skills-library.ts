import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries/base.js';
import { marked } from 'marked';
import { getAllActiveClients } from '../lib/queries/dashboards.js';
import { getSkillFields } from '../lib/skill-inputs.js';

interface SkillRow {
  slug: string;
  title: string;
  description: string;
  inputs: string;
  content: string;
}

interface SkillSummary {
  slug: string;
  title: string;
  description: string;
  inputs: string[];
}

export const skillsLibraryRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Skills library listing
  app.get('/', async (_request, reply) => {
    let skills: SkillSummary[] = [];
    try {
      const dbRows = await rows<SkillRow>('SELECT slug, title, description, inputs FROM skills_library ORDER BY title');
      skills = dbRows.map(r => ({
        slug: r.slug,
        title: r.title,
        description: r.description,
        inputs: JSON.parse(r.inputs || '[]'),
      }));
    } catch {
      // Table may not exist yet
    }
    return reply.render('skills-library', { skills });
  });

  // GET /outputs/:id — View a saved skill output
  app.get<{ Params: { id: string } }>('/outputs/:id', async (request, reply) => {
    const id = request.params.id;
    if (!/^\d+$/.test(id)) {
      return reply.code(400).send('Invalid output ID');
    }

    try {
      const result = await rows<{
        id: number; skill_slug: string; skill_title: string;
        client_id: number; client_name: string; inputs: string;
        output: string; created_by: string | null; created_at: string;
      }>('SELECT * FROM skill_outputs WHERE id = ?', [parseInt(id, 10)]);

      if (!result.length) {
        return reply.code(404).send('Output not found');
      }

      const outputRow = result[0];
      let parsedInputs: Record<string, string> = {};
      try { parsedInputs = JSON.parse(outputRow.inputs); } catch {}

      return reply.render('skills-output-view', {
        output: outputRow,
        parsedInputs,
      });
    } catch {
      return reply.code(404).send('Output not found');
    }
  });

  // GET /:name — Individual skill detail (interactive form)
  app.get<{ Params: { name: string } }>('/:name', async (request, reply) => {
    const name = request.params.name;

    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.code(400).send('Invalid skill name');
    }

    try {
      const result = await rows<SkillRow>('SELECT * FROM skills_library WHERE slug = ?', [name]);
      if (!result.length) {
        return reply.code(404).send('Skill not found');
      }

      const skill = {
        slug: result[0].slug,
        title: result[0].title,
        description: result[0].description,
        inputs: JSON.parse(result[0].inputs || '[]'),
      };

      const [clients, fields] = await Promise.all([
        getAllActiveClients(),
        Promise.resolve(getSkillFields(name)),
      ]);

      return reply.render('skills-detail', { skill, clients, fields });
    } catch {
      return reply.code(404).send('Skill not found');
    }
  });
};
