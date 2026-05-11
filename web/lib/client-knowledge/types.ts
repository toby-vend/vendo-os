/**
 * Client Knowledge briefing — typed object shared by the Eta page, the JSON
 * API surface (future) and the `getClientBriefing` agent tool.
 *
 * Renderers (web/lib/client-knowledge/render.ts) shape this into Markdown /
 * HTML / etc. The orchestrator (briefing.ts) populates it by calling existing
 * query helpers in parallel — no AI involved.
 */

export interface BriefingMeta {
  id: number;
  name: string;
  displayName: string | null;
  vertical: string | null;
  status: string | null;
  email: string | null;
  totalInvoiced: number;
  outstanding: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  firstMeetingDate: string | null;
  lastMeetingDate: string | null;
  meetingCount: number;
}

export interface BriefingHealth {
  score: number;
  tier: 'green' | 'orange' | 'red' | 'unknown';
  trend: 'up' | 'down' | 'flat' | null;
  performance: number;
  relationship: number;
  financial: number;
  period: string;
  prevScore: number | null;
}

export interface BriefingMeetingSummary {
  id: string;
  title: string;
  date: string;
  category: string | null;
  durationSeconds: number | null;
}

export interface BriefingActionItem {
  id: number;
  description: string;
  assignee: string | null;
  completed: boolean;
  meetingId: string;
  meetingTitle: string | null;
  meetingDate: string | null;
}

export interface BriefingAsanaTask {
  gid: string;
  name: string;
  assignee: string | null;
  dueOn: string | null;
  completed: boolean;
  section: string | null;
  project: string | null;
}

export interface BriefingGhlOpp {
  id: string;
  name: string | null;
  monetaryValue: number;
  status: string;
  stage: string | null;
  contact: string | null;
  createdAt: string | null;
}

export interface BriefingActivity {
  lastMeeting: BriefingMeetingSummary | null;
  recentMeetings: BriefingMeetingSummary[];        // last 3 not counting lastMeeting
  openActionItems: BriefingActionItem[];           // top 10
  openTasks: BriefingAsanaTask[];                  // top 10
  overdueTasks: BriefingAsanaTask[];               // dueOn < today + !completed
}

export interface BriefingPerformance {
  metaSpend: number;
  metaImpressions: number;
  metaClicks: number;
  gadsSpend: number;
  gadsImpressions: number;
  gadsClicks: number;
}

export interface BriefingPipeline {
  openOpps: BriefingGhlOpp[];
  totalValueOpen: number;
}

export interface BriefingBrand {
  hasGuidelines: boolean;
  fileCount: number;
}

export interface ClientNote {
  id: number;
  body: string;
  category: 'context' | 'gotcha' | 'preference' | 'history' | 'todo';
  source: string | null;
  authorUserId: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientBriefing {
  generatedAt: string;                             // ISO timestamp
  meta: BriefingMeta;
  health: BriefingHealth | null;
  activity: BriefingActivity;
  performance: BriefingPerformance;
  pipeline: BriefingPipeline;
  brand: BriefingBrand;
  notes: ClientNote[];                             // empty until Phase B
}
