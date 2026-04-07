import type { FastifyPluginAsync } from 'fastify';
import {
  getServiceConfigs,
  upsertServiceConfig,
  deleteServiceConfig,
  getMonthlyHoursForService,
  getPersonCapacity,
  getCompletions,
  toggleCompletion,
  getDistinctPeople,
  generateMonths,
  clearInitialsCache,
} from '../lib/queries/deliverables.js';

/** Parse a CSV line respecting quoted fields (handles commas inside quotes). */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const SERVICE_TYPES = ['paid_search', 'seo', 'paid_social'];
const SERVICE_LABELS: Record<string, string> = {
  paid_search: 'Paid Search',
  seo: 'SEO',
  paid_social: 'Paid Social / Creative',
};

export const deliverablesRoutes: FastifyPluginAsync = async (app) => {

  // ── Main view ──────────────────────────────────────────────

  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const serviceType = SERVICE_TYPES.includes(q.service) ? q.service : 'paid_search';
    const filterPerson = q.person || '';
    const monthCount = parseInt(q.months || '6', 10);
    const months = generateMonths(Math.min(monthCount, 12));

    const filters: { serviceType: string; am?: string; cm?: string } = { serviceType };
    if (filterPerson) {
      // Filter by person — check both AM and CM columns
      // We'll fetch all and filter in JS since SQL OR is awkward with optional params
    }

    let configs = await getServiceConfigs({ serviceType });
    if (filterPerson) {
      configs = configs.filter(c => c.am === filterPerson || c.cm === filterPerson);
    }

    const [monthlyHours, completions, people, capacity] = await Promise.all([
      getMonthlyHoursForService(serviceType, months),
      getCompletions(serviceType, months),
      getDistinctPeople(),
      getPersonCapacity(serviceType, months[months.length - 1]),
    ]);

    // Build lookup maps
    const hoursMap: Record<string, { am: number; cm: number; total: number }> = {};
    for (const h of monthlyHours) {
      hoursMap[`${h.client_name}::${h.month}`] = { am: h.am_hours, cm: h.cm_hours, total: h.total_hours };
    }

    const completionMap: Record<string, boolean> = {};
    for (const c of completions) {
      completionMap[`${c.client_name}::${c.month}`] = c.completed === 1;
    }

    // Calculate totals per month
    const monthTotals: Record<string, { am: number; cm: number }> = {};
    for (const m of months) {
      monthTotals[m] = { am: 0, cm: 0 };
    }
    for (const config of configs) {
      for (const m of months) {
        const key = `${config.client_name}::${m}`;
        const hours = hoursMap[key];
        if (hours) {
          monthTotals[m].am += hours.am;
          monthTotals[m].cm += hours.cm;
        }
      }
    }

    // Total allocated hours
    const totalAllocatedAM = configs.reduce((s, c) => s + c.am_hrs, 0);
    const totalAllocatedCM = configs.reduce((s, c) => s + c.cm_hrs, 0);

    reply.render('deliverables', {
      configs,
      months,
      hoursMap,
      completionMap,
      monthTotals,
      totalAllocatedAM,
      totalAllocatedCM,
      capacity,
      people,
      serviceType,
      serviceTypes: SERVICE_TYPES,
      serviceLabels: SERVICE_LABELS,
      filterPerson,
      monthCount,
      pageTitle: `Deliverables — ${SERVICE_LABELS[serviceType]}`,
    });
  });

  // ── Add/Edit config (HTMX form) ───────────────────────────

  app.post('/config', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const user = (request as any).user;

    await upsertServiceConfig({
      client_name: body.client_name?.trim(),
      service_type: body.service_type,
      am: body.am?.trim() || null,
      cm: body.cm?.trim() || null,
      level: body.level || 'Auto',
      tier: parseInt(body.tier || '3', 10),
      calls: parseInt(body.calls || '1', 10),
      am_hrs: parseFloat(body.am_hrs || '2'),
      cm_hrs: parseFloat(body.cm_hrs || '2'),
      budget: parseFloat(body.budget || '0'),
      currency: body.currency || 'GBP',
      status: body.status || 'active',
    });

    clearInitialsCache();
    reply.redirect(`/deliverables?service=${body.service_type}`);
  });

  // ── Delete config ──────────────────────────────────────────

  app.post('/config/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as Record<string, string>;
    await deleteServiceConfig(parseInt(id, 10));
    reply.redirect(`/deliverables?service=${q.service || 'paid_search'}`);
  });

  // ── Toggle deliverable completion (HTMX) ───────────────────

  app.post('/complete', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const user = (request as any).user;
    const completed = await toggleCompletion(
      body.client_name,
      body.service_type,
      body.month,
      user?.name || 'Unknown',
    );
    // Return just the checkbox HTML for HTMX swap
    const icon = completed
      ? '<svg viewBox="0 0 24 24" fill="var(--vendo-green)" width="18" height="18"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';
    reply.type('text/html').send(icon);
  });

  // ── Bulk import form ───────────────────────────────────────

  app.get('/import', async (request, reply) => {
    const q = request.query as Record<string, string>;
    reply.render('deliverables-import', {
      serviceType: q.service || 'paid_search',
      serviceTypes: SERVICE_TYPES,
      serviceLabels: SERVICE_LABELS,
      pageTitle: 'Import Deliverables',
    });
  });

  app.post('/import', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const serviceType = body.service_type || 'paid_search';
    const csvData = body.csv_data || '';

    const lines = csvData.split('\n').filter(l => l.trim());
    let imported = 0;

    for (const line of lines) {
      const parts = parseCsvLine(line);
      if (parts.length < 2) continue;

      // Skip header rows and legend rows
      const first = parts[0].toLowerCase().trim();
      if (first === 'client_name' || first === 'account name' || first === '' || first.startsWith('am hrs')) continue;

      const clientName = parts[0].trim();
      if (!clientName) continue;

      // Parse budget — strip currency symbols, commas, quotes
      const budgetRaw = (parts[8] || '0').replace(/[£€$,\s"]/g, '');
      const budget = parseFloat(budgetRaw) || 0;

      // Detect currency from budget string
      const budgetStr = parts[8] || '';
      const currency = budgetStr.includes('€') ? 'EUR' : 'GBP';

      await upsertServiceConfig({
        client_name: clientName,
        service_type: serviceType,
        am: parts[1]?.trim() || null,
        cm: parts[2]?.trim() || null,
        level: (parts[3] || 'Auto').trim(),
        tier: parseInt(parts[7] || '3', 10),
        calls: parseInt(parts[4] || '1', 10),
        am_hrs: parseFloat(parts[5] || '2') || 2,
        cm_hrs: parseFloat(parts[6] || '2') || 2,
        budget,
        currency,
        status: 'active',
      });
      imported++;
    }

    clearInitialsCache();
    reply.redirect(`/deliverables?service=${serviceType}&imported=${imported}`);
  });
};
