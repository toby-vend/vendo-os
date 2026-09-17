/**
 * Adds (or refreshes) the Video Ads tab on the Squat Success ad copy sheet.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-video-tab.ts [spreadsheetId]
 *
 * ADDITIVE ON PURPOSE. Toby has pruned tabs and columns on the live sheet by hand,
 * and squat-ad-copy-sheet.ts would put every one of them back. This script touches
 * one tab and nothing else: it will not create, rename, resize or restyle any other
 * sheet in the spreadsheet.
 *
 * Copy is pulled from the same blocks as the statics so a video ad and a static ad
 * running the same angle cannot drift apart.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync } from 'fs';
import { mintSheetsAccessToken } from '../../web/lib/google-sheets.js';

const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

const SPREADSHEET = process.argv[2] ?? '1yI9SYYsnwUmYbH9XWVcPqj5Y9cnfBhEVkk8DstRROhM';
const TAB_TITLE = 'Video Ads';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const FLAG = { red: 0.992, green: 0.906, blue: 0.906 };
const RULE_LINE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };

interface Video {
  group: string;
  name: string;
  length: string;
  folder: string;
  use: string;
  block: string;
  notes: string;
}
interface Inventory {
  source: Record<string, string>;
  folders: Record<string, string>;
  videos: Video[];
}

const inv = JSON.parse(
  readFileSync('data/squat-success-video-ads.json', 'utf-8'),
) as Inventory;

const payload = JSON.parse(
  readFileSync('data/squat-success-meta-ad-copy.json', 'utf-8'),
) as { adcopy: { head: string[]; rows: string[][] } };

// Copy blocks, keyed by ref, off the same payload the statics are built from.
const head = payload.adcopy.head;
const col = (name: string) => head.indexOf(name);
const blocks = new Map(
  payload.adcopy.rows.map((r) => [
    r[col('Ref')],
    {
      angle: r[col('Angle')],
      primary: r[col('Primary Text')],
      headline: r[col('Headline')],
      description: r[col('Description')],
      cta: r[col('CTA Button')],
      destination: r[col('Destination URL')],
    },
  ]),
);

const HEAD = [
  'Group',
  'Video',
  'Length',
  'Watch (Frame.io)',
  'Recommended use',
  'Copy block',
  'Primary Text',
  'Headline',
  'Description',
  'CTA Button',
  'Destination URL',
  'Notes',
];
const WIDTHS = [26, 44, 9, 17, 19, 11, 84, 30, 24, 13, 32, 54];

const rows = inv.videos.map((v) => {
  const b = v.block ? blocks.get(v.block) : undefined;
  if (v.block && !b) throw new Error(`Unknown copy block ${v.block} for ${v.name}`);
  const folderUrl = inv.folders[v.folder];
  if (!folderUrl) throw new Error(`Unknown folder key ${v.folder} for ${v.name}`);
  return [
    v.group,
    v.name,
    v.length,
    `=HYPERLINK("${folderUrl}", "Open folder")`,
    v.use,
    v.block || '',
    b?.primary ?? '',
    b?.headline ?? '',
    b?.description ?? '',
    b?.cta ?? '',
    b?.destination ?? '',
    v.notes,
  ];
});

const token = await mintSheetsAccessToken();

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${method} ${path} failed (${resp.status}): ${text.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}

const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
  `/${SPREADSHEET}?fields=sheets.properties(sheetId,title)`,
  'GET',
);
const existing = meta.sheets.find((s) => s.properties.title === TAB_TITLE);

let sheetId: number;
if (existing) {
  sheetId = existing.properties.sheetId;
  console.log(`refreshing existing tab "${TAB_TITLE}" (gid ${sheetId})`);
  await api(`/${SPREADSHEET}:batchUpdate`, 'POST', {
    requests: [
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              rowCount: rows.length + 1,
              columnCount: HEAD.length,
              frozenRowCount: 1,
              frozenColumnCount: 2,
            },
          },
          fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
        },
      },
    ],
  });
} else {
  // Pick an id nothing else is using, rather than assuming a free number.
  sheetId = Math.max(0, ...meta.sheets.map((s) => s.properties.sheetId)) + 1;
  const added = await api<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(
    `/${SPREADSHEET}:batchUpdate`,
    'POST',
    {
      requests: [
        {
          addSheet: {
            properties: {
              sheetId,
              title: TAB_TITLE,
              index: meta.sheets.length,
              gridProperties: {
                rowCount: rows.length + 1,
                columnCount: HEAD.length,
                frozenRowCount: 1,
                frozenColumnCount: 2,
              },
            },
          },
        },
      ],
    },
  );
  sheetId = added.replies[0].addSheet.properties.sheetId;
  console.log(`added tab "${TAB_TITLE}" (gid ${sheetId})`);
}

await api(`/${SPREADSHEET}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [{ range: `'${TAB_TITLE}'!A1`, majorDimension: 'ROWS', values: [HEAD, ...rows] }],
});

const requests: unknown[] = [
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: {
        userEnteredFormat: {
          backgroundColor: INK,
          wrapStrategy: 'WRAP',
          verticalAlignment: 'MIDDLE',
          textFormat: { foregroundColor: MINT, bold: true, fontSize: 10, fontFamily: 'Arial' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)',
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 44 },
      fields: 'pixelSize',
    },
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: {
        userEnteredFormat: {
          backgroundColor: WHITE,
          wrapStrategy: 'WRAP',
          verticalAlignment: 'TOP',
          padding: { top: 6, bottom: 6, left: 8, right: 8 },
          textFormat: { fontSize: 10, fontFamily: 'Arial' },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
    },
  },
  {
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      innerHorizontal: RULE_LINE,
      innerVertical: RULE_LINE,
    },
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + rows.length },
      properties: { pixelSize: 300 },
      fields: 'pixelSize',
    },
  },
  {
    setBasicFilter: {
      filter: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows.length, startColumnIndex: 0, endColumnIndex: HEAD.length },
      },
    },
  },
];

for (let i = 1; i < rows.length; i += 2) {
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: HEAD.length },
      cell: { userEnteredFormat: { backgroundColor: BAND } },
      fields: 'userEnteredFormat.backgroundColor',
    },
  });
}

WIDTHS.forEach((w, c) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
      properties: { pixelSize: Math.min(Math.round(w * 7.2), 560) },
      fields: 'pixelSize',
    },
  });
});

// Anything not to be run should read as a stop, not as another row.
const useCol = HEAD.indexOf('Recommended use');
rows.forEach((r, i) => {
  if (r[useCol] === 'NOT FOR ADS') {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: HEAD.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: FLAG,
            textFormat: { fontSize: 10, fontFamily: 'Arial', bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }
});

await api(`/${SPREADSHEET}:batchUpdate`, 'POST', { requests });

const counts = rows.reduce<Record<string, number>>((acc, r) => {
  acc[r[useCol]] = (acc[r[useCol]] ?? 0) + 1;
  return acc;
}, {});

console.log('');
console.log(`Tab:    ${TAB_TITLE} (gid ${sheetId})`);
console.log(`Videos: ${rows.length}`);
console.log(`Use:    ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`Sheet:  https://docs.google.com/spreadsheets/d/${SPREADSHEET}/edit#gid=${sheetId}`);
console.log('');
