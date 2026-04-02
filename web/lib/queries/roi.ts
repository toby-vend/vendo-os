import { rows, scalar } from './base.js';

// --- Interfaces ---

export interface ChannelSpend {
  channel: string;
  spend: number;
}

export interface ChannelLeads {
  channel: string;
  lead_count: number;
}

export interface ChannelRevenue {
  channel: string;
  revenue: number;
  converted_count: number;
}

export interface ROISummary {
  total_revenue: number;
  total_spend: number;
  roi_percent: number;
  cpl: number;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
}

export interface TreatmentROI {
  treatment_type: string;
  revenue: number;
  lead_count: number;
  converted_count: number;
  conversion_rate: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

// --- Channel spend ---

export async function getChannelSpend(clientId: number, days = 30): Promise<ChannelSpend[]> {
  const [metaSpend, gadsSpend] = await Promise.all([
    scalar<number>(`
      SELECT COALESCE(SUM(mi.spend), 0)
      FROM meta_insights mi
      JOIN client_account_map cam ON cam.platform_account_id = mi.account_id AND cam.platform = 'meta'
      WHERE cam.client_id = ?
        AND mi.date >= date('now', '-' || ? || ' days')
        AND mi.level = 'campaign'
    `, [clientId, days]),

    scalar<number>(`
      SELECT COALESCE(SUM(gs.spend), 0)
      FROM gads_campaign_spend gs
      JOIN client_account_map cam ON cam.platform_account_id = gs.account_id AND cam.platform = 'gads'
      WHERE cam.client_id = ?
        AND gs.date >= date('now', '-' || ? || ' days')
    `, [clientId, days]),
  ]);

  const result: ChannelSpend[] = [];
  if ((metaSpend ?? 0) > 0) result.push({ channel: 'meta_ads', spend: metaSpend ?? 0 });
  if ((gadsSpend ?? 0) > 0) result.push({ channel: 'google_ads', spend: gadsSpend ?? 0 });
  return result;
}

// --- Leads by channel ---

export async function getLeadsByChannel(clientId: number, days = 30): Promise<ChannelLeads[]> {
  return rows<ChannelLeads>(`
    SELECT attributed_source as channel,
           COUNT(*) as lead_count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY attributed_source
    ORDER BY lead_count DESC
  `, [clientId, days]);
}

// --- Revenue by channel ---

export async function getRevenueByChannel(clientId: number, days = 30): Promise<ChannelRevenue[]> {
  return rows<ChannelRevenue>(`
    SELECT attributed_source as channel,
           COALESCE(SUM(treatment_value), 0) as revenue,
           COUNT(*) as converted_count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
      AND conversion_status = 'converted'
    GROUP BY attributed_source
    ORDER BY revenue DESC
  `, [clientId, days]);
}

// --- Blended ROI summary ---

export async function getROISummary(clientId: number, days = 30): Promise<ROISummary> {
  const [revenueRow, leadsRow, spendRows] = await Promise.all([
    rows<{ revenue: number; converted_count: number }>(`
      SELECT COALESCE(SUM(treatment_value), 0) as revenue,
             COUNT(*) as converted_count
      FROM attributed_leads
      WHERE client_id = ?
        AND lead_date >= date('now', '-' || ? || ' days')
        AND conversion_status = 'converted'
    `, [clientId, days]),

    scalar<number>(`
      SELECT COUNT(*)
      FROM attributed_leads
      WHERE client_id = ?
        AND lead_date >= date('now', '-' || ? || ' days')
    `, [clientId, days]),

    getChannelSpend(clientId, days),
  ]);

  const totalRevenue = revenueRow[0]?.revenue ?? 0;
  const convertedLeads = revenueRow[0]?.converted_count ?? 0;
  const totalLeads = leadsRow ?? 0;
  const totalSpend = spendRows.reduce((sum, r) => sum + r.spend, 0);

  return {
    total_revenue: totalRevenue,
    total_spend: totalSpend,
    roi_percent: totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 10000) / 100 : 0,
    cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
    total_leads: totalLeads,
    converted_leads: convertedLeads,
    conversion_rate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 10000) / 100 : 0,
  };
}

// --- ROI by treatment type ---

export async function getROIByTreatment(clientId: number, days = 30): Promise<TreatmentROI[]> {
  return rows<TreatmentROI>(`
    SELECT COALESCE(treatment_type, 'unknown') as treatment_type,
           COALESCE(SUM(CASE WHEN conversion_status = 'converted' THEN treatment_value ELSE 0 END), 0) as revenue,
           COUNT(*) as lead_count,
           SUM(CASE WHEN conversion_status = 'converted' THEN 1 ELSE 0 END) as converted_count,
           CASE WHEN COUNT(*) > 0
             THEN ROUND(CAST(SUM(CASE WHEN conversion_status = 'converted' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2)
             ELSE 0
           END as conversion_rate
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY treatment_type
    ORDER BY revenue DESC
  `, [clientId, days]);
}

// --- Conversion funnel ---

export async function getConversionFunnel(clientId: number, days = 30): Promise<FunnelStage[]> {
  return rows<FunnelStage>(`
    SELECT conversion_status as stage,
           COUNT(*) as count
    FROM attributed_leads
    WHERE client_id = ?
      AND lead_date >= date('now', '-' || ? || ' days')
    GROUP BY conversion_status
    ORDER BY
      CASE conversion_status
        WHEN 'lead' THEN 1
        WHEN 'qualified' THEN 2
        WHEN 'booked' THEN 3
        WHEN 'attended' THEN 4
        WHEN 'converted' THEN 5
        WHEN 'lost' THEN 6
        ELSE 7
      END
  `, [clientId, days]);
}
