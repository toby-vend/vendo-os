import type { FastifyPluginAsync } from 'fastify';
import { getAdAccountSummary, getCampaignSummary } from '../lib/queries.js';

export const adsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const accounts = await getAdAccountSummary(days);
    reply.render('ads', { accounts, days, query: q });
  });

  // HTMX endpoint for campaign drill-down
  app.get('/campaigns/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const campaigns = await getCampaignSummary(accountId, days);
    reply.render('ads-campaigns', { campaigns });
  });
};
