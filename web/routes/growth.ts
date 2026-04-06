import type { FastifyPluginAsync } from 'fastify';
import {
  getLinkedInPipeline, getLinkedInStats, getLinkedInPost,
  getRecentMeetingsForLinkedIn, getMeetingSummaryForPost,
  insertLinkedInIdeas, updateLinkedInDraft, updateLinkedInStatus,
  getOutboundPipeline, getOutboundFunnel, getProspect,
  insertProspect, updateOutboundDraft, updateOutboundStatus, updateOutboundResponse,
  getCaseStudies, getCaseStudyStats, getCaseStudy,
  insertCaseStudies, updateCaseStudyDraft, updateCaseStudyStatus, updateCaseStudyApproval, updateCaseStudyDistribution,
  getReferrals, getReferralStats,
  insertReferral, updateReferralStatus, markReferralPaid,
  getUpsellOpportunities, getUpsellStats,
  insertUpsellOpportunities, updateUpsellStatus,
  insertGrowthLog, getGrowthLog,
} from '../lib/queries.js';
import {
  generateLinkedInIdeas, draftLinkedInPost,
  draftOutboundMessage, scanForCaseStudyWins, draftCaseStudy,
  scanForUpsells, scoreIcpMatch,
} from '../lib/growth-ai.js';

// --- Helpers ---

async function linkedinPartialData(extra: Record<string, unknown> = {}) {
  const [linkedinPosts, recentMeetings, taskLog] = await Promise.all([
    getLinkedInPipeline(), getRecentMeetingsForLinkedIn(), getGrowthLog('linkedin', 10),
  ]);
  return { linkedinPosts, recentMeetings, taskLog, ...extra };
}

async function outboundPartialData(extra: Record<string, unknown> = {}) {
  const [outboundFunnel, outboundPipeline, taskLog] = await Promise.all([
    getOutboundFunnel(), getOutboundPipeline(), getGrowthLog('outbound', 10),
  ]);
  return { outboundFunnel, outboundPipeline, taskLog, ...extra };
}

async function casestudiesPartialData(extra: Record<string, unknown> = {}) {
  const [caseStudies, taskLog] = await Promise.all([getCaseStudies(), getGrowthLog('casestudies', 10)]);
  return { caseStudies, taskLog, ...extra };
}

async function referralsPartialData(extra: Record<string, unknown> = {}) {
  const [referrals, taskLog] = await Promise.all([getReferrals(), getGrowthLog('referrals', 10)]);
  return { referrals, taskLog, ...extra };
}

async function upsellPartialData(extra: Record<string, unknown> = {}) {
  const [upsells, taskLog] = await Promise.all([getUpsellOpportunities(), getGrowthLog('upsells', 10)]);
  return { upsells, taskLog, ...extra };
}

export const growthRoutes: FastifyPluginAsync = async (app) => {

  // ===== MAIN PAGE =====

  app.get('/', async (_request, reply) => {
    try {
      const [
        linkedinStats, linkedinPosts, recentMeetings,
        outboundFunnel, outboundPipeline,
        caseStudyStats, caseStudies,
        referralStats, referrals,
        upsellStats, upsells,
        taskLog,
      ] = await Promise.all([
        getLinkedInStats(), getLinkedInPipeline(), getRecentMeetingsForLinkedIn(),
        getOutboundFunnel(), getOutboundPipeline(),
        getCaseStudyStats(), getCaseStudies(),
        getReferralStats(), getReferrals(),
        getUpsellStats().catch(() => ({ total: 0, identified: 0, pitched: 0, won: 0 })),
        getUpsellOpportunities().catch(() => []),
        getGrowthLog('linkedin', 10),
      ]);

      reply.render('growth/index', {
        linkedinStats, linkedinPosts, recentMeetings,
        outboundFunnel, outboundPipeline,
        caseStudyStats, caseStudies,
        referralStats, referrals,
        upsellStats, upsells,
        taskLog,
        activeTab: 'linkedin',
      });
    } catch (err) {
      console.error('[growth] Page load failed:', err);
      throw err;
    }
  });

  // ===== TAB LOADING =====

  app.get<{ Params: { section: string } }>('/tab/:section', async (request, reply) => {
    const section = (request.params as { section: string }).section;
    switch (section) {
      case 'linkedin':
        return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData());
      case 'outbound':
        return reply.type('text/html').render('growth/_tab-outbound', await outboundPartialData());
      case 'casestudies':
        return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData());
      case 'referrals':
        return reply.type('text/html').render('growth/_tab-referrals', await referralsPartialData());
      case 'upsells':
        return reply.type('text/html').render('growth/_tab-upsells', await upsellPartialData());
      default:
        return reply.code(404).send('Unknown section');
    }
  });

  // ===== RESULT PANELS =====

  app.get<{ Params: { id: string } }>('/linkedin/:id/result', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const post = await getLinkedInPost(id);
    if (!post) return reply.code(404).send('Not found');
    let meeting: { title: string; summary: string; date: string; client_name: string | null } | null = null;
    if (post.source_meeting_id) meeting = await getMeetingSummaryForPost(post.source_meeting_id);
    return reply.type('text/html').render('growth/_result-linkedin', { post, meeting });
  });

  app.get<{ Params: { id: string } }>('/outbound/:id/result', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const prospect = await getProspect(id);
    if (!prospect) return reply.code(404).send('Not found');
    return reply.type('text/html').render('growth/_result-outbound', { prospect });
  });

  app.get<{ Params: { id: string } }>('/casestudies/:id/result', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const cs = await getCaseStudy(id);
    if (!cs) return reply.code(404).send('Not found');
    return reply.type('text/html').render('growth/_result-casestudy', { cs });
  });

  app.get<{ Params: { id: string } }>('/referrals/:id/result', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const r = await getReferrals();
    const referral = r.find((ref) => ref.id === id);
    if (!referral) return reply.code(404).send('Not found');
    return reply.type('text/html').render('growth/_result-referral', { referral });
  });

  app.get<{ Params: { id: string } }>('/upsells/:id/result', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const upsells = await getUpsellOpportunities();
    const upsell = upsells.find((u) => u.id === id);
    if (!upsell) return reply.code(404).send('Not found');
    return reply.type('text/html').render('growth/_result-upsell', { upsell });
  });

  // ===== LINKEDIN =====

  app.post('/linkedin/generate-ideas', async (request, reply) => {
    try {
      const body = request.body as Record<string, string> | undefined;
      const meetingId = body?.meetingId || undefined;
      const ideas = await generateLinkedInIdeas(meetingId);
      if (!ideas.length) {
        return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ error: 'No ideas generated — check meeting data.' }));
      }

      // Schedule Mon-Thu next week
      const dates: (string | null)[] = [];
      const now = new Date();
      const daysUntilMon = ((1 - now.getDay()) + 7) % 7 || 7;
      for (let i = 0; i < 4; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + daysUntilMon + i);
        dates.push(d.toISOString().split('T')[0]);
      }

      await insertLinkedInIdeas(ideas.map((idea, i) => ({
        pillar: idea.pillar,
        topic: idea.topic,
        scheduledDate: dates[i] ?? null,
        meetingId: idea.meetingId,
      })));

      await insertGrowthLog('linkedin', 'generate_ideas', `Generated ${ideas.length} content ideas`, ideas.length);

      return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ message: `${ideas.length} content ideas generated.` }));
    } catch (err) {
      console.error('[growth] Failed to generate ideas:', err);
      return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ error: 'Failed to generate ideas. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/linkedin/:id/draft', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const post = await getLinkedInPost(id);
      if (!post) return reply.code(404).send('Post not found');

      const draft = await draftLinkedInPost(post.pillar, post.topic);
      await updateLinkedInDraft(id, draft);

      await insertGrowthLog('linkedin', 'draft', `Drafted "${post.topic.slice(0, 50)}"`, 1);

      return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ message: 'Draft created.', selectedId: id }));
    } catch (err) {
      console.error('[growth] LinkedIn draft failed:', err);
      return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/linkedin/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateLinkedInStatus(id, body.status);
    if (body._redirect && body._redirect.startsWith('/') && !body._redirect.startsWith('//')) return reply.redirect(body._redirect);
    return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData());
  });

  // LinkedIn detail page (kept for direct links)
  app.get<{ Params: { id: string } }>('/linkedin/:id', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const post = await getLinkedInPost(id);
    if (!post) return reply.code(404).send('Post not found');

    let meeting: { title: string; summary: string; date: string; client_name: string | null } | null = null;
    if (post.source_meeting_id) {
      meeting = await getMeetingSummaryForPost(post.source_meeting_id);
    }

    reply.render('growth/linkedin-detail', { post, meeting });
  });

  app.post<{ Params: { id: string } }>('/linkedin/:id/draft-and-return', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const post = await getLinkedInPost(id);
      if (!post) return reply.code(404).send('Post not found');

      const draft = await draftLinkedInPost(post.pillar, post.topic);
      await updateLinkedInDraft(id, draft);
      await insertGrowthLog('linkedin', 'draft', `Drafted "${post.topic.slice(0, 50)}"`, 1);
      return reply.redirect(`/growth/linkedin/${id}`);
    } catch {
      return reply.redirect(`/growth/linkedin/${id}?error=draft_failed`);
    }
  });

  // Bulk draft multiple LinkedIn posts
  app.post('/linkedin/bulk-draft', async (request, reply) => {
    const body = request.body as Record<string, string> | undefined;
    const idsRaw = body?.ids || '';
    const ids = idsRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (!ids.length) {
      return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({ error: 'No posts selected.' }));
    }

    let drafted = 0;
    for (const id of ids) {
      try {
        const post = await getLinkedInPost(id);
        if (!post || post.draft) continue;
        const draft = await draftLinkedInPost(post.pillar, post.topic);
        await updateLinkedInDraft(id, draft);
        drafted++;
      } catch (err) {
        console.error(`[growth] Bulk draft failed for id=${id}:`, err);
      }
    }

    await insertGrowthLog('linkedin', 'bulk_draft', `Bulk drafted ${drafted} of ${ids.length} posts`, drafted);

    return reply.type('text/html').render('growth/_tab-linkedin', await linkedinPartialData({
      message: drafted > 0 ? `${drafted} post(s) drafted.` : 'No posts needed drafting.',
    }));
  });

  // ===== OUTBOUND =====

  app.post('/outbound/add', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const name = body.name?.trim();
    if (!name) return reply.redirect('/growth?error=name_required');

    const icpScore = scoreIcpMatch(body.company ?? null, null);
    await insertProspect({
      name,
      company: body.company?.trim() || null,
      email: body.email?.trim() || null,
      channel: body.channel || 'email',
      notes: null,
      icpScore,
    });

    await insertGrowthLog('outbound', 'add_prospect', `Added prospect: ${name}`, 1);

    return reply.redirect('/growth');
  });

  app.post<{ Params: { id: string } }>('/outbound/:id/draft', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const prospect = await getProspect(id);
      if (!prospect) return reply.code(404).send('Prospect not found');

      const draft = await draftOutboundMessage(prospect);
      const existingNotes = prospect.notes ?? '';
      const newNotes = existingNotes ? existingNotes + '\n\n' : '';
      await updateOutboundDraft(id, newNotes + `[Step ${prospect.sequence_step + 1} draft]\n${draft}`, prospect.sequence_step + 1);

      await insertGrowthLog('outbound', 'draft', `Drafted outreach for ${prospect.prospect_name} (Step ${prospect.sequence_step + 1})`, 1);

      return reply.type('text/html').render('growth/_tab-outbound', await outboundPartialData({ message: 'Outreach draft generated.', selectedId: id }));
    } catch (err) {
      console.error('[growth] Outbound draft failed:', err);
      return reply.type('text/html').render('growth/_tab-outbound', await outboundPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/outbound/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateOutboundStatus(id, body.status);
    return reply.type('text/html').render('growth/_tab-outbound', await outboundPartialData());
  });

  app.post<{ Params: { id: string } }>('/outbound/:id/response', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    if (body.response) await updateOutboundResponse(id, body.response);
    return reply.type('text/html').render('growth/_tab-outbound', await outboundPartialData());
  });

  // ===== CASE STUDIES =====

  app.post('/casestudies/scan', async (_request, reply) => {
    try {
      const wins = await scanForCaseStudyWins();
      if (!wins.length) {
        await insertGrowthLog('casestudies', 'scan', 'Scanned for wins — none found', 0);
        return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData({ message: 'No new wins detected this period.' }));
      }

      await insertCaseStudies(wins.map((w) => ({ clientName: w.clientName, winType: w.winType, metric: w.metric })));
      await insertGrowthLog('casestudies', 'scan', `Scanned for wins — ${wins.length} found`, wins.length);
      return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData({ message: `${wins.length} win(s) identified.` }));
    } catch (err) {
      console.error('[growth] Case study scan failed:', err);
      return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData({ error: 'Scan failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/casestudies/:id/draft', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const cs = await getCaseStudy(id);
      if (!cs) return reply.code(404).send('Case study not found');

      const draft = await draftCaseStudy(cs);
      const distribution = JSON.stringify([
        'Published to website', 'LinkedIn post (Sell pillar)', 'Added to proposal deck',
        'Added to outbound email sequence', 'Stored in Google Drive',
      ].map((ch) => ({ channel: ch, done: false })));

      await updateCaseStudyDraft(id, draft, distribution);
      await insertGrowthLog('casestudies', 'draft', `Drafted case study for ${cs.client_name}`, 1);
      return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData({ message: 'Case study drafted.', selectedId: id }));
    } catch (err) {
      console.error('[growth] Case study draft failed:', err);
      return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/casestudies/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateCaseStudyStatus(id, body.status);
    return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData());
  });

  app.post<{ Params: { id: string } }>('/casestudies/:id/approval', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    const approved = body.approval === 'approved';
    const anonymous = body.approval === 'anonymous';
    await updateCaseStudyApproval(id, approved, anonymous);
    return reply.type('text/html').render('growth/_tab-casestudies', await casestudiesPartialData());
  });

  // Toggle a distribution channel as done/undone
  app.post<{ Params: { id: string } }>('/casestudies/:id/distribution', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    const channelIndex = parseInt(body.channelIndex, 10);

    const cs = await getCaseStudy(id);
    if (!cs || !cs.distribution) return reply.code(404).send('Not found');

    try {
      const channels = JSON.parse(cs.distribution) as { channel: string; done: boolean }[];
      if (channels[channelIndex]) {
        channels[channelIndex].done = !channels[channelIndex].done;
        await updateCaseStudyDistribution(id, JSON.stringify(channels));
      }
    } catch { /* invalid JSON */ }

    // Re-fetch and return the result panel
    const updated = await getCaseStudy(id);
    return reply.type('text/html').render('growth/_result-casestudy', { cs: updated });
  });

  // ===== REFERRALS =====

  app.post('/referrals/add', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const referrerName = body.referrerName?.trim();
    const referredName = body.referredName?.trim();
    if (!referrerName || !referredName) return reply.redirect('/growth?error=fields_required');

    await insertReferral({
      referrerName,
      referrerType: body.referrerType || 'client',
      referredName,
      referredCompany: body.referredCompany?.trim() || null,
    });

    await insertGrowthLog('referrals', 'add_referral', `Added referral: ${referredName} from ${referrerName}`, 1);

    return reply.redirect('/growth');
  });

  app.post<{ Params: { id: string } }>('/referrals/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateReferralStatus(id, body.status);
    return reply.type('text/html').render('growth/_tab-referrals', await referralsPartialData());
  });

  app.post<{ Params: { id: string } }>('/referrals/:id/paid', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    await markReferralPaid(id);
    return reply.type('text/html').render('growth/_tab-referrals', await referralsPartialData());
  });

  // ===== UPSELL =====

  app.post('/upsell/scan', async (_request, reply) => {
    try {
      const opps = await scanForUpsells();
      if (!opps.length) {
        await insertGrowthLog('upsells', 'scan', 'Scanned for upsell opportunities — none found', 0);
        return reply.type('text/html').render('growth/_tab-upsells', await upsellPartialData({ message: 'No new opportunities detected.' }));
      }

      await insertUpsellOpportunities(opps);
      await insertGrowthLog('upsells', 'scan', `Scanned for upsells — ${opps.length} found`, opps.length);
      return reply.type('text/html').render('growth/_tab-upsells', await upsellPartialData({ message: `${opps.length} opportunity(ies) identified.` }));
    } catch (err) {
      console.error('[growth] Upsell scan failed:', err);
      return reply.type('text/html').render('growth/_tab-upsells', await upsellPartialData({ error: 'Scan failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/upsell/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateUpsellStatus(id, body.status);
    return reply.type('text/html').render('growth/_tab-upsells', await upsellPartialData());
  });
};
