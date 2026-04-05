import type { FastifyPluginAsync } from 'fastify';
import { getClients, getClientByName, getClientEnrichedData, rows } from '../lib/queries.js';

interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  detail: string | null;
  link: string | null;
}

export const clientsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const clients = await getClients();
    reply.render('clients/list', { clients });
  });

  app.get('/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const decoded = decodeURIComponent(name);
    const data = await getClientByName(decoded);
    if (!data.client) { reply.code(404).send('Client not found'); return; }

    const enriched = data.client.id
      ? await getClientEnrichedData(data.client.id)
      : { metaSpend: null, gadsSpend: null, asanaTasks: [], ghlOpps: [], harvestSummary: null, harvestByUser: [], ga4Summary: null, gscSummary: null };

    // Build activity timeline from multiple sources
    const timeline: TimelineEvent[] = [];

    // Meetings
    for (const m of data.meetings.slice(0, 20)) {
      timeline.push({
        date: m.date || '',
        type: 'meeting',
        title: m.title,
        detail: m.category || null,
        link: `/meetings/${m.id}`,
      });
    }

    // Action items completed
    for (const a of data.actions.filter(a => a.completed).slice(0, 10)) {
      timeline.push({
        date: a.meeting_date || a.created_at || '',
        type: 'action',
        title: `Action completed: ${a.description.slice(0, 80)}`,
        detail: a.assignee || null,
        link: null,
      });
    }

    // GHL pipeline changes
    for (const o of enriched.ghlOpps.slice(0, 10)) {
      timeline.push({
        date: o.created_at || '',
        type: 'pipeline',
        title: `Deal: ${o.contact_name || o.name || 'Unknown'}`,
        detail: `${o.stage_name || '?'} — ${o.status}`,
        link: null,
      });
    }

    // Sort by date descending and limit
    timeline.sort((a, b) => b.date.localeCompare(a.date));
    const recentTimeline = timeline.slice(0, 30);

    reply.render('clients/detail', { ...data, enriched, timeline: recentTimeline });
  });
};
