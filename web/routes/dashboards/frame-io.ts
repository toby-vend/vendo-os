import type { FastifyPluginAsync } from 'fastify';
import {
  getDashboardStats,
  getRecentExternalComments,
  getClientSummaries,
  getActivityFeed,
  getReviewsAwaitingAdCopy,
  getReviewById,
  getAdCopyRowById,
} from '../../lib/queries/frameio-dashboard.js';
import { getConnectionStatus } from '../../lib/frameio/auth.js';
import {
  generateAdCopyForReview,
  approveAdCopy,
  rejectAdCopy,
  adCopyFilename,
} from '../../lib/frameio/ad-copy.js';
import { getOrCreateTranscript } from '../../lib/frameio/transcribe.js';
import { db } from '../../lib/queries/base.js';
import type { SessionUser } from '../../lib/auth.js';

/**
 * /dashboards/frame-io — Frame.io control room.
 *
 * Surfaces (Phase 4):
 *   - OAuth connection state + 24-hour processing health
 *   - Stats: pending reviews, comment volume (today + 7d, total + external)
 *   - Recent client comments awaiting response
 *   - Per-client summary table
 *   - Raw activity feed for the last 30 events
 *
 * Phase 5 additions:
 *   - "Reviews awaiting ad copy" — Frame.io-sourced creative_reviews
 *     with no ad_copy_md yet, plus a "Generate" button each
 *   - POST /generate-ad-copy — runs the pipeline for one review
 *   - GET  /ad-copy/:reviewId — renders the generated markdown
 *   - GET  /ad-copy/:reviewId/download — serves it as a .md file
 *
 * All read queries tolerate missing tables so the page renders cleanly
 * in environments that have never received a Frame.io event.
 */
export const frameIoDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [connection, stats, recentComments, clientSummaries, activity, awaitingAdCopy] = await Promise.all([
      getConnectionStatus(),
      getDashboardStats(),
      getRecentExternalComments(15),
      getClientSummaries(),
      getActivityFeed(30),
      getReviewsAwaitingAdCopy(20),
    ]);

    reply.render('dashboards/frame-io', {
      connection,
      stats,
      recentComments,
      clientSummaries,
      activity,
      awaitingAdCopy,
    });
  });

  // POST /dashboards/frame-io/generate-ad-copy
  // Body: { review_id, objective?, audience_hint? }
  // Returns: HTMX-friendly HTML fragment (the new ad-copy block) on success,
  // 4xx with an error message on failure. Anyone with dashboard access can
  // trigger generation — same gate as viewing the dashboard.
  app.post('/generate-ad-copy', async (request, reply) => {
    const body = request.body as { review_id?: string | number; objective?: string; audience_hint?: string };
    const reviewId = Number(body.review_id);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return reply.code(400).type('text/html').send('<p>Missing review_id</p>');
    }

    const objective = (['awareness', 'traffic', 'leads', 'sales'].includes(body.objective ?? '')
      ? body.objective
      : 'leads') as 'awareness' | 'traffic' | 'leads' | 'sales';

    const result = await generateAdCopyForReview({
      reviewId,
      objective,
      audienceHint: body.audience_hint?.trim() || undefined,
    });

    if (!result.ok) {
      const safe = result.reason.replace(/[<>]/g, '');
      return reply.code(500).type('text/html').send(
        `<div style="color:#EF4444;padding:0.75rem;background:rgba(239,68,68,0.08);border-radius:6px;font-size:13px;">Ad-copy generation failed: <code>${safe}</code></div>`,
      );
    }

    // Re-query the row so the shared partial renders with full state
    // (status pill, approve/reject buttons, latest ad_copy_md, etc.).
    const row = await getAdCopyRowById(result.reviewId);
    if (!row) {
      return reply.code(500).type('text/html').send('<p>Ad copy generated but row vanished.</p>');
    }
    return reply.render('dashboards/_frame-io-ad-copy-block', { row });
  });

  // ---------------------------------------------------------------------
  // Approval gate
  // ---------------------------------------------------------------------

  // POST /dashboards/frame-io/ad-copy/:reviewId/approve
  // Marks the row as approved. Fires the Asana hand-off (best-effort) and
  // returns the re-rendered ad-copy block fragment with a transient banner
  // when the hand-off succeeded or failed for THIS click.
  app.post('/ad-copy/:reviewId/approve', async (request, reply) => {
    const params = request.params as { reviewId: string };
    const reviewId = Number(params.reviewId);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return reply.code(400).type('text/html').send('<p>Invalid review id</p>');
    }
    const user = (request as unknown as { user: SessionUser | null }).user;
    const result = await approveAdCopy(reviewId, user?.email ?? null);
    if (!result.ok) {
      const safe = String(result.reason).replace(/[<>]/g, '');
      return reply.code(400).type('text/html').send(
        `<div style="color:#EF4444;padding:0.5rem 0.75rem;background:rgba(239,68,68,0.08);border-radius:4px;font-size:12px;">Could not approve: <code>${safe}</code></div>`,
      );
    }
    const row = await getAdCopyRowById(reviewId);
    if (!row) return reply.code(404).type('text/html').send('<p>Review not found</p>');
    const rowWithFlash = {
      ...row,
      transientAsanaSuccess: result.asanaTaskGid ? `task ${result.asanaTaskGid}` : null,
      transientAsanaWarning: result.asanaWarning ?? null,
    };
    return reply.render('dashboards/_frame-io-ad-copy-block', { row: rowWithFlash });
  });

  // GET /dashboards/frame-io/ad-copy/:reviewId/reject-form
  // Returns the inline textarea + Confirm/Cancel buttons.
  app.get('/ad-copy/:reviewId/reject-form', async (request, reply) => {
    const params = request.params as { reviewId: string };
    const reviewId = Number(params.reviewId);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return reply.code(400).type('text/html').send('<p>Invalid review id</p>');
    }
    return reply.render('dashboards/_frame-io-reject-form', { reviewId });
  });

  // GET /dashboards/frame-io/ad-copy/:reviewId/cancel-reject
  // Empty-body endpoint used by the form's Cancel button to clear the slot.
  app.get('/ad-copy/:reviewId/cancel-reject', async (_request, reply) => {
    return reply.type('text/html').send('');
  });

  // POST /dashboards/frame-io/ad-copy/:reviewId/reject
  // Body: { reason }. Mandatory; min 5 chars, max 1000.
  app.post('/ad-copy/:reviewId/reject', async (request, reply) => {
    const params = request.params as { reviewId: string };
    const reviewId = Number(params.reviewId);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return reply.code(400).type('text/html').send('<p>Invalid review id</p>');
    }
    const body = request.body as { reason?: string };
    const reason = (body.reason ?? '').toString();
    const user = (request as unknown as { user: SessionUser | null }).user;
    const result = await rejectAdCopy(reviewId, user?.email ?? null, reason);
    if (!result.ok) {
      // Surface validation errors inline on the form so the reviewer can fix
      // and resubmit without losing context.
      let msg = `Could not reject: ${result.reason}`;
      if (result.reason === 'reason_too_short') msg = `Please give at least ${result.min} characters explaining the rejection.`;
      if (result.reason === 'reason_too_long') msg = `Reason is too long — keep it under ${result.max} characters.`;
      if (result.reason === 'no_copy_to_reject') msg = 'There is no generated copy on this review to reject.';
      if (result.reason === 'review_not_found') msg = 'Review not found.';
      return reply.code(400).type('text/html').send(
        `<div style="color:#EF4444;padding:0.5rem 0.75rem;background:rgba(239,68,68,0.08);border-radius:4px;font-size:12px;margin-top:6px;">${msg.replace(/[<>]/g, '')}</div>`,
      );
    }
    const row = await getAdCopyRowById(reviewId);
    if (!row) return reply.code(404).type('text/html').send('<p>Review not found</p>');
    return reply.render('dashboards/_frame-io-ad-copy-block', { row });
  });

  // POST /dashboards/frame-io/transcript/:fileId/refresh
  // Admin-only. Forces a re-transcription via Whisper. Returns a small
  // inline status fragment that replaces the trigger button.
  app.post('/transcript/:fileId/refresh', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser | null }).user;
    if (!user || user.role !== 'admin') {
      return reply.code(403).type('text/html').send(
        '<span style="font-size:10px;color:#EF4444;">admin only</span>',
      );
    }
    const params = request.params as { fileId: string };
    const fileId = String(params.fileId);
    if (!fileId) {
      return reply.code(400).type('text/html').send(
        '<span style="font-size:10px;color:#EF4444;">missing file id</span>',
      );
    }

    // Resolve account_id via the originating creative_review → frameio_project.
    let accountId: string | null = null;
    try {
      const r = await db.execute({
        sql: `SELECT fp.account_id FROM creative_reviews cr
                JOIN frameio_projects fp ON fp.project_id = cr.frameio_project_id
               WHERE cr.frameio_file_id = ?
               LIMIT 1`,
        args: [fileId],
      });
      accountId = (r.rows[0] as unknown as { account_id: string } | undefined)?.account_id ?? null;
    } catch { /* swallow */ }

    if (!accountId) {
      return reply.code(404).type('text/html').send(
        '<span style="font-size:10px;color:#EF4444;">no account mapping</span>',
      );
    }

    const result = await getOrCreateTranscript(accountId, fileId, { regenerate: true });
    if (!result.ok) {
      const safe = result.reason.replace(/[<>]/g, '');
      return reply.code(500).type('text/html').send(
        `<span style="font-size:10px;color:#EF4444;">refresh failed: <code>${safe}</code></span>`,
      );
    }
    return reply.type('text/html').send(
      `<span style="font-size:10px;color:#22C55E;">✓ transcript refreshed (${result.durationSeconds ?? '?'}s audio)</span>`,
    );
  });

  // Browse the markdown for a single review (handy for direct linking).
  app.get('/ad-copy/:reviewId', async (request, reply) => {
    const params = request.params as { reviewId: string };
    const reviewId = Number(params.reviewId);
    const row = await getReviewById(reviewId);
    if (!row || !row.ad_copy_md) return reply.code(404).send('Not found');
    return reply.type('text/markdown').send(row.ad_copy_md);
  });

  // Download as .md file with a sensible filename.
  app.get('/ad-copy/:reviewId/download', async (request, reply) => {
    const params = request.params as { reviewId: string };
    const reviewId = Number(params.reviewId);
    const row = await getReviewById(reviewId);
    if (!row || !row.ad_copy_md) return reply.code(404).send('Not found');
    const filename = adCopyFilename(
      row.client_name,
      row.asset_name,
      row.ad_copy_generated_at ?? new Date().toISOString(),
    );
    reply
      .header('Content-Type', 'text/markdown')
      .header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(row.ad_copy_md);
  });
};
