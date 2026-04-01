import type { FastifyPluginAsync } from 'fastify';
import {
  getPipelineOverview,
  getOpportunitiesByStage,
  getOpportunityDetail,
  getRecentOpportunities,
  getWonDeals,
  getStalledDeals,
} from '../lib/queries.js';

export const pipelineRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const pipelineId = q.pipeline || undefined;

    const [overview, recent, won, stalled] = await Promise.all([
      getPipelineOverview(pipelineId),
      getRecentOpportunities(10, pipelineId),
      getWonDeals(30, pipelineId),
      getStalledDeals(14, pipelineId),
    ]);

    reply.render('pipeline', { overview, recent, won, stalled, query: q });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const opp = await getOpportunityDetail(id);
    if (!opp) { reply.code(404).send('Opportunity not found'); return; }
    reply.render('pipeline-detail', { opp });
  });
};
