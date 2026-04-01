import { rows } from './base.js';

// --- Interfaces ---

export interface AdAccountSummary {
  account_id: string;
  account_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

export interface CampaignSummary {
  campaign_id: string;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

// --- Google Ads interfaces ---

export interface GadsAccountSummary {
  account_id: string;
  account_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

export interface GadsCampaignSummary {
  campaign_id: string;
  campaign_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
}

// --- Meta Ads ---

export async function getAdAccountSummary(days = 30): Promise<AdAccountSummary[]> {
  return rows<AdAccountSummary>(`
    SELECT account_id, account_name,
           SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
           CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) / SUM(impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS REAL) / SUM(impressions) * 100, 2) ELSE 0 END as ctr
    FROM meta_insights
    WHERE date >= date('now', '-' || ? || ' days') AND level = 'campaign'
    GROUP BY account_id, account_name
    ORDER BY spend DESC
  `, [days]);
}

export async function getCampaignSummary(accountId: string, days = 30): Promise<CampaignSummary[]> {
  return rows<CampaignSummary>(`
    SELECT campaign_id, campaign_name,
           SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
           CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2) ELSE 0 END as cpc,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(spend) / SUM(impressions) * 1000, 2) ELSE 0 END as cpm,
           CASE WHEN SUM(impressions) > 0 THEN ROUND(CAST(SUM(clicks) AS REAL) / SUM(impressions) * 100, 2) ELSE 0 END as ctr
    FROM meta_insights
    WHERE account_id = ? AND date >= date('now', '-' || ? || ' days') AND level = 'campaign'
    GROUP BY campaign_id, campaign_name
    ORDER BY spend DESC
  `, [accountId, days]);
}
