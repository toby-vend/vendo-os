import type { FastifyPluginAsync } from 'fastify';
import {
  getLinkedInPipeline, getLinkedInStats, getLinkedInPost,
  getRecentMeetingsForLinkedIn, getMeetingSummaryForPost,
  insertLinkedInIdeas, updateLinkedInDraft, updateLinkedInStatus,
  getOutboundPipeline, getOutboundFunnel, getProspect,
  insertProspect, updateOutboundDraft, updateOutboundStatus, updateOutboundResponse,
  getCaseStudies, getCaseStudyStats, getCaseStudy,
  insertCaseStudies, updateCaseStudyDraft, updateCaseStudyStatus, updateCaseStudyApproval,
  getReferrals, getReferralStats,
  insertReferral, updateReferralStatus, markReferralPaid,
  getUpsellOpportunities,
  insertUpsellOpportunities, updateUpsellStatus,
} from '../lib/queries.js';
import {
  generateLinkedInIdeas, draftLinkedInPost,
  draftOutboundMessage, scanForCaseStudyWins, draftCaseStudy,
  scanForUpsells, scoreIcpMatch,
} from '../lib/growth-ai.js';

// --- Helpers ---

async function linkedinPartialData(extra: Record<string, unknown> = {}) {
  const [linkedinPosts, recentMeetings] = await Promise.all([getLinkedInPipeline(), getRecentMeetingsForLinkedIn()]);
  return { linkedinPosts, recentMeetings, ...extra };
}

async function outboundPartialData(extra: Record<string, unknown> = {}) {
  return { outboundFunnel: await getOutboundFunnel(), outboundPipeline: await getOutboundPipeline(), ...extra };
}

async function casestudiesPartialData(extra: Record<string, unknown> = {}) {
  return { caseStudies: await getCaseStudies(), ...extra };
}

async function referralsPartialData(extra: Record<string, unknown> = {}) {
  return { referrals: await getReferrals(), ...extra };
}

async function upsellPartialData(extra: Record<string, unknown> = {}) {
  return { upsells: await getUpsellOpportunities(), ...extra };
}

export const growthRoutes: FastifyPluginAsync = async (app) => {

  // ===== MAIN PAGE =====

  app.get('/', async (_request, reply) => {
    const [
      linkedinStats, linkedinPosts, recentMeetings,
      outboundFunnel, outboundPipeline,
      caseStudyStats, caseStudies,
      referralStats, referrals,
      upsells,
    ] = await Promise.all([
      getLinkedInStats(), getLinkedInPipeline(), getRecentMeetingsForLinkedIn(),
      getOutboundFunnel(), getOutboundPipeline(),
      getCaseStudyStats(), getCaseStudies(),
      getReferralStats(), getReferrals(),
      getUpsellOpportunities(),
    ]);

    reply.render('growth/index', {
      linkedinStats, linkedinPosts, recentMeetings,
      outboundFunnel, outboundPipeline,
      caseStudyStats, caseStudies,
      referralStats, referrals,
      upsells,
    });
  });

  // ===== LINKEDIN =====

  app.post('/linkedin/generate-ideas', async (request, reply) => {
    try {
      const body = request.body as Record<string, string> | undefined;
      const meetingId = body?.meetingId || undefined;
      const ideas = await generateLinkedInIdeas(meetingId);
      if (!ideas.length) {
        return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData({ error: 'No ideas generated — check meeting data.' }));
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

      return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData({ message: `${ideas.length} content ideas generated.` }));
    } catch (err) {
      console.error('[growth] Failed to generate ideas:', err);
      return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData({ error: 'Failed to generate ideas. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/linkedin/:id/draft', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const post = await getLinkedInPost(id);
      if (!post) return reply.code(404).send('Post not found');

      const draft = await draftLinkedInPost(post.pillar, post.topic);
      await updateLinkedInDraft(id, draft);

      return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData({ message: 'Draft created.' }));
    } catch (err) {
      console.error('[growth] LinkedIn draft failed:', err);
      return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/linkedin/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateLinkedInStatus(id, body.status);
    // If redirected from detail page, go back there
    if (body._redirect && body._redirect.startsWith('/') && !body._redirect.startsWith('//')) return reply.redirect(body._redirect);
    return reply.type('text/html').render('growth/_linkedin-table', await linkedinPartialData());
  });

  // LinkedIn detail page
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

  // Draft from detail page (same logic, redirects back to detail)
  app.post<{ Params: { id: string } }>('/linkedin/:id/draft-and-return', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    try {
      const post = await getLinkedInPost(id);
      if (!post) return reply.code(404).send('Post not found');

      const draft = await draftLinkedInPost(post.pillar, post.topic);
      await updateLinkedInDraft(id, draft);
      return reply.redirect(`/growth/linkedin/${id}`);
    } catch {
      return reply.redirect(`/growth/linkedin/${id}?error=draft_failed`);
    }
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

      return reply.type('text/html').render('growth/_outbound-table', await outboundPartialData({ message: 'Outreach draft generated.' }));
    } catch (err) {
      console.error('[growth] Outbound draft failed:', err);
      return reply.type('text/html').render('growth/_outbound-table', await outboundPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/outbound/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateOutboundStatus(id, body.status);
    return reply.type('text/html').render('growth/_outbound-table', await outboundPartialData());
  });

  app.post<{ Params: { id: string } }>('/outbound/:id/response', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    if (body.response) await updateOutboundResponse(id, body.response);
    return reply.type('text/html').render('growth/_outbound-table', await outboundPartialData());
  });

  // ===== CASE STUDIES =====

  app.post('/casestudies/scan', async (_request, reply) => {
    try {
      const wins = await scanForCaseStudyWins();
      if (!wins.length) {
        return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData({ message: 'No new wins detected this period.' }));
      }

      await insertCaseStudies(wins.map((w) => ({ clientName: w.clientName, winType: w.winType, metric: w.metric })));
      return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData({ message: `${wins.length} win(s) identified.` }));
    } catch (err) {
      console.error('[growth] Case study scan failed:', err);
      return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData({ error: 'Scan failed. Please try again.' }));
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
      return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData({ message: 'Case study drafted.' }));
    } catch (err) {
      console.error('[growth] Case study draft failed:', err);
      return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData({ error: 'Draft failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/casestudies/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateCaseStudyStatus(id, body.status);
    return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData());
  });

  app.post<{ Params: { id: string } }>('/casestudies/:id/approval', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    const approved = body.approval === 'approved';
    const anonymous = body.approval === 'anonymous';
    await updateCaseStudyApproval(id, approved, anonymous);
    return reply.type('text/html').render('growth/_casestudies-table', await casestudiesPartialData());
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

    return reply.redirect('/growth');
  });

  app.post<{ Params: { id: string } }>('/referrals/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateReferralStatus(id, body.status);
    return reply.type('text/html').render('growth/_referrals-table', await referralsPartialData());
  });

  app.post<{ Params: { id: string } }>('/referrals/:id/paid', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    await markReferralPaid(id);
    return reply.type('text/html').render('growth/_referrals-table', await referralsPartialData());
  });

  // ===== UPSELL =====

  app.post('/upsell/scan', async (_request, reply) => {
    try {
      const opps = await scanForUpsells();
      if (!opps.length) {
        return reply.type('text/html').render('growth/_upsell-table', await upsellPartialData({ message: 'No new opportunities detected.' }));
      }

      await insertUpsellOpportunities(opps);
      return reply.type('text/html').render('growth/_upsell-table', await upsellPartialData({ message: `${opps.length} opportunity(ies) identified.` }));
    } catch (err) {
      console.error('[growth] Upsell scan failed:', err);
      return reply.type('text/html').render('growth/_upsell-table', await upsellPartialData({ error: 'Scan failed. Please try again.' }));
    }
  });

  app.post<{ Params: { id: string } }>('/upsell/:id/status', async (request, reply) => {
    const id = parseInt((request.params as { id: string }).id, 10);
    const body = request.body as Record<string, string>;
    await updateUpsellStatus(id, body.status);
    return reply.type('text/html').render('growth/_upsell-table', await upsellPartialData());
  });
};
