/**
 * Report potential duplicate client rows — pairs whose names differ only by
 * whitespace or invisible Unicode characters (zero-width space, BOM, etc.).
 * Non-destructive: prints a report. Merging is manual for now because each
 * pair may need judgement (which xero_contact_id is canonical, which row has
 * the right status, etc.).
 *
 * Usage:
 *   npx tsx scripts/migrations/find-duplicate-clients.ts
 *
 * Example: `Iconic Dent Ltd` vs `\u200BIconic Dent Ltd` — the two rows that
 * triggered this in April 2026.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';

function canonicalise(s: string): string {
  // Strip Unicode whitespace + invisible chars, lowercase, collapse spaces.
  return s
    .normalize('NFKD')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!dbUrl) { console.error('TURSO_DATABASE_URL not set'); process.exit(1); }

  const db = createClient({ url: dbUrl, authToken: token });
  const { rows } = await db.execute('SELECT id, name, status, xero_contact_id, meeting_count FROM clients ORDER BY name');

  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = canonicalise(row.name as string);
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }

  const dupes = [...groups.entries()].filter(([, rs]) => rs.length > 1);
  if (!dupes.length) {
    console.log('No duplicate clients found.');
    return;
  }

  console.log(`Found ${dupes.length} potential duplicate group${dupes.length === 1 ? '' : 's'}:\n`);
  for (const [key, clients] of dupes) {
    console.log(`  "${key}"`);
    for (const c of clients) {
      const rawName = c.name as string;
      const hasHidden = rawName !== rawName.normalize('NFKD').replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '');
      console.log(
        `    id=${c.id} status=${c.status} xero=${(c.xero_contact_id as string | null) || '—'}`
        + ` meetings=${c.meeting_count} hidden-chars=${hasHidden ? 'YES' : 'no'}`
        + ` name=${JSON.stringify(rawName)}`,
      );
    }
    console.log('');
  }

  console.log('---');
  console.log('Merge checklist (do manually for each group):');
  console.log('  1. Pick the canonical row (usually the one with status="active" and most meeting_count).');
  console.log('  2. UPDATE client_source_mappings SET client_id=<canonical> WHERE client_id=<dupe>;');
  console.log('  3. UPDATE meetings SET client_name=<canonical name> WHERE client_name=<dupe name>;');
  console.log('  4. UPDATE client_health SET client_name=<canonical> WHERE client_name=<dupe>; (may conflict on UNIQUE — DELETE dupe rows first)');
  console.log('  5. UPDATE traffic_light_alerts SET client_name=<canonical> WHERE client_name=<dupe>;');
  console.log('  6. UPDATE clients SET status="merged" WHERE id=<dupe>; (or DELETE if you are confident)');
  console.log('  7. Fix the source in Xero if two Xero contacts exist for the same real business.');
}

main().catch((err) => { console.error(err); process.exit(1); });
