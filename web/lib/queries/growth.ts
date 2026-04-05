import { db, rows, scalar } from './base.js';

// --- LinkedIn Content ---

export interface LinkedInPost {
  id: number;
  pillar: string;
  topic: string;
  status: string;
  scheduled_date: string | null;
  draft: string | null;
  source_meeting_id: string | null;
  engagement_likes: number;
  engagement_comments: number;
  engagement_reposts: number;
  engagement_impressions: number;
  created_at: string;
}

export interface RecentMeeting {
  id: string;
  title: string;
  date: string;
  client_name: string | null;
  summary: string | null;
  category: string | null;
}

export async function getRecentMeetingsForLinkedIn(): Promise<RecentMeeting[]> {
  return rows<RecentMeeting>(`
    SELECT id, title, date, client_name, summary, category
    FROM meetings
    WHERE summary IS NOT NULL AND date >= date('now', '-30 days')
    ORDER BY date DESC
    LIMIT 20
  `);
}

export async function getLinkedInPipeline(): Promise<LinkedInPost[]> {
  return rows<LinkedInPost>(`
    SELECT id, pillar, topic, status, scheduled_date, draft, source_meeting_id,
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
  notes: string | null;
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

// ===== MUTATIONS =====

// --- LinkedIn mutations ---

export async function getLinkedInPost(id: number): Promise<LinkedInPost | null> {
  const r = await rows<LinkedInPost>(
    'SELECT id, pillar, topic, status, scheduled_date, draft, source_meeting_id, engagement_likes, engagement_comments, engagement_reposts, engagement_impressions, created_at FROM linkedin_content WHERE id = ?',
    [id],
  );
  return r[0] ?? null;
}

export async function getMeetingSummaryForPost(meetingId: string): Promise<{ title: string; summary: string; date: string; client_name: string | null } | null> {
  const r = await rows<{ title: string; summary: string; date: string; client_name: string | null }>(
    'SELECT title, summary, date, client_name FROM meetings WHERE id = ?',
    [meetingId],
  );
  return r[0] ?? null;
}

export async function insertLinkedInIdeas(ideas: { pillar: string; topic: string; scheduledDate: string | null; meetingId: string | null }[]): Promise<void> {
  const now = new Date().toISOString();
  for (const idea of ideas) {
    await db.execute({
      sql: 'INSERT INTO linkedin_content (pillar, topic, status, scheduled_date, source_meeting_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [idea.pillar, idea.topic, 'idea', idea.scheduledDate, idea.meetingId, now, now],
    });
  }
}

export async function updateLinkedInDraft(id: number, draft: string): Promise<void> {
  await db.execute({
    sql: "UPDATE linkedin_content SET draft = ?, status = 'drafted', updated_at = ? WHERE id = ?",
    args: [draft, new Date().toISOString(), id],
  });
}

export async function updateLinkedInStatus(id: number, status: string): Promise<void> {
  const now = new Date().toISOString();
  const publishedAt = status === 'published' ? now : null;
  await db.execute({
    sql: 'UPDATE linkedin_content SET status = ?, published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?',
    args: [status, publishedAt, now, id],
  });
}

export async function updateLinkedInEngagement(id: number, data: { likes: number; comments: number; reposts: number; impressions: number }): Promise<void> {
  await db.execute({
    sql: 'UPDATE linkedin_content SET engagement_likes = ?, engagement_comments = ?, engagement_reposts = ?, engagement_impressions = ?, updated_at = ? WHERE id = ?',
    args: [data.likes, data.comments, data.reposts, data.impressions, new Date().toISOString(), id],
  });
}

// --- Outbound mutations ---

export async function getProspect(id: number): Promise<OutboundProspect | null> {
  const r = await rows<OutboundProspect>(
    'SELECT id, prospect_name, prospect_company, prospect_email, icp_match_score, channel, sequence_step, status, response_type, meeting_booked, converted, notes, updated_at FROM outbound_campaigns WHERE id = ?',
    [id],
  );
  return r[0] ?? null;
}

export async function insertProspect(data: { name: string; company: string | null; email: string | null; channel: string; notes: string | null; icpScore: number }): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO outbound_campaigns (prospect_name, prospect_company, prospect_email, icp_match_score, channel, sequence_step, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
    args: [data.name, data.company, data.email, data.icpScore, data.channel, 'queued', data.notes, now, now],
  });
}

export async function updateOutboundDraft(id: number, notes: string, step: number): Promise<void> {
  await db.execute({
    sql: "UPDATE outbound_campaigns SET notes = ?, sequence_step = ?, status = 'drafted', updated_at = ? WHERE id = ?",
    args: [notes, step, new Date().toISOString(), id],
  });
}

export async function updateOutboundStatus(id: number, status: string): Promise<void> {
  const now = new Date().toISOString();
  const meetingBooked = status === 'meeting_booked' ? 1 : null;
  const converted = status === 'converted' ? 1 : null;
  await db.execute({
    sql: 'UPDATE outbound_campaigns SET status = ?, meeting_booked = COALESCE(?, meeting_booked), converted = COALESCE(?, converted), updated_at = ? WHERE id = ?',
    args: [status, meetingBooked, converted, now, id],
  });
}

export async function updateOutboundResponse(id: number, responseType: string): Promise<void> {
  await db.execute({
    sql: "UPDATE outbound_campaigns SET response_type = ?, status = 'responded', last_contact_at = ?, updated_at = ? WHERE id = ?",
    args: [responseType, new Date().toISOString(), new Date().toISOString(), id],
  });
}

// --- Case Study mutations ---

export async function getCaseStudy(id: number): Promise<(CaseStudy & { draft?: string }) | null> {
  const r = await rows<CaseStudy & { draft?: string }>(
    'SELECT id, client_name, win_type, metric_highlight, client_approved, anonymous, status, draft, created_at FROM case_studies WHERE id = ?',
    [id],
  );
  return r[0] ?? null;
}

export async function insertCaseStudies(wins: { clientName: string; winType: string; metric: string }[]): Promise<void> {
  const now = new Date().toISOString();
  for (const w of wins) {
    await db.execute({
      sql: "INSERT INTO case_studies (client_name, win_type, metric_highlight, status, created_at, updated_at) VALUES (?, ?, ?, 'identified', ?, ?)",
      args: [w.clientName, w.winType, w.metric, now, now],
    });
  }
}

export async function updateCaseStudyDraft(id: number, draft: string, distribution: string): Promise<void> {
  await db.execute({
    sql: "UPDATE case_studies SET draft = ?, distribution = ?, status = 'drafted', updated_at = ? WHERE id = ?",
    args: [draft, distribution, new Date().toISOString(), id],
  });
}

export async function updateCaseStudyStatus(id: number, status: string): Promise<void> {
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  await db.execute({
    sql: 'UPDATE case_studies SET status = ?, published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ?',
    args: [status, publishedAt, new Date().toISOString(), id],
  });
}

export async function updateCaseStudyApproval(id: number, approved: boolean, anonymous: boolean): Promise<void> {
  await db.execute({
    sql: 'UPDATE case_studies SET client_approved = ?, anonymous = ?, updated_at = ? WHERE id = ?',
    args: [approved ? 1 : 0, anonymous ? 1 : 0, new Date().toISOString(), id],
  });
}

// --- Referral mutations ---

export async function insertReferral(data: { referrerName: string; referrerType: string; referredName: string; referredCompany: string | null }): Promise<void> {
  const rewardRules: Record<string, { type: string; amount: number }> = {
    client: { type: 'invoice_credit', amount: 250 },
    partner: { type: 'commission', amount: 500 },
    employee: { type: 'bonus', amount: 100 },
  };
  const reward = rewardRules[data.referrerType] ?? rewardRules.client;
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO referrals (referrer_name, referrer_type, referred_name, referred_company, status, reward_type, reward_amount, created_at, updated_at) VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?)",
    args: [data.referrerName, data.referrerType, data.referredName, data.referredCompany, reward.type, reward.amount, now, now],
  });
}

export async function updateReferralStatus(id: number, status: string): Promise<void> {
  const converted = status === 'converted' ? 1 : null;
  await db.execute({
    sql: 'UPDATE referrals SET status = ?, converted = COALESCE(?, converted), updated_at = ? WHERE id = ?',
    args: [status, converted, new Date().toISOString(), id],
  });
}

export async function markReferralPaid(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE referrals SET reward_paid = 1, updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  });
}

// --- Upsell mutations ---

export async function insertUpsellOpportunities(opps: { clientName: string; triggerType: string; signal: string; confidence: number; action: string }[]): Promise<void> {
  const now = new Date().toISOString();
  for (const o of opps) {
    await db.execute({
      sql: "INSERT INTO upsell_opportunities (client_name, trigger_type, signal, confidence, recommended_action, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'identified', ?, ?)",
      args: [o.clientName, o.triggerType, o.signal, o.confidence, o.action, now, now],
    });
  }
}

export async function updateUpsellStatus(id: number, status: string, outcome?: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE upsell_opportunities SET status = ?, outcome = COALESCE(?, outcome), updated_at = ? WHERE id = ?',
    args: [status, outcome ?? null, new Date().toISOString(), id],
  });
}

export async function getUpsellStats(): Promise<{
  total: number; identified: number; pitched: number; won: number;
}> {
  const r = await rows<Record<string, number>>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'identified' THEN 1 ELSE 0 END) as identified,
      SUM(CASE WHEN status = 'pitched' THEN 1 ELSE 0 END) as pitched,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won
    FROM upsell_opportunities
  `);
  const row = r[0] || {};
  return {
    total: row.total ?? 0, identified: row.identified ?? 0,
    pitched: row.pitched ?? 0, won: row.won ?? 0,
  };
}

// ===== GROWTH TASK LOG =====

export interface GrowthTaskLogEntry {
  id: number;
  section: string;
  action: string;
  summary: string;
  item_count: number;
  created_at: string;
}

export async function ensureGrowthLogTable(): Promise<void> {
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS growth_task_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL,
        action TEXT NOT NULL,
        summary TEXT NOT NULL,
        item_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    });
  } catch {
    // Table may already exist
  }
}

export async function insertGrowthLog(section: string, action: string, summary: string, itemCount = 0): Promise<void> {
  try {
    await db.execute({
      sql: 'INSERT INTO growth_task_log (section, action, summary, item_count, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [section, action, summary, itemCount, new Date().toISOString()],
    });
  } catch {
    // Table may not exist yet — create it and retry
    await ensureGrowthLogTable();
    await db.execute({
      sql: 'INSERT INTO growth_task_log (section, action, summary, item_count, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [section, action, summary, itemCount, new Date().toISOString()],
    });
  }
}

export async function getGrowthLog(section?: string, limit = 20): Promise<GrowthTaskLogEntry[]> {
  try {
    if (section) {
      return await rows<GrowthTaskLogEntry>(
        'SELECT id, section, action, summary, item_count, created_at FROM growth_task_log WHERE section = ? ORDER BY created_at DESC LIMIT ?',
        [section, limit],
      );
    }
    return await rows<GrowthTaskLogEntry>(
      'SELECT id, section, action, summary, item_count, created_at FROM growth_task_log ORDER BY created_at DESC LIMIT ?',
      [limit],
    );
  } catch {
    // Table may not exist yet — create it for next time
    await ensureGrowthLogTable();
    return [];
  }
}
