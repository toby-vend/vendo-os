import type { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import crypto from 'crypto';

import type { SessionUser } from '../lib/auth.js';
import { getSidebarConfig } from '../lib/queries/sidebar.js';
import {
  getSuggestionsEnabled,
  createDraft,
  getDraft,
  updateDraftTranscript,
  deleteDraft,
  saveAttachment,
  getAttachmentsForDraft,
  countAttachmentsForDraft,
  deleteAttachment,
  createSuggestion,
  promoteDraftAttachments,
  listSuggestions,
  type ChatTurn,
} from '../lib/queries/suggestions.js';
import {
  validateImageBuffer,
  uploadImage,
  MAX_FILES_PER_DRAFT,
  MAX_FILE_BYTES,
  UploadValidationError,
} from '../lib/suggestions-uploads.js';
import { buildSystemPrompt, runIntakeTurn } from '../lib/suggestions-ai.js';

// --- Rate-limit state (in-memory, per serverless instance) ---
// Enough to prevent runaway loops; not a security boundary.
interface RateBucket { windowStart: number; count: number }
const chatBuckets = new Map<string, RateBucket>();
const uploadBuckets = new Map<string, RateBucket>();
const CHAT_LIMIT_PER_HOUR = 30;
const UPLOAD_LIMIT_PER_HOUR = 20;

function hitLimit(bucket: Map<string, RateBucket>, userId: string, limit: number): boolean {
  const now = Date.now();
  const existing = bucket.get(userId);
  if (!existing || now - existing.windowStart > 60 * 60 * 1000) {
    bucket.set(userId, { windowStart: now, count: 1 });
    return false;
  }
  existing.count += 1;
  return existing.count > limit;
}

// --- Helpers ---

function requireTeamUser(user: SessionUser | null): user is SessionUser {
  return !!user && (user.role === 'admin' || user.role === 'standard');
}

/** Build the prompt-context payload from the draft + live sidebar config. */
async function buildPromptCtx(draft: {
  scope: 'page' | 'sitewide';
  page_url: string | null;
  page_label: string | null;
  user_name: string;
}, role: string): Promise<ReturnType<typeof buildSystemPrompt>> {
  const sidebar = await getSidebarConfig();
  const sections: Array<{ label: string; href: string }> = [];
  for (const group of sidebar) {
    for (const item of group.items) {
      if (item.hidden) continue;
      sections.push({ label: item.label, href: item.href });
    }
  }
  return buildSystemPrompt({
    scope: draft.scope,
    pageUrl: draft.page_url,
    pageLabel: draft.page_label,
    submitterName: draft.user_name,
    submitterRole: role,
    sections,
  });
}

/** Resolve human-readable page label from a URL path by walking the sidebar. */
async function labelForPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const sidebar = await getSidebarConfig();
  for (const group of sidebar) {
    for (const item of group.items) {
      if (item.href === path) return item.label;
    }
  }
  // Prefix match (e.g. /clients/123 → 'Clients')
  for (const group of sidebar) {
    for (const item of group.items) {
      if (item.href !== '/' && path.startsWith(item.href + '/')) return item.label;
    }
  }
  return null;
}

// ============================================================================
// /api/suggestions/* — widget + chat endpoints
// ============================================================================

export const suggestionsApiRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart for this scope only (file upload endpoint)
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_FILE_BYTES + 1024 }, // tiny overhead above validator cap
  });

  // Widget fragment — rendered via HTMX in base.eta on every authed page.
  app.get('/widget', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(204).send();

    const enabled = await getSuggestionsEnabled();
    if (!enabled) return reply.code(204).send();

    return reply.type('text/html').render('suggestions/_widget', {
      user,
      maxFilesPerDraft: MAX_FILES_PER_DRAFT,
      maxFileMB: Math.floor(MAX_FILE_BYTES / 1024 / 1024),
    });
  });

  // Start a new intake session. Body: { scope, page_url, page_label }
  app.post('/chat/start', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const enabled = await getSuggestionsEnabled();
    if (!enabled) return reply.code(403).send('Submissions closed');

    const body = (request.body ?? {}) as Record<string, string | string[] | undefined>;
    const scopeRaw = Array.isArray(body.scope) ? body.scope[0] : body.scope;
    const scope: 'page' | 'sitewide' = scopeRaw === 'page' ? 'page' : 'sitewide';
    const pageUrl = scope === 'page'
      ? (Array.isArray(body.page_url) ? body.page_url[0] : body.page_url) ?? null
      : null;
    const providedLabel = Array.isArray(body.page_label) ? body.page_label[0] : body.page_label;
    const pageLabel = scope === 'page'
      ? (providedLabel || (await labelForPath(pageUrl)) || null)
      : null;

    const sessionId = crypto.randomUUID();
    await createDraft({
      sessionId,
      userId: user.id,
      userName: user.name,
      scope,
      pageUrl,
      pageLabel,
    });

    // Seed the opening assistant prompt — deterministic, no Claude round-trip needed yet.
    const opening = scope === 'page'
      ? `You're on **${pageLabel ?? pageUrl ?? 'this page'}**. What's the suggestion — a bug, a missing piece, something to change? Tell me in your own words.`
      : `Site-wide suggestion — fire away. What's the idea?`;

    const transcript: ChatTurn[] = [
      { role: 'assistant', content: opening },
    ];
    await updateDraftTranscript(sessionId, transcript);

    return reply.type('text/html').render('suggestions/_chat-session', {
      sessionId,
      scope,
      pageUrl,
      pageLabel,
      transcript,
      attachments: [],
      maxFilesPerDraft: MAX_FILES_PER_DRAFT,
    });
  });

  // Send a user message. Body: { session_id, message }
  app.post('/chat', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');
    const enabled = await getSuggestionsEnabled();
    if (!enabled) return reply.code(403).send('Submissions closed');
    if (hitLimit(chatBuckets, user.id, CHAT_LIMIT_PER_HOUR)) {
      return reply.code(429).type('text/html').send('<div class="sg-error">Too many messages — try again later.</div>');
    }

    const body = (request.body ?? {}) as Record<string, string | string[] | undefined>;
    const sessionId = (Array.isArray(body.session_id) ? body.session_id[0] : body.session_id) ?? '';
    const message = ((Array.isArray(body.message) ? body.message[0] : body.message) ?? '').trim();

    if (!sessionId || (!message && true)) {
      // Allow empty message only if it's purely a screenshot follow-up — but we rely on the UI to always send something
      if (!sessionId) return reply.code(400).type('text/html').send('<div class="sg-error">Missing session.</div>');
    }

    const draft = await getDraft(sessionId);
    if (!draft || draft.user_id !== user.id) {
      return reply.code(404).type('text/html').send('<div class="sg-error">Session not found.</div>');
    }

    const transcript: ChatTurn[] = JSON.parse(draft.transcript);
    const prevAttachments = await getAttachmentsForDraft(sessionId);
    const lastUserTurnAttIds = new Set<number>();
    for (const t of transcript) if (t.role === 'user' && t.attachmentIds) t.attachmentIds.forEach(id => lastUserTurnAttIds.add(id));
    const newAttachments = prevAttachments.filter(a => !lastUserTurnAttIds.has(a.id));

    // Append user turn (include references to attachment ids)
    transcript.push({
      role: 'user',
      content: message || '(screenshot attached)',
      attachmentIds: newAttachments.map(a => a.id),
    });

    const systemPrompt = await buildPromptCtx(draft, user.role);
    let result;
    try {
      result = await runIntakeTurn({
        systemPrompt,
        transcript: transcript.slice(0, -1), // exclude the just-appended user turn — runIntakeTurn re-appends
        newUserMessage: message || '(screenshot attached)',
        newAttachmentUrls: newAttachments.map(a => a.blob_url),
        allAttachments: prevAttachments.map(a => ({
          url: a.blob_url,
          filename: a.filename,
          content_type: a.content_type,
        })),
        scope: draft.scope,
        pageUrl: draft.page_url,
        pageLabel: draft.page_label,
      });
    } catch (err) {
      request.log?.error?.(err);
      return reply.code(500).type('text/html').send('<div class="sg-error">Something went wrong talking to Claude — try again.</div>');
    }

    if (result.kind === 'submit' && result.structured) {
      // Persist the assistant's "done" signal for transcript completeness
      transcript.push({ role: 'assistant', content: '(structured suggestion ready)' });
      await updateDraftTranscript(sessionId, transcript);

      return reply.type('text/html').render('suggestions/_review-panel', {
        sessionId,
        structured: result.structured,
        attachments: prevAttachments,
      });
    }

    transcript.push({ role: 'assistant', content: result.question ?? '' });
    await updateDraftTranscript(sessionId, transcript);

    return reply.type('text/html').render('suggestions/_chat-turn', {
      sessionId,
      lastUserMessage: message,
      newAttachments,
      assistantMessage: result.question ?? '',
      canStillAttach: prevAttachments.length < MAX_FILES_PER_DRAFT,
    });
  });

  // Upload an image. Multipart form field `file`, plus `session_id` as field.
  app.post('/chat/upload', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');
    const enabled = await getSuggestionsEnabled();
    if (!enabled) return reply.code(403).send('Submissions closed');
    if (hitLimit(uploadBuckets, user.id, UPLOAD_LIMIT_PER_HOUR)) {
      return reply.code(429).type('text/html').send('<div class="sg-error">Too many uploads — try again later.</div>');
    }

    const parts = request.parts();
    let sessionId = '';
    let fileBuffer: Buffer | null = null;
    let clientFilename: string | null = null;

    try {
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'session_id') {
          sessionId = String(part.value);
        } else if (part.type === 'file' && part.fieldname === 'file') {
          clientFilename = part.filename ?? null;
          fileBuffer = await part.toBuffer();
        }
      }
    } catch (err) {
      request.log?.error?.(err);
      return reply.code(400).type('text/html').send('<div class="sg-error">Upload failed.</div>');
    }

    if (!sessionId || !fileBuffer) {
      return reply.code(400).type('text/html').send('<div class="sg-error">Missing file or session.</div>');
    }

    const draft = await getDraft(sessionId);
    if (!draft || draft.user_id !== user.id) {
      return reply.code(404).type('text/html').send('<div class="sg-error">Session not found.</div>');
    }

    const existing = await countAttachmentsForDraft(sessionId);
    if (existing >= MAX_FILES_PER_DRAFT) {
      return reply.code(400).type('text/html').send(
        `<div class="sg-error">Max ${MAX_FILES_PER_DRAFT} attachments per suggestion.</div>`,
      );
    }

    let validated;
    try {
      validated = validateImageBuffer(fileBuffer);
    } catch (err) {
      const msg = err instanceof UploadValidationError ? err.message : 'Invalid file.';
      return reply.code(400).type('text/html').send(`<div class="sg-error">${msg}</div>`);
    }

    let blob;
    try {
      blob = await uploadImage({ sessionId, filename: clientFilename, image: validated });
    } catch (err) {
      request.log?.error?.(err);
      return reply.code(500).type('text/html').send('<div class="sg-error">Upload failed.</div>');
    }

    const attachment = await saveAttachment({
      draftSessionId: sessionId,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      contentType: validated.contentType,
      sizeBytes: validated.bytes.length,
      filename: clientFilename,
    });

    return reply.type('text/html').render('suggestions/_attachment-chip', { attachment });
  });

  // Remove an attachment chip before submission.
  app.post('/chat/attachment/:id/delete', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const idRaw = (request.params as { id: string }).id;
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id)) return reply.code(400).send('Bad id');

    const body = (request.body ?? {}) as Record<string, string | string[] | undefined>;
    const sessionId = (Array.isArray(body.session_id) ? body.session_id[0] : body.session_id) ?? '';

    const draft = await getDraft(sessionId);
    if (!draft || draft.user_id !== user.id) return reply.code(404).send('Not found');

    await deleteAttachment(id, sessionId);
    // Caller swaps the chip element out with an empty response.
    return reply.type('text/html').send('');
  });

  // Finalise and save the suggestion.
  app.post('/submit', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const body = (request.body ?? {}) as Record<string, string | string[] | undefined>;
    const sessionId = (Array.isArray(body.session_id) ? body.session_id[0] : body.session_id) ?? '';
    const structuredJson = (Array.isArray(body.structured) ? body.structured[0] : body.structured) ?? '';

    const draft = await getDraft(sessionId);
    if (!draft || draft.user_id !== user.id) {
      return reply.code(404).type('text/html').send('<div class="sg-error">Session not found.</div>');
    }

    let structured;
    try {
      structured = JSON.parse(structuredJson);
    } catch {
      return reply.code(400).type('text/html').send('<div class="sg-error">Invalid submission.</div>');
    }

    const transcript: ChatTurn[] = JSON.parse(draft.transcript);
    const rawIdea = transcript.find(t => t.role === 'user')?.content ?? '(no seed)';

    const suggestionId = await createSuggestion({
      userId: user.id,
      userName: user.name,
      title: String(structured.title ?? 'Untitled suggestion').slice(0, 200),
      rawIdea,
      transcript,
      structured,
    });

    await promoteDraftAttachments(sessionId, suggestionId);
    await deleteDraft(sessionId);

    return reply.type('text/html').render('suggestions/_submitted', { suggestionId });
  });
};

// ============================================================================
// /suggestions/* — UI pages (full layout)
// ============================================================================

export const suggestionsUiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/mine', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!requireTeamUser(user)) return reply.code(403).send('Forbidden');

    const items = await listSuggestions({ userId: user.id, limit: 50 });
    return reply.render('suggestions/mine', { items });
  });
};
