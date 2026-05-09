import type { FastifyPluginAsync } from 'fastify';
import {
  getDashboardStats,
  getRecentExternalComments,
  getClientSummaries,
  getActivityFeed,
  getReviewsAwaitingAdCopy,
  getReviewById,
} from '../../lib/queries/frameio-dashboard.js';
import { getConnectionStatus } from '../../lib/frameio/auth.js';
import { generateAdCopyForReview, adCopyFilename } from '../../lib/frameio/ad-copy.js';

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

    // Render the result as an HTMX-swappable fragment. The full page just
    // gets re-rendered on next refresh with the new copy attached.
    const downloadUrl = `/dashboards/frame-io/ad-copy/${result.reviewId}/download`;
    const generatedAt = new Date(result.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const escaped = result.markdown.replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'));
    return reply.type('text/html').send(`
      <div style="background:#0B0B0B;border:1px solid rgba(34,197,94,0.30);border-radius:8px;padding:0.875rem 1rem;font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
          <strong style="color:#22C55E;">✓ Ad copy generated</strong>
          <span style="color:#94A3B8;font-size:11px;">${result.objective} · ${generatedAt}</span>
        </div>
        <details>
          <summary style="cursor:pointer;color:#cbd5e1;font-size:12px;margin-bottom:6px;">Show / hide markdown</summary>
          <pre style="white-space:pre-wrap;font-size:11px;background:#000;padding:0.75rem;border-radius:4px;color:#d1d5db;margin:6px 0;">${escaped}</pre>
        </details>
        <a href="${downloadUrl}" style="font-size:11px;color:#94A3B8;text-decoration:underline;">↓ download .md</a>
      </div>
    `);
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
