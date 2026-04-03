import type { FastifyPluginAsync } from 'fastify';
import { getReviewData, getReviewSchedule } from '../../lib/queries.js';

export const reviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [reviews, schedule] = await Promise.all([
      getReviewData(),
      getReviewSchedule(),
    ]);
    const overdueCount = schedule.filter(s => s.overdue).length;
    const completedCount = reviews.filter(r => r.status === 'completed').length;
    const completionRate = reviews.length > 0 ? Math.round(completedCount / reviews.length * 100) : 0;
    reply.render('dashboards/reviews', { reviews, schedule, overdueCount, completedCount, completionRate });
  });
};
