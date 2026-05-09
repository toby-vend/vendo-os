import { z } from 'zod';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import type { ToolCtx } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// web/lib/agents/tools → project root is four levels up.
const DECISIONS_DIR = resolve(__dirname, '../../../../data/decisions');

const inputSchema = z.object({
  query: z.string().optional(),
  sinceDays: z.number().int().min(1).max(3650).default(365),
});

const outputSchema = z.object({
  hits: z.array(
    z.object({
      filename: z.string(),
      date: z.string(),
      title: z.string(),
      excerpt: z.string(),
    }),
  ),
});

function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text;
  return text.slice(end + 4).replace(/^\s+/, '');
}

function extractTitle(text: string, filename: string): string {
  const body = stripFrontmatter(text);
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return filename.replace(/\.md$/, '');
}

function extractDate(filename: string, mtime: Date): string {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return mtime.toISOString().slice(0, 10);
}

export const queryDecisions = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'queryDecisions',
      description:
        'Search past business decisions logged via /decide. Returns up to 10 hits with title, date, and a short excerpt.',
      hasSideEffect: false,
      capability: CAPABILITIES.DECISIONS_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        let entries: string[];
        try {
          entries = await readdir(DECISIONS_DIR);
        } catch {
          // Directory may not exist on this machine — return empty rather than error.
          return { hits: [] };
        }

        const cutoff = Date.now() - args.sinceDays * 24 * 60 * 60 * 1000;
        const lowered = args.query?.toLowerCase();

        type Hit = {
          filename: string;
          date: string;
          title: string;
          excerpt: string;
          mtime: number;
        };
        const hits: Hit[] = [];

        for (const filename of entries) {
          if (!filename.endsWith('.md')) continue;
          const fullPath = join(DECISIONS_DIR, filename);

          let st;
          try {
            st = await stat(fullPath);
          } catch {
            continue;
          }
          if (!st.isFile()) continue;
          if (st.mtimeMs < cutoff) continue;

          let text: string;
          try {
            text = await readFile(fullPath, 'utf-8');
          } catch {
            continue;
          }

          if (lowered && !text.toLowerCase().includes(lowered)) continue;

          const body = stripFrontmatter(text);
          const title = extractTitle(text, filename);
          // Body excerpt — drop heading lines so the excerpt is the prose.
          const prose = body
            .split('\n')
            .filter((l) => !l.startsWith('#'))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          hits.push({
            filename,
            date: extractDate(filename, st.mtime),
            title,
            excerpt: prose.slice(0, 200),
            mtime: st.mtimeMs,
          });
        }

        // Newest first, top 10.
        hits.sort((a, b) => b.mtime - a.mtime);
        const top = hits.slice(0, 10).map((h) => ({
          filename: h.filename,
          date: h.date,
          title: h.title,
          excerpt: h.excerpt,
        }));

        return { hits: top };
      },
    },
    ctx,
  );
