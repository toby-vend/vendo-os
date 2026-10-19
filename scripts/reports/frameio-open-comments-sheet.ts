/**
 * Frame.io open comments → Google Sheet.
 *
 *   node --env-file=.env.local --import tsx/esm scripts/reports/frameio-open-comments-sheet.ts
 *   ... -- --cached             # rebuild the sheet from the last collected JSON (no Frame.io calls)
 *   ... -- --sheet <id>         # write into an existing spreadsheet instead of creating one
 *
 * Read-only walk of every Frame.io project (folders, files and every version
 * inside version stacks), listing each file's comments and keeping the ones
 * nobody has ticked off (completed_at is null) and that came from a client
 * (any email outside the Vendo domains; some clients, e.g. Zen House, are
 * Frame.io account members, so membership is not a signal). Progress is
 * checkpointed per project, so a re-run resumes. Writes the raw rows to
 * outputs/frameio-comments/<date>.json, then builds a Google Sheet
 * with a clickable link to each file (at the right version): comments on the
 * latest version (or a single-version file) on one tab, superseded versions on another.
 *
 * Nothing in Frame.io is changed.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ACCOUNT_ID = '915ca91e-31fe-4f6a-bfb6-29e661cf1297';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OpenComment {
  client: string;
  workspace: string;
  path: string;
  file: string;
  version: string;
  commenter: string;
  email: string;
  text: string;
  timecode: string;
  created_at: string;
  link: string;
}

const INTERNAL_DOMAINS = ['vendodigital.co.uk', 'vendo.co.uk'];
const CONCURRENCY = 6;

/** Retry Frame.io 429s with a growing pause (20s, 40s…) and dropped connections after 5s. */
async function withBackoff<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      const network = err instanceof TypeError; // undici "fetch failed" (ETIMEDOUT, ECONNRESET…)
      if ((status !== 429 && !network) || i >= attempts) throw err;
      const wait = status === 429 ? 20_000 * i : 5_000;
      console.log(`[comments] ${status === 429 ? 'rate limited' : 'network error'}, retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/** Frame.io timestamps are frame numbers; show them as m:ss at the file's rate (25fps fallback). */
function timecode(frames: number | null, fps: number): string {
  if (frames === null || frames === undefined) return '';
  const secs = Math.floor(frames / (fps || 25));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

async function collect(checkpoint: string): Promise<OpenComment[]> {
  const { listWorkspaces, listProjectsInWorkspace, listFolderChildren, listAll } = await import('../../web/lib/frameio/client.js');
  type Child = import('../../web/lib/frameio/client.js').FrameioFolderChild & { fps?: number | null };
  type Comment = import('../../web/lib/frameio/client.js').FrameioComment & {
    owner?: { name?: string | null; email?: string | null } | null;
    owner_id?: string | null;
  };

  const isClient = (c: Comment) => {
    const domain = (c.owner?.email ?? '').split('@')[1]?.toLowerCase() ?? '';
    return !INTERNAL_DOMAINS.includes(domain);
  };

  const done: Record<string, OpenComment[]> = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : {};
  const workspaces = await withBackoff(() => listWorkspaces(ACCOUNT_ID));
  for (const ws of workspaces) {
    const projects = await withBackoff(() => listProjectsInWorkspace(ACCOUNT_ID, ws.id));
    for (const p of projects) {
      if (done[p.id]) {
        console.log(`[comments] ${ws.name} / ${p.name}: already collected (${done[p.id].length} open client comments)`);
        continue;
      }
      const rows: OpenComment[] = [];
      // Walk folders breadth-first, collecting every file (stack versions included).
      const files: Array<{ file: Child; path: string; version: string }> = [];
      const queue: Array<{ id: string; path: string; depth: number }> = [{ id: p.root_folder_id, path: '', depth: 0 }];
      while (queue.length) {
        const level = queue.splice(0, queue.length).filter((f) => f.depth <= 12);
        const stacks: Array<{ id: string; path: string }> = [];
        await pool(level, CONCURRENCY, async ({ id, path, depth }) => {
          const children = await withBackoff(() => listFolderChildren(ACCOUNT_ID, id)) as Child[];
          for (const c of children) {
            if (c.type === 'folder') queue.push({ id: c.id, path: path ? `${path} / ${c.name}` : c.name, depth: depth + 1 });
            else if (c.type === 'file') files.push({ file: c, path, version: '' });
            else if (c.type === 'version_stack') stacks.push({ id: c.id, path });
          }
        });
        await pool(stacks, CONCURRENCY, async ({ id, path }) => {
          const versions = await withBackoff(() => listAll<Child>(`/accounts/${ACCOUNT_ID}/version_stacks/${id}/children`));
          // Children come newest first; number them oldest = v1.
          versions.forEach((v, i) => files.push({ file: v, path, version: `v${versions.length - i} of ${versions.length}` }));
        });
      }

      await pool(files, CONCURRENCY, async ({ file, path, version }) => {
        const comments = await withBackoff(() =>
          listAll<Comment>(`/accounts/${ACCOUNT_ID}/files/${file.id}/comments?include=owner&page_size=100`),
        );
        for (const c of comments) {
          if (c.completed_at || c.completer_id || !isClient(c)) continue;
          rows.push({
            client: p.name,
            workspace: ws.name,
            path,
            file: file.name,
            version,
            commenter: c.owner?.name ?? '',
            email: c.owner?.email ?? '',
            text: c.text ?? '',
            timecode: timecode(c.timestamp, file.fps ?? 25),
            created_at: c.created_at,
            link: file.view_url ?? p.view_url,
          });
        }
      });
      done[p.id] = rows;
      writeFileSync(checkpoint, JSON.stringify(done));
      console.log(`[comments] ${ws.name} / ${p.name}: ${files.length} files, ${rows.length} open client comments`);
    }
  }
  return Object.values(done).flat();
}

async function buildSheet(rows: OpenComment[], existingId?: string): Promise<string> {
  const { mintSheetsAccessToken } = await import('../../web/lib/google-sheets.js');
  const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
  if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
    const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
    if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
  }
  const token = await mintSheetsAccessToken();
  async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
    const resp = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) throw new Error(`${method} ${path} failed (${resp.status}): ${(await resp.text()).slice(0, 500)}`);
    return (await resp.json()) as T;
  }

  const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
  const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
  const head = ['Client / project', 'Folder', 'File', 'Version', 'Commenter', 'Comment', 'Timecode', 'Left on', 'Link'];
  const widths = [190, 260, 280, 80, 150, 420, 80, 95, 90];

  rows.sort((a, b) => a.client.localeCompare(b.client) || b.created_at.localeCompare(a.created_at));
  const q = (s: string) => s.replace(/"/g, '""');
  const toValues = (list: OpenComment[]) => [
    head,
    ...list.map((r) => [
      r.client,
      r.path,
      r.file,
      r.version,
      r.commenter || r.email,
      r.text,
      r.timecode,
      r.created_at.slice(0, 10).split('-').reverse().join('/'),
      `=HYPERLINK("${q(r.link)}","Open")`,
    ]),
  ];
  // "v2 of 3" is superseded; a single file ('') or "v3 of 3" is current.
  const isOlder = (r: OpenComment) => {
    const m = /^v(\d+) of (\d+)$/.exec(r.version);
    return !!m && m[1] !== m[2];
  };
  const tabs = [
    { sheetId: 0, title: 'Latest versions', values: toValues(rows.filter((r) => !isOlder(r))) },
    { sheetId: 1, title: 'Older versions', values: toValues(rows.filter(isOlder)) },
  ];

  const title = `Frame.io open client comments (${new Date().toLocaleDateString('en-GB')})`;
  const id = existingId
    ? existingId
    : (await api<{ spreadsheetId: string }>('', 'POST', {
        properties: { title },
        sheets: tabs.map((t, index) => ({
          properties: { sheetId: t.sheetId, title: t.title, index, gridProperties: { rowCount: t.values.length + 1, columnCount: head.length, frozenRowCount: 1 } },
        })),
      })).spreadsheetId;

  // On a rebuild the tabs are sized for the previous run and a write past the
  // grid edge is rejected, so resize and clear before writing.
  if (existingId) {
    await api(`/${id}:batchUpdate`, 'POST', {
      requests: tabs.map((t) => ({
        updateSheetProperties: {
          properties: { sheetId: t.sheetId, gridProperties: { rowCount: t.values.length + 1, columnCount: head.length, frozenRowCount: 1 } },
          fields: 'gridProperties(rowCount,columnCount,frozenRowCount)',
        },
      })),
    });
    await api(`/${id}/values:batchClear`, 'POST', { ranges: tabs.map((t) => `'${t.title}'`) });
  }

  await api(`/${id}/values:batchUpdate`, 'POST', {
    valueInputOption: 'USER_ENTERED',
    data: tabs.map((t) => ({ range: `'${t.title}'!A1`, majorDimension: 'ROWS', values: t.values })),
  });

  await api(`/${id}:batchUpdate`, 'POST', {
    requests: tabs.flatMap((t) => {
      const all = { sheetId: t.sheetId, startRowIndex: 0, endRowIndex: t.values.length, startColumnIndex: 0, endColumnIndex: head.length };
      return [
        {
          repeatCell: {
            range: all,
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP', textFormat: { fontFamily: 'Arial', fontSize: 10 } } },
            fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)',
          },
        },
        {
          repeatCell: {
            range: { ...all, endRowIndex: 1 },
            cell: { userEnteredFormat: { backgroundColor: INK, verticalAlignment: 'MIDDLE', textFormat: { foregroundColor: MINT, bold: true, fontFamily: 'Arial', fontSize: 10 } } },
            fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)',
          },
        },
        ...widths.map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId: t.sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        { setBasicFilter: { filter: { range: all } } },
      ];
    }),
  });
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

const outDir = resolve('outputs/frameio-comments');
mkdirSync(outDir, { recursive: true });
const latest = resolve(outDir, 'latest.json');

let rows: OpenComment[];
if (process.argv.includes('--cached')) {
  rows = JSON.parse(readFileSync(latest, 'utf8')) as OpenComment[];
} else {
  rows = await collect(resolve(outDir, `checkpoint-${new Date().toISOString().slice(0, 10)}.json`));
  const json = JSON.stringify(rows, null, 2);
  writeFileSync(latest, json);
  writeFileSync(resolve(outDir, `${new Date().toISOString().slice(0, 10)}.json`), json);
}
console.log(`[comments] ${rows.length} open client comments in total`);
const sheetIdx = process.argv.indexOf('--sheet');
const url = await buildSheet(rows, sheetIdx > -1 ? process.argv[sheetIdx + 1] : undefined);
console.log(`[comments] sheet: ${url}`);
