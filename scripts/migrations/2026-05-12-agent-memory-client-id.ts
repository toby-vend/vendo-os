/**
 * Add `client_id` to agent_memory_chunks for per-client RAG filtering.
 *
 * Security fix: today searchKnowledge is cross-client. A staff agent
 * discussing Client A could surface chunks from Client B if the metadata
 * happens to overlap on terms. Tagging chunks with a normalised client_id
 * lets the tool filter — and lets per-client search reliably exclude
 * irrelevant context.
 *
 * Also backfills client_id from `metadata.clientName` via
 * scripts/utils/resolve-client.ts. Unresolved rows stay null (cross-client
 * visible — same as today).
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-agent-memory-client-id.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveClient } from '../utils/resolve-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements: string[] = [
  `ALTER TABLE agent_memory_chunks ADD COLUMN client_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS idx_agent_memory_client ON agent_memory_chunks(client_id)`,
];

(async () => {
  // 1. Apply schema change (tolerate "already exists")
  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log('  ok:', sql.slice(0, 80));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate column|already exists/i.test(msg)) {
        console.log('  skip (already exists):', sql.slice(0, 80));
      } else {
        console.error('  FAIL:', msg);
        process.exit(1);
      }
    }
  }

  // 2. Backfill from metadata.clientName
  console.log('\nBackfilling client_id from metadata.clientName ...');
  const candidates = await client.execute({
    sql: `SELECT id, metadata FROM agent_memory_chunks
          WHERE client_id IS NULL AND metadata IS NOT NULL`,
    args: [],
  });
  console.log(`  ${candidates.rows.length} chunks with metadata to consider`);

  let resolved = 0;
  let unresolvable = 0;
  let noClientName = 0;
  const unresolvedNames = new Map<string, number>();

  for (const row of candidates.rows) {
    const metaStr = String(row.metadata ?? '');
    let meta: Record<string, unknown>;
    try { meta = JSON.parse(metaStr); } catch { continue; }
    const clientName = typeof meta.clientName === 'string' ? meta.clientName.trim() : null;
    if (!clientName) {
      noClientName++;
      continue;
    }

    // `resolveClient` expects a source + externalId; we don't have those here.
    // Direct name match via clients table.
    const match = await client.execute({
      sql: `SELECT id FROM clients WHERE LOWER(name) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1`,
      args: [clientName, clientName],
    });
    const clientId = match.rows[0]?.id;

    if (clientId != null) {
      await client.execute({
        sql: `UPDATE agent_memory_chunks SET client_id = ? WHERE id = ?`,
        args: [Number(clientId), String(row.id)],
      });
      resolved++;
    } else {
      unresolvable++;
      unresolvedNames.set(clientName, (unresolvedNames.get(clientName) ?? 0) + 1);
    }
  }

  console.log(`\nBackfill result:`);
  console.log(`  resolved:        ${resolved}`);
  console.log(`  no clientName:   ${noClientName}`);
  console.log(`  unresolvable:    ${unresolvable}`);
  if (unresolvedNames.size > 0) {
    console.log(`\nUnresolved client names (rerun resolveClient or fix aliases):`);
    for (const [name, count] of [...unresolvedNames].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)}  ${name}`);
    }
  }

  // 3. Final state
  const finalState = await client.execute({
    sql: `SELECT
            (SELECT count(*) FROM agent_memory_chunks) AS total,
            (SELECT count(*) FROM agent_memory_chunks WHERE client_id IS NOT NULL) AS tagged`,
    args: [],
  });
  const { total, tagged } = finalState.rows[0] as { total: number; tagged: number };
  console.log(`\nagent_memory_chunks: ${tagged}/${total} tagged with client_id`);

  process.exit(0);
})();
