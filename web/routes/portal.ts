import type { FastifyPluginAsync } from 'fastify';
import { getROISummary, getLeadsByChannel, getConversionFunnel, getChannelSpend, getRevenueByChannel, getROIByTreatment, getGhlROI } from '../lib/queries/roi.js';
import { getGA4Summary, getGA4TrafficSources, getOrganicTrend } from '../lib/queries/ga4.js';
import { getGSCSummary, getTopQueries, getTopPages } from '../lib/queries/gsc.js';
import { getAttributedLeads, getLeadsBySource, getLeadsByTreatment } from '../lib/queries/attribution.js';
import { getMetaCampaignsForClient, getGadsCampaignsForClient, getClientName, getClientPortalInfo, getGhlPipelineSummary, getGhlRecentOpportunities, getGhlLeads, getGhlLeadTags } from '../lib/queries/portal.js';
import { getClientFeedback, addClientFeedback } from '../lib/queries/tracking.js';

// --- Helpers ---

function parseDays(query: Record<string, string>): number {
  const d = parseInt(query.days || '30', 10);
  return [7, 30, 90, 180, 365].includes(d) ? d : 30;
}

function getClientId(request: any): number {
  // clientId is set on the user object by the auth middleware for client-role users.
  // Admin users previewing a client portal pass ?clientId= as a query param.
  const fromUser = request.user?.clientId;
  const fromQuery = parseInt((request.query as Record<string, string>)?.clientId, 10);
  const id = fromUser ?? (request.user?.role === 'admin' ? fromQuery : undefined);
  if (typeof id !== 'number' || isNaN(id)) throw new Error('Missing clientId on request');
  return id;
}

// --- Routes ---

export const portalRoutes: FastifyPluginAsync = async (app) => {

  // GET /portal — Executive dashboard
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [roi, leadsByChannel, funnel, pipelineStages, recentOpps, clientInfo] = await Promise.all([
      getROISummary(clientId, days),
      getLeadsByChannel(clientId, days),
      getConversionFunnel(clientId, days),
      getGhlPipelineSummary(clientId),
      getGhlRecentOpportunities(clientId, 10),
      getClientPortalInfo(clientId),
    ]);

    reply.render('portal/dashboard', {
      roi,
      leadsByChannel,
      funnel,
      pipelineStages,
      recentOpps,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days,
      pageTitle: 'Dashboard',
    });
  });

  // GET /portal/seo — SEO performance
  app.get('/seo', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [ga4Summary, trafficSources, organicTrend, gscSummary, topQueries, topPages, clientInfo] = await Promise.all([
      getGA4Summary(clientId, days),
      getGA4TrafficSources(clientId, days),
      getOrganicTrend(clientId, days),
      getGSCSummary(clientId, days),
      getTopQueries(clientId, days, 20),
      getTopPages(clientId, days, 20),
      getClientPortalInfo(clientId),
    ]);

    reply.render('portal/seo', {
      ga4Summary,
      trafficSources,
      organicTrend,
      gscSummary,
      topQueries,
      topPages,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days,
      pageTitle: 'SEO Performance',
    });
  });

  // GET /portal/ads — Paid ads performance
  app.get('/ads', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [channelSpend, leadsByChannel, metaCampaigns, gadsCampaigns, clientInfo] = await Promise.all([
      getChannelSpend(clientId, days),
      getLeadsByChannel(clientId, days),
      getMetaCampaignsForClient(clientId, days),
      getGadsCampaignsForClient(clientId, days),
      getClientPortalInfo(clientId),
    ]);

    // Filter leads to ad channels only
    const adLeads = leadsByChannel.filter(l => l.channel === 'google_ads' || l.channel === 'meta_ads');

    reply.render('portal/ads', {
      channelSpend,
      adLeads,
      metaCampaigns,
      gadsCampaigns,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days,
      pageTitle: 'Ad Performance',
    });
  });

  // GET /portal/leads — Lead attribution
  app.get('/leads', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const pageSize = 50;

    const filters = {
      source: q.source || undefined,
      treatment: q.treatment || undefined,
      status: q.status || undefined,
      page,
      pageSize,
    };

    const ghlFilters = {
      status: q.ghl_status || undefined,
      tag: q.tag || undefined,
      page,
      pageSize,
    };

    const [leadsResult, sources, treatments, ghlResult, ghlTags, clientInfo] = await Promise.all([
      getAttributedLeads(clientId, days, filters),
      getLeadsBySource(clientId, days),
      getLeadsByTreatment(clientId, days),
      getGhlLeads(clientId, days, ghlFilters),
      getGhlLeadTags(clientId, days),
      getClientPortalInfo(clientId),
    ]);

    reply.render('portal/leads', {
      leadsResult,
      sources,
      treatments,
      ghlResult,
      ghlTags,
      filters: { source: q.source || '', treatment: q.treatment || '', status: q.status || '', ghl_status: q.ghl_status || '', tag: q.tag || '' },
      page,
      pageSize,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days,
      pageTitle: 'Lead Attribution',
    });
  });

  // GET /portal/roi — ROI breakdown
  app.get('/roi', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [roi, treatmentROI, channelSpend, revenueByChannel, leadsByChannel, ghlRoi, clientInfo] = await Promise.all([
      getROISummary(clientId, days),
      getROIByTreatment(clientId, days),
      getChannelSpend(clientId, days),
      getRevenueByChannel(clientId, days),
      getLeadsByChannel(clientId, days),
      getGhlROI(clientId, days),
      getClientPortalInfo(clientId),
    ]);

    reply.render('portal/roi', {
      roi,
      treatmentROI,
      channelSpend,
      revenueByChannel,
      leadsByChannel,
      ghlRoi,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days,
      pageTitle: 'ROI Breakdown',
    });
  });

  // GET /portal/feedback — Client feedback & requests
  app.get('/feedback', async (request, reply) => {
    const clientId = getClientId(request);
    const [feedback, clientInfo] = await Promise.all([
      getClientFeedback(clientId),
      getClientPortalInfo(clientId),
    ]);

    reply.render('portal/feedback', {
      feedback,
      clientName: clientInfo.name,
      clientAm: clientInfo.am,
      clientCm: clientInfo.cm,
      days: 30,
      pageTitle: 'Feedback & Requests',
    });
  });

  // POST /portal/feedback — Submit feedback
  app.post('/feedback', async (request, reply) => {
    const clientId = getClientId(request);
    const body = request.body as Record<string, string>;
    const type = body.type || 'general';
    const message = (body.message || '').trim();

    if (message) {
      await addClientFeedback(clientId, type, message);
    }

    return reply.redirect('/portal/feedback');
  });

  // --- HTMX Partials ---

  app.get('/partials/dashboard-kpis', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [roi, leadsByChannel, funnel, pipelineStages, recentOpps] = await Promise.all([
      getROISummary(clientId, days),
      getLeadsByChannel(clientId, days),
      getConversionFunnel(clientId, days),
      getGhlPipelineSummary(clientId),
      getGhlRecentOpportunities(clientId, 10),
    ]);

    reply.render('portal/dashboard', {
      roi,
      leadsByChannel,
      funnel,
      pipelineStages,
      recentOpps,
      clientName: '',
      days,
      pageTitle: 'Dashboard',
      isHtmx: true,
    });
  });

  app.get('/partials/seo-summary', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [ga4Summary, trafficSources, organicTrend, gscSummary, topQueries, topPages] = await Promise.all([
      getGA4Summary(clientId, days),
      getGA4TrafficSources(clientId, days),
      getOrganicTrend(clientId, days),
      getGSCSummary(clientId, days),
      getTopQueries(clientId, days, 20),
      getTopPages(clientId, days, 20),
    ]);

    reply.render('portal/seo', {
      ga4Summary,
      trafficSources,
      organicTrend,
      gscSummary,
      topQueries,
      topPages,
      clientName: '',
      days,
      pageTitle: 'SEO Performance',
      isHtmx: true,
    });
  });

  app.get('/partials/ads-summary', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [channelSpend, leadsByChannel, metaCampaigns, gadsCampaigns] = await Promise.all([
      getChannelSpend(clientId, days),
      getLeadsByChannel(clientId, days),
      getMetaCampaignsForClient(clientId, days),
      getGadsCampaignsForClient(clientId, days),
    ]);

    const adLeads = leadsByChannel.filter(l => l.channel === 'google_ads' || l.channel === 'meta_ads');

    reply.render('portal/ads', {
      channelSpend,
      adLeads,
      metaCampaigns,
      gadsCampaigns,
      clientName: '',
      days,
      pageTitle: 'Ad Performance',
      isHtmx: true,
    });
  });

  app.get('/partials/leads-table', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const pageSize = 50;

    const filters = {
      source: q.source || undefined,
      treatment: q.treatment || undefined,
      status: q.status || undefined,
      page,
      pageSize,
    };

    const [leadsResult, sources, treatments] = await Promise.all([
      getAttributedLeads(clientId, days, filters),
      getLeadsBySource(clientId, days),
      getLeadsByTreatment(clientId, days),
    ]);

    reply.render('portal/leads', {
      leadsResult,
      sources,
      treatments,
      filters: { source: q.source || '', treatment: q.treatment || '', status: q.status || '' },
      page,
      pageSize,
      clientName: '',
      days,
      pageTitle: 'Lead Attribution',
      isHtmx: true,
    });
  });

  app.get('/partials/roi-chart', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [roi, treatmentROI, channelSpend, revenueByChannel, leadsByChannel] = await Promise.all([
      getROISummary(clientId, days),
      getROIByTreatment(clientId, days),
      getChannelSpend(clientId, days),
      getRevenueByChannel(clientId, days),
      getLeadsByChannel(clientId, days),
    ]);

    reply.render('portal/roi', {
      roi,
      treatmentROI,
      channelSpend,
      revenueByChannel,
      leadsByChannel,
      clientName: '',
      days,
      pageTitle: 'ROI Breakdown',
      isHtmx: true,
    });
  });
};
