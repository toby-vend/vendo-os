/**
 * Client Cleanup Script
 *
 * Matches canonical paying clients against Xero-sourced client records.
 * Sets display_name, status, and aliases for matched clients.
 * Marks unmatched existing clients as inactive.
 *
 * Usage:
 *   npx tsx scripts/utils/cleanup-clients.ts --dry-run   # preview changes
 *   npx tsx scripts/utils/cleanup-clients.ts              # apply changes
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, saveDb, closeDb, log } from './db.js';
import { normaliseName } from '../matching/build-match-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

// Manual overrides for canonical names where Xero name is very different
const MANUAL_OVERRIDES: Record<string, string> = {
  'Avenue Dental Practice': 'BS bhandal limited / Avenue Dental',
  'DK Dental Clinic': 'DK Dental Practice & Lab',
  'D H Keen (Dentartistry)': 'R & T (Lee) Clinic Limited (DH Keen)',
  'The Dental Practice UK': 'The Denture Clinic (Dental Practice UK)',
  'Sone Productions': 'Sone Marketing',
  'Mobile Denture Repairs': 'Mobile Denture Repair Company',
  'The Event Beverage Co': 'The Event & Exhibition Beverage Company',
  'JRT Group': 'AJ Building Group / JRT',
};

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
  aliases: string | null;
  status: string;
}

interface MatchResult {
  canonicalName: string;
  clientId: number;
  xeroName: string;
  method: 'exact' | 'contains' | 'token-overlap';
  score?: number;
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    log('CLEANUP', '=== DRY RUN — no changes will be written ===');
  }

  // Load canonical list
  const canonicalPath = resolve(PROJECT_ROOT, 'data/canonical-clients.json');
  const canonical: string[] = JSON.parse(readFileSync(canonicalPath, 'utf-8'));
  log('CLEANUP', `Loaded ${canonical.length} canonical client names`);

  const db = await getDb();

  // Load all existing clients
  const result = db.exec('SELECT id, name, display_name, aliases, COALESCE(status, \'active\') as status FROM clients');
  const existing: ClientRow[] = [];
  if (result.length && result[0].values.length) {
    for (const row of result[0].values) {
      existing.push({
        id: row[0] as number,
        name: row[1] as string,
        display_name: row[2] as string | null,
        aliases: row[3] as string | null,
        status: row[4] as string,
      });
    }
  }
  log('CLEANUP', `Found ${existing.length} existing client records`);

  // Build normalised lookup: normalisedName -> ClientRow
  const normLookup = new Map<string, ClientRow>();
  for (const client of existing) {
    normLookup.set(normaliseName(client.name), client);
  }

  const matched: MatchResult[] = [];
  const unmatchedCanonical: string[] = [];
  const matchedClientIds = new Set<number>();

  // --- Pass 0: Manual overrides ---
  const xeroNameLookup = new Map<string, ClientRow>();
  for (const client of existing) {
    xeroNameLookup.set(client.name, client);
  }

  const afterOverrides: string[] = [];
  for (const name of canonical) {
    const override = MANUAL_OVERRIDES[name];
    if (override) {
      const client = xeroNameLookup.get(override);
      if (client) {
        matched.push({ canonicalName: name, clientId: client.id, xeroName: client.name, method: 'exact' });
        matchedClientIds.add(client.id);
        continue;
      }
    }
    afterOverrides.push(name);
  }

  // --- Pass 1: Exact normalised match ---
  const remainingCanonical: string[] = [];

  for (const name of afterOverrides) {
    const norm = normaliseName(name);
    const client = normLookup.get(norm);
    if (client) {
      matched.push({ canonicalName: name, clientId: client.id, xeroName: client.name, method: 'exact' });
      matchedClientIds.add(client.id);
    } else {
      remainingCanonical.push(name);
    }
  }

  // --- Pass 2: Contains match ---
  const afterContains: string[] = [];
  const unmatchedExisting = existing.filter(c => !matchedClientIds.has(c.id));

  for (const name of remainingCanonical) {
    const norm = normaliseName(name);
    let found = false;

    for (const client of unmatchedExisting) {
      if (matchedClientIds.has(client.id)) continue;
      const clientNorm = normaliseName(client.name);

      if (clientNorm.includes(norm) || norm.includes(clientNorm)) {
        matched.push({ canonicalName: name, clientId: client.id, xeroName: client.name, method: 'contains' });
        matchedClientIds.add(client.id);
        found = true;
        break;
      }
    }

    if (!found) afterContains.push(name);
  }

  // --- Pass 3: Token overlap ---
  for (const name of afterContains) {
    const norm = normaliseName(name);
    let bestScore = 0;
    let bestClient: ClientRow | null = null;

    for (const client of existing) {
      if (matchedClientIds.has(client.id)) continue;
      const clientNorm = normaliseName(client.name);
      const score = tokenOverlap(norm, clientNorm);

      if (score > bestScore) {
        bestScore = score;
        bestClient = client;
      }
    }

    if (bestClient && bestScore >= 0.6) {
      matched.push({
        canonicalName: name,
        clientId: bestClient.id,
        xeroName: bestClient.name,
        method: 'token-overlap',
        score: bestScore,
      });
      matchedClientIds.add(bestClient.id);
    } else {
      unmatchedCanonical.push(name);
    }
  }

  // --- Report ---
  console.log('\n========== MATCH REPORT ==========\n');

  console.log(`MATCHED (${matched.length}):`);
  for (const m of matched) {
    const tag = m.method === 'exact' ? '' : ` [${m.method}${m.score ? ` score=${m.score.toFixed(2)}` : ''}]`;
    const diff = m.canonicalName !== m.xeroName ? ` (Xero: "${m.xeroName}")` : '';
    console.log(`  ✓ ${m.canonicalName}${diff}${tag}`);
  }

  const inactive = existing.filter(c => !matchedClientIds.has(c.id));
  console.log(`\nMARKED INACTIVE (${inactive.length}):`);
  for (const c of inactive) {
    console.log(`  ✗ ${c.name}${c.display_name ? ` (display: ${c.display_name})` : ''}`);
  }

  if (unmatchedCanonical.length) {
    console.log(`\nNO XERO MATCH — will create as manual (${unmatchedCanonical.length}):`);
    for (const name of unmatchedCanonical) {
      console.log(`  ? ${name}`);
    }
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`  Matched:          ${matched.length}`);
  console.log(`  Marked inactive:  ${inactive.length}`);
  console.log(`  Created (manual): ${unmatchedCanonical.length}`);
  console.log(`  Total canonical:  ${canonical.length}`);
  console.log(`  Total existing:   ${existing.length}`);
  console.log('');

  if (dryRun) {
    log('CLEANUP', 'Dry run complete — no changes written.');
    closeDb();
    return;
  }

  // --- Apply changes ---
  log('CLEANUP', 'Applying changes...');

  // Update matched clients
  for (const m of matched) {
    const client = existing.find(c => c.id === m.clientId)!;

    // Build aliases: keep existing + add Xero name if different from canonical
    let aliases: string[] = [];
    if (client.aliases) {
      try { aliases = JSON.parse(client.aliases); } catch { aliases = client.aliases.split(',').map(a => a.trim()); }
    }
    if (m.canonicalName !== m.xeroName && !aliases.includes(m.xeroName)) {
      aliases.push(m.xeroName);
    }

    db.run(
      'UPDATE clients SET display_name = ?, status = ?, aliases = ? WHERE id = ?',
      [m.canonicalName, 'active', aliases.length ? JSON.stringify(aliases) : null, m.clientId],
    );
  }

  // Mark unmatched existing as inactive
  for (const c of inactive) {
    db.run('UPDATE clients SET status = ? WHERE id = ?', ['inactive', c.id]);
  }

  // Create records for unmatched canonical names
  for (const name of unmatchedCanonical) {
    db.run(
      'INSERT INTO clients (name, display_name, status, source) VALUES (?, ?, ?, ?)',
      [name, name, 'active', 'manual'],
    );
  }

  saveDb();
  log('CLEANUP', `Done: ${matched.length} matched, ${inactive.length} inactive, ${unmatchedCanonical.length} created.`);
  closeDb();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
