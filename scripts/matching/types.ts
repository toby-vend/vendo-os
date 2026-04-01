export interface MatchResult {
  client_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  method: 'email_domain' | 'action_item_email' | 'title' | 'attendee_name' | 'transcript_speaker' | 'ai' | 'internal' | 'unmatched';
  evidence: Record<string, unknown>;
}

export interface Invitee {
  name: string;
  email: string | null;
  domain: string | null;
}

export interface MeetingData {
  id: string;
  title: string;
  summary: string | null;
  transcript: string | null;
  calendar_invitees: string | null;   // JSON array of Invitee
  raw_action_items: string | null;
  invitee_domains_type: string | null;
}

export interface MatchContext {
  emailDomainLookup: Map<string, string>;    // domain → client_name
  clientNameLookup: Map<string, string>;     // normalised name → canonical name
  contactNameLookup: Map<string, string>;    // normalised contact name → client company/name
  teamEmails: Set<string>;                   // Vendo team email domains
  teamNames: Set<string>;                    // Vendo team member names (lowercase)
  allClientNames: string[];                  // for AI classification prompt
}

export type StrategyFn = (meeting: MeetingData, ctx: MatchContext) => MatchResult | null;
