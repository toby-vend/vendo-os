import type { FastifyPluginAsync } from 'fastify';
import { getROISummary, getLeadsByChannel, getConversionFunnel, getChannelSpend, getRevenueByChannel, getROIByTreatment, getGhlROI, getMonthlyAdTrend } from '../lib/queries/roi.js';
import {
  getActiveVideoProjects, getVideoProject, getShootPlan,
  getVideoFiles, getVideoComments, getVideoAuditLog,
  moveVideoProject, updateVideoProject, addVideoComment, logVideoAudit,
  VIDEO_COLUMNS,
} from '../lib/queries/video-production.js';
import { getGA4Summary, getGA4TrafficSources, getOrganicTrend, getGA4EngagementSummary, getGA4EngagementSummaryPrior } from '../lib/queries/ga4.js';
import { getGSCSummary, getTopQueries, getTopPages, getGSCDailyTrend, getGSCSummaryPrior, getPositionDistribution, getCTROpportunities, getPositionMovers } from '../lib/queries/gsc.js';
import { getAttributedLeads, getLeadsBySource, getLeadsByTreatment } from '../lib/queries/attribution.js';
import { getMetaCampaignsForClient, getGadsCampaignsForClient, getClientName, getGhlPipelineSummary, getGhlRecentOpportunities, getGhlLeads, getGhlLeadTags, getMetaTopAds, getMetaEngagement, getGadsTopKeywords } from '../lib/queries/portal.js';

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

    const [
      ga4Summary, trafficSources, organicTrend,
      gscSummary, gscPrior, gscTrend,
      topQueries, topPages,
      positionDist, ctrOpportunities, positionMovers,
      ga4Engagement, ga4EngagementPrior,
      clientName,
    ] = await Promise.all([
      getGA4Summary(clientId, days),
      getGA4TrafficSources(clientId, days),
      getOrganicTrend(clientId, days),
      getGSCSummary(clientId, days),
      getGSCSummaryPrior(clientId, days),
      getGSCDailyTrend(clientId, days),
      getTopQueries(clientId, days, 20),
      getTopPages(clientId, days, 20),
      getPositionDistribution(clientId, days),
      getCTROpportunities(clientId, days, 10),
      getPositionMovers(clientId, days, 10),
      getGA4EngagementSummary(clientId, days),
      getGA4EngagementSummaryPrior(clientId, days),
      getClientName(clientId),
    ]);

    reply.render('portal/seo', {
      ga4Summary,
      trafficSources,
      organicTrend,
      gscSummary,
      gscPrior,
      gscTrend,
      topQueries,
      topPages,
      positionDist,
      ctrOpportunities,
      positionMovers,
      ga4Engagement,
      ga4EngagementPrior,
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

  // GET /portal/meta — Meta Ads (Paid Social)
  app.get('/meta', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [metaCampaigns, topAds, engagement, channelSpend, clientName] = await Promise.all([
      getMetaCampaignsForClient(clientId, days),
      getMetaTopAds(clientId, days, 10).catch(() => []),
      getMetaEngagement(clientId, days).catch(() => ({ total_reach: 0, avg_frequency: 0, total_impressions: 0, total_clicks: 0 })),
      getChannelSpend(clientId, days).catch(() => []),
      getClientName(clientId),
    ]);

    const metaSpend = channelSpend.find((c: any) => c.channel === 'meta_ads')?.spend || 0;
    const totalClicks = metaCampaigns.reduce((s: number, c: any) => s + c.clicks, 0);
    const totalImpressions = metaCampaigns.reduce((s: number, c: any) => s + c.impressions, 0);

    reply.render('portal/meta', {
      metaCampaigns,
      topAds,
      engagement,
      metaSpend,
      totalClicks,
      totalImpressions,
      clientName,
      days,
      pageTitle: 'Meta Ads',
    });
  });

  // GET /portal/google — Google Ads (Paid Search)
  app.get('/google', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseDays(q);
    const clientId = getClientId(request);

    const [gadsCampaigns, topKeywords, channelSpend, clientName] = await Promise.all([
      getGadsCampaignsForClient(clientId, days),
      getGadsTopKeywords(clientId, days, 15).catch(() => []),
      getChannelSpend(clientId, days).catch(() => []),
      getClientName(clientId),
    ]);

    const gadsSpend = channelSpend.find((c: any) => c.channel === 'google_ads')?.spend || 0;
    const totalConversions = gadsCampaigns.reduce((s: number, c: any) => s + c.conversions, 0);
    const totalClicks = gadsCampaigns.reduce((s: number, c: any) => s + c.clicks, 0);
    const totalImpressions = gadsCampaigns.reduce((s: number, c: any) => s + c.impressions, 0);

    reply.render('portal/google', {
      gadsCampaigns,
      topKeywords,
      gadsSpend,
      totalConversions,
      totalClicks,
      totalImpressions,
      clientName,
      days,
      pageTitle: 'Google Ads',
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

    const [
      ga4Summary, trafficSources, organicTrend,
      gscSummary, gscPrior, gscTrend,
      topQueries, topPages,
      positionDist, ctrOpportunities, positionMovers,
      ga4Engagement, ga4EngagementPrior,
    ] = await Promise.all([
      getGA4Summary(clientId, days),
      getGA4TrafficSources(clientId, days),
      getOrganicTrend(clientId, days),
      getGSCSummary(clientId, days),
      getGSCSummaryPrior(clientId, days),
      getGSCDailyTrend(clientId, days),
      getTopQueries(clientId, days, 20),
      getTopPages(clientId, days, 20),
      getPositionDistribution(clientId, days),
      getCTROpportunities(clientId, days, 10),
      getPositionMovers(clientId, days, 10),
      getGA4EngagementSummary(clientId, days),
      getGA4EngagementSummaryPrior(clientId, days),
    ]);

    reply.render('portal/seo', {
      ga4Summary,
      trafficSources,
      organicTrend,
      gscSummary,
      gscPrior,
      gscTrend,
      topQueries,
      topPages,
      positionDist,
      ctrOpportunities,
      positionMovers,
      ga4Engagement,
      ga4EngagementPrior,
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

  // ── Portal: Video Production ──────────────────────────────────────

  app.get('/video-production', async (request, reply) => {
    const clientId = getClientId(request);
    const clientName = await getClientName(clientId);
    const projects = await getActiveVideoProjects({ clientId });

    reply.render('portal/video-production', {
      projects,
      columnDefs: VIDEO_COLUMNS,
      clientName,
      days: 30,
      pageTitle: 'Video Production',
    });
  });

  app.get('/video-production/:id', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const project = await getVideoProject(parseInt(id, 10));

    if (!project || project.client_id !== clientId) {
      reply.code(404).send('Project not found');
      return;
    }

    const clientName = await getClientName(clientId);
    const [shootPlan, files, comments] = await Promise.all([
      getShootPlan(project.id),
      getVideoFiles(project.id),
      getVideoComments(project.id),
    ]);

    const rawFiles = files.filter(f => f.type === 'raw');
    const editFiles = files.filter(f => f.type === 'edit');

    reply.render('portal/video-project', {
      project,
      shootPlan,
      rawFiles,
      editFiles,
      comments,
      columnDefs: VIDEO_COLUMNS,
      clientName,
      days: 30,
      pageTitle: project.title,
    });
  });

  // Client confirms raw file receipt
  app.post('/video-production/:id/confirm-receipt', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project || project.client_id !== clientId) { reply.code(404).send('Not found'); return; }

    const now = new Date().toISOString();
    await updateVideoProject(projectId, { raw_files_confirmed_at: now, client_status: 'confirmed' });
    await moveVideoProject(projectId, 'in_editing', request.user?.id, request.user?.name);
    await logVideoAudit(projectId, 'raw_files_confirmed', null, null, request.user?.id, request.user?.name);

    reply.redirect(`/portal/video-production/${id}`);
  });

  // Client approves shoot plan
  app.post('/video-production/:id/approve-plan', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project || project.client_id !== clientId) { reply.code(404).send('Not found'); return; }

    const { updateShootPlan } = await import('../lib/queries/video-production.js');
    const plan = await getShootPlan(projectId);
    if (!plan) { reply.code(404).send('No plan'); return; }

    const now = new Date().toISOString();
    await updateShootPlan(plan.id, { status: 'approved', approved_at: now });
    await updateVideoProject(projectId, { client_status: 'approved' });
    if (plan.treatments) await updateVideoProject(projectId, { treatments_planned: plan.treatments });
    await moveVideoProject(projectId, 'shoot_plan_approved', request.user?.id, request.user?.name);
    await logVideoAudit(projectId, 'shoot_plan_approved', null, null, request.user?.id, request.user?.name);

    reply.redirect(`/portal/video-production/${id}`);
  });

  // Client requests changes on shoot plan
  app.post('/video-production/:id/request-plan-changes', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project || project.client_id !== clientId) { reply.code(404).send('Not found'); return; }

    const { updateShootPlan } = await import('../lib/queries/video-production.js');
    const plan = await getShootPlan(projectId);
    if (!plan) { reply.code(404).send('No plan'); return; }

    const body = request.body as Record<string, string | string[]>;
    const comments = typeof body.comments === 'string' ? body.comments.trim() : '';

    await updateShootPlan(plan.id, { status: 'changes_requested', client_comments: comments });
    await updateVideoProject(projectId, { client_status: 'changes_requested' });
    if (comments) {
      await addVideoComment({ project_id: projectId, source: 'client', author_name: request.user?.name || 'Client', body: comments });
    }
    await moveVideoProject(projectId, 'shoot_plan_in_progress', request.user?.id, request.user?.name);
    await logVideoAudit(projectId, 'shoot_plan_changes_requested', null, null, request.user?.id, request.user?.name);

    reply.redirect(`/portal/video-production/${id}`);
  });

  // Client approves edit
  app.post('/video-production/:id/approve-edit', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project || project.client_id !== clientId) { reply.code(404).send('Not found'); return; }

    const now = new Date().toISOString();
    await updateVideoProject(projectId, { client_status: 'approved', client_approved_at: now });
    await moveVideoProject(projectId, 'live', request.user?.id, request.user?.name);
    await logVideoAudit(projectId, 'client_approved', null, null, request.user?.id, request.user?.name);

    reply.redirect(`/portal/video-production/${id}`);
  });

  // Client requests changes on edit
  app.post('/video-production/:id/request-edit-changes', async (request, reply) => {
    const clientId = getClientId(request);
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project || project.client_id !== clientId) { reply.code(404).send('Not found'); return; }

    const body = request.body as Record<string, string | string[]>;
    const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
    const newRound = (project.revision_round || 0) + 1;

    await updateVideoProject(projectId, { client_status: 'changes_requested', revision_round: newRound });
    if (feedback) {
      await addVideoComment({ project_id: projectId, source: 'client', round: newRound, author_name: request.user?.name || 'Client', body: feedback });
    }
    await moveVideoProject(projectId, 'revisions', request.user?.id, request.user?.name);
    await logVideoAudit(projectId, 'client_changes_requested', null, null, request.user?.id, request.user?.name);

    reply.redirect(`/portal/video-production/${id}`);
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
