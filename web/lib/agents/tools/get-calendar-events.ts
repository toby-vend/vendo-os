import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { getGoogleAccessToken } from '../../google-tokens.js';
import type { ToolCtx } from '../types.js';

/**
 * getCalendarEvents — read the caller's primary Google Calendar via
 * the OAuth token already on their session. Live API call (no local
 * sync), so it always reflects current state.
 *
 * Timeframes:
 *   - 'today'      → midnight → midnight local-equivalent (UTC range)
 *   - 'tomorrow'   → tomorrow's UTC day
 *   - 'this-week'  → today through end of day in 7 days
 *   - 'next-week'  → 7-14 days from now
 *
 * Returns events sorted by start time, up to `limit` entries, with the
 * optional `attendeeContains` filter applied client-side (Calendar API
 * doesn't filter attendees server-side).
 */

const inputSchema = z.object({
  timeframe: z.enum(['today', 'tomorrow', 'this-week', 'next-week']).default('today'),
  // Filter by an attendee email or display-name fragment (case-insensitive).
  attendeeContains: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const eventRow = z.object({
  id: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  location: z.string().nullable(),
  hangoutLink: z.string().nullable(),
  attendees: z.array(z.object({ email: z.string().nullable(), displayName: z.string().nullable(), responseStatus: z.string().nullable() })),
  htmlLink: z.string().nullable(),
});

const outputSchema = z.object({
  timeframe: z.enum(['today', 'tomorrow', 'this-week', 'next-week']),
  rangeStart: z.string(),
  rangeEnd: z.string(),
  events: z.array(eventRow),
  note: z.string().nullable(),
});

interface CalendarApiAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
}
interface CalendarApiEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  hangoutLink?: string;
  attendees?: CalendarApiAttendee[];
  htmlLink?: string;
  status?: string;
}

function rangeFor(timeframe: 'today' | 'tomorrow' | 'this-week' | 'next-week'): { start: Date; end: Date } {
  // All ranges are computed in UTC. The Calendar API accepts ISO strings.
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = 24 * 60 * 60 * 1000;
  switch (timeframe) {
    case 'today':
      return { start: startOfToday, end: new Date(startOfToday.getTime() + day) };
    case 'tomorrow':
      return { start: new Date(startOfToday.getTime() + day), end: new Date(startOfToday.getTime() + 2 * day) };
    case 'this-week':
      return { start: startOfToday, end: new Date(startOfToday.getTime() + 7 * day) };
    case 'next-week':
      return { start: new Date(startOfToday.getTime() + 7 * day), end: new Date(startOfToday.getTime() + 14 * day) };
  }
}

export const getCalendarEvents = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getCalendarEvents',
      description:
        "Read upcoming events from the caller's Google Calendar. Pick a timeframe ('today' / 'tomorrow' / 'this-week' / 'next-week'). Optional `attendeeContains` filters to events with a matching attendee email or name. Requires the user to have Google connected.",
      hasSideEffect: false,
      capability: CAPABILITIES.CALENDAR_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args, callCtx) => {
        const { start, end } = rangeFor(args.timeframe);
        const rangeStart = start.toISOString();
        const rangeEnd = end.toISOString();

        const accessToken = await getGoogleAccessToken(callCtx.user.id);
        if (!accessToken) {
          return {
            timeframe: args.timeframe,
            rangeStart,
            rangeEnd,
            events: [],
            note: 'google_not_connected',
          };
        }

        const params = new URLSearchParams({
          timeMin: rangeStart,
          timeMax: rangeEnd,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: String(Math.min(args.limit * 2, 50)),
        });
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          return {
            timeframe: args.timeframe,
            rangeStart,
            rangeEnd,
            events: [],
            note: `calendar_api_${res.status}: ${body.slice(0, 200)}`,
          };
        }

        const json = (await res.json()) as { items?: CalendarApiEvent[] };
        const items = json.items ?? [];

        // Drop cancelled, optionally filter by attendee fragment, then trim.
        const needle = args.attendeeContains?.trim().toLowerCase();
        const filtered = items
          .filter((e) => e.status !== 'cancelled')
          .filter((e) => {
            if (!needle) return true;
            return (e.attendees ?? []).some(
              (a) =>
                (a.email && a.email.toLowerCase().includes(needle)) ||
                (a.displayName && a.displayName.toLowerCase().includes(needle)),
            );
          })
          .slice(0, args.limit);

        return {
          timeframe: args.timeframe,
          rangeStart,
          rangeEnd,
          events: filtered.map((e) => ({
            id: e.id,
            summary: e.summary ?? null,
            description: e.description ?? null,
            start: e.start?.dateTime ?? e.start?.date ?? null,
            end: e.end?.dateTime ?? e.end?.date ?? null,
            location: e.location ?? null,
            hangoutLink: e.hangoutLink ?? null,
            attendees: (e.attendees ?? []).map((a) => ({
              email: a.email ?? null,
              displayName: a.displayName ?? null,
              responseStatus: a.responseStatus ?? null,
            })),
            htmlLink: e.htmlLink ?? null,
          })),
          note: null,
        };
      },
    },
    ctx,
  );
