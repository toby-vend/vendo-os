/**
 * Growth AI service — AI prompts and scan logic for the /growth page.
 * Uses Turso queries (not local sql.js) and @anthropic-ai/sdk directly.
 */

import Anthropic from '@anthropic-ai/sdk';
import { rows } from './queries/base.js';
import type { OutboundProspect, CaseStudy } from './queries/growth.js';

// --- Claude client ---

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey });
}

async function callClaude(
  system: string,
  userMessage: string,
  maxTokens = 1500,
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

// --- LinkedIn Ideas ---

export async function generateLinkedInIdeas(meetingId?: string): Promise<{ pillar: string; topic: string; meetingId: string | null }[]> {
  let meetings: { id: string; title: string; summary: string }[];

  if (meetingId) {
    meetings = await rows<{ id: string; title: string; summary: string }>(
      'SELECT id, title, summary FROM meetings WHERE id = ? AND summary IS NOT NULL',
      [meetingId],
    );
  } else {
    meetings = await rows<{ id: string; title: string; summary: string }>(`
      SELECT id, title, summary FROM meetings
      WHERE summary IS NOT NULL AND date >= date('now', '-14 days')
        AND category IN ('client_catchup', 'strategy', 'discovery_sales', 'internal')
      ORDER BY date DESC LIMIT 10
    `);
  }

  if (!meetings.length) {
    return [
      { pillar: 'teach', topic: 'Share a practical tip from your recent paid media work', meetingId: null },
      { pillar: 'sell', topic: 'Highlight a recent client win or performance improvement', meetingId: null },
      { pillar: 'trust', topic: 'Share a behind-the-scenes look at how your team works', meetingId: null },
      { pillar: 'personal', topic: 'Reflect on a lesson learned from running your agency', meetingId: null },
    ];
  }

  const summaryText = meetings
    .map((s) => `Meeting: ${s.title}\nSummary: ${(s.summary ?? '').slice(0, 500)}`)
    .join('\n\n');

  const text = await callClaude(
    'You generate LinkedIn content ideas for a digital marketing agency founder. The agency (Vendo) specialises in paid media (Google Ads, Meta Ads) for SMBs. Content should be practical, direct, and avoid corporate jargon. UK English.',
    `Based on these recent meetings, generate 4 LinkedIn post ideas (one per pillar: Teach, Sell, Build Trust, Personal).\n\n${summaryText}\n\nRespond with JSON only:\n[\n  { "pillar": "teach|sell|trust|personal", "topic": "<post topic in one sentence>", "meeting_index": <0-based index of source meeting> }\n]`,
  );

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? '[]') as { pillar: string; topic: string; meeting_index: number }[];
    return parsed.map((p) => ({
      pillar: p.pillar,
      topic: p.topic,
      meetingId: meetings[p.meeting_index]?.id ?? meetings[0]?.id ?? null,
    }));
  } catch {
    return [];
  }
}

// --- LinkedIn Draft ---

export async function draftLinkedInPost(pillar: string, topic: string): Promise<string> {
  const pillarDescriptions: Record<string, string> = {
    teach: 'Share expertise, tips, frameworks — position as authority',
    sell: 'Case studies, results, social proof — drive inbound leads',
    trust: 'Behind-the-scenes, process, values — build relatability',
    personal: 'Founder journey, lessons, opinions — humanise the brand',
  };

  return callClaude(
    'You write LinkedIn posts for Toby, founder of Vendo (a paid media agency). Style: conversational, direct, no fluff. Use short paragraphs and line breaks. End with a question or CTA. UK English. 150-250 words max.',
    `Write a LinkedIn post.\n\nPillar: ${pillar} — ${pillarDescriptions[pillar] ?? ''}\nTopic: ${topic}\n\nWrite the post text only, no title or metadata.`,
    1000,
  );
}

// --- Outbound Draft ---

export async function draftOutboundMessage(prospect: OutboundProspect): Promise<string> {
  const nextStep = prospect.sequence_step + 1;
  const sequenceType = nextStep === 1 ? 'initial outreach' : nextStep === 2 ? 'follow-up' : 'final follow-up';

  return callClaude(
    'You write cold outreach emails for Vendo, a paid media agency specialising in Google Ads and Meta Ads for growing businesses. Style: direct, value-first, no fluff. Keep emails under 100 words. UK English.',
    `Write a ${sequenceType} email.\n\nProspect: ${prospect.prospect_name}\nCompany: ${prospect.prospect_company ?? 'Unknown'}\nICP score: ${prospect.icp_match_score}/100\n${nextStep > 1 ? 'This is follow-up #' + nextStep + ' — reference previous outreach without being pushy.' : ''}\n\nWrite subject line and email body only. Format:\nSubject: ...\n\nBody text...`,
    800,
  );
}

// --- Case Study Win Scan (no AI — pure SQL) ---

export interface WinCandidate {
  clientName: string;
  winType: string;
  metric: string;
}

export async function scanForCaseStudyWins(): Promise<WinCandidate[]> {
  const wins: WinCandidate[] = [];

  // Google Ads — spend growth >20%
  const gadsWins = await rows<{ account_name: string; last_month_spend: number; prev_month_spend: number; clicks: number }>(`
    SELECT
      account_name,
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN spend ELSE 0 END) as last_month_spend,
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-2 month') THEN spend ELSE 0 END) as prev_month_spend,
      SUM(CASE WHEN strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') THEN clicks ELSE 0 END) as clicks
    FROM gads_campaign_spend
    WHERE date >= date('now', '-90 days')
    GROUP BY account_name
    HAVING clicks > 100
  `);

  for (const r of gadsWins) {
    if (r.prev_month_spend > 0 && r.last_month_spend > r.prev_month_spend * 1.2) {
      const growth = Math.round(((r.last_month_spend / r.prev_month_spend) - 1) * 100);
      wins.push({ clientName: r.account_name, winType: 'spend_growth', metric: `${growth}% spend growth MoM (${r.clicks} clicks)` });
    }
  }

  // Meta Ads — strong CTR
  const metaWins = await rows<{ account_name: string; spend: number; clicks: number; impressions: number }>(`
    SELECT account_name, SUM(spend) as spend, SUM(clicks) as clicks, SUM(impressions) as impressions
    FROM meta_insights
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', '-1 month') AND level = 'account'
    GROUP BY account_name HAVING clicks > 200
  `);

  for (const r of metaWins) {
    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    if (ctr > 2) {
      wins.push({ clientName: r.account_name, winType: 'high_ctr', metric: `${ctr.toFixed(2)}% CTR on Meta (${r.clicks} clicks, £${r.spend.toFixed(0)} spend)` });
    }
  }

  // Filter out clients with recent case studies
  const existing = await rows<{ client_name: string }>('SELECT client_name FROM case_studies WHERE created_at >= date(\'now\', \'-90 days\')');
  const existingNames = new Set(existing.map((e) => e.client_name));

  return wins.filter((w) => !existingNames.has(w.clientName));
}

// --- Case Study Draft ---

export async function draftCaseStudy(cs: CaseStudy & { draft?: string }): Promise<string> {
  let context = `Client: ${cs.client_name}\nWin type: ${cs.win_type}\nKey metric: ${cs.metric_highlight}\n`;

  const meeting = await rows<{ summary: string }>(`
    SELECT summary FROM meetings WHERE client_name LIKE ? AND summary IS NOT NULL ORDER BY date DESC LIMIT 1
  `, [`%${cs.client_name}%`]);

  if (meeting.length) context += `\nRecent meeting context: ${(meeting[0].summary ?? '').slice(0, 500)}`;

  const brand = await rows<{ content: string }>('SELECT content FROM brand_hub WHERE client_name LIKE ? LIMIT 1', [`%${cs.client_name}%`]);
  if (brand.length) context += `\nBrand context: ${(brand[0].content ?? '').slice(0, 300)}`;

  return callClaude(
    'You write case studies for Vendo, a UK paid media agency. Format: Challenge → Approach → Results → Quote placeholder. Keep it factual, concise, under 400 words. UK English.',
    `Draft a case study based on this data:\n\n${context}\n\nInclude a [CLIENT QUOTE PLACEHOLDER] for the testimonial.`,
  );
}

// --- Upsell Scan (no AI — pure SQL) ---

export interface UpsellCandidate {
  clientName: string;
  triggerType: string;
  signal: string;
  confidence: number;
  action: string;
}

export async function scanForUpsells(): Promise<UpsellCandidate[]> {
  const opps: UpsellCandidate[] = [];

  // High-performing ad accounts
  const adPerf = await rows<{ account_name: string; total_spend: number; total_clicks: number }>(`
    SELECT account_name, SUM(spend) as total_spend, SUM(clicks) as total_clicks
    FROM gads_campaign_spend WHERE date >= date('now', '-90 days')
    GROUP BY account_name HAVING total_spend > 5000 AND total_clicks > 1000
  `);

  for (const r of adPerf) {
    opps.push({
      clientName: r.account_name,
      triggerType: 'high_performance',
      signal: `£${r.total_spend.toFixed(0)} spend, ${r.total_clicks} clicks in 90 days`,
      confidence: 0.7,
      action: 'Propose budget increase or new channel expansion',
    });
  }

  // Meeting signals
  const meetingSignals = await rows<{ client_name: string }>(`
    SELECT DISTINCT client_name FROM meetings
    WHERE date >= date('now', '-30 days') AND client_name IS NOT NULL
      AND (summary LIKE '%new channel%' OR summary LIKE '%expand%' OR summary LIKE '%more budget%'
        OR summary LIKE '%linkedin%' OR summary LIKE '%tiktok%' OR summary LIKE '%seo%'
        OR summary LIKE '%new market%' OR summary LIKE '%grow%')
  `);

  for (const r of meetingSignals) {
    opps.push({
      clientName: r.client_name,
      triggerType: 'meeting_signal',
      signal: 'Expansion language detected in recent meeting',
      confidence: 0.6,
      action: 'Review meeting notes and propose tailored expansion',
    });
  }

  // Filter existing
  const existing = await rows<{ client_name: string }>('SELECT client_name FROM upsell_opportunities WHERE created_at >= date(\'now\', \'-90 days\')');
  const existingNames = new Set(existing.map((e) => e.client_name));

  return opps.filter((o) => !existingNames.has(o.clientName));
}

// --- ICP scoring ---

export function scoreIcpMatch(company: string | null, notes: string | null): number {
  if (!company && !notes) return 30;
  const text = `${company ?? ''} ${notes ?? ''}`.toLowerCase();

  const industries = ['ecommerce', 'saas', 'professional services', 'healthcare', 'education', 'finance', 'retail', 'hospitality'];
  const painPoints = ['low roas', 'scaling paid media', 'no in-house marketing', 'agency dissatisfaction', 'entering new markets'];
  const disqualifiers = ['no budget', 'in-house team >5', 'competitor agency locked in'];

  let score = 40;
  if (industries.some((i) => text.includes(i))) score += 20;
  score += painPoints.filter((p) => text.includes(p)).length * 10;
  if (disqualifiers.some((d) => text.includes(d))) score -= 30;

  return Math.max(0, Math.min(100, score));
}
