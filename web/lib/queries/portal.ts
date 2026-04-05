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
  const rawRows = await rows<PortalCampaignRow & { actions_json: string | null }>(`
    SELECT mi.campaign_id, mi.campaign_name,
           'meta_ads' as platform,
           SUM(mi.impressions) as impressions,
           SUM(mi.clicks) as clicks,
           SUM(mi.spend) as spend,
           CASE WHEN SUM(mi.clicks) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(CAST(SUM(mi.clicks) AS REAL) / SUM(mi.impressions) * 100, 2) ELSE 0 END as ctr,
           GROUP_CONCAT(mi.actions, '|||') as actions_json
    FROM meta_insights mi
    JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source ='meta'
    WHERE csm.client_id = ?
      AND mi.date >= date('now', '-' || ? || ' days')
      AND mi.level = 'campaign'
    GROUP BY mi.campaign_id, mi.campaign_name
    ORDER BY spend DESC
  `, [clientId, days]);

  return rawRows.map(r => {
    let conversions = 0;
    if (r.actions_json) {
      for (const chunk of String(r.actions_json).split('|||')) {
        conversions += extractMetaConversions(chunk);
      }
    }
    return { ...r, conversions, actions_json: undefined } as PortalCampaignRow;
  });
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
  pipeline_name: string | null;
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
           p.name as pipeline_name, s.name as stage_name,
           o.contact_name, o.contact_email, o.created_at
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
    WHERE (o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
           OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))
    ORDER BY o.created_at DESC
    LIMIT ?
  `, [clientId, clientId, limit]);
}

// --- GHL leads (opportunities as leads for the leads page) ---

export interface GhlLeadRow {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  opp_source: string | null;
  monetary_value: number;
  status: string;
  tags: string | null;
  created_at: string | null;
}

export interface GhlLeadsResult {
  leads: GhlLeadRow[];
  total: number;
}

export async function getGhlLeads(
  clientId: number,
  days = 30,
  filters?: { status?: string; tag?: string; page?: number; pageSize?: number },
): Promise<GhlLeadsResult> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [
    `(o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
      OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))`,
    "o.created_at >= date('now', '-' || ? || ' days')",
  ];
  const args: (string | number)[] = [clientId, clientId, days];

  if (filters?.status) {
    conditions.push('o.status = ?');
    args.push(filters.status);
  }
  if (filters?.tag) {
    conditions.push("o.contact_tags LIKE '%' || ? || '%'");
    args.push(filters.tag);
  }

  const whereClause = conditions.join(' AND ');

  const [leads, total] = await Promise.all([
    rows<GhlLeadRow>(`
      SELECT o.id, o.contact_name, o.contact_email, o.contact_phone,
             p.name as pipeline_name, s.name as stage_name,
             o.source as opp_source, o.monetary_value, o.status,
             o.contact_tags as tags, o.created_at
      FROM ghl_opportunities o
      LEFT JOIN ghl_stages s ON o.stage_id = s.id
      LEFT JOIN ghl_pipelines p ON o.pipeline_id = p.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...args, pageSize, offset]),

    rows<{ c: number }>(`
      SELECT COUNT(*) as c
      FROM ghl_opportunities o
      WHERE ${whereClause}
    `, args),
  ]);

  return { leads, total: total[0]?.c ?? 0 };
}

export async function getGhlLeadTags(clientId: number, days = 30): Promise<{ tag: string; count: number }[]> {
  const result = await rows<{ tags: string }>(`
    SELECT o.contact_tags as tags
    FROM ghl_opportunities o
    WHERE (o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
           OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))
      AND o.created_at >= date('now', '-' || ? || ' days')
      AND o.contact_tags IS NOT NULL AND o.contact_tags != '[]'
  `, [clientId, clientId, days]);

  const tagCounts = new Map<string, number>();
  for (const row of result) {
    try {
      const tags = JSON.parse(row.tags) as string[];
      for (const t of tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    } catch { /* skip malformed */ }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Client name lookup ---

export async function getClientName(clientId: number): Promise<string> {
  const result = await rows<{ name: string }>(
    'SELECT COALESCE(display_name, name) as name FROM clients WHERE id = ? LIMIT 1',
    [clientId],
  );
  return result[0]?.name ?? `Client ${clientId}`;
}

// --- Meta Ads: top performing ads (ad-level data) ---

export interface MetaAdRow {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  ctr: number;
  reach: number;
  frequency: number;
  thumbnail_url: string | null;
  conversions: number;
}

/** Extract dental conversions (View Content + Instant Form/Lead) from Meta actions JSON */
function extractMetaConversions(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions: Array<{ action_type: string; value: string }> = JSON.parse(actionsJson);
    let total = 0;
    for (const a of actions) {
      if (a.action_type.includes('view_content') || a.action_type === 'lead' || a.action_type.includes('lead_grouped') || a.action_type === 'onsite_conversion.messaging_first_reply') {
        total += parseInt(a.value, 10) || 0;
      }
    }
    return total;
  } catch { return 0; }
}

export async function getMetaTopAds(clientId: number, days = 30, limit = 10): Promise<MetaAdRow[]> {
  // Try with thumbnail_url column, fall back to NULL if column doesn't exist yet
  let rawRows: Array<MetaAdRow & { actions_json: string | null }>;
  try {
    rawRows = await rows<MetaAdRow & { actions_json: string | null }>(`
      SELECT mi.ad_id, mi.ad_name, mi.campaign_name, MAX(mi.thumbnail_url) as thumbnail_url,
             SUM(mi.impressions) as impressions,
             SUM(mi.clicks) as clicks, SUM(mi.spend) as spend,
             CASE WHEN SUM(mi.clicks) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.clicks), 2) ELSE 0 END as cpc,
             CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(CAST(SUM(mi.clicks) AS REAL) / SUM(mi.impressions) * 100, 2) ELSE 0 END as ctr,
             COALESCE(SUM(mi.reach), 0) as reach,
             CASE WHEN SUM(mi.reach) > 0 THEN ROUND(CAST(SUM(mi.impressions) AS REAL) / SUM(mi.reach), 2) ELSE 0 END as frequency,
             GROUP_CONCAT(mi.actions, '|||') as actions_json
      FROM meta_insights mi
      JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ? AND mi.date >= date('now', '-' || ? || ' days') AND mi.level = 'ad' AND mi.ad_id IS NOT NULL
      GROUP BY mi.ad_id, mi.ad_name ORDER BY spend DESC LIMIT ?
    `, [clientId, days, limit]);
  } catch {
    // Fallback: thumbnail_url column doesn't exist yet
    rawRows = await rows<MetaAdRow & { actions_json: string | null }>(`
      SELECT mi.ad_id, mi.ad_name, mi.campaign_name, NULL as thumbnail_url,
             SUM(mi.impressions) as impressions, SUM(mi.clicks) as clicks, SUM(mi.spend) as spend,
             CASE WHEN SUM(mi.clicks) > 0 THEN ROUND(SUM(mi.spend) / SUM(mi.clicks), 2) ELSE 0 END as cpc,
             CASE WHEN SUM(mi.impressions) > 0 THEN ROUND(CAST(SUM(mi.clicks) AS REAL) / SUM(mi.impressions) * 100, 2) ELSE 0 END as ctr,
             COALESCE(SUM(mi.reach), 0) as reach,
             CASE WHEN SUM(mi.reach) > 0 THEN ROUND(CAST(SUM(mi.impressions) AS REAL) / SUM(mi.reach), 2) ELSE 0 END as frequency,
             GROUP_CONCAT(mi.actions, '|||') as actions_json
      FROM meta_insights mi
      JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source = 'meta'
      WHERE csm.client_id = ? AND mi.date >= date('now', '-' || ? || ' days') AND mi.level = 'ad' AND mi.ad_id IS NOT NULL
      GROUP BY mi.ad_id, mi.ad_name ORDER BY spend DESC LIMIT ?
    `, [clientId, days, limit]);
  }

  return rawRows.map(r => {
    // Parse concatenated actions JSON arrays
    let conversions = 0;
    if (r.actions_json) {
      for (const chunk of String(r.actions_json).split('|||')) {
        conversions += extractMetaConversions(chunk);
      }
    }
    return { ...r, conversions, actions_json: undefined } as MetaAdRow;
  });
}

// --- Meta Ads: reach & engagement summary ---

export interface MetaEngagementSummary {
  total_reach: number;
  avg_frequency: number;
  total_impressions: number;
  total_clicks: number;
}

export async function getMetaEngagement(clientId: number, days = 30): Promise<MetaEngagementSummary> {
  const result = await rows<MetaEngagementSummary>(`
    SELECT COALESCE(SUM(mi.reach), 0) as total_reach,
           CASE WHEN SUM(mi.reach) > 0 THEN ROUND(CAST(SUM(mi.impressions) AS REAL) / SUM(mi.reach), 2) ELSE 0 END as avg_frequency,
           COALESCE(SUM(mi.impressions), 0) as total_impressions,
           COALESCE(SUM(mi.clicks), 0) as total_clicks
    FROM meta_insights mi
    JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source = 'meta'
    WHERE csm.client_id = ?
      AND mi.date >= date('now', '-' || ? || ' days')
      AND mi.level = 'campaign'
  `, [clientId, days]);
  return result[0] || { total_reach: 0, avg_frequency: 0, total_impressions: 0, total_clicks: 0 };
}

// --- Google Ads: top converting keywords ---

export interface GadsKeywordRow {
  keyword_text: string;
  match_type: string | null;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  cpc: number;
  ctr: number;
}

export async function getGadsTopKeywords(clientId: number, days = 30, limit = 15): Promise<GadsKeywordRow[]> {
  return rows<GadsKeywordRow>(`
    SELECT kw.keyword_text, kw.match_type, kw.campaign_name,
           SUM(kw.impressions) as impressions,
           SUM(kw.clicks) as clicks,
           SUM(kw.spend) as spend,
           COALESCE(SUM(kw.conversions), 0) as conversions,
           COALESCE(SUM(kw.conversion_value), 0) as conversion_value,
           CASE WHEN SUM(kw.clicks) > 0 THEN ROUND(SUM(kw.spend) / SUM(kw.clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(kw.impressions) > 0 THEN ROUND(CAST(SUM(kw.clicks) AS REAL) / SUM(kw.impressions) * 100, 2) ELSE 0 END as ctr
    FROM gads_keyword_stats kw
    JOIN client_source_mappings csm ON csm.external_id = kw.account_id AND csm.source = 'gads'
    WHERE csm.client_id = ?
      AND kw.date >= date('now', '-' || ? || ' days')
    GROUP BY kw.keyword_text
    ORDER BY conversions DESC, spend DESC
    LIMIT ?
  `, [clientId, days, limit]);
}
