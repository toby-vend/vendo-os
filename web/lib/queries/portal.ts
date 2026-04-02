import { rows } from './base.js';

// --- Interfaces ---

export interface PortalCampaignRow {
  campaign_id: string;
  campaign_name: string | null;
  platform: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversions: number;
}

// --- Client-scoped campaign breakdowns ---

export async function getMetaCampaignsForClient(clientId: number, days = 30): Promise<PortalCampaignRow[]> {
  return rows<PortalCampaignRow>(`
    SELECT mi.campaign_id, mi.campaign_name,
           'meta_ads' as platform,
           SUM(mi.impressions) as impressions,
           SUM(mi.clicks) as clicks,
           SUM(mi.spend) as spend,
           CASE WHEN SUM(mi.clicks) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(CAST(SUM(mi.clicks) AS REAL) / SUM(mi.impressions) * 100, 2) ELSE 0 END as ctr,
           0 as conversions
    FROM meta_insights mi
    JOIN client_account_map cam ON cam.platform_account_id = mi.account_id AND cam.platform = 'meta'
    WHERE cam.client_id = ?
      AND mi.date >= date('now', '-' || ? || ' days')
      AND mi.level = 'campaign'
    GROUP BY mi.campaign_id, mi.campaign_name
    ORDER BY spend DESC
  `, [clientId, days]);
}

export async function getGadsCampaignsForClient(clientId: number, days = 30): Promise<PortalCampaignRow[]> {
  return rows<PortalCampaignRow>(`
    SELECT gs.campaign_id, gs.campaign_name,
           'google_ads' as platform,
           SUM(gs.impressions) as impressions,
           SUM(gs.clicks) as clicks,
           SUM(gs.spend) as spend,
           CASE WHEN SUM(gs.clicks) > 0 THEN ROUND(SUM(gs.spend) / SUM(gs.clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(gs.impressions) > 0 THEN ROUND(SUM(gs.spend) / SUM(gs.impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(gs.impressions) > 0 THEN ROUND(CAST(SUM(gs.clicks) AS REAL) / SUM(gs.impressions) * 100, 2) ELSE 0 END as ctr,
           COALESCE(SUM(gs.conversions), 0) as conversions
    FROM gads_campaign_spend gs
    JOIN client_account_map cam ON cam.platform_account_id = gs.account_id AND cam.platform = 'gads'
    WHERE cam.client_id = ?
      AND gs.date >= date('now', '-' || ? || ' days')
    GROUP BY gs.campaign_id, gs.campaign_name
    ORDER BY spend DESC
  `, [clientId, days]);
}

// --- Client name lookup ---

export async function getClientName(clientId: number): Promise<string> {
  const result = await rows<{ client_name: string }>(
    'SELECT client_name FROM client_user_map WHERE client_id = ? LIMIT 1',
    [clientId],
  );
  if (result[0]) return result[0].client_name;

  const cam = await rows<{ client_name: string }>(
    'SELECT client_name FROM client_account_map WHERE client_id = ? LIMIT 1',
    [clientId],
  );
  return cam[0]?.client_name ?? `Client ${clientId}`;
}
