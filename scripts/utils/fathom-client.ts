import { log, logError } from './db.js';

const BASE_URL = 'https://api.fathom.ai/external/v1';
const MAX_REQUESTS_PER_MINUTE = 55; // Safety margin below 60
const WINDOW_MS = 60_000;
const MAX_RETRIES = 3;

interface FathomMeeting {
  title: string;
  meeting_title: string;
  url: string;
  created_at: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  recording_id: number;
  recording_start_time: string | null;
  recording_end_time: string | null;
  calendar_invitees_domains_type: string;
  transcript: unknown | null;
  transcript_language: string;
  default_summary: {
    template_name: string | null;
    markdown_formatted: string | null;
  } | null;
  action_items: Array<{
    description: string;
    user_generated: boolean;
    completed: boolean;
    recording_timestamp: string;
    recording_playback_url: string;
    assignee: {
      name: string;
      email: string;
      team: string;
    } | null;
  }> | null;
}

interface FathomListResponse {
  items: FathomMeeting[];
  next_cursor: string | null;
  limit: number;
}

interface TranscriptEntry {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email: string | null;
  };
  text: string;
  timestamp: string;
}

interface TranscriptResponse {
  transcript: TranscriptEntry[];
}

class RateLimiter {
  private timestamps: number[] = [];

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < WINDOW_MS);

    if (this.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      const oldest = this.timestamps[0];
      const waitMs = WINDOW_MS - (now - oldest) + 100; // +100ms buffer
      log('RATE', `Limit reached (${this.timestamps.length}/${MAX_REQUESTS_PER_MINUTE}), waiting ${Math.ceil(waitMs / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.waitForSlot();
    }

    this.timestamps.push(Date.now());
  }

  get usage(): string {
    const now = Date.now();
    const active = this.timestamps.filter(t => now - t < WINDOW_MS).length;
    return `${active}/${MAX_REQUESTS_PER_MINUTE}`;
  }
}

export class FathomClient {
  private apiKey: string;
  private rateLimiter = new RateLimiter();

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('FATHOM_API_KEY is required');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, retries = MAX_RETRIES): Promise<T> {
    await this.rateLimiter.waitForSlot();

    const url = `${BASE_URL}${path}`;
    try {
      const response = await fetch(url, {
        headers: { 'X-Api-Key': this.apiKey },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        log('RATE', `429 received, waiting ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(path, retries);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      return await response.json() as T;
    } catch (err) {
      if (retries > 0 && !(err instanceof Error && err.message.includes('401'))) {
        const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
        logError('API', `Request failed, retrying in ${delay / 1000}s (${retries} left)`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(path, retries - 1);
      }
      throw err;
    }
  }

  async listMeetings(options?: {
    cursor?: string;
    createdAfter?: string;
    includeSummary?: boolean;
    includeActionItems?: boolean;
    includeTranscript?: boolean;
  }): Promise<FathomListResponse> {
    const params = new URLSearchParams();
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.createdAfter) params.set('created_after', options.createdAfter);
    if (options?.includeSummary !== false) params.set('include_summary', 'true');
    if (options?.includeActionItems !== false) params.set('include_action_items', 'true');
    if (options?.includeTranscript) params.set('include_transcript', 'true');

    const qs = params.toString();
    return this.request<FathomListResponse>(`/meetings${qs ? '?' + qs : ''}`);
  }

  async getTranscript(recordingId: number): Promise<string> {
    const data = await this.request<TranscriptResponse>(`/recordings/${recordingId}/transcript`);

    if (!data.transcript || !Array.isArray(data.transcript)) return '';

    return data.transcript
      .map(entry => `[${entry.timestamp}] ${entry.speaker.display_name}: ${entry.text}`)
      .join('\n');
  }

  get rateLimitUsage(): string {
    return this.rateLimiter.usage;
  }
}

export type { FathomMeeting, FathomListResponse };
