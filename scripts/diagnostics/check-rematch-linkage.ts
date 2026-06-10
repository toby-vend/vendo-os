/** Verify newly re-matched meetings link to canonical clients and reports. */
import { rows } from '../../web/lib/queries/base.js';

async function main() {
  // Meetings matched in the last hour-ish by the rematch (needs_review or not),
  // grouped by client_name, with whether that name exists in clients.
  const recent = await rows<{ client_name: string; n: number; canonical: number; latest: string }>(
    `SELECT m.client_name, COUNT(*) AS n,
            EXISTS(SELECT 1 FROM clients c WHERE c.name = m.client_name) AS canonical,
            MAX(m.date) AS latest
     FROM meetings m
     WHERE m.client_name IS NOT NULL
       AND m.match_method IN ('ai', 'title', 'attendee_name', 'email_domain', 'action_item_email', 'transcript_speaker')
       AND m.date >= date('now', '-90 days')
     GROUP BY m.client_name
     ORDER BY canonical ASC, m.client_name`,
  );
  console.log('client_name (last 90d matched meetings) | meetings | canonical clients.name?');
  for (const r of recent) {
    console.log(`${r.canonical ? '  ok ' : 'MISS '} ${r.client_name}  (${r.n}, latest ${r.latest.slice(0, 10)})`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
