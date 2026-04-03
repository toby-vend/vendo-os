import type { FastifyPluginAsync } from 'fastify';
import { getPipelineStages, getPipelineWonDeals, getPipelineMonthlyForecast } from '../../lib/queries.js';

export const pipelineTrackerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [stages, wonDeals, forecast] = await Promise.all([
      getPipelineStages(),
      getPipelineWonDeals(30),
      getPipelineMonthlyForecast(),
    ]);
    const totalPipelineValue = stages.reduce((s, r) => s + r.value, 0);
    const totalWeightedValue = stages.reduce((s, r) => s + r.weighted_value, 0);
    const totalDeals = stages.reduce((s, r) => s + r.count, 0);
    reply.render('dashboards/pipeline-tracker', { stages, wonDeals, forecast, totalPipelineValue, totalWeightedValue, totalDeals });
  });
};
