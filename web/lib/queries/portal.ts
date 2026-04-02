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
    JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source ='meta'
    WHERE csm.client_id = ?
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
    JOIN client_source_mappings csm ON csm.external_id = gs.account_id AND csm.source ='gads'
    WHERE csm.client_id = ?
      AND gs.date >= date('now', '-' || ? || ' days')
    GROUP BY gs.campaign_id, gs.campaign_name
    ORDER BY spend DESC
  `, [clientId, days]);
}

// --- GHL pipeline data ---

export interface PortalPipelineStage {
  stage_name: string;
  opp_count: number;
  total_value: number;
}

export interface PortalOpportunityRow {
  id: string;
  name: string | null;
  monetary_value: number;
  status: string;
  stage_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string | null;
}

export async function getGhlPipelineSummary(clientId: number): Promise<PortalPipelineStage[]> {
  return rows<PortalPipelineStage>(`
    SELECT s.name as stage_name,
           COUNT(*) as opp_count,
           COALESCE(SUM(o.monetary_value), 0) as total_value
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE (o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
           OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))
      AND o.status = 'open'
    GROUP BY s.name
    ORDER BY opp_count DESC
  `, [clientId, clientId]);
}

export async function getGhlRecentOpportunities(clientId: number, limit = 20): Promise<PortalOpportunityRow[]> {
  return rows<PortalOpportunityRow>(`
    SELECT o.id, o.name, o.monetary_value, o.status,
           s.name as stage_name, o.contact_name, o.contact_email, o.created_at
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE (o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
           OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))
    ORDER BY o.created_at DESC
    LIMIT ?
  `, [clientId, clientId, limit]);
}

// --- Client name lookup ---

export async function getClientName(clientId: number): Promise<string> {
  const result = await rows<{ name: string }>(
    'SELECT COALESCE(display_name, name) as name FROM clients WHERE id = ? LIMIT 1',
    [clientId],
  );
  return result[0]?.name ?? `Client ${clientId}`;
}
