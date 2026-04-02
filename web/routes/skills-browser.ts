import type { FastifyPluginAsync } from 'fastify';
import {
  listSkillChannels,
  listSkillsByChannel,
  getSkillById,
  searchSkills,
  type SkillRow,
  type SkillSearchResult,
} from '../lib/queries/drive.js';

/** Minimal shape needed by templates — both SkillRow and SkillSearchResult satisfy this. */
type SkillForDisplay = Pick<SkillRow, 'id' | 'title' | 'channel' | 'skill_type' | 'drive_modified_at'>;

/**
 * Group skills by skill_type for display. Accepts any skill-like object with
 * the required fields (both SkillRow and SkillSearchResult are compatible).
 */
function groupBySkillType(skills: SkillForDisplay[]): Record<string, SkillForDisplay[]> {
  const grouped: Record<string, SkillForDisplay[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.skill_type]) {
      grouped[skill.skill_type] = [];
    }
    grouped[skill.skill_type].push(skill);
  }
  return grouped;
}

export const skillsBrowserRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Skills browser main page (or HTMX partial if hx-request header present)
  app.get<{ Querystring: { channel?: string; q?: string } }>('/', async (request, reply) => {
    const channels = await listSkillChannels();
    const defaultChannel = channels[0] ?? 'paid_social';

    const channel = request.query.channel ?? defaultChannel;
    const q = (request.query.q ?? '').trim();

    let grouped: Record<string, SkillForDisplay[]>;
    let gap = false;

    if (q) {
      const response = await searchSkills(q, channel, 50);
      grouped = groupBySkillType(response.results as SkillSearchResult[]);
      gap = response.gap;
    } else {
      const skills = await listSkillsByChannel(channel);
      grouped = groupBySkillType(skills);
    }

    const isHtmx = request.headers['hx-request'] === 'true';

    if (isHtmx) {
      return reply.render('skills/skill-results', { channels, activeChannel: channel, query: q, grouped, gap });
    }

    return reply.render('skills/browser', { channels, activeChannel: channel, query: q, grouped, gap });
  });

  // GET /search — HTMX search partial endpoint (always returns partial)
  app.get<{ Querystring: { channel?: string; q?: string } }>('/search', async (request, reply) => {
    const channels = await listSkillChannels();
    const defaultChannel = channels[0] ?? 'paid_social';

    const channel = request.query.channel ?? defaultChannel;
    const q = (request.query.q ?? '').trim();

    let grouped: Record<string, SkillForDisplay[]>;
    let gap = false;

    if (q) {
      const response = await searchSkills(q, channel, 50);
      grouped = groupBySkillType(response.results as SkillSearchResult[]);
      gap = response.gap;
    } else {
      const skills = await listSkillsByChannel(channel);
      grouped = groupBySkillType(skills);
    }

    return reply.render('skills/skill-results', { channels, activeChannel: channel, query: q, grouped, gap });
  });

  // GET /:id — Skill detail page
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send('Invalid skill ID');
    }

    const skill = await getSkillById(id);
    if (!skill) {
      return reply.code(404).send('Skill not found');
    }

    const isHtmx = request.headers['hx-request'] === 'true';

    if (isHtmx) {
      return reply.render('skills/skill-detail', { skill });
    }

    return reply.render('skills/skill-detail', { skill });
  });
};
