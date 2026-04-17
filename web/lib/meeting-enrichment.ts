import { db } from './queries/base.js';
import { match as emailDomainMatch } from '../../scripts/matching/strategies/email-domain.js';
import { match as actionItemEmailMatch } from '../../scripts/matching/strategies/action-item-email.js';
import { match as titleMatch } from '../../scripts/matching/strategies/title-extraction.js';
import { match as attendeeNameMatch } from '../../scripts/matching/strategies/attendee-name.js';
import { match as transcriptSpeakerMatch } from '../../scripts/matching/strategies/transcript-speaker.js';
import { TEAM_MEMBERS, VENDO_TEAM_DOMAINS } from '../../scripts/matching/team.js';
import type { MatchContext, MatchResult, MeetingData } from '../../scripts/matching/types.js';

/**
 * Turso-backed meeting enrichment: categorises the meeting and runs the
 * client-matching waterfall, then writes the results back to the Turso
 * `meetings` row. Called from the Fathom webhook right after upsert so every
 * real-time meeting has client_name and category populated.
 */

// --- Categorisation (copy from scripts/analysis/process-meetings.ts) ---

interface CategoryRule {
  slug: string;
  keywords: string[];
  requiresClient?: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  { slug: 'interview', keywords: ['interview', 'hiring'] },
  { slug: 'onboarding', keywords: ['onboarding', 'onboard'] },
  { slug: 'internal', keywords: ['team meeting', 'team call', 'management meeting', '1 - 1', '1-1'] },
  { slug: 'discovery_sales', keywords: ['discovery', 'initial call', 'enquiry', 'inquiry', 'proposal'] },
  { slug: 'website_design', keywords: ['website', 'web design', 'design feedback', 'design review', 'pdp'] },
  { slug: 'strategy', keywords: ['strategy', 'audit'] },
  { slug: 'service_specific', keywords: ['paid social team', 'paid search team', 'paid social management', 'paid search |', 'seo catch up'] },
  { slug: 'client_catchup', keywords: ['catch up', 'catch-up', 'catchup', 'monthly', 'bi-weekly', 'bi weekly', 'update', 'review'], requiresClient: true },
];

export function categoriseMeeting(title: string): string {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    const matches = rule.keywords.some((kw) => lower.includes(kw));
    if (!matches) continue;
    if (rule.requiresClient) {
      const hasClient = /[x|/\-–—]/.test(title) && !lower.includes('team');
      if (!hasClient) continue;
    }
    return rule.slug;
  }
  return 'other';
}

// --- Match context (Turso port of scripts/matching/build-match-context.ts) ---

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|inc|uk|t\/a)\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addNameVariants(lookup: Map<string, string>, name: string, canonical: string): void {
  const norm = normaliseName(name);
  if (norm) lookup.set(norm, canonical);
  const words = norm.split(' ').filter((w) => w.length > 2);
  if (words.length >= 2) {
    lookup.set(words.slice(0, 2).join(' '), canonical);
    if (words.length >= 3) lookup.set(words.slice(0, 3).join(' '), canonical);
  }
}

interface CachedContext {
  context: MatchContext;
  builtAt: number;
}

const CONTEXT_TTL_MS = 5 * 60 * 1000;
let _cachedContext: CachedContext | null = null;

async function buildMatchContextFromTurso(): Promise<MatchContext> {
  const emailDomainLookup = new Map<string, string>();
  const clientNameLookup = new Map<string, string>();
  const contactNameLookup = new Map<string, string>();

  // Email domain lookup — contact_email_domains, then Xero, then GHL
  const ced = await db.execute('SELECT domain, client_name FROM contact_email_domains').catch(() => ({ rows: [] }));
  for (const row of ced.rows) {
    emailDomainLookup.set(row.domain as string, row.client_name as string);
  }

  const xero = await db
    .execute(
      `SELECT xc.email, c.name
       FROM xero_contacts xc
       JOIN clients c ON c.xero_contact_id = xc.id
       WHERE xc.email IS NOT NULL AND xc.email != ''`,
    )
    .catch(() => ({ rows: [] }));
  for (const row of xero.rows) {
    const email = row.email as string;
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && !VENDO_TEAM_DOMAINS.has(domain)) {
      emailDomainLookup.set(domain, row.name as string);
    }
  }

  const ghlOps = await db
    .execute(
      `SELECT contact_email, COALESCE(contact_company, contact_name) as company
       FROM ghl_opportunities
       WHERE contact_email IS NOT NULL AND contact_email != ''
         AND COALESCE(contact_company, contact_name) IS NOT NULL`,
    )
    .catch(() => ({ rows: [] }));
  for (const row of ghlOps.rows) {
    const email = row.contact_email as string;
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && !VENDO_TEAM_DOMAINS.has(domain) && !emailDomainLookup.has(domain)) {
      emailDomainLookup.set(domain, row.company as string);
    }
  }

  // Client name lookup — Xero clients with aliases, plus GHL companies
  const clients = await db
    .execute("SELECT name, aliases FROM clients WHERE source = 'xero'")
    .catch(() => ({ rows: [] }));
  for (const row of clients.rows) {
    const name = row.name as string;
    const aliases = row.aliases as string | null;
    addNameVariants(clientNameLookup, name, name);
    if (aliases) {
      try {
        const list = JSON.parse(aliases) as string[];
        for (const alias of list) addNameVariants(clientNameLookup, alias, name);
      } catch {
        addNameVariants(clientNameLookup, aliases, name);
      }
    }
  }
  const ghlCompanies = await db
    .execute(
      `SELECT DISTINCT contact_company FROM ghl_opportunities
       WHERE contact_company IS NOT NULL AND contact_company != ''`,
    )
    .catch(() => ({ rows: [] }));
  for (const row of ghlCompanies.rows) {
    const company = row.contact_company as string;
    const norm = normaliseName(company);
    if (norm && !clientNameLookup.has(norm)) clientNameLookup.set(norm, company);
  }

  // Contact name lookup — Xero contacts + GHL contacts
  const xeroContacts = await db
    .execute(
      `SELECT xc.name, c.name as client_name
       FROM xero_contacts xc JOIN clients c ON c.xero_contact_id = xc.id
       WHERE xc.name IS NOT NULL`,
    )
    .catch(() => ({ rows: [] }));
  for (const row of xeroContacts.rows) {
    const norm = normaliseName(row.name as string);
    if (norm) contactNameLookup.set(norm, row.client_name as string);
  }
  const ghlContacts = await db
    .execute(
      `SELECT contact_name, COALESCE(contact_company, contact_name) as company
       FROM ghl_opportunities
       WHERE contact_name IS NOT NULL AND contact_name != ''`,
    )
    .catch(() => ({ rows: [] }));
  for (const row of ghlContacts.rows) {
    const norm = normaliseName(row.contact_name as string);
    if (norm && !contactNameLookup.has(norm)) {
      contactNameLookup.set(norm, row.company as string);
    }
  }

  // Team names from the static team registry
  const teamNames = new Set<string>();
  for (const [canonical, aliases] of Object.entries(TEAM_MEMBERS) as [string, string[]][]) {
    teamNames.add(canonical.toLowerCase());
    for (const alias of aliases) teamNames.add(alias.toLowerCase());
  }

  // All client names for (optional) AI fallback prompt
  const topClients = await db
    .execute(
      `SELECT name FROM clients
       WHERE source = 'xero'
       ORDER BY meeting_count DESC NULLS LAST
       LIMIT 100`,
    )
    .catch(() => ({ rows: [] }));
  const allClientNames = topClients.rows.map((r) => r.name as string);

  return {
    emailDomainLookup,
    clientNameLookup,
    contactNameLookup,
    teamEmails: VENDO_TEAM_DOMAINS,
    teamNames,
    allClientNames,
  };
}

async function getMatchContext(): Promise<MatchContext> {
  const now = Date.now();
  if (_cachedContext && now - _cachedContext.builtAt < CONTEXT_TTL_MS) {
    return _cachedContext.context;
  }
  const context = await buildMatchContextFromTurso();
  _cachedContext = { context, builtAt: now };
  return context;
}

function runWaterfall(meeting: MeetingData, ctx: MatchContext): MatchResult {
  // Step 0: internal check (title + Fathom classification)
  const lower = meeting.title.toLowerCase();
  const internalKeywords = [
    'team meeting', 'team call', 'management meeting',
    '1-1', '1 - 1', 'standup', 'stand-up', 'all hands',
  ];
  if (
    internalKeywords.some((kw) => lower.includes(kw)) ||
    meeting.invitee_domains_type === 'internal' ||
    meeting.invitee_domains_type === 'only_internal'
  ) {
    return {
      client_name: null,
      confidence: 'high',
      method: 'internal',
      evidence: { title: meeting.title, invitee_domains_type: meeting.invitee_domains_type },
    };
  }

  const strategies = [
    emailDomainMatch,
    actionItemEmailMatch,
    titleMatch,
    attendeeNameMatch,
    transcriptSpeakerMatch,
  ];

  const confidenceRank = (c: MatchResult['confidence']) =>
    c === 'high' ? 3 : c === 'medium' ? 2 : 1;

  let best: MatchResult | null = null;
  for (const strategy of strategies) {
    const result = strategy(meeting, ctx);
    if (!result || result.client_name === null) continue;
    if (result.confidence === 'high') return result;
    if (!best || confidenceRank(result.confidence) > confidenceRank(best.confidence)) {
      best = result;
    }
  }

  if (best) return best;

  return {
    client_name: null,
    confidence: 'low',
    method: 'unmatched',
    evidence: { reason: 'no deterministic match — AI fallback disabled for real-time path' },
  };
}

export interface EnrichInput {
  meetingId: string;
  title: string;
  summary: string | null;
  transcript: string | null;
  calendarInviteesJson: string | null;
  rawActionItemsJson: string | null;
  inviteeDomainsType: string | null;
}

export interface EnrichResult {
  category: string;
  clientName: string | null;
  matchMethod: string;
  matchConfidence: string;
  needsReview: boolean;
}

export async function enrichMeeting(
  input: EnrichInput,
  log: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void },
): Promise<EnrichResult> {
  const category = categoriseMeeting(input.title);

  let match: MatchResult;
  try {
    const ctx = await getMatchContext();
    match = runWaterfall(
      {
        id: input.meetingId,
        title: input.title,
        summary: input.summary,
        transcript: input.transcript,
        calendar_invitees: input.calendarInviteesJson,
        raw_action_items: input.rawActionItemsJson,
        invitee_domains_type: input.inviteeDomainsType,
      },
      ctx,
    );
  } catch (err) {
    log.error({ err, meetingId: input.meetingId }, 'Match context build failed — writing category only');
    match = {
      client_name: null,
      confidence: 'low',
      method: 'unmatched',
      evidence: { reason: 'context error' },
    };
  }

  const needsReview =
    match.method !== 'internal' &&
    (match.method === 'unmatched' || match.confidence === 'low' || match.confidence === 'medium');

  await db.execute({
    sql: `UPDATE meetings
          SET category = ?, client_name = ?, match_method = ?, match_confidence = ?, needs_review = ?
          WHERE id = ?`,
    args: [
      category,
      match.client_name,
      match.method,
      match.confidence,
      needsReview ? 1 : 0,
      input.meetingId,
    ],
  });

  log.info(
    {
      meetingId: input.meetingId,
      category,
      client: match.client_name,
      method: match.method,
      confidence: match.confidence,
      needsReview,
    },
    'Meeting enriched',
  );

  return {
    category,
    clientName: match.client_name,
    matchMethod: match.method,
    matchConfidence: match.confidence,
    needsReview,
  };
}
