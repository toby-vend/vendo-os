/**
 * Treatment-mappings admin module — UI + mutating endpoints.
 *
 * UI (full layout, CSRF-protected through cookie):
 *   GET  /admin/clients/:clientId/treatment-mappings
 *
 * Mutations (HTMX targets, CSRF-exempt because they live under /api/*):
 *   POST /api/admin/clients/:clientId/treatment-mappings           — create
 *   POST /api/admin/clients/:clientId/treatment-mappings/:id/update — partial update
 *   POST /api/admin/clients/:clientId/treatment-mappings/:id/delete — hard delete
 *   POST /api/admin/clients/:clientId/treatment-mappings/auto-suggest — scan campaigns
 *
 * URL shape is from plan §5.1. The plugin uses full paths internally and is
 * mounted once at root in web/server.ts, so UI + API can share a single file
 * without juggling two prefixes.
 *
 * UK English in comments, labels, and error strings.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import type { SessionUser } from '../../lib/auth.js';
import { getAdminClientDetail } from '../../lib/queries/clients.js';
import {
  listMappingsForClient,
  getMapping,
  createMapping,
  updateMapping,
  deleteMapping,
  listClientCampaigns,
  bulkCreateMappings,
  type AppliesTo,
  type ClientCampaign,
} from '../../lib/queries/treatment-mappings.js';
import {
  classifyByDefaults,
  TREATMENT_DEFAULTS,
} from '../../lib/reports/treatment-defaults.js';

// --- Helpers ---

function requireTeamUser(user: SessionUser | null): user is SessionUser {
  return !!user && (user.role === 'admin' || user.role === 'standard');
}

function field(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const v = (body as Record<string, unknown>)[key];
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
  return typeof v === 'string' ? v : '';
}

function parseAppliesTo(raw: string): AppliesTo | null {
  if (raw === 'meta' || raw === 'google' || raw === 'both') return raw;
  return null;
}

/**
 * Validate the supplied campaign pattern by compiling it. Returns the
 * pattern string when valid, or an error message otherwise. We don't
 * coerce — we just refuse anything that would throw at match-time.
 */
function validateRegex(pattern: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = pattern.trim();
  if (!trimmed) return { ok: false, error: 'Campaign pattern is required.' };
  try {
    new RegExp(trimmed, 'i');
    return { ok: true, value: trimmed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid regex';
    return { ok: false, error: `Invalid regex pattern: ${msg}` };
  }
}

/**
 * Parse the avg_case_value field. Empty string → null (fall through to
 * vertical default). Anything else must be a positive number.
 */
function parseAvgCaseValue(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) {
    return { ok: false, error: 'Average case value must be a positive number, or left blank.' };
  }
  return { ok: true, value: num };
}

function parsePriority(raw: string, fallback = 100): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(9999, Math.trunc(n)));
}

/** Escape every regex metacharacter — used to turn a literal campaign name
 * into a safe regex pattern for the "Add as mapping" sidebar shortcut. */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the view context for the page render or HTMX table refresh.
 * Always fetches mappings + campaigns together so the "unmapped" sidebar
 * stays in sync after every mutation.
 */
async function buildContext(clientId: number) {
  const [detail, mappings, campaigns] = await Promise.all([
    getAdminClientDetail(clientId),
    listMappingsForClient(clientId),
    listClientCampaigns(clientId),
  ]);

  if (!detail.client) return null;

  // Annotate each campaign with the treatment it currently maps to (if
  // any), so the sidebar can hide already-mapped campaigns. A campaign
  // is considered mapped when at least one active mapping's pattern
  // matches its name. We also precompute the suggested pattern string
  // so the view's "Add as mapping" button can hand it to the form with
  // a single dataset attribute — no JS regex-escaping in the template.
  const unmappedCampaigns: Array<ClientCampaign & {
    suggested: string | null;
    suggestedPattern: string;
  }> = [];
  for (const c of campaigns) {
    let isMapped = false;
    for (const m of mappings) {
      try {
        if (new RegExp(m.campaign_pattern, 'i').test(c.name)) { isMapped = true; break; }
      } catch {
        // Skip invalid regexes — they'd never match at lookup time either.
      }
    }
    if (!isMapped) {
      const suggested = classifyByDefaults(c.name);
      const def = suggested ? TREATMENT_DEFAULTS.find(d => d.treatment === suggested) : null;
      const suggestedPattern = def
        ? def.pattern.source
        : escapeForRegex(c.name);
      unmappedCampaigns.push({ ...c, suggested, suggestedPattern });
    }
  }

  return {
    client: detail.client,
    mappings,
    campaigns,
    unmappedCampaigns,
    appliesToOptions: ['both', 'meta', 'google'] as const,
    defaultPatterns: TREATMENT_DEFAULTS.map(d => ({
      treatment: d.treatment,
      pattern: d.pattern.source,
      vertical: d.vertical,
    })),
  };
}

/**
 * Render the mappings page after a mutation. HTMX requests get a small
 * partial; full-page requests (e.g. a curl test) get the whole page.
 */
async function renderTable(
  request: FastifyRequest,
  reply: FastifyReply,
  clientId: number,
  opts: { error?: string; autoSuggestedCount?: number } = {},
): Promise<void> {
  const ctx = await buildContext(clientId);
  if (!ctx) {
    reply.code(404).send('Client not found');
    return;
  }
  const isHtmx = request.headers['hx-request'] === 'true';
  reply.render(
    isHtmx ? 'admin/treatment-mappings-partial' : 'admin/treatment-mappings',
    { ...ctx, error: opts.error, autoSuggestedCount: opts.autoSuggestedCount },
  );
}

// ============================================================================
// Plugin — registered at root in web/server.ts so full paths work as-is.
// ============================================================================

export const treatmentMappingsRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // UI page
  // ──────────────────────────────────────────────────────────────────────
  app.get<{ Params: { clientId: string } }>(
    '/admin/clients/:clientId/treatment-mappings',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.params.clientId);
      if (!Number.isFinite(clientId)) return reply.code(404).send('Not found');

      const ctx = await buildContext(clientId);
      if (!ctx) return reply.code(404).send('Client not found');

      return reply.render('admin/treatment-mappings', ctx);
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // API — create
  // ──────────────────────────────────────────────────────────────────────
  app.post<{ Params: { clientId: string } }>(
    '/api/admin/clients/:clientId/treatment-mappings',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.params.clientId);
      if (!Number.isFinite(clientId)) return reply.code(404).send('Not found');

      const treatmentName = field(request.body, 'treatment_name').trim();
      const campaignPatternRaw = field(request.body, 'campaign_pattern');
      const appliesToRaw = field(request.body, 'applies_to') || 'both';
      const avgCaseRaw = field(request.body, 'avg_case_value_gbp');
      const priorityRaw = field(request.body, 'priority');

      if (!treatmentName) {
        return renderTable(request, reply, clientId, { error: 'Treatment name is required.' });
      }
      const regex = validateRegex(campaignPatternRaw);
      if (!regex.ok) return renderTable(request, reply, clientId, { error: regex.error });

      const appliesTo = parseAppliesTo(appliesToRaw);
      if (!appliesTo) {
        return renderTable(request, reply, clientId, { error: 'Applies-to must be one of: meta, google, both.' });
      }

      const avgCase = parseAvgCaseValue(avgCaseRaw);
      if (!avgCase.ok) return renderTable(request, reply, clientId, { error: avgCase.error });

      await createMapping({
        clientId,
        treatmentName,
        campaignPattern: regex.value,
        appliesTo,
        avgCaseValueGbp: avgCase.value,
        priority: parsePriority(priorityRaw),
        createdBy: user.email,
      });

      return renderTable(request, reply, clientId);
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // API — partial update (HTMX inline-edit)
  // ──────────────────────────────────────────────────────────────────────
  app.post<{ Params: { clientId: string; id: string } }>(
    '/api/admin/clients/:clientId/treatment-mappings/:id/update',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.params.clientId);
      const id = Number(request.params.id);
      if (!Number.isFinite(clientId) || !Number.isFinite(id)) {
        return reply.code(404).send('Not found');
      }

      const existing = await getMapping(id);
      if (!existing || existing.client_id !== clientId) {
        return reply.code(404).send('Mapping not found for this client');
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      const updates: Parameters<typeof updateMapping>[1] = {};

      if ('treatment_name' in body) {
        const v = field(body, 'treatment_name').trim();
        if (!v) return renderTable(request, reply, clientId, { error: 'Treatment name cannot be empty.' });
        updates.treatmentName = v;
      }
      if ('campaign_pattern' in body) {
        const regex = validateRegex(field(body, 'campaign_pattern'));
        if (!regex.ok) return renderTable(request, reply, clientId, { error: regex.error });
        updates.campaignPattern = regex.value;
      }
      if ('applies_to' in body) {
        const a = parseAppliesTo(field(body, 'applies_to'));
        if (!a) return renderTable(request, reply, clientId, { error: 'Applies-to must be one of: meta, google, both.' });
        updates.appliesTo = a;
      }
      if ('avg_case_value_gbp' in body) {
        const acv = parseAvgCaseValue(field(body, 'avg_case_value_gbp'));
        if (!acv.ok) return renderTable(request, reply, clientId, { error: acv.error });
        updates.avgCaseValueGbp = acv.value;
      }
      if ('priority' in body) {
        updates.priority = parsePriority(field(body, 'priority'));
      }
      // is_active. The inline-edit form ALWAYS includes a hidden
      // `is_active_present=1` marker so we can tell "form omitted the
      // field" (don't touch it) from "checkbox is unticked" (set to 0).
      // The checkbox itself only appears in the body when ticked.
      if ('is_active_present' in body) {
        const raw = field(body, 'is_active');
        const truthy = raw === 'on' || raw === '1' || raw === 'true';
        updates.isActive = truthy;
      } else if ('is_active' in body) {
        // Direct API caller — accept explicit value.
        const raw = field(body, 'is_active');
        updates.isActive = raw === 'on' || raw === '1' || raw === 'true';
      }

      await updateMapping(id, updates);
      return renderTable(request, reply, clientId);
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // API — delete
  // ──────────────────────────────────────────────────────────────────────
  app.post<{ Params: { clientId: string; id: string } }>(
    '/api/admin/clients/:clientId/treatment-mappings/:id/delete',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.params.clientId);
      const id = Number(request.params.id);
      if (!Number.isFinite(clientId) || !Number.isFinite(id)) {
        return reply.code(404).send('Not found');
      }

      const existing = await getMapping(id);
      if (!existing || existing.client_id !== clientId) {
        return reply.code(404).send('Mapping not found for this client');
      }

      await deleteMapping(id);
      return renderTable(request, reply, clientId);
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // API — auto-suggest
  // ──────────────────────────────────────────────────────────────────────
  app.post<{ Params: { clientId: string } }>(
    '/api/admin/clients/:clientId/treatment-mappings/auto-suggest',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.params.clientId);
      if (!Number.isFinite(clientId)) return reply.code(404).send('Not found');

      const [existing, campaigns] = await Promise.all([
        listMappingsForClient(clientId),
        listClientCampaigns(clientId),
      ]);

      // Treatments already represented on this client (case-insensitive set).
      const mappedTreatments = new Set(
        existing.map(m => m.treatment_name.trim().toLowerCase()),
      );

      // De-dupe inside a single auto-suggest run so we don't insert
      // "Invisalign & Ortho" twice when two campaigns both match it.
      const seenInRun = new Set<string>();
      const toInsert: Parameters<typeof bulkCreateMappings>[1] = [];

      for (const campaign of campaigns) {
        const treatment = classifyByDefaults(campaign.name);
        if (!treatment) continue; // "Other" / unknown — skip, don't fabricate
        const key = treatment.toLowerCase();
        if (mappedTreatments.has(key) || seenInRun.has(key)) continue;

        const def = TREATMENT_DEFAULTS.find(d => d.treatment === treatment);
        if (!def) continue;

        toInsert.push({
          treatmentName: treatment,
          campaignPattern: def.pattern.source,
          appliesTo: 'both',
          avgCaseValueGbp: null,
          priority: 100,
        });
        seenInRun.add(key);
      }

      const inserted = await bulkCreateMappings(clientId, toInsert, user.email);
      return renderTable(request, reply, clientId, { autoSuggestedCount: inserted });
    },
  );
};
