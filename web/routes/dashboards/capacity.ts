import type { FastifyPluginAsync } from 'fastify';
import { getCapacityData } from '../../lib/queries.js';

export const capacityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const data = await getCapacityData(days);

    // Group by role/department
    const departments = new Map<string, typeof data>();
    for (const row of data) {
      const dept = row.roles || 'Unassigned';
      const existing = departments.get(dept) || [];
      existing.push(row);
      departments.set(dept, existing);
    }

    // Company-wide stats
    const totalHours = data.reduce((s, r) => s + r.hours_logged, 0);
    const totalCapacity = data.reduce((s, r) => s + r.weekly_capacity, 0);
    const companyUtilisation = totalCapacity > 0 ? Math.round(totalHours / totalCapacity * 1000) / 10 : 0;

    reply.render('dashboards/capacity', { data, departments, days, companyUtilisation, totalHours, totalCapacity, query: q });
  });
};
