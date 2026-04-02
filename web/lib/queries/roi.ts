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
      JOIN client_source_mappings csm ON csm.external_id = mi.account_id AND csm.source ='meta'
      WHERE csm.client_id = ?
        AND mi.date >= date('now', '-' || ? || ' days')
        AND mi.level = 'campaign'
    `, [clientId, days]),

    scalar<number>(`
      SELECT COALESCE(SUM(gs.spend), 0)
      FROM gads_campaign_spend gs
      JOIN client_source_mappings csm ON csm.external_id = gs.account_id AND csm.source ='gads'
      WHERE csm.client_id = ?
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

// --- GHL-based ROI (derived from opportunity stages + tags) ---

// Stage mapping: Booked Appointment / Follow Up (post appointment) = in_progress, Won status = won
const IN_PROGRESS_STAGES = ['Booked Appointment', 'Follow Up (post appointment)'];

function ghlLocationFilter(clientId: number): { clause: string; args: (string | number)[] } {
  return {
    clause: `(o.location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
              OR o.contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl'))`,
    args: [clientId, clientId],
  };
}

/** Parse tag like "composite bonding - google" → { treatment: "composite bonding", channel: "google" } */
function parseTag(tag: string): { treatment: string; channel: string } | null {
  // Skip meta-tags like "google - opportunity won", "interest: ...", "emarketing", etc.
  if (tag.includes('opportunity won') || tag.startsWith('interest:') || tag === 'emarketing'
    || tag === 'manual upload' || tag === 'location-asset' || tag === 'paid search'
    || tag.startsWith('pmax') || tag.startsWith('unfiltered') || tag.startsWith('fb -')) return null;

  const parts = tag.split(' - ');
  if (parts.length === 2) {
    return { treatment: parts[0].trim(), channel: parts[1].trim() };
  }
  // Try "treatment channel lead" pattern e.g. "invisalign google lead"
  const match = tag.match(/^(.+?)\s+(google|facebook|meta)\b/i);
  if (match) return { treatment: match[1].trim(), channel: match[2].toLowerCase() };
  return null;
}

export interface GhlChannelROI {
  channel: string;
  leads: number;
  in_progress: number;
  won: number;
  revenue: number;
  spend: number;
}

export interface GhlTreatmentROI {
  treatment: string;
  leads: number;
  in_progress: number;
  won: number;
  revenue: number;
}

export interface GhlROISummary {
  total_leads: number;
  total_in_progress: number;
  total_won: number;
  total_revenue: number;
  total_spend: number;
  roi_percent: number;
  cpl: number;
  conversion_rate: number;
  channels: GhlChannelROI[];
  treatments: GhlTreatmentROI[];
}

export async function getGhlROI(clientId: number, days = 30): Promise<GhlROISummary> {
  const loc = ghlLocationFilter(clientId);

  // Get all opportunities with stage + tags + value + status + source
  const opps = await rows<{
    stage_name: string | null; status: string; monetary_value: number; contact_tags: string | null; opp_source: string | null;
  }>(`
    SELECT s.name as stage_name, o.status, o.monetary_value, o.contact_tags, o.source as opp_source
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE ${loc.clause}
      AND o.created_at >= date('now', '-' || ? || ' days')
  `, [...loc.args, days]);

  // Get ad spend
  const spendRows = await getChannelSpend(clientId, days);
  const spendByChannel: Record<string, number> = {};
  let totalSpend = 0;
  for (const s of spendRows) {
    const ch = s.channel === 'meta_ads' ? 'facebook' : s.channel === 'google_ads' ? 'google' : s.channel;
    spendByChannel[ch] = (spendByChannel[ch] || 0) + s.spend;
    totalSpend += s.spend;
  }

  // Aggregate by channel and treatment
  const channelData: Record<string, { leads: number; in_progress: number; won: number; revenue: number }> = {};
  const treatmentData: Record<string, { leads: number; in_progress: number; won: number; revenue: number }> = {};
  let totalLeads = 0, totalInProgress = 0, totalWon = 0, totalRevenue = 0;

  for (const opp of opps) {
    const isInProgress = IN_PROGRESS_STAGES.includes(opp.stage_name || '');
    const isWon = opp.status === 'won';

    // Determine channel from opportunity source field first, then fall back to tags
    let channels: string[] = [];
    let treatments: string[] = [];

    // Map opportunity source to channel
    const src = (opp.opp_source || '').toLowerCase();
    if (src.includes('paid search') || src.includes('search -') || src.includes('pmax')) {
      if (!channels.includes('google')) channels.push('google');
    }
    if (src.includes('paid social') || src.includes('facebook') || src.includes('meta')) {
      if (!channels.includes('facebook')) channels.push('facebook');
    }
    // Skip organic leads
    if (src.includes('organic') || src === 'direct' || src === 'gbp' || src === 'recommendation' || src === 'patient called') {
      continue;
    }

    // Parse tags for treatment + additional channel signal
    if (opp.contact_tags) {
      try {
        const tags = JSON.parse(opp.contact_tags) as string[];
        for (const tag of tags) {
          const parsed = parseTag(tag);
          if (parsed) {
            if (!channels.includes(parsed.channel)) channels.push(parsed.channel);
            if (!treatments.includes(parsed.treatment)) treatments.push(parsed.treatment);
          }
        }
      } catch { /* skip */ }
    }
    if (channels.length === 0) channels = ['unattributed'];
    if (treatments.length === 0) treatments = ['general'];

    totalLeads++;
    if (isInProgress) totalInProgress++;
    if (isWon) { totalWon++; totalRevenue += opp.monetary_value || 0; }

    for (const ch of channels) {
      if (!channelData[ch]) channelData[ch] = { leads: 0, in_progress: 0, won: 0, revenue: 0 };
      channelData[ch].leads++;
      if (isInProgress) channelData[ch].in_progress++;
      if (isWon) { channelData[ch].won++; channelData[ch].revenue += opp.monetary_value || 0; }
    }

    for (const tr of treatments) {
      if (!treatmentData[tr]) treatmentData[tr] = { leads: 0, in_progress: 0, won: 0, revenue: 0 };
      treatmentData[tr].leads++;
      if (isInProgress) treatmentData[tr].in_progress++;
      if (isWon) { treatmentData[tr].won++; treatmentData[tr].revenue += opp.monetary_value || 0; }
    }
  }

  const channelRows: GhlChannelROI[] = Object.entries(channelData)
    .map(([channel, d]) => ({ channel, ...d, spend: spendByChannel[channel] || 0 }))
    .sort((a, b) => b.leads - a.leads);

  const treatmentRows: GhlTreatmentROI[] = Object.entries(treatmentData)
    .map(([treatment, d]) => ({ treatment, ...d }))
    .sort((a, b) => b.leads - a.leads);

  return {
    total_leads: totalLeads,
    total_in_progress: totalInProgress,
    total_won: totalWon,
    total_revenue: totalRevenue,
    total_spend: totalSpend,
    roi_percent: totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 10000) / 100 : 0,
    cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
    conversion_rate: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 10000) / 100 : 0,
    channels: channelRows,
    treatments: treatmentRows,
  };
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
