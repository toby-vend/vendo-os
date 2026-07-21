/**
 * Ingest a Markdown playbook (curated strategy/reference doc) into
 * agent_memory_chunks under scope 'playbook', so searchKnowledge can
 * surface it in Atlas chat and the specialist agents.
 *
 * Chunks by ## section, splitting oversized sections at paragraph
 * boundaries. Idempotent — chunk ids derive from the slug + section
 * index, so re-runs upsert. Use --reset to delete the slug's chunks
 * first (e.g. after restructuring the source doc).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/agents/ingest-playbook.ts \
 *     --file "path/to/doc.md" --slug meta-creative-strategy-2026 \
 *     --title "Meta Ads Creative Strategy 2026"
 *
 * Flags:
 *   --file <path>    Markdown source (required)
 *   --slug <slug>    Stable id prefix for this playbook (required)
 *   --title <text>   Human title prefixed to every chunk (default: first H1)
 *   --reset          Delete this slug's existing chunks first
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFile } from 'fs/promises';

import { db } from '../../web/lib/queries/base';
import { insertChunks } from '../../web/lib/agents/memory/long-term';

const MAX_CHUNK_CHARS = 3500;

interface Args {
  file: string;
  slug: string;
  title?: string;
  reset: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { reset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--slug') args.slug = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--reset') args.reset = true;
  }
  if (!args.file || !args.slug) {
    console.error('Usage: ingest-playbook.ts --file <md> --slug <slug> [--title <text>] [--reset]');
    process.exit(1);
  }
  return args as Args;
}

/** Split at ## headings; further split any section over MAX_CHUNK_CHARS. */
function chunkMarkdown(md: string): { heading: string; text: string }[] {
  const sections: { heading: string; text: string }[] = [];
  const parts = md.split(/^(?=## )/m);
  for (const part of parts) {
    const headingMatch = part.match(/^##\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : 'Introduction';
    const text = part.trim();
    if (!text) continue;
    if (text.length <= MAX_CHUNK_CHARS) {
      sections.push({ heading, text });
      continue;
    }
    let current = '';
    for (const para of text.split('\n\n')) {
      if (current.length + para.length > MAX_CHUNK_CHARS && current) {
        sections.push({ heading, text: current.trim() });
        current = '';
      }
      current += (current ? '\n\n' : '') + para;
    }
    if (current.trim()) sections.push({ heading, text: current.trim() });
  }
  return sections;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const md = await readFile(args.file, 'utf-8');
  const title =
    args.title ?? md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? args.slug;

  if (args.reset) {
    const result = await db.execute({
      sql: `DELETE FROM agent_memory_chunks WHERE scope = 'playbook' AND scope_id LIKE ?`,
      args: [`${args.slug}#%`],
    });
    console.log(`[ingest-playbook] reset removed ${result.rowsAffected} chunks for ${args.slug}`);
  }

  const sections = chunkMarkdown(md);
  console.log(`[ingest-playbook] ${sections.length} chunks from ${args.file}`);

  const batch = sections.map((s, i) => ({
    scope: 'playbook' as const,
    scope_id: `${args.slug}#${String(i).padStart(3, '0')}`,
    content: `Playbook: ${title} — ${s.heading}\n\n${s.text}`,
    metadata: { title, slug: args.slug, heading: s.heading, index: i },
    clientId: null,
  }));

  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i += 16) {
    const r = await insertChunks(batch.slice(i, i + 16));
    inserted += r.inserted;
    failed += r.failed;
    console.log(`[ingest-playbook] +${r.inserted} (failed ${r.failed}, total ${inserted}/${batch.length})`);
  }

  console.log(`[ingest-playbook] done — inserted=${inserted} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[ingest-playbook] failed:', err);
    process.exit(1);
  });
