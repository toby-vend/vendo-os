import type { FastifyPluginAsync } from 'fastify';
import { rows } from '../lib/queries/base.js';
import { marked } from 'marked';

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

  // GET /:name — Individual skill detail
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
      const html = await marked(result[0].content);
      return reply.render('skills-library-detail', { skill, html });
    } catch {
      return reply.code(404).send('Skill not found');
    }
  });
};
