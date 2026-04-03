import type { FastifyPluginAsync } from 'fastify';
import { getClientProfitability } from '../../lib/queries.js';

export const profitabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const costRate = parseFloat(q.costRate || '35');
    const rawData = await getClientProfitability(costRate);

    // Calculate margin fields
    const data = rawData.map(r => {
      const mrr = r.mrr ?? 0;
      const margin = mrr - r.cost;
      const marginPct = mrr > 0 ? Math.round(margin / mrr * 1000) / 10 : 0;
      return { ...r, mrr, margin, margin_pct: marginPct };
    }).filter(r => r.mrr > 0 || r.hours > 0);

    const totalMRR = data.reduce((s, r) => s + r.mrr, 0);
    const totalCost = data.reduce((s, r) => s + r.cost, 0);
    const totalMargin = totalMRR - totalCost;
    const avgMarginPct = totalMRR > 0 ? Math.round(totalMargin / totalMRR * 1000) / 10 : 0;
    const lossMaking = data.filter(r => r.margin < 0).length;

    reply.render('dashboards/profitability', { data, costRate, totalMRR, totalCost, totalMargin, avgMarginPct, lossMaking, query: q });
  });
};
