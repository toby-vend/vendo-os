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
  MAX_FILE_BYTES,
  UploadValidationError,
} from '../lib/blob-uploads.js';
import {
  listReports,
  getReport,
  createReport,
  findReport,
  listScreenshots,
  addScreenshot,
  updateScreenshot,
  deleteScreenshot,
  reorderScreenshots,
  updateNarrative,
  updateAiBlocks,
  updateAiBlock,
  setStatus,
  deleteReport,
  listActiveClientsForReports,
  PLATFORM_OPTIONS,
  type ScreenshotPlatform,
  type ReportStatus,
} from '../lib/queries/reports.js';
import { generateReportInsights } from '../lib/report-ai.js';

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
    const status = (request.query.status === 'draft' || request.query.status === 'final')
      ? request.query.status as ReportStatus
      : undefined;

    const [items, clients] = await Promise.all([
      listReports({ clientId, status }),
      listActiveClientsForReports(),
    ]);

    return reply.render('reports/list', {
      items,
      clients,
      filterClientId: clientId ?? '',
      filterStatus: status ?? '',
    });
  });

  // New form
  app.get('/new', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clients = await listActiveClientsForReports();
    return reply.render('reports/new', {
      clients,
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

    return reply.render('reports/editor', {
      report,
      screenshots,
      platforms: PLATFORM_OPTIONS,
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

    // Same email-style structure as the preview page so a copy-paste lands in
    // a client's inbox looking like the reference report.
    const seenPlatforms: string[] = [];
    for (const s of screenshots) {
      const lbl = platformLabel(s.platform);
      if (!seenPlatforms.includes(lbl)) seenPlatforms.push(lbl);
    }
    const platformPhrase = seenPlatforms.length === 0
      ? 'performance'
      : seenPlatforms.length === 1
        ? `${seenPlatforms[0]} Ads`
        : seenPlatforms.length === 2
          ? seenPlatforms.join(' & ')
          : `${seenPlatforms.slice(0, -1).join(', ')} & ${seenPlatforms[seenPlatforms.length - 1]}`;

    const senderFirstName = (user.name ?? '').split(/\s+/)[0] || 'Vendo';

    const sections: string[] = [
      `Hi ${report.contact_name || 'there'},`,
      '',
      `Hope you're well!`,
      '',
      `Please find your monthly ${platformPhrase} Report for ${report.period_label} below:`,
      '',
    ];

    if (report.performance_summary_md.trim()) {
      sections.push(
        `## ${report.period_label}${seenPlatforms.length ? ' ' + seenPlatforms.join(' / ') : ''} Performance`,
        '',
        report.performance_summary_md.trim(),
        '',
      );
    }

    if (screenshots.length) {
      sections.push('## Screenshots');
      for (const s of screenshots) {
        const cap = s.caption ? ` — ${s.caption}` : '';
        sections.push(`- **${platformLabel(s.platform)}**${cap} (${s.blob_url})`);
      }
      sections.push('');
    }

    sections.push('## This Month', '');
    if (report.exec_summary_md.trim()) sections.push(report.exec_summary_md.trim(), '');
    if (report.wins_md.trim()) sections.push(report.wins_md.trim(), '');
    if (report.worked_on_md.trim()) sections.push(report.worked_on_md.trim(), '');

    if (report.risks_md.trim() && !/^\s*-?\s*no material risks/i.test(report.risks_md)) {
      sections.push('## Things to keep an eye on', '', report.risks_md.trim(), '');
    }

    sections.push('## Next Month & Ongoing', '');
    if (report.focus_next_md.trim()) sections.push(report.focus_next_md.trim(), '');
    if (report.recommendations_md.trim()) sections.push(report.recommendations_md.trim(), '');

    sections.push('', `Let us know if you have any questions at all!`, '', `Thanks,`, senderFirstName);

    return reply.render('reports/text', {
      report,
      screenshots,
      platforms: PLATFORM_OPTIONS,
      seenPlatforms,
      platformPhrase,
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

  // Create a new report — POST from /reports/new
  app.post('/', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const clientIdRaw = field(request.body, 'client_id');
    const monthRaw = field(request.body, 'month');
    const clientId = Number(clientIdRaw);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return reply.code(400).send('Missing or invalid client_id');
    }
    const period = monthToPeriod(monthRaw);
    if (!period) return reply.code(400).send('Invalid month — expected YYYY-MM');

    const existing = await findReport(clientId, period.start, period.end);
    if (existing) return reply.redirect(`/reports/${existing}`);

    const id = await createReport({
      clientId,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      createdBy: user.email,
    });
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

    const params: Parameters<typeof updateNarrative>[1] = {};
    if ('worked_on_md' in (request.body as object)) params.workedOnMd = workedOnMd;
    if ('focus_next_md' in (request.body as object)) params.focusNextMd = focusNextMd;
    if ('contact_name' in (request.body as object)) params.contactName = contactName;

    await updateNarrative(id, params);

    // Tiny acknowledgement chip
    return reply.type('text/html').send(
      `<span class="r-saved" hx-swap-oob="true" id="r-save-flash">Saved</span>`,
    );
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

    const screenshot = await addScreenshot({
      reportId: id,
      platform,
      caption,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
    });

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

  // Generate AI insights (one-shot, no streaming)
  app.post<{ Params: { id: string } }>('/:id/generate', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const report = await getReport(id);
    if (!report) return reply.code(404).send('Not found');
    const screenshots = await listScreenshots(id);

    try {
      const out = await generateReportInsights(
        {
          clientName: report.client_display_name || report.client_name,
          vertical: report.client_vertical,
          periodLabel: report.period_label,
          workedOnMd: report.worked_on_md,
          focusNextMd: report.focus_next_md,
          screenshots: screenshots.map(s => ({ platform: s.platform, caption: s.caption, url: s.blob_url })),
        },
        user.id,
      );
      await updateAiBlocks(id, {
        execSummaryMd: out.exec_summary,
        performanceSummaryMd: out.performance_summary,
        winsMd: out.wins,
        risksMd: out.risks,
        recommendationsMd: out.recommendations,
      });
    } catch (err) {
      request.log?.error?.({ err }, 'Report AI generation failed');
      const msg = err instanceof Error ? err.message : 'Generation failed';
      return reply.code(500).type('text/html').send(
        `<div class="r-error">AI generation failed: ${msg.slice(0, 200)}</div>`,
      );
    }

    const fresh = await getReport(id);
    return reply.type('text/html').render('reports/_ai-blocks', { report: fresh });
  });

  // Mark final / draft
  app.post<{ Params: { id: string } }>('/:id/status', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(404).send('Not found');
    const next = field(request.body, 'status');
    if (next !== 'draft' && next !== 'final') return reply.code(400).send('Bad status');
    await setStatus(id, next);
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
