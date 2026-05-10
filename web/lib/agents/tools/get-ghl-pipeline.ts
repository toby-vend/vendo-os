import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

/**
 * getGhlPipeline — admin-only read access to the locally synced GHL
 * data (ghl_opportunities, ghl_stages, ghl_pipelines, ghl_locations).
 *
 * Three views:
 *   - 'by-stage'   → count + sum monetary_value per stage (open only)
 *   - 'top-deals'  → top N open opportunities by monetary_value
 *   - 'recent'    → most recently created opportunities (any status)
 */

const inputSchema = z.object({
  view: z.enum(['by-stage', 'top-deals', 'recent']),
  // Optional pipeline name fragment (e.g. 'sales', 'onboarding') to scope
  // by-stage / top-deals. LIKE-matched against ghl_pipelines.name; if a
  // single pipeline matches it's filtered, otherwise all pipelines roll up.
  pipeline: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  // 'recent' view: how many days back to include.
  daysBack: z.number().int().min(1).max(90).default(14),
});

const stageRow = z.object({
  pipeline: z.string(),
  stage: z.string(),
  stagePosition: z.number().nullable(),
  openCount: z.number(),
  openValue: z.number(),
});

const opportunityRow = z.object({
  id: z.string(),
  name: z.string().nullable(),
  monetaryValue: z.number().nullable(),
  pipeline: z.string().nullable(),
  stage: z.string().nullable(),
  status: z.string().nullable(),
  contactName: z.string().nullable(),
  contactCompany: z.string().nullable(),
  contactEmail: z.string().nullable(),
  createdAt: z.string().nullable(),
});

const outputSchema = z.object({
  view: z.enum(['by-stage', 'top-deals', 'recent']),
  byStage: z.array(stageRow).nullable(),
  opportunities: z.array(opportunityRow).nullable(),
  matchedPipeline: z.string().nullable(),
  asOf: z.string(),
});

interface StageAggRow {
  pipeline_name: string;
  stage_name: string;
  stage_position: number | null;
  open_count: number;
  open_value: number;
}
interface OppRow {
  id: string;
  name: string | null;
  monetary_value: number | null;
  pipeline_name: string | null;
  stage_name: string | null;
  status: string | null;
  contact_name: string | null;
  contact_company: string | null;
  contact_email: string | null;
  created_at: string | null;
}

export const getGhlPipeline = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getGhlPipeline',
      description:
        "Read the GoHighLevel CRM pipeline from the local sync. Pick a view: 'by-stage' (open opportunity count + total value per stage), 'top-deals' (top N open by value), or 'recent' (most recently created in last N days). Optional `pipeline` filter scopes by-stage / top-deals to one pipeline.",
      hasSideEffect: false,
      capability: CAPABILITIES.GHL_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const asOf = new Date().toISOString();

        // Resolve pipeline filter once, used by by-stage and top-deals.
        let pipelineFilter: string | null = null;
        let matchedPipeline: string | null = null;
        if (args.pipeline && args.pipeline.trim()) {
          const p = await rows<{ id: string; name: string }>(
            `SELECT id, name FROM ghl_pipelines WHERE name LIKE ? ORDER BY length(name) ASC LIMIT 1`,
            [`%${args.pipeline.trim()}%`],
          );
          if (p.length > 0) {
            pipelineFilter = p[0].id;
            matchedPipeline = p[0].name;
          }
        }

        if (args.view === 'by-stage') {
          const r = await rows<StageAggRow>(
            `SELECT p.name AS pipeline_name,
                    s.name AS stage_name,
                    s.position AS stage_position,
                    COUNT(o.id) AS open_count,
                    COALESCE(SUM(o.monetary_value), 0) AS open_value
               FROM ghl_stages s
               JOIN ghl_pipelines p ON p.id = s.pipeline_id
          LEFT JOIN ghl_opportunities o
                 ON o.stage_id = s.id AND o.status = 'open'
              WHERE (? IS NULL OR p.id = ?)
           GROUP BY s.id
           ORDER BY p.name, s.position ASC`,
            [pipelineFilter, pipelineFilter],
          );
          return {
            view: 'by-stage' as const,
            byStage: r.map((s) => ({
              pipeline: s.pipeline_name,
              stage: s.stage_name,
              stagePosition: s.stage_position ?? null,
              openCount: Number(s.open_count ?? 0),
              openValue: Number(s.open_value ?? 0),
            })),
            opportunities: null,
            matchedPipeline,
            asOf,
          };
        }

        if (args.view === 'top-deals') {
          const r = await rows<OppRow>(
            `SELECT o.id, o.name, o.monetary_value,
                    p.name AS pipeline_name, s.name AS stage_name,
                    o.status, o.contact_name, o.contact_company, o.contact_email, o.created_at
               FROM ghl_opportunities o
          LEFT JOIN ghl_stages s ON s.id = o.stage_id
          LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
              WHERE o.status = 'open'
                AND (? IS NULL OR o.pipeline_id = ?)
           ORDER BY o.monetary_value DESC NULLS LAST
              LIMIT ?`,
            [pipelineFilter, pipelineFilter, args.limit],
          );
          return {
            view: 'top-deals' as const,
            byStage: null,
            opportunities: r.map(rowToOpportunity),
            matchedPipeline,
            asOf,
          };
        }

        // recent
        const r = await rows<OppRow>(
          `SELECT o.id, o.name, o.monetary_value,
                  p.name AS pipeline_name, s.name AS stage_name,
                  o.status, o.contact_name, o.contact_company, o.contact_email, o.created_at
             FROM ghl_opportunities o
        LEFT JOIN ghl_stages s ON s.id = o.stage_id
        LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
            WHERE o.created_at >= datetime('now', '-' || ? || ' days')
         ORDER BY o.created_at DESC
            LIMIT ?`,
          [args.daysBack, args.limit],
        );
        return {
          view: 'recent' as const,
          byStage: null,
          opportunities: r.map(rowToOpportunity),
          matchedPipeline: null,
          asOf,
        };
      },
    },
    ctx,
  );

function rowToOpportunity(o: OppRow) {
  return {
    id: o.id,
    name: o.name ?? null,
    monetaryValue: o.monetary_value ?? null,
    pipeline: o.pipeline_name ?? null,
    stage: o.stage_name ?? null,
    status: o.status ?? null,
    contactName: o.contact_name ?? null,
    contactCompany: o.contact_company ?? null,
    contactEmail: o.contact_email ?? null,
    createdAt: o.created_at ?? null,
  };
}
