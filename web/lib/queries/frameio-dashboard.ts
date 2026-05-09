import { db } from './base.js';

/**
 * Read-only queries powering the /dashboards/frame-io view.
 *
 * Defensive about missing tables — the Frame.io tables are created lazily
 * by the webhook handler / processor, so a fresh environment may not have
 * them yet. Each query catches the "no such table" error and returns
 * empty data so the dashboard still renders cleanly.
 */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('no such table')) return fallback;
    throw err;
  }
}

export interface DashboardStats {
  pendingReviews: number;
  readyForReview: number;
  approved: number;
  commentsToday: number;
  commentsTodayExternal: number;
  commentsLast7d: number;
  commentsLast7dExternal: number;
  activeProjects: number;
  mappedProjects: number;
  unmappedProjects: number;
  signatureFailures24h: number;
  processingFailures24h: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const reviewsByStatus = await safe(
    async () => {
      const r = await db.execute({
        sql: "SELECT status, COUNT(*) AS n FROM creative_reviews WHERE frameio_file_id IS NOT NULL GROUP BY status",
        args: [],
      });
      return r.rows as unknown as Array<{ status: string; n: number }>;
    },
    [],
  );
  const reviewMap = new Map(reviewsByStatus.map((r) => [r.status, Number(r.n)]));

  const commentsToday = await safe(async () => {
    const r = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM frameio_events WHERE event_type = 'comment.created' AND received_at >= ?",
      args: [todayIso],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  const commentsLast7d = await safe(async () => {
    const r = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM frameio_events WHERE event_type = 'comment.created' AND received_at >= ?",
      args: [sevenDaysAgo],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  // External-comment counts. We can't tell external from internal without
  // joining to frameio_users — but the user_id sits inside the JSON payload.
  // Use a SQLite json_extract for that.
  const commentsTodayExternal = await safe(async () => {
    const r = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM frameio_events e
              LEFT JOIN frameio_users u ON u.user_id = json_extract(e.payload, '$.user.id')
            WHERE e.event_type = 'comment.created'
              AND e.received_at >= ?
              AND COALESCE(u.is_external, 1) = 1`,
      args: [todayIso],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  const commentsLast7dExternal = await safe(async () => {
    const r = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM frameio_events e
              LEFT JOIN frameio_users u ON u.user_id = json_extract(e.payload, '$.user.id')
            WHERE e.event_type = 'comment.created'
              AND e.received_at >= ?
              AND COALESCE(u.is_external, 1) = 1`,
      args: [sevenDaysAgo],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  const projectCounts = await safe(async () => {
    const total = await db.execute({ sql: "SELECT COUNT(*) AS n FROM frameio_projects", args: [] });
    const mapped = await db.execute({ sql: "SELECT COUNT(*) AS n FROM client_source_mappings WHERE source = 'frameio'", args: [] });
    return {
      total: Number((total.rows[0] as unknown as { n: number }).n),
      mapped: Number((mapped.rows[0] as unknown as { n: number }).n),
    };
  }, { total: 0, mapped: 0 });

  const sigFails = await safe(async () => {
    const r = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM frameio_events WHERE processing_status = 'signature_failed' AND received_at >= ?",
      args: [yesterday],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  const procFails = await safe(async () => {
    const r = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM frameio_events WHERE processing_status = 'processing_failed' AND received_at >= ?",
      args: [yesterday],
    });
    return Number((r.rows[0] as unknown as { n: number }).n);
  }, 0);

  return {
    pendingReviews: reviewMap.get('pending') ?? 0,
    readyForReview: reviewMap.get('ready_for_review') ?? 0,
    approved: reviewMap.get('approved') ?? 0,
    commentsToday,
    commentsTodayExternal,
    commentsLast7d,
    commentsLast7dExternal,
    activeProjects: projectCounts.total,
    mappedProjects: projectCounts.mapped,
    unmappedProjects: Math.max(0, projectCounts.total - projectCounts.mapped),
    signatureFailures24h: sigFails,
    processingFailures24h: procFails,
  };
}

export interface RecentComment {
  eventId: number;
  receivedAt: string;
  clientName: string | null;
  projectName: string | null;
  projectViewUrl: string | null;
  authorEmail: string | null;
  authorName: string | null;
  isExternal: boolean;
  reviewId: number | null;
  assetName: string | null;
  feedbackPreview: string | null;
}

/** Most recent comment events that landed against a mapped project, oldest
 *  Vendo-internal noise filtered out. Up to `limit` rows. */
export async function getRecentExternalComments(limit = 15): Promise<RecentComment[]> {
  return safe(async () => {
    const r = await db.execute({
      sql: `
        SELECT e.id AS event_id, e.received_at,
               c.name AS client_name,
               p.name AS project_name, p.view_url AS project_view_url,
               u.email AS author_email, u.name AS author_name, COALESCE(u.is_external, 1) AS is_external,
               cr.id AS review_id, cr.asset_name, cr.feedback
          FROM frameio_events e
     LEFT JOIN frameio_users u
                ON u.user_id = json_extract(e.payload, '$.user.id')
     LEFT JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.external_id = e.project_id
     LEFT JOIN clients c
                ON c.id = csm.client_id
     LEFT JOIN frameio_projects p
                ON p.project_id = e.project_id
     LEFT JOIN creative_reviews cr
                ON cr.frameio_file_id = e.resource_id    -- only matches if event was for a file
         WHERE e.event_type = 'comment.created'
           AND COALESCE(u.is_external, 1) = 1
         ORDER BY e.received_at DESC
         LIMIT ?
      `,
      args: [limit],
    });
    return r.rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const fb = (r.feedback as string | null) ?? null;
      return {
        eventId: Number(r.event_id),
        receivedAt: String(r.received_at),
        clientName: (r.client_name as string | null) ?? null,
        projectName: (r.project_name as string | null) ?? null,
        projectViewUrl: (r.project_view_url as string | null) ?? null,
        authorEmail: (r.author_email as string | null) ?? null,
        authorName: (r.author_name as string | null) ?? null,
        isExternal: Number(r.is_external) === 1,
        reviewId: r.review_id != null ? Number(r.review_id) : null,
        assetName: (r.asset_name as string | null) ?? null,
        feedbackPreview: fb ? fb.split('\n').slice(-1)[0]?.slice(0, 240) ?? null : null,
      };
    });
  }, []);
}

export interface ClientSummary {
  clientId: number;
  clientName: string;
  pendingReviews: number;
  readyForReview: number;
  totalReviews: number;
  externalCommentsLast7d: number;
  lastActivityAt: string | null;
}

export async function getClientSummaries(): Promise<ClientSummary[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return safe(async () => {
    const r = await db.execute({
      sql: `
        SELECT c.id AS client_id, c.name AS client_name,
               COALESCE(SUM(CASE WHEN cr.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_reviews,
               COALESCE(SUM(CASE WHEN cr.status = 'ready_for_review' THEN 1 ELSE 0 END), 0) AS ready_for_review,
               COALESCE(COUNT(cr.id), 0) AS total_reviews
          FROM clients c
          JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.client_id = c.id
     LEFT JOIN creative_reviews cr
                ON cr.frameio_project_id = csm.external_id
      GROUP BY c.id, c.name
      ORDER BY c.name
      `,
      args: [],
    });

    const ext = await db.execute({
      sql: `
        SELECT csm.client_id, COUNT(*) AS n,
               MAX(e.received_at) AS last_activity
          FROM frameio_events e
          JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.external_id = e.project_id
     LEFT JOIN frameio_users u
                ON u.user_id = json_extract(e.payload, '$.user.id')
         WHERE e.event_type = 'comment.created'
           AND e.received_at >= ?
           AND COALESCE(u.is_external, 1) = 1
      GROUP BY csm.client_id
      `,
      args: [sevenDaysAgo],
    });
    const extByClient = new Map<number, { n: number; last_activity: string }>();
    for (const row of ext.rows) {
      const r = row as unknown as { client_id: number; n: number; last_activity: string };
      extByClient.set(Number(r.client_id), { n: Number(r.n), last_activity: r.last_activity });
    }

    const lastActivityForUnmappedTable = await db.execute({
      sql: `
        SELECT csm.client_id, MAX(e.received_at) AS last_activity
          FROM frameio_events e
          JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.external_id = e.project_id
      GROUP BY csm.client_id
      `,
      args: [],
    });
    const lastActivityByClient = new Map<number, string>();
    for (const row of lastActivityForUnmappedTable.rows) {
      const r = row as unknown as { client_id: number; last_activity: string };
      lastActivityByClient.set(Number(r.client_id), r.last_activity);
    }

    return r.rows.map((row) => {
      const x = row as unknown as { client_id: number; client_name: string; pending_reviews: number; ready_for_review: number; total_reviews: number };
      const cid = Number(x.client_id);
      const e = extByClient.get(cid);
      return {
        clientId: cid,
        clientName: x.client_name,
        pendingReviews: Number(x.pending_reviews),
        readyForReview: Number(x.ready_for_review),
        totalReviews: Number(x.total_reviews),
        externalCommentsLast7d: e?.n ?? 0,
        lastActivityAt: e?.last_activity ?? lastActivityByClient.get(cid) ?? null,
      };
    });
  }, []);
}

export interface ActivityRow {
  eventId: number;
  receivedAt: string;
  eventType: string;
  resourceType: string | null;
  clientName: string | null;
  projectName: string | null;
  authorEmail: string | null;
  isExternal: boolean;
  status: string;
}

/** Last `limit` events of any type — top-of-feed activity stream. */
export async function getActivityFeed(limit = 30): Promise<ActivityRow[]> {
  return safe(async () => {
    const r = await db.execute({
      sql: `
        SELECT e.id AS event_id, e.received_at, e.event_type, e.resource_type, e.processing_status,
               c.name AS client_name,
               p.name AS project_name,
               u.email AS author_email, COALESCE(u.is_external, 1) AS is_external
          FROM frameio_events e
     LEFT JOIN frameio_users u
                ON u.user_id = json_extract(e.payload, '$.user.id')
     LEFT JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.external_id = e.project_id
     LEFT JOIN clients c
                ON c.id = csm.client_id
     LEFT JOIN frameio_projects p
                ON p.project_id = e.project_id
      ORDER BY e.received_at DESC
         LIMIT ?
      `,
      args: [limit],
    });
    return r.rows.map((row) => {
      const x = row as unknown as Record<string, unknown>;
      return {
        eventId: Number(x.event_id),
        receivedAt: String(x.received_at),
        eventType: String(x.event_type ?? ''),
        resourceType: (x.resource_type as string | null) ?? null,
        clientName: (x.client_name as string | null) ?? null,
        projectName: (x.project_name as string | null) ?? null,
        authorEmail: (x.author_email as string | null) ?? null,
        isExternal: Number(x.is_external) === 1,
        status: String(x.processing_status ?? ''),
      };
    });
  }, []);
}
