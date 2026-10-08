/**
 * Builds the Siha Dental client review sheet: ad previews + copy, Meet the Team
 * carousel, landing page links. Run upload.ts first (it writes manifest.json).
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     outputs/creative/siha-client-review/build-sheet.ts [existingSpreadsheetId]
 *
 * The spreadsheet is created through the Drive API with the drive.file token so it
 * lands in Toby's folder (the Sheets token is spreadsheets-scope only and cannot
 * place files), then filled and styled with the Sheets API.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mintSheetsAccessToken } from '../../../web/lib/google-sheets.js';

const ROOT = 'outputs/creative/siha-client-review';
const TITLE = 'Siha Dental x Vendo — Ads and landing pages for review';

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf-8')) as {
  parentId: string;
  folders: Record<string, string>;
  files: Record<string, string>;
};
interface Ad { treatment: string; file: string; concept: string; headline: string; primary: string }
const copy = JSON.parse(readFileSync(join(ROOT, 'copy.json'), 'utf-8')) as {
  ads: Ad[];
  team: { primary: string; cta: string; cards: { file: string; headline: string }[] };
  lps: string[];
};

// --- tokens ------------------------------------------------------------------
for (const [env, path] of [
  ['GOOGLE_SHEETS_REFRESH_TOKEN', '.secrets/google-sheets-tokens.json'],
  ['GOOGLE_DRIVE_REFRESH_TOKEN', '.secrets/google-drive-tokens.json'],
] as const) {
  if (!process.env[env] && existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf-8')) as { refresh_token?: string };
    if (saved.refresh_token) process.env[env] = saved.refresh_token;
  }
}

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

const sheetsToken = await mintSheetsAccessToken();
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`${method} ${path} failed (${resp.status}): ${(await resp.text()).slice(0, 500)}`);
  return (await resp.json()) as T;
}

// --- helpers -----------------------------------------------------------------
const fileId = (dir: string, name: string): string => {
  const id = manifest.files[`${dir}/${name}.png`];
  if (!id) throw new Error(`No Drive file for ${dir}/${name}.png`);
  return id;
};
const image = (dir: string, name: string) =>
  `=IMAGE("https://lh3.googleusercontent.com/d/${fileId(dir, name)}=w600", 1)`;
const link = (dir: string, name: string, label: string) =>
  `=HYPERLINK("https://drive.google.com/file/d/${fileId(dir, name)}/view", "${label}")`;
const folderLink = (dir: string, label: string) =>
  `=HYPERLINK("https://drive.google.com/drive/folders/${manifest.folders[dir]}", "${label}")`;

// --- tab content -------------------------------------------------------------
const INTRO = [
  ['Siha Dental — Meta ads and landing pages for review'],
  [''],
  ['Everything we have prepared for the new campaigns is in this sheet. Each ad shows in both sizes (square for the feed, tall for stories and reels), with the headline and the text that runs above it.'],
  [''],
  ['How to leave feedback'],
  ['Click the cell you want to comment on, then right-click › Comment (or Ctrl + Alt + M, Cmd + Option + M on a Mac). We see every comment and will reply in the thread.'],
  [''],
  ['What is in each tab'],
  ['Meta ads: 30 ads across six treatments. Composite bonding, natural smile, new patient check-up, nervous patients, ICON white spot treatment and smile makeover.'],
  ['Meet the team: a 10-card carousel introducing the team.'],
  ['Landing pages: new patient check-up, smile makeover and emergency dentist, each with its desktop, mobile and thank-you page. Click a link to open the full page.'],
  [''],
  ['Full-size files'],
  [folderLink('ads', 'Meta ads folder')],
  [folderLink('team', 'Meet the team folder')],
  [folderLink('lp', 'Landing pages folder')],
];
const INTRO_KIND = ['h1', 's', 'b', 's', 'h2', 'b', 's', 'h2', 'b', 'b', 'b', 's', 'h2', 'b', 'b', 'b'];

const adsHead = ['Treatment', 'Ad', 'Square (1:1)', 'Story (9:16)', 'Headline', 'Primary text'];
const adsRows = copy.ads.map((a) => [
  a.treatment,
  a.concept,
  image('ads', `${a.file} - 1x1`),
  image('ads', `${a.file} - 9x16`),
  a.headline,
  a.primary,
]);

const teamHead = ['Card', 'Preview', 'Card title', 'Text above the carousel'];
const teamRows = copy.team.cards.map((c, i) => [
  String(i + 1).padStart(2, '0'),
  image('team', c.file),
  c.headline,
  i === 0 ? `${copy.team.primary}\n\nButton: ${copy.team.cta}` : '',
]);

const lpHead = ['Page', 'Desktop', 'Mobile', 'Thank-you page (desktop)', 'Thank-you page (mobile)'];
const lpRows = copy.lps.map((p) => [
  p,
  link('lp', `${p} - Desktop`, 'Open desktop page'),
  link('lp', `${p} - Mobile`, 'Open mobile page'),
  link('lp', `${p} - Thank you page - Desktop`, 'Open thank-you (desktop)'),
  link('lp', `${p} - Thank you page - Mobile`, 'Open thank-you (mobile)'),
]);

const TABS = [
  { sheetId: 1, title: 'Meta ads', head: adsHead, rows: adsRows, widths: [150, 170, 330, 190, 220, 620], rowHeight: 400, frozenCols: 2, imageCols: [2, 3] },
  { sheetId: 2, title: 'Meet the team', head: teamHead, rows: teamRows, widths: [70, 300, 240, 520], rowHeight: 300, frozenCols: 1, imageCols: [1] },
  { sheetId: 3, title: 'Landing pages', head: lpHead, rows: lpRows, widths: [200, 190, 190, 210, 210], rowHeight: 44, frozenCols: 1, imageCols: [] as number[] },
];

// --- create (or reuse) the spreadsheet in Toby's folder ---------------------
let id = process.argv[2];
if (!id) {
  const dt = await driveToken();
  const resp = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${dt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: TITLE, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [manifest.parentId] }),
  });
  if (!resp.ok) throw new Error(`Sheet create failed: ${await resp.text()}`);
  id = ((await resp.json()) as { id: string }).id;
  console.log(`created spreadsheet ${id}`);
}

const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
  `/${id}?fields=sheets.properties(sheetId,title)`,
  'GET',
);
const existing = meta.sheets.map((s) => s.properties);
const setup: unknown[] = [];
// The default first tab becomes the intro.
const introId = existing[0].sheetId;
setup.push({
  updateSheetProperties: {
    properties: { sheetId: introId, title: 'Start here', gridProperties: { rowCount: INTRO.length + 2, columnCount: 1 } },
    fields: 'title,gridProperties(rowCount,columnCount)',
  },
});
for (const t of TABS) {
  const grid = { rowCount: t.rows.length + 1, columnCount: t.head.length, frozenRowCount: 1, frozenColumnCount: t.frozenCols };
  if (existing.some((e) => e.sheetId === t.sheetId)) {
    setup.push({ updateSheetProperties: { properties: { sheetId: t.sheetId, title: t.title, gridProperties: grid }, fields: 'title,gridProperties' } });
  } else {
    setup.push({ addSheet: { properties: { sheetId: t.sheetId, title: t.title, gridProperties: grid } } });
  }
}
await api(`/${id}:batchUpdate`, 'POST', { requests: setup });
await api(`/${id}:batchUpdate`, 'POST', {
  requests: [{ updateSpreadsheetProperties: { properties: { title: TITLE, locale: 'en_GB' }, fields: 'title,locale' } }],
});

await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [
    { range: `'Start here'!A1`, values: INTRO },
    ...TABS.map((t) => ({ range: `'${t.title}'!A1`, values: [t.head, ...t.rows] })),
  ],
});

// --- styling (Vendo: ink header, mint text) ---------------------------------
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const RULE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };
const font = (extra: object = {}) => ({ fontFamily: 'Arial', fontSize: 10, ...extra });

const req: unknown[] = [];
req.push({
  updateDimensionProperties: {
    range: { sheetId: introId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
    properties: { pixelSize: 820 },
    fields: 'pixelSize',
  },
});
INTRO_KIND.forEach((kind, i) => {
  const range = { sheetId: introId, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: 1 };
  const format =
    kind === 'h1'
      ? { backgroundColor: INK, textFormat: font({ foregroundColor: MINT, bold: true, fontSize: 15 }), padding: { top: 10, bottom: 10, left: 12, right: 12 } }
      : kind === 'h2'
        ? { backgroundColor: WHITE, textFormat: font({ bold: true, fontSize: 11 }), padding: { top: 4, bottom: 4, left: 12, right: 12 } }
        : { backgroundColor: WHITE, textFormat: font(), padding: { top: 4, bottom: 4, left: 12, right: 12 } };
  req.push({
    repeatCell: {
      range,
      cell: { userEnteredFormat: { ...format, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,padding,wrapStrategy,verticalAlignment)',
    },
  });
  req.push({
    updateDimensionProperties: {
      range: { sheetId: introId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: kind === 'h1' ? 54 : kind === 's' ? 12 : kind === 'h2' ? 30 : 40 },
      fields: 'pixelSize',
    },
  });
});

for (const t of TABS) {
  const { sheetId } = t;
  const cols = t.head.length;
  const n = t.rows.length;
  req.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: { backgroundColor: INK, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE', textFormat: font({ foregroundColor: MINT, bold: true }) } },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)',
    },
  });
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: 'pixelSize' } });
  req.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1 + n, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: { backgroundColor: WHITE, wrapStrategy: 'WRAP', verticalAlignment: 'TOP', padding: { top: 8, bottom: 8, left: 8, right: 8 }, textFormat: font() } },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,padding,textFormat)',
    },
  });
  for (let i = 1; i < n; i += 2) {
    req.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: cols },
        cell: { userEnteredFormat: { backgroundColor: BAND } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }
  req.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 + n, startColumnIndex: 0, endColumnIndex: cols },
      innerHorizontal: RULE,
      innerVertical: RULE,
    },
  });
  req.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1 + n, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { textFormat: font({ bold: true }) } },
      fields: 'userEnteredFormat.textFormat',
    },
  });
  if (t.title === 'Meta ads') {
    // Headline column reads as the headline.
    req.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + n, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { textFormat: font({ bold: true, fontSize: 11 }) } },
        fields: 'userEnteredFormat.textFormat',
      },
    });
  }
  if (t.title === 'Landing pages') {
    // HYPERLINK() cells render as plain text unless styled, so make them read as links.
    req.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + n, startColumnIndex: 1, endColumnIndex: cols },
        cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', textFormat: font({ underline: true, foregroundColor: { red: 0.07, green: 0.33, blue: 0.8 } }) } },
        fields: 'userEnteredFormat(verticalAlignment,textFormat)',
      },
    });
  }
  for (const c of t.imageCols) {
    req.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + n, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', padding: { top: 4, bottom: 4, left: 4, right: 4 } } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,padding)',
      },
    });
  }
  t.widths.forEach((w, c) =>
    req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } }),
  );
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + n }, properties: { pixelSize: t.rowHeight }, fields: 'pixelSize' } });
}
await api(`/${id}:batchUpdate`, 'POST', { requests: req });

writeFileSync(join(ROOT, 'sheet.json'), JSON.stringify({ spreadsheetId: id }, null, 2));
console.log(`\n${TITLE}\nhttps://docs.google.com/spreadsheets/d/${id}/edit`);
console.log(`Tabs: Start here, ${TABS.map((t) => `${t.title} (${t.rows.length})`).join(', ')}`);
