import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows, scalar } from '../../queries/base.js';
import {
  getCampaignSummary,
  getGadsCampaignSummary,
} from '../../queries/ads.js';
import type { ToolCtx } from '../types.js';

const inputSchema = z.object({
  clientId: z.number().int(),
  platform: z.enum(['meta', 'google', 'both']).default('both'),
  days: z.number().int().min(1).max(180).default(30),
});

const platformSchema = z.object({
  platform: z.enum(['meta', 'google']),
  campaigns: z.array(
    z.object({
      campaignId: z.string(),
      campaignName: z.string(),
      spend: z.number(),
      impressions: z.number(),
      clicks: z.number(),
      ctr: z.number().nullable(),
      cpc: z.number().nullable(),
    }),
  ),
  totalSpend: z.number(),
});

const outputSchema = z.object({
  clientName: z.string().nullable(),
  period: z.object({
    days: z.number(),
    from: z.string(),
    to: z.string(),
  }),
  platforms: z.array(platformSchema),
});

interface AccountIdRow {
  external_id: string;
}

export const getCampaignPerformance = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getCampaignPerformance',
      description:
        'Get recent campaign performance for a client across Meta and Google Ads. Returns campaigns with spend, clicks, impressions, CTR.',
      hasSideEffect: false,
      capability: CAPABILITIES.CAMPAIGNS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const clientName = await scalar<string>(
          'SELECT COALESCE(display_name, name) FROM clients WHERE id = ?',
          [args.clientId],
        );

        const now = new Date();
        const fromDate = new Date(now.getTime() - args.days * 24 * 60 * 60 * 1000);
        const period = {
          days: args.days,
          from: fromDate.toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        };

        const wantMeta = args.platform === 'meta' || args.platform === 'both';
        const wantGoogle = args.platform === 'google' || args.platform === 'both';

        const platforms: z.infer<typeof platformSchema>[] = [];

        if (wantMeta) {
          const accounts = await rows<AccountIdRow>(
            `SELECT external_id FROM client_source_mappings
             WHERE client_id = ? AND source = 'meta'`,
            [args.clientId],
          );

          const aggregated = new Map<
            string,
            {
              campaignId: string;
              campaignName: string;
              spend: number;
              impressions: number;
              clicks: number;
            }
          >();

          for (const acc of accounts) {
            const summary = await getCampaignSummary(acc.external_id, args.days);
            for (const c of summary) {
              const existing = aggregated.get(c.campaign_id);
              if (existing) {
                existing.spend += c.spend;
                existing.impressions += c.impressions;
                existing.clicks += c.clicks;
              } else {
                aggregated.set(c.campaign_id, {
                  campaignId: c.campaign_id,
                  campaignName: c.campaign_name ?? '(unnamed)',
                  spend: c.spend,
                  impressions: c.impressions,
                  clicks: c.clicks,
                });
              }
            }
          }

          const campaigns = Array.from(aggregated.values()).map((c) => ({
            campaignId: c.campaignId,
            campaignName: c.campaignName,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks,
            ctr:
              c.impressions > 0
                ? Math.round((c.clicks / c.impressions) * 10000) / 100
                : null,
            cpc:
              c.clicks > 0 ? Math.round((c.spend / c.clicks) * 100) / 100 : null,
          }));

          platforms.push({
            platform: 'meta',
            campaigns,
            totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          });
        }

        if (wantGoogle) {
          // Google Ads is mapped under source='gads' in client_source_mappings.
          const accounts = await rows<AccountIdRow>(
            `SELECT external_id FROM client_source_mappings
             WHERE client_id = ? AND source = 'gads'`,
            [args.clientId],
          );

          const aggregated = new Map<
            string,
            {
              campaignId: string;
              campaignName: string;
              spend: number;
              impressions: number;
              clicks: number;
            }
          >();

          for (const acc of accounts) {
            const summary = await getGadsCampaignSummary(acc.external_id, args.days);
            for (const c of summary) {
              const existing = aggregated.get(c.campaign_id);
              if (existing) {
                existing.spend += c.spend;
                existing.impressions += c.impressions;
                existing.clicks += c.clicks;
              } else {
                aggregated.set(c.campaign_id, {
                  campaignId: c.campaign_id,
                  campaignName: c.campaign_name ?? '(unnamed)',
                  spend: c.spend,
                  impressions: c.impressions,
                  clicks: c.clicks,
                });
              }
            }
          }

          const campaigns = Array.from(aggregated.values()).map((c) => ({
            campaignId: c.campaignId,
            campaignName: c.campaignName,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks,
            ctr:
              c.impressions > 0
                ? Math.round((c.clicks / c.impressions) * 10000) / 100
                : null,
            cpc:
              c.clicks > 0 ? Math.round((c.spend / c.clicks) * 100) / 100 : null,
          }));

          platforms.push({
            platform: 'google',
            campaigns,
            totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          });
        }

        return {
          clientName,
          period,
          platforms,
        };
      },
    },
    ctx,
  );
