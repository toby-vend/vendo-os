import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, upsertMeeting, rebuildFts, getLastSyncedDate, saveDb, closeDb, log, logError } from '../utils/db.js';
import { FathomClient, type FathomMeeting } from '../utils/fathom-client.js';

const BACKFILL = process.argv.includes('--backfill');
const TRANSCRIPTS_ONLY = process.argv.includes('--transcripts-only');
const BACKFILL_INVITEES = process.argv.includes('--backfill-invitees');

function parseMeeting(m: FathomMeeting) {
  let durationSeconds: number | null = null;
  if (m.recording_start_time && m.recording_end_time) {
    const start = new Date(m.recording_start_time).getTime();
    const end = new Date(m.recording_end_time).getTime();
    durationSeconds = Math.round((end - start) / 1000);
    if (durationSeconds < 0 || durationSeconds > 18000) durationSeconds = null; // sanity: max 5h
  }

  const summary = m.default_summary?.markdown_formatted || null;
  const actionItems = m.action_items ? JSON.stringify(m.action_items) : null;

  // Extract invitee emails from action items (available at list time)
  const invitees: Array<{ name: string; email: string | null; domain: string | null }> = [];
  const seenEmails = new Set<string>();
  if (m.action_items) {
    for (const item of m.action_items) {
      if (item.assignee?.email && !seenEmails.has(item.assignee.email)) {
        seenEmails.add(item.assignee.email);
        const domain = item.assignee.email.split('@')[1]?.toLowerCase() || null;
        invitees.push({ name: item.assignee.name, email: item.assignee.email, domain });
      }
    }
  }

  return {
    id: String(m.recording_id),
    title: m.title || m.meeting_title || 'Untitled',
    date: m.created_at,
    duration_seconds: durationSeconds,
    url: m.url || null,
    summary,
    transcript: null as string | null, // fetched separately
    attendees: null as string | null,
    raw_action_items: actionItems,
    calendar_invitees: invitees.length > 0 ? JSON.stringify(invitees) : null,
    invitee_domains_type: m.calendar_invitees_domains_type || null,
  };
}

async function syncMeetings() {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) {
    logError('SYNC', 'FATHOM_API_KEY not set in .env.local');
    process.exit(1);
  }

  await initSchema();
  const db = await getDb();
  const client = new FathomClient(apiKey);

  // Create sync log entry
  const now = new Date().toISOString();
  db.run('INSERT INTO sync_log (started_at, status) VALUES (?, ?)', [now, 'running']);
  const logResult = db.exec('SELECT last_insert_rowid()');
  const syncLogId = logResult[0].values[0][0] as number;

  let totalFetched = 0;
  let totalNew = 0;
  let totalUpdated = 0;

  try {
    if (BACKFILL_INVITEES) {
      await backfillInvitees(client);
    } else if (TRANSCRIPTS_ONLY) {
      await fetchMissingTranscripts(client);
    } else {
      // Determine start point
      let createdAfter: string | undefined;
      if (!BACKFILL) {
        const lastDate = await getLastSyncedDate();
        if (lastDate) {
          // Overlap by 1 day to catch any stragglers
          const overlap = new Date(new Date(lastDate).getTime() - 86400000);
          createdAfter = overlap.toISOString();
          log('SYNC', `Incremental sync from ${createdAfter}`);
        } else {
          log('SYNC', 'No existing data — running full backfill');
        }
      } else {
        log('SYNC', 'Full backfill requested');
      }

      // Page through meetings
      let cursor: string | undefined;
      let page = 0;

      while (true) {
        page++;
        const resp = await client.listMeetings({
          cursor,
          createdAfter,
          includeSummary: true,
          includeActionItems: true,
        });

        for (const m of resp.items) {
          const parsed = parseMeeting(m);
          const result = await upsertMeeting(parsed);
          totalFetched++;
          if (result === 'inserted') totalNew++;
          else totalUpdated++;
        }

        log('SYNC', `Page ${page}: ${resp.items.length} meetings (${totalNew} new, ${totalUpdated} updated) [rate: ${client.rateLimitUsage}]`);

        // Save cursor for crash recovery
        if (resp.next_cursor) {
          db.run('UPDATE sync_log SET last_cursor = ?, meetings_fetched = ?, meetings_new = ?, meetings_updated = ? WHERE id = ?',
            [resp.next_cursor, totalFetched, totalNew, totalUpdated, syncLogId]);
          saveDb();
        }

        if (!resp.next_cursor || resp.items.length === 0) break;
        cursor = resp.next_cursor;
      }

      log('SYNC', `Listing complete: ${totalFetched} meetings (${totalNew} new, ${totalUpdated} updated)`);

      // Fetch transcripts for meetings that don't have one
      await fetchMissingTranscripts(client);
    }

    // Rebuild FTS index after all changes
    log('SYNC', 'Rebuilding FTS index...');
    await rebuildFts();
    saveDb();

    // Update sync log
    db.run('UPDATE sync_log SET completed_at = ?, meetings_fetched = ?, meetings_new = ?, meetings_updated = ?, status = ? WHERE id = ?',
      [new Date().toISOString(), totalFetched, totalNew, totalUpdated, 'completed', syncLogId]);
    saveDb();

    log('SYNC', 'Sync complete');

  } catch (err) {
    logError('SYNC', 'Sync failed', err);
    db.run('UPDATE sync_log SET status = ?, error = ? WHERE id = ?',
      ['failed', err instanceof Error ? err.message : String(err), syncLogId]);
    saveDb();
    process.exit(1);
  } finally {
    closeDb();
  }
}

async function fetchMissingTranscripts(client: FathomClient) {
  const db = await getDb();
  const missing = db.exec('SELECT id FROM meetings WHERE transcript IS NULL');
  if (!missing.length || !missing[0].values.length) {
    log('SYNC', 'All meetings have transcripts');
    return;
  }

  const ids = missing[0].values.map((row: unknown[]) => String(row[0]));
  log('SYNC', `Fetching transcripts for ${ids.length} meetings...`);

  let fetched = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const { text, speakers } = await client.getTranscriptWithSpeakers(Number(id));
      if (text) {
        // Merge transcript speaker emails into calendar_invitees
        const existingInvitees = db.exec('SELECT calendar_invitees FROM meetings WHERE id = ?', [id]);
        let invitees: Array<{ name: string; email: string | null; domain: string | null }> = [];
        if (existingInvitees.length && existingInvitees[0].values[0][0]) {
          try { invitees = JSON.parse(existingInvitees[0].values[0][0] as string); } catch { /* ignore */ }
        }

        const seenEmails = new Set(invitees.map(i => i.email).filter(Boolean));
        for (const speaker of speakers) {
          if (speaker.email && !seenEmails.has(speaker.email)) {
            seenEmails.add(speaker.email);
            const domain = speaker.email.split('@')[1]?.toLowerCase() || null;
            invitees.push({ name: speaker.name, email: speaker.email, domain });
          }
        }

        const inviteesJson = invitees.length > 0 ? JSON.stringify(invitees) : null;
        db.run('UPDATE meetings SET transcript = ?, calendar_invitees = COALESCE(?, calendar_invitees) WHERE id = ?',
          [text, inviteesJson, id]);
        fetched++;
      }
    } catch (err) {
      logError('SYNC', `Failed to fetch transcript for ${id}`, err);
      failed++;
    }

    // Save periodically
    if ((fetched + failed) % 20 === 0) {
      saveDb();
      log('SYNC', `Transcripts: ${fetched} fetched, ${failed} failed, ${ids.length - fetched - failed} remaining [rate: ${client.rateLimitUsage}]`);
    }
  }

  saveDb();
  log('SYNC', `Transcripts complete: ${fetched} fetched, ${failed} failed`);
}

syncMeetings();
