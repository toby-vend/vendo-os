import type { FastifyPluginAsync } from 'fastify';
import {
  getLinkedInPipeline, getLinkedInStats,
  getOutboundPipeline, getOutboundFunnel,
  getCaseStudies, getCaseStudyStats,
  getReferrals, getReferralStats,
  getUpsellOpportunities,
} from '../lib/queries.js';

export const growthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [
      linkedinStats, linkedinPosts,
      outboundFunnel, outboundPipeline,
      caseStudyStats, caseStudies,
      referralStats, referrals,
      upsells,
    ] = await Promise.all([
      getLinkedInStats(), getLinkedInPipeline(),
      getOutboundFunnel(), getOutboundPipeline(),
      getCaseStudyStats(), getCaseStudies(),
      getReferralStats(), getReferrals(),
      getUpsellOpportunities(),
    ]);

    reply.render('growth/index', {
      linkedinStats, linkedinPosts,
      outboundFunnel, outboundPipeline,
      caseStudyStats, caseStudies,
      referralStats, referrals,
      upsells,
    });
  });
};
