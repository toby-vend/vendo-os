/**
 * Backfill agent_memory_chunks from existing meetings + decisions.
 *
 * Idempotent — chunks are keyed by `<scope>:<scope_id>` so re-runs upsert
 * rather than duplicate. Pass --reset to delete-and-rewrite a scope.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/agents/seed-memory.ts
 *   node --env-file=.env.local --import tsx/esm scripts/agents/seed-memory.ts --only meetings
 *   node --env-file=.env.local --import tsx/esm scripts/agents/seed-memory.ts --reset --only decisions
 *
 * Flags:
 *   --only <scope>   meetings | decisions   (default: both)
 *   --reset          drop the scope's chunks first (otherwise upsert in place)
 *   --batch <n>      embed batch size (default 16)
 *   --limit <n>      cap rows processed per scope (handy for first-run smoke)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile, readdir, stat } from 'fs/promises';

import { db } from '../../web/lib/queries/base';
import {
  insertChunks,
  existingScopeIds,
  deleteByScope,
} from '../../web/lib/agents/memory/long-term';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
  only?: 'meetings' | 'decisions';
  reset: boolean;
  batch: number;
  limit: number | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { reset: false, batch: 16, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') args.only = argv[++i] as Args['only'];
    else if (a === '--reset') args.reset = true;
    else if (a === '--batch') args.batch = parseInt(argv[++i] ?? '16', 10);
    else if (a === '--limit') args.limit = parseInt(argv[++i] ?? '0', 10) || null;
  }
  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  client_name: string | null;
  summary: string | null;
}

async function* meetingsToSeed(
  skipIds: Set<string>,
  limit: number | null,
): AsyncGenerator<{ id: string; content: string; metadata: Record<string, unknown> }> {
  const result = await db.execute({
    sql: `SELECT id, title, date, client_name, summary
          FROM meetings
          WHERE summary IS NOT NULL AND length(summary) > 100
          ORDER BY date DESC
          ${limit ? `LIMIT ${limit}` : ''}`,
    args: [],
  });
  for (const row of result.rows as unknown as MeetingRow[]) {
    if (skipIds.has(row.id)) continue;
    const heading = `Meeting: ${row.title} (${row.date}${row.client_name ? `, ${row.client_name}` : ''})`;
    yield {
      id: row.id,
      content: `${heading}\n\n${row.summary ?? ''}`,
      metadata: {
        title: row.title,
        date: row.date,
        clientName: row.client_name,
      },
    };
  }
}

async function* decisionsToSeed(
  skipIds: Set<string>,
  limit: number | null,
): AsyncGenerator<{ id: string; content: string; metadata: Record<string, unknown> }> {
  const decisionsDir = resolve(PROJECT_ROOT, 'data/decisions');
  let files: string[];
  try {
    files = await readdir(decisionsDir);
  } catch {
    console.warn(`[seed-memory] no data/decisions dir at ${decisionsDir} — skipping decisions scope.`);
    return;
  }
  files = files.filter(f => f.endsWith('.md')).sort().reverse();
  if (limit) files = files.slice(0, limit);

  let count = 0;
  for (const filename of files) {
    if (skipIds.has(filename)) continue;
    const path = resolve(decisionsDir, filename);
    let content: string;
    let mtime: string;
    try {
      [content, mtime] = await Promise.all([
        readFile(path, 'utf-8'),
        stat(path).then(s => s.mtime.toISOString()),
      ]);
    } catch (err: unknown) {
      console.warn(`[seed-memory] could not read ${filename}:`, err instanceof Error ? err.message : String(err));
      continue;
    }
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, '');
    yield {
      id: filename,
      content: `Decision: ${title}\n\n${content}`,
      metadata: { title, filename, mtime },
    };
    count++;
  }
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function seedScope(
  scope: 'meeting' | 'decision',
  source: AsyncGenerator<{ id: string; content: string; metadata: Record<string, unknown> }>,
): Promise<{ scope: string; inserted: number; failed: number; skipped: number }> {
  const skipped = ARGS.reset ? 0 : -1; // -1 means "computed below"
  const skipIds = ARGS.reset ? new Set<string>() : await existingScopeIds(scope);

  if (ARGS.reset) {
    const removed = await deleteByScope(scope);
    console.log(`[seed-memory] scope=${scope} reset removed ${removed} chunks.`);
  }

  let inserted = 0;
  let failed = 0;
  let batchBuffer: { scope: 'meeting' | 'decision'; scope_id: string; content: string; metadata: Record<string, unknown> }[] = [];
  let preSkipped = 0;

  for await (const item of source) {
    if (skipIds.has(item.id)) {
      preSkipped++;
      continue;
    }
    batchBuffer.push({
      scope,
      scope_id: item.id,
      content: item.content,
      metadata: item.metadata,
    });
    if (batchBuffer.length >= ARGS.batch) {
      const r = await insertChunks(batchBuffer);
      inserted += r.inserted;
      failed += r.failed;
      console.log(
        `[seed-memory] scope=${scope} +${r.inserted} (failed ${r.failed}, total ${inserted}/${inserted + failed})`,
      );
      batchBuffer = [];
    }
  }
  if (batchBuffer.length > 0) {
    const r = await insertChunks(batchBuffer);
    inserted += r.inserted;
    failed += r.failed;
    console.log(
      `[seed-memory] scope=${scope} final +${r.inserted} (failed ${r.failed}, total ${inserted}/${inserted + failed})`,
    );
  }

  return {
    scope,
    inserted,
    failed,
    skipped: skipped === -1 ? preSkipped : 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[seed-memory] start', ARGS);

  const results: Array<{ scope: string; inserted: number; failed: number; skipped: number }> = [];

  if (ARGS.only !== 'decisions') {
    console.log('\n[seed-memory] === meetings ===');
    const skipIds = ARGS.reset ? new Set<string>() : await existingScopeIds('meeting');
    results.push(await seedScope('meeting', meetingsToSeed(skipIds, ARGS.limit)));
  }

  if (ARGS.only !== 'meetings') {
    console.log('\n[seed-memory] === decisions ===');
    const skipIds = ARGS.reset ? new Set<string>() : await existingScopeIds('decision');
    results.push(await seedScope('decision', decisionsToSeed(skipIds, ARGS.limit)));
  }

  console.log('\n[seed-memory] summary');
  for (const r of results) {
    console.log(
      `  ${r.scope.padEnd(10)} inserted=${r.inserted}  failed=${r.failed}  skipped=${r.skipped}`,
    );
  }
  console.log('[seed-memory] done');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n[seed-memory] failed:', err);
    process.exit(1);
  });
