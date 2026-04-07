import type { FastifyPluginAsync } from 'fastify';
import {
  getServiceConfigs,
  getServiceConfigsForUser,
  getServiceTypesForUser,
  upsertServiceConfig,
  updateConfigField,
  deleteServiceConfig,
  getPersonCapacity,
  getCompletions,
  toggleCompletion,
  getDistinctPeople,
  generateMonths,
  clearInitialsCache,
  getUserInitials,
  getAggregatedHours,
  upsertHourEntry,
  deleteHourEntry,
  parseMultiPerson,
  getTeamMembers,
  getTeamMembersForService,
  upsertTeamMember,
  deleteTeamMember,
  getVendoUsers,
} from '../lib/queries/deliverables.js';

// --- Input sanitisation helpers ---

/** Strip HTML/script tags and trim to max length. */
function sanitise(val: string | undefined, maxLen: number): string {
  if (!val) return '';
  return val.trim().replace(/<[^>]*>/g, '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '').slice(0, maxLen);
}

/** Parse int, clamp between min/max, fallback to def. */
function clampInt(val: string | undefined, min: number, max: number, def: number): number {
  const n = parseInt((val || '').trim(), 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

/** Parse float, clamp between min/max, fallback to def. */
function clampFloat(val: string | undefined, min: number, max: number, def: number): number {
  const n = parseFloat((val || '').trim());
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

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
    const user = (request as any).user;
    const isAdmin = user?.role === 'admin';
    const userInitials = user ? await getUserInitials(user.name, user.id) : '';

    // Determine which service tabs this user can see
    const allowedServiceTypes = isAdmin
      ? SERVICE_TYPES
      : await getServiceTypesForUser(userInitials);

    // Default to first allowed tab, or requested if permitted
    let serviceType = SERVICE_TYPES.includes(q.service) ? q.service : allowedServiceTypes[0] || 'paid_search';
    if (!isAdmin && !allowedServiceTypes.includes(serviceType)) {
      serviceType = allowedServiceTypes[0] || 'paid_search';
    }

    const filterPerson = q.person || '';
    const monthCount = parseInt(q.months || '3', 10);
    const months = generateMonths(Math.min(monthCount, 12)).reverse();

    // Get configs — staff only see their assigned clients
    let configs = isAdmin
      ? await getServiceConfigs({ serviceType })
      : await getServiceConfigsForUser(serviceType, userInitials);

    if (filterPerson && isAdmin) {
      configs = configs.filter(c => {
        const ams = parseMultiPerson(c.am);
        const cms = parseMultiPerson(c.cm);
        return ams.includes(filterPerson) || cms.includes(filterPerson);
      });
    }

    const [hoursAgg, completions, people, capacity, teamForService] = await Promise.all([
      getAggregatedHours(serviceType, months),
      getCompletions(serviceType, months),
      isAdmin ? getDistinctPeople() : Promise.resolve([]),
      getPersonCapacity(serviceType, months[months.length - 1] || months[0]),
      getTeamMembersForService(serviceType),
    ]);

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
        const agg = hoursAgg[key];
        if (agg) {
          monthTotals[m].am += agg.am.total;
          monthTotals[m].cm += agg.cm.total;
        }
      }
    }

    const totalAllocatedAM = configs.reduce((s, c) => s + c.am_hrs, 0);
    const totalAllocatedCM = configs.reduce((s, c) => s + c.cm_hrs, 0);

    reply.render('deliverables', {
      configs,
      months,
      hoursAgg,
      completionMap,
      monthTotals,
      totalAllocatedAM,
      totalAllocatedCM,
      capacity,
      people,
      serviceType,
      serviceTypes: SERVICE_TYPES,
      allowedServiceTypes,
      serviceLabels: SERVICE_LABELS,
      filterPerson,
      monthCount,
      showBudget: serviceType !== 'seo',
      showCS: serviceType === 'paid_social',
      isAdmin,
      userInitials,
      teamForService,
      userName: user?.name || '',
      pageTitle: `Deliverables — ${SERVICE_LABELS[serviceType]}`,
    });
  });

  // ── Hour entry (HTMX) ───────────────────────────────────────

  app.post('/hours', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const user = (request as any).user;
    const isAdmin = user?.role === 'admin';
    const userInitials = user ? await getUserInitials(user.name) : '';

    const clientName = body.client_name;
    const serviceType = body.service_type;
    const month = body.month;
    const role = body.role; // 'am' or 'cm'
    const rawHours = clampFloat(body.hours, 0, 200, 0);
    const hours = Math.round(rawHours * 2) / 2; // Round to nearest 0.5
    const targetInitials = body.user_initials || userInitials;

    // Staff can only edit their own hours
    if (!isAdmin && targetInitials !== userInitials) {
      reply.code(403).type('text/html').send('<span style="color:#EF4444">Not allowed</span>');
      return;
    }

    if (hours > 0) {
      await upsertHourEntry(clientName, serviceType, month, targetInitials, user?.name || targetInitials, role, hours);
    } else {
      await deleteHourEntry(clientName, serviceType, month, targetInitials, role);
    }

    // Return updated cell content
    const agg = await getAggregatedHours(serviceType, [month]);
    const key = `${clientName}::${month}`;
    const data = agg[key];
    const val = role === 'am' ? data?.am : data?.cm;
    const total = val?.total || 0;
    const breakdown = (val?.breakdown || []).map(b => `${b.user_initials}: ${b.hours}h`).join(', ');

    reply.type('text/html').send(
      total > 0
        ? `<span title="${breakdown}">${total}</span>`
        : ''
    );
  });

  // ── Update single config field (admin only, HTMX) ─────────

  app.post('/config/:id/field', async (request, reply) => {
    if ((request as any).user?.role !== 'admin') { reply.code(403).send('Admin only'); return; }
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const field = body.field;
    const rawValue = body.value?.trim() ?? '';

    const numericFields = ['tier', 'calls', 'am_hrs', 'cm_hrs', 'cs_hrs', 'budget'];
    let value: string | number = rawValue;
    if (numericFields.includes(field)) {
      let n = parseFloat(rawValue) || 0;
      if (field === 'am_hrs' || field === 'cm_hrs' || field === 'cs_hrs') n = Math.round(n * 2) / 2;
      value = n;
    }

    try {
      await updateConfigField(parseInt(id, 10), field, value);
      clearInitialsCache();
      reply.type('text/html').send(String(rawValue || '—'));
    } catch (err: any) {
      reply.code(400).type('text/html').send(err.message);
    }
  });

  // ── Add new config (admin only) ──────────────────────────

  app.post('/config', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const user = (request as any).user;

    if (user?.role !== 'admin') {
      reply.code(403).send('Admin only');
      return;
    }

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
    if ((request as any).user?.role !== 'admin') { reply.code(403).send('Admin only'); return; }
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

  // ── Team settings (admin only) ──────────────────────────────

  app.get('/settings', async (request, reply) => {
    if ((request as any).user?.role !== 'admin') { reply.code(403).send('Admin only'); return; }
    const [members, users] = await Promise.all([
      getTeamMembers(false),
      getVendoUsers(),
    ]);
    reply.render('deliverables-settings', {
      members,
      users,
      serviceTypes: SERVICE_TYPES,
      serviceLabels: SERVICE_LABELS,
      pageTitle: 'Deliverables — Team Settings',
    });
  });

  app.post('/settings/member', async (request, reply) => {
    if ((request as any).user?.role !== 'admin') { reply.code(403).send('Admin only'); return; }
    const body = request.body as Record<string, string>;
    const initials = sanitise(body.initials, 10).toUpperCase();
    if (!initials) { reply.redirect('/deliverables/settings'); return; }

    const serviceTypes = SERVICE_TYPES.filter(st => body['service_' + st] === 'on').join(',') || 'paid_search';
    const roles = ['am', 'cm'].filter(r => body['role_' + r] === 'on').join(',') || 'am,cm';

    await upsertTeamMember({
      initials,
      name: sanitise(body.name, 50) || initials,
      user_id: body.user_id || null,
      service_types: serviceTypes,
      roles,
      is_active: body.is_active === 'on' ? 1 : 0,
    });
    reply.redirect('/deliverables/settings');
  });

  app.post('/settings/member/:id/delete', async (request, reply) => {
    if ((request as any).user?.role !== 'admin') { reply.code(403).send('Admin only'); return; }
    const { id } = request.params as { id: string };
    await deleteTeamMember(parseInt(id, 10));
    reply.redirect('/deliverables/settings');
  });
};
