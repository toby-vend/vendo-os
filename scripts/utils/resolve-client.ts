/**
 * Universal Client Resolution Layer
 *
 * Any sync script can call resolveClient() or resolveClientBatch() to
 * map an external system account to a canonical client record.
 *
 * Resolution order:
 * 1. Exact mapping — look up client_source_mappings for (source, externalId)
 * 2. Name match — normalise and match against clients.name, display_name, aliases
 * 3. Auto-link — if name match found, INSERT into client_source_mappings
 * 4. Return null — log as unresolved for manual linking
 */

import type { Database } from 'sql.js';
import { getDb, saveDb, log } from './db.js';
import { normaliseName } from '../matching/build-match-context.js';

interface ClientRecord {
  id: number;
  name: string;
  display_name: string | null;
  aliases: string | null;
}

let _clientCache: ClientRecord[] | null = null;
let _normLookup: Map<string, ClientRecord> | null = null;

function loadClients(db: Database): void {
  if (_clientCache) return;

  const result = db.exec(
    "SELECT id, name, display_name, aliases FROM clients WHERE status = 'active'",
  );

  _clientCache = [];
  _normLookup = new Map();

  if (!result.length || !result[0].values.length) return;

  for (const row of result[0].values) {
    const client: ClientRecord = {
      id: row[0] as number,
      name: row[1] as string,
      display_name: row[2] as string | null,
      aliases: row[3] as string | null,
    };
    _clientCache.push(client);

    // Index by normalised name
    _normLookup.set(normaliseName(client.name), client);

    // Index by normalised display_name
    if (client.display_name) {
      _normLookup.set(normaliseName(client.display_name), client);
    }

    // Index by normalised aliases
    if (client.aliases) {
      let aliasList: string[] = [];
      try { aliasList = JSON.parse(client.aliases); } catch { aliasList = client.aliases.split(',').map(a => a.trim()); }
      for (const alias of aliasList) {
        if (alias) _normLookup.set(normaliseName(alias), client);
      }
    }
  }
}

/** Clear the in-memory cache (call if you modify clients mid-run) */
export function clearClientCache(): void {
  _clientCache = null;
  _normLookup = null;
}

/**
 * Resolve an external account to a canonical client.
 *
 * @returns client_id or null if unresolved
 */
export async function resolveClient(
  source: string,
  externalId: string,
  externalName?: string,
): Promise<number | null> {
  const db = await getDb();
  loadClients(db);

  // 1. Check existing mapping
  const existing = db.exec(
    'SELECT client_id FROM client_source_mappings WHERE source = ? AND external_id = ?',
    [source, externalId],
  );
  if (existing.length && existing[0].values.length) {
    return existing[0].values[0][0] as number;
  }

  // 2. Try name match
  if (!externalName) return null;

  const norm = normaliseName(externalName);
  const client = _normLookup!.get(norm);

  if (!client) {
    // Try contains match as fallback
    for (const [key, c] of _normLookup!) {
      if (key.includes(norm) || norm.includes(key)) {
        // Auto-link
        db.run(
          'INSERT OR IGNORE INTO client_source_mappings (client_id, source, external_id, external_name, created_at) VALUES (?, ?, ?, ?, ?)',
          [c.id, source, externalId, externalName, new Date().toISOString()],
        );
        saveDb();
        log('RESOLVE', `Auto-linked: ${externalName} (${source}:${externalId}) → ${c.display_name || c.name} [contains]`);
        return c.id;
      }
    }
    return null;
  }

  // 3. Auto-link the mapping
  db.run(
    'INSERT OR IGNORE INTO client_source_mappings (client_id, source, external_id, external_name, created_at) VALUES (?, ?, ?, ?, ?)',
    [client.id, source, externalId, externalName, new Date().toISOString()],
  );
  saveDb();
  log('RESOLVE', `Auto-linked: ${externalName} (${source}:${externalId}) → ${client.display_name || client.name}`);
  return client.id;
}

/**
 * Resolve a batch of external accounts.
 *
 * @returns Map of externalId → client_id (only includes resolved accounts)
 */
export async function resolveClientBatch(
  source: string,
  accounts: { id: string; name: string }[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const unresolved: string[] = [];

  for (const account of accounts) {
    const clientId = await resolveClient(source, account.id, account.name);
    if (clientId !== null) {
      results.set(account.id, clientId);
    } else {
      unresolved.push(account.name);
    }
  }

  if (unresolved.length) {
    log('RESOLVE', `${source}: ${unresolved.length} unresolved accounts: ${unresolved.join(', ')}`);
  }

  log('RESOLVE', `${source}: ${results.size}/${accounts.length} accounts resolved`);
  return results;
}
