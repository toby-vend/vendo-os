import type { FastifyPluginAsync } from 'fastify';
import { getAllActiveClients } from '../../lib/queries.js';
import { getGhlROI, getChannelSpend, getMonthlyAdTrend } from '../../lib/queries/roi.js';
import { getGhlPipelineSummary, getClientName, getMetaCampaignsForClient, getGadsCampaignsForClient } from '../../lib/queries/portal.js';

export const reportingHubRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const d = parseInt(q.days || '30', 10);
    const days = [7, 30, 90, 180, 365].includes(d) ? d : 30;
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const clients = await getAllActiveClients();

    if (!clientId) {
      reply.render('dashboards/reporting-hub', { clients, report: null, days, query: q });
      return;
    }

    const emptyGhl = { total_leads: 0, total_in_progress: 0, total_won: 0, total_revenue: 0, total_spend: 0, roi_percent: 0, cpl: 0, conversion_rate: 0, channels: [] as any[], treatments: [] as any[] };

    const [ghlRoi, channelSpend, monthlyTrend, pipelineStages, clientName, metaCampaigns, gadsCampaigns] = await Promise.all([
      getGhlROI(clientId, days).catch(() => emptyGhl),
      getChannelSpend(clientId, days).catch(() => []),
      getMonthlyAdTrend(clientId).catch(() => []),
      getGhlPipelineSummary(clientId).catch(() => []),
      getClientName(clientId),
      getMetaCampaignsForClient(clientId, days),
      getGadsCampaignsForClient(clientId, days),
    ]);

    reply.render('dashboards/reporting-hub', {
      clients,
      report: { ghlRoi, channelSpend, monthlyTrend, pipelineStages, clientName, metaCampaigns, gadsCampaigns },
      days,
      query: q,
    });
  });
};
