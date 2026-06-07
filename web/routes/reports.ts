/**
 * Client Reporting module — UI pages and mutating API endpoints.
 *
 * Pages (`/reports/*`): list, new, editor, preview, text.
 * Mutations (`/api/reports/*`): create, save narrative, screenshot CRUD, AI
 * generate, finalise, delete. Mounted under /api/* so the global CSRF hook
 * skips them (HTMX requests use session cookie auth instead).
 */
import type { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from '@fastify/multipart';

import type { SessionUser } from '../lib/auth.js';
import {
  validateImageBuffer,
  uploadImage as uploadImageToBlob,
  validateCsvBuffer,
  uploadCsv,
  looksLikeCsvFilename,
  MAX_FILE_BYTES,
  UploadValidationError,
} from '../lib/blob-uploads.js';
import {
  listReports,
  listReviewQueue,
  getReport,
  createReport,
  findReport,
  listScreenshots,
  addScreenshot,
  updateScreenshot,
  deleteScreenshot,
  reorderScreenshots,
  updateNarrative,
  updateAiBlock,
  submitForReview,
  approveReport,
  reopenReport,
  deleteReport,
  listActiveClientsForReports,
  PLATFORM_OPTIONS,
  CHANNEL_OPTIONS,
  CHANNEL_PLATFORMS,
  channelLabel,
  isReportChannel,
  type ScreenshotPlatform,
  type ReportStatus,
  type ReportChannel,
} from '../lib/queries/reports.js';
import { generateReportForId } from '../lib/reports/generate.js';
import { fetchGadsChangeHistory } from '../lib/reports/gads-change-history.js';
import { safeStringify } from '../lib/reports/dashboard-shell.js';
import { buildDashboardData, recomputeDashboard } from '../lib/reports/build-dashboard-data.js';

// --- Helpers ---

function requireTeamUser(user: SessionUser | null): user is SessionUser {
  return !!user && (user.role === 'admin' || user.role === 'standard');
}

/**
 * AM-role check. Admins always count. Otherwise the user must hold the
 * `chat-am` channel slug — the existing per-user Account Manager flag in
 * SessionUser.channels (mapped via user_channels → channels.slug). No new
 * column needed; AMs already get this slug when an admin grants them
 * access to the /chat/am specialist.
 */
function isAmUser(user: SessionUser | null): user is SessionUser {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.channels.includes('chat-am') || user.allowedRoutes.includes('chat-am');
}

function field(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const v = (body as Record<string, unknown>)[key];
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
  return typeof v === 'string' ? v : '';
}

function fieldArray(body: unknown, key: string): string[] {
  if (!body || typeof body !== 'object') return [];
  const v = (body as Record<string, unknown>)[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') return [v];
  return [];
}

function isValidPlatform(p: string): p is ScreenshotPlatform {
  return PLATFORM_OPTIONS.some(opt => opt.value === p);
}

/**
 * Compute period_label / period_start / period_end from a YYYY-MM string.
 * Returns null if the input doesn't match.
 */
function monthToPeriod(yyyyMM: string): { label: string; start: string; end: string } | null {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  const startDate = new Date(Date.UTC(year, monthIdx, 1));
  const endDate = new Date(Date.UTC(year, monthIdx + 1, 0));
  const monthName = startDate.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    label: `${monthName} ${year}`,
    start: `${year}-${pad(monthIdx + 1)}-01`,
    end: `${year}-${pad(monthIdx + 1)}-${pad(endDate.getUTCDate())}`,
  };
}

function defaultMonthYYYYMM(): string {
  // Default to *previous* month — that's the period typically being reported on.
  const now = new Date();
  now.setUTCDate(1);
  now.setUTCMonth(now.getUTCMonth() - 1);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// ============================================================================
// /reports/* — UI pages (full layout)
// ============================================================================

export const reportsUiRoutes: FastifyPluginAsync = async (app) => {
  // List
  app.get<{ Querystring: { client?: string; status?: string } }>('/', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clientId = request.query.client ? Number(request.query.client) : undefined;
    const status = (request.query.status === 'draft' || request.query.status === 'review' || request.query.status === 'final')
      ? request.query.status as ReportStatus
      : undefined;

    const [items, clients, reviewQueue] = await Promise.all([
      listReports({ clientId, status }),
      listActiveClientsForReports(),
      listReviewQueue(),
    ]);

    return reply.render('reports/list', {
      items,
      clients,
      filterClientId: clientId ?? '',
      filterStatus: status ?? '',
      reviewCount: reviewQueue.length,
      isAm: isAmUser(user),
    });
  });

  // New form
  app.get('/new', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clients = await listActiveClientsForReports();
    return reply.render('reports/new', {
      clients,
      channelOptions: CHANNEL_OPTIONS,
      defaultMonth: defaultMonthYYYYMM(),
    });
  });

  // Editor
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');
    const screenshots = await listScreenshots(id);

    // Sibling reports for this client + period, so the channel selector can
    // show which channels already have a report vs which need generating.
    const siblings = await listReports({ clientId: report.client_id, limit: 50 });
    const siblingByChannel: Record<string, number> = {};
    for (const s of siblings) {
      if (s.period_start === report.period_start && s.period_end === report.period_end) {
        siblingByChannel[s.channel] = s.id;
      }
    }

    return reply.render('reports/editor', {
      report,
      screenshots,
      platforms: PLATFORM_OPTIONS,
      // Only allow tagging screenshots with this report's channel platforms.
      channelPlatforms: PLATFORM_OPTIONS.filter(p => CHANNEL_PLATFORMS[report.channel].includes(p.value)),
      channelOptions: CHANNEL_OPTIONS,
      channelLabel: channelLabel(report.channel),
      monthValue: report.period_start.slice(0, 7),
      siblingByChannel,
      isAm: isAmUser(user),
    });
  });

  // Switch to a different month/channel for the same client. Redirects to the
  // matching report, or to a "generate this report" page when none exists yet.
  app.get<{ Querystring: { clientId?: string; month?: string; channel?: string } }>(
    '/switch',
    async (request, reply) => {
      const user = (request as any).user as SessionUser | null;
      if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

      const clientId = Number(request.query.clientId);
      const channel: ReportChannel = isReportChannel(request.query.channel) ? request.query.channel : 'google_ads';
      const period = monthToPeriod(request.query.month ?? '');
      if (!Number.isFinite(clientId) || !period) return reply.code(400).send('Invalid client or month');

      const existing = await findReport(clientId, period.start, period.end, channel);
      if (existing) return reply.redirect(`/reports/${existing}`);

      const clients = await listActiveClientsForReports();
      const client = clients.find(c => c.id === clientId);
      return reply.render('reports/generate-missing', {
        clientId,
        clientName: client ? (client.display_name || client.name) : `Client ${clientId}`,
        channel,
        channelLabel: channelLabel(channel),
        month: request.query.month,
        periodLabel: period.label,
      });
    },
  );

  // ── v2 dashboard ─────────────────────────────────────────────────────────
  // Renders the React shell. The full DashboardPayload is assembled by
  // buildDashboardData (cached in client_report_data_cache). Aggregators
  // for each block live in web/lib/reports/aggregators/.
  // See plans/2026-05-12-client-report-v2-tab-dashboard.md.
  app.get<{ Params: { id: string } }>('/:id/view', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');

    const payload = await buildDashboardData(id, { mode: 'internal' });
    return reply.render('reports/dashboard', {
      client: payload.client,
      payloadJson: safeStringify(payload),
    });
  });

  // Polished print-friendly preview
  app.get<{ Params: { id: string } }>('/:id/preview', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');
    const screenshots = await listScreenshots(id);

    return reply.render('reports/preview', {
      report,
      screenshots,
      platforms: PLATFORM_OPTIONS,
    });
  });

  // Copy-paste plain markdown
  app.get<{ Params: { id: string } }>('/:id/text', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');
    const screenshots = await listScreenshots(id);

    const platformLabel = (v: ScreenshotPlatform) =>
      PLATFORM_OPTIONS.find(p => p.value === v)?.label ?? v;

    // Channel-pure: the report's single channel sets the heading.
    const channelPhrase = channelLabel(report.channel);

    const senderFirstName = (user.name ?? '').split(/\s+/)[0] || 'Vendo';

    const sections: string[] = [
      `Hi ${report.contact_name || 'there'},`,
      '',
      `Hope you're well. Here's your ${channelPhrase} summary for ${report.period_label}.`,
      '',
    ];

    // Headline (exec summary) leads, no heading.
    if (report.exec_summary_md.trim()) sections.push(report.exec_summary_md.trim(), '');

    if (report.performance_summary_md.trim()) {
      sections.push('## Performance by campaign', '', report.performance_summary_md.trim(), '');
    }

    if (screenshots.length) {
      sections.push('## Screenshots');
      for (const s of screenshots) {
        const cap = s.caption ? ` — ${s.caption}` : '';
        sections.push(`- **${platformLabel(s.platform)}**${cap} (${s.blob_url})`);
      }
      sections.push('');
    }

    if (report.worked_on_md.trim()) {
      sections.push('## What we did this month', '', report.worked_on_md.trim(), '');
    }

    if (report.risks_md.trim() && !/^\s*-?\s*no material/i.test(report.risks_md)) {
      sections.push('## Watch point', '', report.risks_md.trim(), '');
    }

    if (report.focus_next_md.trim() || report.recommendations_md.trim()) {
      sections.push('## Next month', '');
      if (report.focus_next_md.trim()) sections.push(report.focus_next_md.trim(), '');
      if (report.recommendations_md.trim()) sections.push(report.recommendations_md.trim(), '');
    }

    sections.push('', `Thanks,`, senderFirstName);

    return reply.render('reports/text', {
      report,
      screenshots,
      platforms: PLATFORM_OPTIONS,
      channelPhrase,
      senderFirstName,
      markdown: sections.join('\n'),
    });
  });
};

// ============================================================================
// /api/reports/* — mutating endpoints (HTMX targets)
// ============================================================================

export const reportsApiRoutes: FastifyPluginAsync = async (app) => {
  // Multipart only for the upload endpoint.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_FILE_BYTES + 1024 },
  });

  // ── v2 dashboard data ────────────────────────────────────────────────────
  // JSON payload that backs the React dashboard. Same shape returned to
  // both the admin shell render and the portal shell render. Admin-only
  // for now; the portal route inlines the payload at SSR time so no
  // separate API call is needed from the client mode.
  app.get<{ Params: { id: string } }>('/:id/data.json', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    try {
      const payload = await buildDashboardData(id, { mode: 'internal' });
      return reply
        .header('Cache-Control', 'private, no-cache')
        .send(payload);
    } catch (err: any) {
      request.log?.error({ err }, 'dashboard data build failed');
      return reply.code(500).send({ error: err?.message || 'Build failed' });
    }
  });

  // Force a fresh build (drops the cache row, recomputes, writes back).
  app.post<{ Params: { id: string } }>('/:id/recompute', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    try {
      const payload = await recomputeDashboard(id, 'internal');
      return reply.send({ ok: true, computedAt: payload.computedAt });
    } catch (err: any) {
      request.log?.error({ err }, 'dashboard recompute failed');
      return reply.code(500).send({ error: err?.message || 'Recompute failed' });
    }
  });

  // Create a new report — POST from /reports/new
  app.post('/', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clientIdRaw = field(request.body, 'client_id');
    const monthRaw = field(request.body, 'month');
    const channelRaw = field(request.body, 'channel');
    const clientId = Number(clientIdRaw);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return reply.code(400).send('Missing or invalid client_id');
    }
    const channel: ReportChannel = isReportChannel(channelRaw) ? channelRaw : 'google_ads';
    const period = monthToPeriod(monthRaw);
    if (!period) return reply.code(400).send('Invalid month — expected YYYY-MM');

    const existing = await findReport(clientId, period.start, period.end, channel);
    if (existing) return reply.redirect(`/reports/${existing}`);

    const id = await createReport({
      clientId,
      channel,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      createdBy: user.email,
    });
    return reply.redirect(`/reports/${id}`);
  });

  // Create a report for a month/channel AND generate it in one step. Used by
  // the "Generate this report" button when switching to an empty combination.
  app.post('/create-and-generate', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clientId = Number(field(request.body, 'client_id'));
    const channelRaw = field(request.body, 'channel');
    const period = monthToPeriod(field(request.body, 'month'));
    if (!Number.isFinite(clientId) || clientId <= 0) return reply.code(400).send('Invalid client_id');
    const channel: ReportChannel = isReportChannel(channelRaw) ? channelRaw : 'google_ads';
    if (!period) return reply.code(400).send('Invalid month — expected YYYY-MM');

    let id = await findReport(clientId, period.start, period.end, channel);
    if (!id) {
      id = await createReport({
        clientId, channel,
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        createdBy: user.email,
      });
      await generateReportForId(id, {
        userId: user.id,
        applyNarrativeDraft: true,
        log: (m) => request.log?.info?.(m),
      });
    }
    return reply.redirect(`/reports/${id}`);
  });

  // Save narrative fields (HTMX inline saves from textareas)
  app.post<{ Params: { id: string } }>('/:id/narrative', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');

    const workedOnMd = field(request.body, 'worked_on_md');
    const focusNextMd = field(request.body, 'focus_next_md');
    const contactName = field(request.body, 'contact_name');
    const changeHistory = field(request.body, 'change_history');

    const params: Parameters<typeof updateNarrative>[1] = {};
    if ('worked_on_md' in (request.body as object)) params.workedOnMd = workedOnMd;
    if ('focus_next_md' in (request.body as object)) params.focusNextMd = focusNextMd;
    if ('contact_name' in (request.body as object)) params.contactName = contactName;
    if ('change_history' in (request.body as object)) params.changeHistory = changeHistory;

    await updateNarrative(id, params);

    // Tiny acknowledgement chip
    return reply.type('text/html').send(
      `<span class="r-saved" hx-swap-oob="true" id="r-save-flash">Saved</span>`,
    );
  });

  // Auto-pull the Google Ads change history from the API into the field.
  app.post<{ Params: { id: string } }>('/:id/pull-change-history', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');
    if (report.channel !== 'google_ads') {
      return reply.code(400).type('text/html').send('<div class="r-error">Change history is Google Ads only.</div>');
    }

    let note: string | undefined;
    try {
      const result = await fetchGadsChangeHistory(report.client_id, report.period_start, report.period_end);
      note = result.note;
      if (result.text) await updateNarrative(id, { changeHistory: result.text });
    } catch (err) {
      request.log?.error?.({ err }, 'change history pull failed');
      note = `Pull failed: ${err instanceof Error ? err.message : 'unknown error'}`;
    }

    const fresh = await getReport(id);
    return reply.type('text/html').render('reports/_change-history-field', { report: fresh, note });
  });

  // Save a single AI block (after the user edits it post-generation)
  app.post<{ Params: { id: string; field: string } }>('/:id/ai/:field', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const fieldName = request.params.field;
    const allowed = ['exec_summary', 'performance_summary', 'wins', 'risks', 'recommendations'] as const;
    if (!allowed.includes(fieldName as typeof allowed[number])) {
      return reply.code(400).send('Bad field');
    }

    const value = field(request.body, 'content');
    await updateAiBlock(id, `${fieldName}_md` as `${typeof allowed[number]}_md`, value);

    return reply.type('text/html').send(
      `<span class="r-saved" hx-swap-oob="true" id="r-save-flash">Saved</span>`,
    );
  });

  // Upload a screenshot (multipart)
  app.post<{ Params: { id: string } }>('/:id/screenshots', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');

    const parts = request.parts();
    let platform: ScreenshotPlatform | null = null;
    let caption = '';
    let buffer: Buffer | null = null;
    let clientFilename: string | null = null;

    try {
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'platform') {
          const val = String(part.value);
          if (isValidPlatform(val)) platform = val;
        } else if (part.type === 'field' && part.fieldname === 'caption') {
          caption = String(part.value).slice(0, 1000);
        } else if (part.type === 'file' && part.fieldname === 'file') {
          clientFilename = part.filename ?? null;
          buffer = await part.toBuffer();
        }
      }
    } catch (err) {
      request.log?.error?.(err);
      return reply.code(400).type('text/html').send('<div class="r-error">Upload failed.</div>');
    }

    if (!platform) return reply.code(400).type('text/html').send('<div class="r-error">Pick a platform.</div>');
    if (!buffer) return reply.code(400).type('text/html').send('<div class="r-error">No file attached.</div>');

    let screenshot;

    if (looksLikeCsvFilename(clientFilename)) {
      // CSV campaign-data upload: validate as text, store the parsed text for
      // the AI, and keep the original file in Blob for re-download.
      let csv;
      try {
        csv = validateCsvBuffer(buffer);
      } catch (err) {
        const msg = err instanceof UploadValidationError ? err.message : 'Invalid CSV.';
        return reply.code(400).type('text/html').send(`<div class="r-error">${msg}</div>`);
      }
      let blob;
      try {
        blob = await uploadCsv({ pathPrefix: `reports/${id}`, filename: clientFilename || platform, bytes: buffer });
      } catch (err) {
        request.log?.error?.(err);
        return reply.code(500).type('text/html').send('<div class="r-error">Upload failed.</div>');
      }
      screenshot = await addScreenshot({
        reportId: id,
        platform,
        caption,
        kind: 'csv',
        fileName: clientFilename,
        csvText: csv.text,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
      });
    } else {
      // Image screenshot upload (existing path).
      let validated;
      try {
        validated = validateImageBuffer(buffer);
      } catch (err) {
        const msg = err instanceof UploadValidationError ? err.message : 'Invalid file.';
        return reply.code(400).type('text/html').send(`<div class="r-error">${msg}</div>`);
      }
      let blob;
      try {
        blob = await uploadImageToBlob({
          pathPrefix: `reports/${id}`,
          filename: clientFilename || platform,
          image: validated,
        });
      } catch (err) {
        request.log?.error?.(err);
        return reply.code(500).type('text/html').send('<div class="r-error">Upload failed.</div>');
      }
      screenshot = await addScreenshot({
        reportId: id,
        platform,
        caption,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
      });
    }

    return reply.type('text/html').render('reports/_screenshot-card', {
      screenshot,
      platforms: PLATFORM_OPTIONS,
    });
  });

  // Update screenshot caption / platform
  app.post<{ Params: { id: string; sid: string } }>('/:id/screenshots/:sid', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const sid = Number(request.params.sid);
    if (!Number.isFinite(sid)) return reply.code(404).send('Not found');

    const platformRaw = field(request.body, 'platform');
    const captionRaw = field(request.body, 'caption');
    const params: Parameters<typeof updateScreenshot>[1] = {};
    if (platformRaw && isValidPlatform(platformRaw)) params.platform = platformRaw;
    if ('caption' in (request.body as object)) params.caption = captionRaw.slice(0, 1000);

    await updateScreenshot(sid, params);
    return reply.type('text/html').send(
      `<span class="r-saved" hx-swap-oob="true" id="r-save-flash">Saved</span>`,
    );
  });

  // Delete a screenshot
  app.post<{ Params: { id: string; sid: string } }>('/:id/screenshots/:sid/delete', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const sid = Number(request.params.sid);
    if (!Number.isFinite(sid)) return reply.code(404).send('Not found');

    const removed = await deleteScreenshot(sid);
    if (removed) {
      // Best-effort blob delete (the row is gone either way).
      try {
        const { del } = await import('@vercel/blob');
        await del(removed.blob_pathname);
      } catch (err) {
        request.log?.warn?.({ err }, 'Failed to delete blob — orphan tolerated');
      }
    }
    // HTMX swaps the entire card out via outerHTML.
    return reply.type('text/html').send('');
  });

  // Reorder
  app.post<{ Params: { id: string } }>('/:id/screenshots/reorder', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const reportId = Number(request.params.id);
    if (!Number.isFinite(reportId)) return reply.code(404).send('Not found');

    const orderedIds = fieldArray(request.body, 'order')
      .map(s => Number(s))
      .filter(n => Number.isFinite(n));
    if (!orderedIds.length) return reply.code(400).send('Bad order');
    await reorderScreenshots(reportId, orderedIds);
    return reply.code(204).send();
  });

  // Generate AI insights (one-shot, no streaming). Also rebuilds the Google
  // Ads structured summary on the fly so on-demand regeneration always uses
  // the freshest sync data, not a stale snapshot from the monthly cron.
  app.post<{ Params: { id: string } }>('/:id/generate', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');

    // Shared pipeline: rebuilds the Google Ads summary on the fly, runs the
    // reconciliation guardrail, pulls narrative + meeting context, and
    // generates the AI blocks. The manual flow keeps the team's hand-written
    // `worked_on_md` (applyNarrativeDraft defaults off) but still benefits
    // from the auto-pulled meeting context.
    const gen = await generateReportForId(id, {
      userId: user.id,
      log: (m) => request.log?.info?.(m),
    });
    if (!gen.aiGenerated) {
      request.log?.error?.({ aiError: gen.aiError }, 'Report AI generation failed');
      const msg = gen.aiError ?? 'Generation failed';
      return reply.code(500).type('text/html').send(
        `<div class="r-error">AI generation failed: ${msg.slice(0, 200)}</div>`,
      );
    }

    const fresh = await getReport(id);
    return reply.type('text/html').render('reports/_ai-blocks', { report: fresh });
  });

  // Submit a draft for AM review. Any team member can do this.
  app.post<{ Params: { id: string } }>('/:id/submit-review', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    try {
      await submitForReview(id, user.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot submit for review';
      return reply.code(409).type('text/html').send(
        `<div class="r-error">${msg.slice(0, 200)}</div>`,
      );
    }
    return reply.header('HX-Redirect', `/reports/${id}`).code(204).send();
  });

  // Approve a report and send it. AM role only.
  app.post<{ Params: { id: string } }>('/:id/approve', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');
    if (!isAmUser(user)) {
      return reply.code(403).type('text/html').send(
        '<div class="r-error">Only Account Managers can approve reports.</div>',
      );
    }

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    try {
      await approveReport(id, user.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot approve';
      return reply.code(409).type('text/html').send(
        `<div class="r-error">${msg.slice(0, 200)}</div>`,
      );
    }
    return reply.header('HX-Redirect', `/reports/${id}`).code(204).send();
  });

  // Reopen — clears review/approval timestamps, returns to draft. Either AM
  // (rollback an approval) or a team member (rework after submission).
  app.post<{ Params: { id: string } }>('/:id/reopen', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    await reopenReport(id);
    return reply.header('HX-Redirect', `/reports/${id}`).code(204).send();
  });

  // Apply the AI-suggested "What we worked on" draft (built by A3 via
  // buildNarrativeContext) to the editable worked_on_md textarea. Posted by
  // the _suggested-narrative.eta partial's "Use suggestion" button.
  app.post<{ Params: { id: string } }>('/:id/use-suggested-narrative', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');

    const draft = report.narrative_draft_md;
    if (draft && draft.trim()) {
      await updateNarrative(id, { workedOnMd: draft });
    }
    // HTMX-friendly: redirect back to the editor so the textarea reflects the
    // applied draft and the partial removes itself.
    return reply.header('HX-Redirect', `/reports/${id}`).code(204).send();
  });

  // Delete a whole report
  app.post<{ Params: { id: string } }>('/:id/delete', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');

    const screenshots = await listScreenshots(id);
    await deleteReport(id);

    // Best-effort blob cleanup (rows already gone via cascade)
    if (screenshots.length) {
      try {
        const { del } = await import('@vercel/blob');
        await del(screenshots.map(s => s.blob_pathname));
      } catch (err) {
        request.log?.warn?.({ err }, 'Bulk blob delete failed — orphans tolerated');
      }
    }

    return reply.header('HX-Redirect', '/reports').code(204).send();
  });
};
