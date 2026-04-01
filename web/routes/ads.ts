import type { FastifyPluginAsync } from 'fastify';
import { getAdAccountSummary, getCampaignSummary, getGadsAccountSummary, getGadsCampaignSummary } from '../lib/queries.js';

export const adsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const [metaAccounts, gadsAccounts] = await Promise.all([
      getAdAccountSummary(days),
      getGadsAccountSummary(days),
    ]);
    const totalSpend = [...metaAccounts, ...gadsAccounts].reduce((sum, a) => sum + a.spend, 0);
    reply.render('ads', { metaAccounts, gadsAccounts, totalSpend, days, query: q });
  });

  // HTMX endpoint for Meta campaign drill-down
  app.get('/campaigns/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const campaigns = await getCampaignSummary(accountId, days);
    reply.render('ads-campaigns', { campaigns });
  });

  // HTMX endpoint for Google Ads campaign drill-down
  app.get('/gads/campaigns/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const campaigns = await getGadsCampaignSummary(accountId, days);
    reply.render('ads-campaigns', { campaigns });
  });
};
