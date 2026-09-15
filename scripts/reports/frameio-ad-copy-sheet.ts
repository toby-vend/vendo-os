/**
 * Builds a single-tab Google Sheet mapping Frame.io video assets to Meta ad copy.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/frameio-ad-copy-sheet.ts <payload.json>
 *
 * Payload: { title, head: string[], rows: string[][], widths: number[], linkCol }
 * The link column is written as a HYPERLINK formula so each row opens the exact asset.
 *
 * Uses GOOGLE_SHEETS_REFRESH_TOKEN (spreadsheets scope). Layout follows
 * compound-ad-copy-sheet.ts: header on row 1, no merged cells, Vendo header styling.
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

interface Payload {
  title: string;
  head: string[];
  rows: string[][];
  widths: number[];
  /** 0-based column holding the asset URL; rendered as a clickable link. */
  linkCol: number;
  frozenCols?: number;
}

const payloadPath = process.argv[2];
if (!payloadPath) throw new Error('Pass the payload JSON path as the first argument');
const payload = JSON.parse(readFileSync(payloadPath, 'utf-8')) as Payload;

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const RULE_LINE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };

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

const SHEET_ID = 0;
const cols = payload.head.length;
const dataRows = payload.rows.length;

const created = await api<{ spreadsheetId: string; spreadsheetUrl: string }>('', 'POST', {
  properties: { title: payload.title },
  sheets: [
    {
      properties: {
        sheetId: SHEET_ID,
        title: 'Ad Copy',
        gridProperties: {
          rowCount: dataRows + 2,
          columnCount: cols,
          frozenRowCount: 1,
          frozenColumnCount: payload.frozenCols ?? 1,
        },
      },
    },
  ],
});
const id = created.spreadsheetId;

const escapeFormula = (s: string) => s.replace(/"/g, '""');
const values = [
  payload.head,
  ...payload.rows.map((r) =>
    r.map((cell, c) =>
      c === payload.linkCol && cell ? `=HYPERLINK("${escapeFormula(cell)}","Open in Frame.io")` : cell,
    ),
  ),
];

await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [{ range: `'Ad Copy'!A1`, majorDimension: 'ROWS', values }],
});

const requests: unknown[] = [
  {
    repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
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
      range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 40 },
      fields: 'pixelSize',
    },
  },
  {
    repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
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
      range: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
      innerHorizontal: RULE_LINE,
      innerVertical: RULE_LINE,
    },
  },
  {
    setBasicFilter: {
      filter: {
        range: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
      },
    },
  },
];

for (let i = 1; i < dataRows; i += 2) {
  requests.push({
    repeatCell: {
      range: { sheetId: SHEET_ID, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: { backgroundColor: BAND } },
      fields: 'userEnteredFormat.backgroundColor',
    },
  });
}

payload.widths.forEach((w, c) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: SHEET_ID, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
      properties: { pixelSize: w },
      fields: 'pixelSize',
    },
  });
});

await api(`/${id}:batchUpdate`, 'POST', { requests });

console.log(`Created: ${payload.title}`);
console.log(`URL:     ${created.spreadsheetUrl}`);
console.log(`Rows:    ${dataRows}`);
