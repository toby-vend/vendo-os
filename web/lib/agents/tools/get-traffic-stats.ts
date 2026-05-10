import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  /** Client / property display name to match against ga4_properties.display_name and gsc_sites.id (LIKE %name%). Required. */
  clientOrProperty: z.string().min(1),
  /** Inclusive YYYY-MM-DD start date. Defaults to 30 days ago. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Inclusive YYYY-MM-DD end date. Defaults to today. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Slice to return. */
  slice: z
    .enum(['summary', 'traffic_sources', 'top_queries', 'top_pages'])
    .default('summary'),
  /** Cap on grouped rows (queries/pages/sources). */
  limit: z.number().int().min(1).max(50).default(10),
});

const outputSchema = z.object({
  windowFrom: z.string(),
  windowTo: z.string(),
  matchedProperty: z.string().nullable(),
  matchedGscSite: z.string().nullable(),
  ga4Totals: z
    .object({
      sessions: z.number(),
      users: z.number(),
      newUsers: z.number(),
      pageViews: z.number(),
      engagementRate: z.number().nullable(),
      bounceRate: z.number().nullable(),
      conversions: z.number(),
    })
    .nullable(),
  gscTotals: z
    .object({
      clicks: z.number(),
      impressions: z.number(),
      ctr: z.number().nullable(),
      avgPosition: z.number().nullable(),
    })
    .nullable(),
  trafficSources: z
    .array(
      z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        sessions: z.number(),
        conversions: z.number(),
      }),
    )
    .optional(),
  topQueries: z
    .array(
      z.object({
        query: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number().nullable(),
        position: z.number().nullable(),
      }),
    )
    .optional(),
  topPages: z
    .array(
      z.object({
        page: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number().nullable(),
        position: z.number().nullable(),
      }),
    )
    .optional(),
});

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export const getTrafficStats = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getTrafficStats',
      description:
        'Look up GA4 + Google Search Console stats for a client website. Returns a summary (sessions / users / clicks / impressions) by default; switch slice to traffic_sources, top_queries or top_pages for breakdowns. Defaults to the last 30 days.',
      hasSideEffect: false,
      capability: CAPABILITIES.TRAFFIC_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const from = args.from ?? defaultFrom();
        const to = args.to ?? defaultTo();
        const pattern = `%${args.clientOrProperty}%`;

        // Try to match a GA4 property by display_name first.
        const ga4 = await rows<{ id: string; display_name: string | null }>(
          `SELECT id, display_name FROM ga4_properties
            WHERE display_name LIKE ? OR id LIKE ?
            ORDER BY display_name LIMIT 1`,
          [pattern, pattern],
        );
        const propertyId = ga4[0]?.id ?? null;
        const matchedProperty = ga4[0]?.display_name ?? propertyId;

        // GSC site is identified by site URL (id), not a separate display name.
        const gsc = await rows<{ id: string }>(
          `SELECT id FROM gsc_sites WHERE id LIKE ? ORDER BY id LIMIT 1`,
          [pattern],
        );
        const gscSite = gsc[0]?.id ?? null;

        // GA4 totals across the window.
        let ga4Totals = null as null | {
          sessions: number; users: number; newUsers: number; pageViews: number;
          engagementRate: number | null; bounceRate: number | null; conversions: number;
        };
        if (propertyId) {
          const t = await rows<{
            sessions: number; users: number; new_users: number; page_views: number;
            engagement_rate: number | null; bounce_rate: number | null; conversions: number;
          }>(
            `SELECT
              COALESCE(SUM(sessions),0) sessions,
              COALESCE(SUM(users),0) users,
              COALESCE(SUM(new_users),0) new_users,
              COALESCE(SUM(page_views),0) page_views,
              AVG(engagement_rate) engagement_rate,
              AVG(bounce_rate) bounce_rate,
              COALESCE(SUM(conversions),0) conversions
            FROM ga4_daily
            WHERE property_id = ? AND date >= ? AND date <= ?`,
            [propertyId, from, to],
          );
          const r = t[0];
          if (r) {
            ga4Totals = {
              sessions: r.sessions ?? 0,
              users: r.users ?? 0,
              newUsers: r.new_users ?? 0,
              pageViews: r.page_views ?? 0,
              engagementRate: r.engagement_rate ?? null,
              bounceRate: r.bounce_rate ?? null,
              conversions: r.conversions ?? 0,
            };
          }
        }

        // GSC totals across the window.
        let gscTotals = null as null | {
          clicks: number; impressions: number; ctr: number | null; avgPosition: number | null;
        };
        if (gscSite) {
          const t = await rows<{
            clicks: number; impressions: number; ctr: number | null; avg_position: number | null;
          }>(
            `SELECT
              COALESCE(SUM(clicks),0) clicks,
              COALESCE(SUM(impressions),0) impressions,
              AVG(ctr) ctr,
              AVG(avg_position) avg_position
            FROM gsc_daily
            WHERE site_id = ? AND date >= ? AND date <= ?`,
            [gscSite, from, to],
          );
          const r = t[0];
          if (r) {
            gscTotals = {
              clicks: r.clicks ?? 0,
              impressions: r.impressions ?? 0,
              ctr: r.ctr ?? null,
              avgPosition: r.avg_position ?? null,
            };
          }
        }

        const out: z.infer<typeof outputSchema> = {
          windowFrom: from,
          windowTo: to,
          matchedProperty: matchedProperty ?? null,
          matchedGscSite: gscSite,
          ga4Totals,
          gscTotals,
        };

        if (args.slice === 'traffic_sources' && propertyId) {
          const r = await rows<{
            source: string | null; medium: string | null; sessions: number; conversions: number;
          }>(
            `SELECT source, medium,
                    SUM(sessions) sessions, SUM(conversions) conversions
              FROM ga4_traffic_sources
              WHERE property_id = ? AND date >= ? AND date <= ?
              GROUP BY source, medium
              ORDER BY sessions DESC LIMIT ?`,
            [propertyId, from, to, args.limit],
          );
          out.trafficSources = r.map(s => ({
            source: s.source ?? null,
            medium: s.medium ?? null,
            sessions: s.sessions ?? 0,
            conversions: s.conversions ?? 0,
          }));
        }

        if (args.slice === 'top_queries' && gscSite) {
          const r = await rows<{
            query: string; clicks: number; impressions: number; ctr: number | null; position: number | null;
          }>(
            `SELECT query,
                    SUM(clicks) clicks,
                    SUM(impressions) impressions,
                    AVG(ctr) ctr,
                    AVG(position) position
              FROM gsc_queries
              WHERE site_id = ? AND date >= ? AND date <= ?
              GROUP BY query
              ORDER BY clicks DESC LIMIT ?`,
            [gscSite, from, to, args.limit],
          );
          out.topQueries = r.map(q => ({
            query: q.query,
            clicks: q.clicks ?? 0,
            impressions: q.impressions ?? 0,
            ctr: q.ctr ?? null,
            position: q.position ?? null,
          }));
        }

        if (args.slice === 'top_pages' && gscSite) {
          const r = await rows<{
            page: string; clicks: number; impressions: number; ctr: number | null; position: number | null;
          }>(
            `SELECT page,
                    SUM(clicks) clicks,
                    SUM(impressions) impressions,
                    AVG(ctr) ctr,
                    AVG(position) position
              FROM gsc_pages
              WHERE site_id = ? AND date >= ? AND date <= ?
              GROUP BY page
              ORDER BY clicks DESC LIMIT ?`,
            [gscSite, from, to, args.limit],
          );
          out.topPages = r.map(p => ({
            page: p.page,
            clicks: p.clicks ?? 0,
            impressions: p.impressions ?? 0,
            ctr: p.ctr ?? null,
            position: p.position ?? null,
          }));
        }

        return out;
      },
    },
    ctx,
  );
