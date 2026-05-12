/**
 * agent_runs.parent_run_id + depth — links child runs back to the parent
 * when one agent invokes another via the `invokeAgent` tool. Enables the
 * /admin/agents/run/:runId tree view and the recursion-depth cap.
 *
 * Idempotent: each ALTER lives in its own try/catch so re-running after a
 * partial failure does not abort. SQLite doesn't support DROP COLUMN cleanly
 * so we have to be tidy from the start.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-agent-runs-parent.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function tryRun(sql: string, label: string): Promise<void> {
  try {
    await client.execute(sql);
    console.log(`✓ ${label}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate column|already exists/i.test(msg)) {
      console.log(`• ${label} (already present)`);
    } else {
      console.error(`✗ ${label}: ${msg}`);
      throw err;
    }
  }
}

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running agent_runs parent/depth migration against ${target}...`);

await tryRun(
  `ALTER TABLE agent_runs ADD COLUMN parent_run_id TEXT`,
  'add parent_run_id column',
);
await tryRun(
  `ALTER TABLE agent_runs ADD COLUMN depth INTEGER NOT NULL DEFAULT 0`,
  'add depth column',
);
await tryRun(
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_parent ON agent_runs(parent_run_id)`,
  'idx_agent_runs_parent',
);
await tryRun(
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_conv_depth
     ON agent_runs(conversation_id, depth, started_at DESC)`,
  'idx_agent_runs_conv_depth',
);

console.log('Done.');
