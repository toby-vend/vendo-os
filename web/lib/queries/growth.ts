import { rows, scalar } from './base.js';

// --- LinkedIn Content ---

export interface LinkedInPost {
  id: number;
  pillar: string;
  topic: string;
  status: string;
  scheduled_date: string | null;
  draft: string | null;
  engagement_likes: number;
  engagement_comments: number;
  engagement_reposts: number;
  engagement_impressions: number;
  created_at: string;
}

export async function getLinkedInPipeline(): Promise<LinkedInPost[]> {
  return rows<LinkedInPost>(`
    SELECT id, pillar, topic, status, scheduled_date, draft,
      engagement_likes, engagement_comments, engagement_reposts, engagement_impressions, created_at
    FROM linkedin_content
    WHERE status NOT IN ('cancelled')
    ORDER BY CASE WHEN status = 'published' THEN 2 ELSE 0 END, scheduled_date ASC, created_at DESC
    LIMIT 30
  `);
}

export async function getLinkedInStats(): Promise<{
  total: number; ideas: number; drafted: number; published: number;
  avgImpressions: number | null; avgLikes: number | null;
}> {
  const r = await rows<Record<string, number | null>>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'idea' THEN 1 ELSE 0 END) as ideas,
      SUM(CASE WHEN status = 'drafted' THEN 1 ELSE 0 END) as drafted,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      ROUND(AVG(CASE WHEN engagement_impressions > 0 THEN engagement_impressions END), 0) as avgImpressions,
      ROUND(AVG(CASE WHEN engagement_likes > 0 THEN engagement_likes END), 0) as avgLikes
    FROM linkedin_content
  `);
  const row = r[0] || {};
  return {
    total: (row.total as number) ?? 0,
    ideas: (row.ideas as number) ?? 0,
    drafted: (row.drafted as number) ?? 0,
    published: (row.published as number) ?? 0,
    avgImpressions: row.avgImpressions as number | null,
    avgLikes: row.avgLikes as number | null,
  };
}

// --- Outbound Lead Gen ---

export interface OutboundProspect {
  id: number;
  prospect_name: string;
  prospect_company: string | null;
  prospect_email: string | null;
  icp_match_score: number;
  channel: string;
  sequence_step: number;
  status: string;
  response_type: string | null;
  meeting_booked: number;
  converted: number;
  updated_at: string;
}

export async function getOutboundPipeline(): Promise<OutboundProspect[]> {
  return rows<OutboundProspect>(`
    SELECT id, prospect_name, prospect_company, prospect_email, icp_match_score,
      channel, sequence_step, status, response_type, meeting_booked, converted, updated_at
    FROM outbound_campaigns
    ORDER BY
      CASE status WHEN 'responded' THEN 0 WHEN 'meeting_booked' THEN 1 WHEN 'drafted' THEN 2 WHEN 'sent' THEN 3 WHEN 'queued' THEN 4 ELSE 5 END,
      icp_match_score DESC
    LIMIT 50
  `);
}

export async function getOutboundFunnel(): Promise<{
  total: number; contacted: number; responded: number;
  interested: number; meetings: number; converted: number;
}> {
  const r = await rows<Record<string, number>>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status != 'queued' THEN 1 ELSE 0 END) as contacted,
      SUM(CASE WHEN response_type IS NOT NULL THEN 1 ELSE 0 END) as responded,
      SUM(CASE WHEN response_type = 'interested' THEN 1 ELSE 0 END) as interested,
      SUM(CASE WHEN meeting_booked = 1 THEN 1 ELSE 0 END) as meetings,
      SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted
    FROM outbound_campaigns
  `);
  const row = r[0] || {};
  return {
    total: row.total ?? 0, contacted: row.contacted ?? 0, responded: row.responded ?? 0,
    interested: row.interested ?? 0, meetings: row.meetings ?? 0, converted: row.converted ?? 0,
  };
}

// --- Case Studies ---

export interface CaseStudy {
  id: number;
  client_name: string;
  win_type: string;
  metric_highlight: string;
  client_approved: number;
  anonymous: number;
  status: string;
  created_at: string;
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  return rows<CaseStudy>(`
    SELECT id, client_name, win_type, metric_highlight, client_approved, anonymous, status, created_at
    FROM case_studies
    ORDER BY created_at DESC
    LIMIT 20
  `);
}

export async function getCaseStudyStats(): Promise<{
  total: number; identified: number; drafted: number; published: number;
}> {
  const r = await rows<Record<string, number>>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'identified' THEN 1 ELSE 0 END) as identified,
      SUM(CASE WHEN status = 'drafted' THEN 1 ELSE 0 END) as drafted,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
    FROM case_studies
  `);
  const row = r[0] || {};
  return {
    total: row.total ?? 0, identified: row.identified ?? 0,
    drafted: row.drafted ?? 0, published: row.published ?? 0,
  };
}

// --- Referrals ---

export interface Referral {
  id: number;
  referrer_name: string;
  referrer_type: string;
  referred_name: string;
  referred_company: string | null;
  status: string;
  converted: number;
  reward_type: string | null;
  reward_amount: number | null;
  reward_paid: number;
  created_at: string;
}

export async function getReferrals(): Promise<Referral[]> {
  return rows<Referral>(`
    SELECT id, referrer_name, referrer_type, referred_name, referred_company,
      status, converted, reward_type, reward_amount, reward_paid, created_at
    FROM referrals
    ORDER BY created_at DESC
    LIMIT 30
  `);
}

export async function getReferralStats(): Promise<{
  total: number; converted: number; convRate: number;
  totalPaid: number; totalOwing: number;
}> {
  const r = await rows<Record<string, number>>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN reward_paid = 1 THEN reward_amount ELSE 0 END) as totalPaid,
      SUM(CASE WHEN converted = 1 AND reward_paid = 0 THEN reward_amount ELSE 0 END) as totalOwing
    FROM referrals
  `);
  const row = r[0] || {};
  const total = row.total ?? 0;
  const converted = row.converted ?? 0;
  return {
    total, converted,
    convRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    totalPaid: row.totalPaid ?? 0,
    totalOwing: row.totalOwing ?? 0,
  };
}

// --- Upsell ---

export interface UpsellOpportunity {
  id: number;
  client_name: string;
  trigger_type: string;
  signal: string;
  confidence: number;
  recommended_action: string;
  status: string;
  created_at: string;
}

export async function getUpsellOpportunities(): Promise<UpsellOpportunity[]> {
  return rows<UpsellOpportunity>(`
    SELECT id, client_name, trigger_type, signal, confidence, recommended_action, status, created_at
    FROM upsell_opportunities
    ORDER BY confidence DESC, created_at DESC
    LIMIT 20
  `);
}
