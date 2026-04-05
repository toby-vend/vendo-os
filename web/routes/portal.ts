import type { FastifyPluginAsync } from 'fastify';
import { getROISummary, getLeadsByChannel, getConversionFunnel, getChannelSpend, getRevenueByChannel, getROIByTreatment, getGhlROI, getMonthlyAdTrend } from '../lib/queries/roi.js';
import { getGA4Summary, getGA4TrafficSources, getOrganicTrend } from '../lib/queries/ga4.js';
import { getGSCSummary, getTopQueries, getTopPages } from '../lib/queries/gsc.js';
import { getAttributedLeads, getLeadsBySource, getLeadsByTreatment } from '../lib/queries/attribution.js';
import { getMetaCampaignsForClient, getGadsCampaignsForClient, getClientName, getGhlPipelineSummary, getGhlRecentOpportunities, getGhlLeads, getGhlLeadTags } from '../lib/queries/portal.js';

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

  // GET /portal — Home: Executive Summary
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const emptyGhl = { total_leads: 0, total_in_progress: 0, total_won: 0, total_revenue: 0, total_spend: 0, roi_percent: 0, cpl: 0, conversion_rate: 0, channels: [] as any[], treatments: [] as any[] };

    const [ghlRoi, channelSpend, monthlyTrend, pipelineStages, clientName] = await Promise.all([
      getGhlROI(clientId, days).catch(() => emptyGhl),
      getChannelSpend(clientId, days).catch(() => []),
      getMonthlyAdTrend(clientId).catch(() => []),
      getGhlPipelineSummary(clientId).catch(() => []),
      getClientName(clientId),
    ]);

    reply.render('portal/dashboard', {
      ghlRoi,
      channelSpend,
      monthlyTrend,
      pipelineStages,
      clientName,
      days,
      pageTitle: 'Executive Summary',
    });
  });

  // GET /portal/seo — SEO performance
  app.get('/seo', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [ga4Summary, trafficSources, organicTrend, gscSummary, topQueries, topPages, clientName] = await Promise.all([
      getGA4Summary(clientId, days),
      getGA4TrafficSources(clientId, days),
      getOrganicTrend(clientId, days),
      getGSCSummary(clientId, days),
      getTopQueries(clientId, days, 20),
      getTopPages(clientId, days, 20),
      getClientName(clientId),
    ]);

    reply.render('portal/seo', {
      ga4Summary,
      trafficSources,
      organicTrend,
      gscSummary,
      topQueries,
      topPages,
      clientName,
      days,
      pageTitle: 'SEO Performance',
    });
  });

  // GET /portal/ads — Unified ad performance (merged ads + ROI)
  app.get('/ads', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const emptyGhl = { total_leads: 0, total_in_progress: 0, total_won: 0, total_revenue: 0, total_spend: 0, roi_percent: 0, cpl: 0, conversion_rate: 0, channels: [] as any[], treatments: [] as any[] };

    const [ghlRoi, channelSpend, leadsByChannel, funnel, metaCampaigns, gadsCampaigns, monthlyTrend, clientName] = await Promise.all([
      getGhlROI(clientId, days).catch(() => emptyGhl),
      getChannelSpend(clientId, days).catch(() => []),
      getLeadsByChannel(clientId, days).catch(() => []),
      getConversionFunnel(clientId, days).catch(() => []),
      getMetaCampaignsForClient(clientId, days),
      getGadsCampaignsForClient(clientId, days),
      getMonthlyAdTrend(clientId).catch(() => []),
      getClientName(clientId),
    ]);

    const adLeads = leadsByChannel.filter(l => l.channel === 'google_ads' || l.channel === 'meta_ads');

    reply.render('portal/ads', {
      ghlRoi,
      channelSpend,
      adLeads,
      funnel,
      metaCampaigns,
      gadsCampaigns,
      monthlyTrend,
      clientName,
      days,
      pageTitle: 'Ad Performance',
    });
  });

  // GET /portal/leads — Lead Generation Overview
  app.get('/leads', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const emptyGhl = { total_leads: 0, total_in_progress: 0, total_won: 0, total_revenue: 0, total_spend: 0, roi_percent: 0, cpl: 0, conversion_rate: 0, channels: [] as any[], treatments: [] as any[] };

    const [ghlRoi, leadsBySource, leadsByTreatment, funnel, channelSpend, clientName] = await Promise.all([
      getGhlROI(clientId, days).catch(() => emptyGhl),
      getLeadsBySource(clientId, days).catch(() => []),
      getLeadsByTreatment(clientId, days).catch(() => []),
      getConversionFunnel(clientId, days).catch(() => []),
      getChannelSpend(clientId, days).catch(() => []),
      getClientName(clientId),
    ]);

    // Diagnostic flags
    const totalSpend = channelSpend.reduce((s: number, c: any) => s + c.spend, 0);
    const diagnostics = {
      lowVolume: ghlRoi.total_leads < 10 && totalSpend > 500,
      lowBookingRate: ghlRoi.total_leads > 0 && ghlRoi.total_in_progress > 0 ? false : ghlRoi.total_leads > 5,
      lowWinRate: ghlRoi.total_leads > 5 && ghlRoi.conversion_rate < 30,
    };

    reply.render('portal/leads', {
      ghlRoi,
      leadsBySource,
      leadsByTreatment,
      funnel,
      channelSpend,
      diagnostics,
      clientName,
      days,
      pageTitle: 'Lead Generation',
    });
  });

  // GET /portal/pipeline — CRM & Pipeline
  app.get('/pipeline', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const emptyGhl = { total_leads: 0, total_in_progress: 0, total_won: 0, total_revenue: 0, total_spend: 0, roi_percent: 0, cpl: 0, conversion_rate: 0, channels: [] as any[], treatments: [] as any[] };

    const [ghlRoi, pipelineStages, recentOpps, clientName] = await Promise.all([
      getGhlROI(clientId, days).catch(() => emptyGhl),
      getGhlPipelineSummary(clientId).catch(() => []),
      getGhlRecentOpportunities(clientId, 30).catch(() => []),
      getClientName(clientId),
    ]);

    reply.render('portal/pipeline', {
      ghlRoi,
      pipelineStages,
      recentOpps,
      clientName,
      days,
      pageTitle: 'CRM & Pipeline',
    });
  });

  // GET /portal/roi — Redirect to unified ads page
  app.get('/roi', async (request, reply) => {
    const q = request.query as Record<string, string>;
    reply.redirect(`/portal/ads${q.days ? '?days=' + q.days : ''}`);
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
