import type { FastifyPluginAsync } from 'fastify';
import { readdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
// On Vercel, use __dirname relative path; locally use cwd
const SKILLS_DIR = process.env.VERCEL
  ? resolve(__dirname, '../../.claude/commands/skills')
  : resolve(process.cwd(), '.claude/commands/skills');

interface SkillSummary {
  slug: string;
  title: string;
  description: string;
  inputs: string[];
}

async function loadSkills(): Promise<SkillSummary[]> {
  try {
    const files = await readdir(SKILLS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();

    const skills: SkillSummary[] = [];

    for (const file of mdFiles) {
      const content = await readFile(resolve(SKILLS_DIR, file), 'utf-8');
      const slug = file.replace(/\.md$/, '');

      // Parse title from first # heading
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : slug;

      // Parse description from first paragraph after the heading
      const lines = content.split('\n');
      let description = '';
      let foundHeading = false;
      for (const line of lines) {
        if (!foundHeading && line.startsWith('# ')) {
          foundHeading = true;
          continue;
        }
        if (foundHeading && line.trim() === '') continue;
        if (foundHeading && line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
          description = line.trim();
          break;
        }
        if (foundHeading && (line.startsWith('#') || line.startsWith('-'))) break;
      }

      // Parse inputs — look for list items under "Inputs" section
      const inputs: string[] = [];
      const inputSection = content.match(/## Inputs[^\n]*\n([\s\S]*?)(?=\n##|\n$)/i);
      if (inputSection) {
        const inputLines = inputSection[1].split('\n');
        for (const il of inputLines) {
          const match = il.match(/^-\s+\*\*(.+?)\*\*/);
          if (match) inputs.push(match[1]);
        }
      }

      skills.push({ slug, title, description, inputs });
    }

    return skills;
  } catch {
    return [];
  }
}

export const skillsLibraryRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Skills library listing
  app.get('/', async (_request, reply) => {
    const skills = await loadSkills();
    return reply.render('skills-library', { skills });
  });

  // GET /:name — Individual skill detail
  app.get<{ Params: { name: string } }>('/:name', async (request, reply) => {
    const name = request.params.name;

    // Sanitise — only allow alphanumeric and hyphens
    if (!/^[a-z0-9-]+$/.test(name)) {
      return reply.code(400).send('Invalid skill name');
    }

    const skills = await loadSkills();
    const skill = skills.find(s => s.slug === name);
    if (!skill) {
      return reply.code(404).send('Skill not found');
    }

    try {
      const content = await readFile(resolve(SKILLS_DIR, `${name}.md`), 'utf-8');
      const html = await marked(content);
      return reply.render('skills-library-detail', { skill, html });
    } catch {
      return reply.code(404).send('Skill not found');
    }
  });
};
