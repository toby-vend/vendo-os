/**
 * Write the creative wash-up into a Google Sheet that only Vendo can open.
 *
 *   node --env-file=.env.local --import tsx/esm scripts/creative-washup/sheet.ts <run-dir>
 *
 * First run: creates the spreadsheet with the Drive token (drive.file scope),
 * shares it with the vendodigital.co.uk domain as commenter, and saves its id
 * to data/creative-washup/sheet.json. Every run after that rewrites the same
 * spreadsheet, so the one-off "Allow access" click for image previews sticks.
 *
 * Tabs: Start here, Fix first, Talking points, Concepts, Creatives.
 * Data tabs keep the header on row 1 with no merged cells (frozen panes reject
 * a merge that crosses the freeze line).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { mintSheetsAccessToken } from '../../web/lib/google-sheets.js';

const RUN = process.argv[2];
if (!RUN) throw new Error('Pass the run directory');
const STATE = 'data/creative-washup/sheet.json';
const DOMAIN = 'vendodigital.co.uk';

for (const [env, file] of [
  ['GOOGLE_SHEETS_REFRESH_TOKEN', '.secrets/google-sheets-tokens.json'],
  ['GOOGLE_DRIVE_REFRESH_TOKEN', '.secrets/google-drive-tokens.json'],
] as const) {
  if (!process.env[env] && existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf-8')) as { refresh_token?: string };
    if (saved.refresh_token) process.env[env] = saved.refresh_token;
  }
}

interface Fix { client: string; ads: string[]; sev: string; text: string }
interface Theme { title: string; body: string; ask: string }
interface ConceptRow {
  value: string; n: number; clients: number; spend: number; ts: number | null; ctr: number;
  results?: number; cpr?: number | null; sales?: number; roas?: number;
}
interface Payload {
  title: string; runDate: string; period: string; pageUrl: string;
  fixes: Fix[]; themes: Theme[]; clients: Record<string, string[]>;
  concepts: Record<'lead' | 'ecom', Record<string, ConceptRow[]>>; conceptNotes: string[];
  creatives: Record<string, string>[];
  winners: { board: string; rank: number; client: string; ad: string; value: string; detail: string; preview: string; play: string }[];
  winnerNotes: string[];
}
const p = JSON.parse(readFileSync(path.join(RUN, 'sheet-payload.json'), 'utf-8')) as Payload;

async function driveToken(): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!.trim(),
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(`Drive token refresh failed: ${await resp.text()}`);
  return ((await resp.json()) as { access_token: string }).access_token;
}

async function call<T>(url: string, token: string, method: string, body?: unknown): Promise<T> {
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`${method} ${url} failed (${resp.status}): ${(await resp.text()).slice(0, 500)}`);
  return (await resp.json()) as T;
}

// ---------- find or create the spreadsheet ----------
let spreadsheetId: string;
if (existsSync(STATE)) {
  spreadsheetId = (JSON.parse(readFileSync(STATE, 'utf-8')) as { spreadsheetId: string }).spreadsheetId;
} else {
  const dt = await driveToken();
  const file = await call<{ id: string }>('https://www.googleapis.com/drive/v3/files', dt, 'POST', {
    name: p.title, mimeType: 'application/vnd.google-apps.spreadsheet',
  });
  await call(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions?sendNotificationEmail=false`, dt, 'POST', {
    type: 'domain', domain: DOMAIN, role: 'commenter', allowFileDiscovery: false,
  });
  spreadsheetId = file.id;
  writeFileSync(STATE, JSON.stringify({ spreadsheetId }, null, 2));
  console.log(`Created sheet ${spreadsheetId}, shared with ${DOMAIN}`);
}

const token = await mintSheetsAccessToken();
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

// ---------- tab contents ----------
const fmt = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const segName = { lead: 'Dental leads', ecom: 'Ecommerce' } as const;
const dimName: Record<string, string> = { format: 'Format', angle: 'Angle', offer: 'Offer', persona: 'Persona' };

const conceptRows: (string | number)[][] = [];
for (const seg of ['lead', 'ecom'] as const) {
  for (const dim of Object.keys(dimName)) {
    for (const r of p.concepts[seg][dim]) {
      conceptRows.push([
        segName[seg], dimName[dim], r.value, r.n, r.clients, fmt(r.spend),
        seg === 'ecom' ? (r.sales ?? 0) : (r.results ?? 0),
        seg === 'ecom' ? (r.roas ?? 0) : (r.cpr != null ? fmt(r.cpr) : ''),
        r.ts != null ? `${r.ts}%` : '', `${r.ctr}%`,
      ]);
    }
  }
}

const COLS = ['preview', 'client', 'ad', 'type', 'status', 'launch', 'flag', 'format', 'angle', 'offer', 'persona',
  'spend', 'thumbstop', 'thruplay', 'ctr', 'results', 'hook', 'copy', 'headlines', 'play', 'campaign'] as const;
const creativeRows = p.creatives.map((c) => COLS.map((k) => {
  if (k === 'preview') return c.preview ? `=IMAGE("${c.preview}", 1)` : '';
  if (k === 'play') return c.play ? `=HYPERLINK("${c.play}", "Play")` : '';
  return c[k] ?? '';
}));

const tabs = [
  {
    title: 'Start here', sheetId: 0, frozenCols: 0, rowHeight: 21, widths: [900],
    head: [`Creative wash-up · ${p.runDate} · Meta, ${p.period}`],
    rows: [
      ['Refreshed automatically before each fortnightly Creative Wash Up. Every run overwrites this sheet.'],
      [`Designed version with images, copy and scripts: ${p.pageUrl}`],
      ['Tabs: Fix first (copy problems in live ads), Winners (top five per metric), Talking points (themes and per-client prompts), Concepts (format, angle, offer and persona compared), Creatives (every live creative with preview, tags, metrics, copy and script).'],
      ['Figures come from Motion (ad-level attribution). Check Ads Manager before quoting a client. Dentistry.ie is in euros, Veltuff in Danish krone, Iconic Dent in US dollars; the Concepts tab converts to £ at approximate rates.'],
      ...p.conceptNotes.map((n) => [`Concept takeaway: ${n}`]),
    ],
  },
  {
    title: 'Fix first', sheetId: 1, frozenCols: 1, rowHeight: 90, widths: [170, 110, 640, 320],
    head: ['Client', 'When', 'Problem', 'Ads'],
    rows: p.fixes.map((f) => [f.client, f.sev, f.text, f.ads.join('\n')]),
  },
  {
    title: 'Talking points', sheetId: 2, frozenCols: 1, rowHeight: 70, widths: [220, 760, 420],
    head: ['Topic', 'Point', 'Ask the room'],
    rows: [
      ...p.themes.map((t) => [t.title, t.body, t.ask]),
      ...Object.entries(p.clients).flatMap(([client, notes]) => notes.map((n) => [client, n, ''])),
    ],
  },
  {
    title: 'Winners', sheetId: 5, frozenCols: 1, rowHeight: 110, widths: [190, 50, 100, 160, 260, 90, 300, 60],
    head: ['Metric', 'Rank', 'Preview', 'Client', 'Ad', 'Value', 'Detail', 'Video'],
    rows: [
      ...p.winnerNotes.map((n) => ['Takeaway', '', '', '', n, '', '', '']),
      ...p.winners.map((w) => [w.board, w.rank, w.preview ? `=IMAGE("${w.preview}", 1)` : '', w.client, w.ad, w.value,
        w.detail, w.play ? `=HYPERLINK("${w.play}", "Play")` : '']),
    ],
  },
  {
    title: 'Concepts', sheetId: 3, frozenCols: 3, rowHeight: 21, widths: [120, 90, 260, 60, 80, 90, 90, 90, 90, 70],
    head: ['Segment', 'Dimension', 'Concept', 'Ads', 'Accounts', 'Spend (£ approx)', 'Leads / sales', 'Per lead / ROAS', 'Thumbstop', 'CTR'],
    rows: conceptRows,
  },
  {
    title: 'Creatives', sheetId: 4, frozenCols: 3, rowHeight: 150,
    widths: [120, 150, 240, 70, 85, 90, 90, 150, 150, 150, 150, 85, 85, 80, 70, 120, 280, 380, 220, 60, 260],
    head: ['Preview', 'Client', 'Ad', 'Type', 'Status', 'Launched', 'Flag', 'Format', 'Angle', 'Offer', 'Persona',
      'Spend', 'Thumbstop', 'Thru-play', 'CTR', 'Results', 'Opens with', 'Primary text', 'Headlines', 'Video', 'Campaign › ad set'],
    rows: creativeRows,
  },
];

// ---------- make sure tabs exist, then clear them ----------
const meta = await call<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${BASE}?fields=sheets.properties`, token, 'GET');
const have = new Map(meta.sheets.map((s) => [s.properties.sheetId, s.properties.title]));
const setup: unknown[] = [];
for (const t of tabs) {
  if (!have.has(t.sheetId)) {
    setup.push({ addSheet: { properties: { sheetId: t.sheetId, title: `tmp-${t.sheetId}` } } });
  }
}
for (const t of tabs) {
  setup.push({ updateSheetProperties: { properties: { sheetId: t.sheetId, title: t.title }, fields: 'title' } });
  setup.push({ unmergeCells: { range: { sheetId: t.sheetId } } });
  setup.push({ updateCells: { range: { sheetId: t.sheetId }, fields: 'userEnteredValue' } });
}
// Retitle in two passes so a renamed tab never collides with an existing title.
await call(`${BASE}:batchUpdate`, token, 'POST', {
  requests: [...setup.filter((r) => 'addSheet' in (r as object)),
    ...tabs.filter((t) => have.has(t.sheetId)).map((t) => ({
      updateSheetProperties: { properties: { sheetId: t.sheetId, title: `tmp-${t.sheetId}` }, fields: 'title' },
    }))],
});
await call(`${BASE}:batchUpdate`, token, 'POST', { requests: setup.filter((r) => !('addSheet' in (r as object))) });

// ---------- write values ----------
await call(`${BASE}/values:batchUpdate`, token, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: [t.head, ...t.rows] })),
});

// ---------- styling ----------
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const style: unknown[] = [];
for (const t of tabs) {
  const n = t.rows.length + 1;
  style.push(
    { updateSheetProperties: { properties: { sheetId: t.sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: t.frozenCols } }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } },
    { repeatCell: { range: { sheetId: t.sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: INK, textFormat: { foregroundColor: MINT, bold: true }, verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)' } },
    { repeatCell: { range: { sheetId: t.sheetId, startRowIndex: 1, endRowIndex: n }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP', textFormat: { fontSize: 10 } } }, fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat.fontSize)' } },
    { updateDimensionProperties: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 36 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: n }, properties: { pixelSize: t.rowHeight }, fields: 'pixelSize' } },
    ...t.widths.map((w, i) => ({ updateDimensionProperties: { range: { sheetId: t.sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } })),
  );
  // Only the first tab is free text that may run long: let it wrap without a fixed row height.
  if (t.sheetId === 0) {
    style.push({ autoResizeDimensions: { dimensions: { sheetId: 0, dimension: 'ROWS', startIndex: 0, endIndex: n } } });
  }
}
await call(`${BASE}:batchUpdate`, token, 'POST', { requests: style });

console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit (${p.creatives.length} creatives)`);
