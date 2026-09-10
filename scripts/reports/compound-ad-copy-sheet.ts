/**
 * One-off builder for the Compound Meta ad copy sheet.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/compound-ad-copy-sheet.ts <payload.json> [existingSpreadsheetId]
 *
 * Builds a Google Sheet with four tabs (Start Here, Ad Copy, RiskSave Rules,
 * On Hold) from the JSON payload produced by the copy build script, then
 * applies Vendo header styling, column widths, wrapping and frozen panes.
 *
 * Note on layout: the data tabs deliberately put the header on row 1 with no
 * merged cells. Google rejects a frozen-column boundary that cuts through a
 * merged cell, so the standing context lives on its own Start Here tab rather
 * than as a merged banner above each table.
 *
 * Uses GOOGLE_SHEETS_REFRESH_TOKEN (spreadsheets scope), the same credential
 * as the deliverables hours sheet.
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

interface Tab {
  head: string[];
  rows: string[][];
  widths: number[];
}
interface Payload {
  adcopy: Tab;
  rules: Tab;
  hold: Tab;
  folder: string;
}

const payloadPath = process.argv[2];
if (!payloadPath) throw new Error('Pass the payload JSON path as the first argument');
const payload = JSON.parse(readFileSync(payloadPath, 'utf-8')) as Payload;

const TITLE = 'Compound x Vendo — Meta Ad Copy (RiskSave approved creatives)';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Vendo brand: deep green-black canvas, one luminous mint accent.
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const APPROVED = { red: 0.894, green: 0.976, blue: 0.929 };
const BLOCKED = { red: 0.992, green: 0.906, blue: 0.906 };
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

const INTRO_ID = 0;
const DATA_TABS = [
  { key: 'adcopy' as const, title: 'Ad Copy', sheetId: 1, frozenCols: 4, rowHeight: 250 },
  { key: 'rules' as const, title: 'RiskSave Rules', sheetId: 2, frozenCols: 1, rowHeight: 118 },
  { key: 'hold' as const, title: 'On Hold', sheetId: 3, frozenCols: 1, rowHeight: 150 },
];

// --- Start Here copy ---------------------------------------------------------
type IntroRow = { text: string; kind: 'h1' | 'h2' | 'body' | 'warn' | 'spacer' };
const INTRO: IntroRow[] = [
  { kind: 'h1', text: 'Compound x Vendo — Meta ad copy' },
  {
    kind: 'body',
    text:
      'Primary text, headline and description for every Compound creative RiskSave has signed off. ' +
      'One row per creative on the Ad Copy tab, keyed to the folder and file name in the AMENDED ' +
      'creative folder so there is no ambiguity about which copy belongs to which image.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Where this came from' },
  {
    kind: 'body',
    text:
      'Creatives: the AMENDED folder as at 10/09/2026 — ' + payload.folder,
  },
  {
    kind: 'body',
    text:
      'Approvals: "Compound Meta Ads approved - check notes.xlsx", sent by Dan Klin on 10/09/2026, ' +
      'recording RiskSave\'s review of 09-10/09/2026 and Rebecca Sibbald\'s original feedback of 04/09/2026.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'What is covered' },
  {
    kind: 'body',
    text:
      '25 creatives in total: 6 B2C Awareness and 19 B2B across Accountants & IFAs, General Awareness, ' +
      'IFAs, Payroll Bureaus and Umbrella Companies. Three B2C creatives are not approved and have no ' +
      'copy written for them — they are listed on the On Hold tab with what needs to happen next.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Before anything goes live' },
  {
    kind: 'warn',
    text:
      'BATCH GATING: every post in a set must be approved, or formally confirmed withdrawn in writing, ' +
      'before ANY post in that set may go live. The B2C Awareness set still has 3 unresolved creatives, ' +
      'so no B2C ad can launch yet. All 19 B2B creatives are approved, so B2B is clear on the creative side.',
  },
  {
    kind: 'warn',
    text:
      'LANDING PAGES: the three landing pages are still with RiskSave awaiting sign-off, so no traffic ' +
      'should be sent to them yet.',
  },
  {
    kind: 'warn',
    text:
      'AD COPY APPROVAL: the copy in this sheet has not itself been through RiskSave. It is written to ' +
      'the constraints on the RiskSave Rules tab, but it is a financial promotion in its own right and ' +
      'needs submitting alongside the creatives.',
  },
  {
    kind: 'warn',
    text:
      'OPEN QUESTION FOR RISKSAVE: every primary text ends with the exact risk warning printed on its ' +
      'creative. Meta hides primary text beyond roughly 125 characters behind "See more", so on longer ' +
      'copy the warning is not visible unexpanded. Confirm whether that satisfies the prominence ' +
      'requirement, given the warning also appears on the image itself, or whether the copy needs cutting.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Destinations still to confirm' },
  {
    kind: 'body',
    text:
      'Three landing pages exist: /employee/ (B2C), /payroll-bureau/ (Payroll Bureaus) and /accountants/ ' +
      '(Accountants & IFAs). Three approved creatives have no matching page and are marked TBC on the Ad ' +
      'Copy tab: Callout – First Employee (employers), Adviser Scheme 2014 (IFAs) and Callout – 3000 ' +
      'Contractors (umbrella companies). They cannot be built until a destination is agreed.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'How to use the Ad Copy tab' },
  {
    kind: 'body',
    text:
      'The Ref column is the build key. Audience, Creative Name and Files identify exactly which assets ' +
      'the copy belongs to: single-image creatives have four ratios (Square 1x1, Portrait 4x5, Story 9x16, ' +
      'Landscape 1.91x1) which all share one set of copy, and carousels have five cards which share one ad. ' +
      'The on-creative headline column is there so the copy does not simply repeat what is already on the ' +
      'image. Read the Compliance notes column before editing any line.',
  },
  {
    kind: 'body',
    text:
      'B2C-03 and B2C-04 carry deliberately identical copy. They are a colour test, so the creative is the ' +
      'variable and the wording must stay matched.',
  },
];

// --- create or reuse ---------------------------------------------------------
const existingId = process.argv[3];
const created = existingId
  ? await api<{ spreadsheetId: string; spreadsheetUrl: string }>(
      `/${existingId}?fields=spreadsheetId,spreadsheetUrl`,
      'GET',
    )
  : await api<{ spreadsheetId: string; spreadsheetUrl: string }>('', 'POST', {
      properties: { title: TITLE },
      sheets: [
        {
          properties: {
            sheetId: INTRO_ID,
            title: 'Start Here',
            index: 0,
            gridProperties: { rowCount: INTRO.length + 4, columnCount: 1 },
          },
        },
        ...DATA_TABS.map((t, i) => ({
          properties: {
            sheetId: t.sheetId,
            title: t.title,
            index: i + 1,
            gridProperties: {
              rowCount: payload[t.key].rows.length + 2,
              columnCount: payload[t.key].head.length,
              frozenRowCount: 1,
              frozenColumnCount: t.frozenCols,
            },
          },
        })),
      ],
    });

const id = created.spreadsheetId;

// --- values ------------------------------------------------------------------
await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'RAW',
  data: [
    { range: `'Start Here'!A1`, majorDimension: 'ROWS', values: INTRO.map((r) => [r.text]) },
    ...DATA_TABS.map((t) => ({
      range: `'${t.title}'!A1`,
      majorDimension: 'ROWS',
      values: [payload[t.key].head, ...payload[t.key].rows],
    })),
  ],
});

// --- formatting --------------------------------------------------------------
const requests: unknown[] = [];

// Start Here: one wide column, typeset by row kind.
requests.push({
  updateDimensionProperties: {
    range: { sheetId: INTRO_ID, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
    properties: { pixelSize: 900 },
    fields: 'pixelSize',
  },
});
INTRO.forEach((row, i) => {
  const range = {
    sheetId: INTRO_ID,
    startRowIndex: i,
    endRowIndex: i + 1,
    startColumnIndex: 0,
    endColumnIndex: 1,
  };
  const base = { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' as const };
  const format =
    row.kind === 'h1'
      ? {
          ...base,
          backgroundColor: INK,
          padding: { top: 10, bottom: 10, left: 12, right: 12 },
          textFormat: { foregroundColor: MINT, bold: true, fontSize: 15, fontFamily: 'Arial' },
        }
      : row.kind === 'h2'
        ? {
            ...base,
            textFormat: { bold: true, fontSize: 11, fontFamily: 'Arial' },
          }
        : row.kind === 'warn'
          ? {
              ...base,
              backgroundColor: BLOCKED,
              padding: { top: 8, bottom: 8, left: 12, right: 12 },
              textFormat: { fontSize: 10, fontFamily: 'Arial' },
            }
          : {
              ...base,
              padding: { top: 4, bottom: 4, left: 12, right: 12 },
              textFormat: { fontSize: 10, fontFamily: 'Arial' },
            };
  requests.push({
    repeatCell: {
      range,
      cell: { userEnteredFormat: format },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
    },
  });
  const height =
    row.kind === 'h1' ? 54 : row.kind === 'spacer' ? 14 : row.kind === 'h2' ? 30 : 74;
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: INTRO_ID, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: height },
      fields: 'pixelSize',
    },
  });
});

// Data tabs.
DATA_TABS.forEach((t) => {
  const { sheetId } = t;
  const tab = payload[t.key];
  const cols = tab.head.length;
  const dataRows = tab.rows.length;

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
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
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 44 },
      fields: 'pixelSize',
    },
  });

  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
      cell: {
        userEnteredFormat: {
          backgroundColor: WHITE,
          wrapStrategy: 'WRAP',
          verticalAlignment: 'TOP',
          padding: { top: 6, bottom: 6, left: 8, right: 8 },
          textFormat: { fontSize: 10, fontFamily: 'Arial' },
        },
      },
      fields:
        'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
    },
  });
  requests.push({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
      innerHorizontal: RULE_LINE,
      innerVertical: RULE_LINE,
    },
  });

  for (let i = 1; i < dataRows; i += 2) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: cols },
        cell: { userEnteredFormat: { backgroundColor: BAND } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  tab.widths.forEach((w, c) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: Math.min(Math.round(w * 7.2), 500) },
        fields: 'pixelSize',
      },
    });
  });

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + dataRows },
      properties: { pixelSize: t.rowHeight },
      fields: 'pixelSize',
    },
  });

  if (t.key === 'adcopy') {
    requests.push({
      setBasicFilter: {
        filter: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: cols },
        },
      },
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 10, fontFamily: 'Arial' } } },
        fields: 'userEnteredFormat.textFormat',
      },
    });
    // Approval column (N) tinted, so a non-approved row would stand out at once.
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 13, endColumnIndex: 14 },
        cell: { userEnteredFormat: { backgroundColor: APPROVED } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  if (t.key === 'hold') {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BLOCKED,
            textFormat: { bold: true, fontSize: 10, fontFamily: 'Arial' },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }
});

await api(`/${id}:batchUpdate`, 'POST', { requests });

console.log('');
console.log(`Created: ${TITLE}`);
console.log(`URL:     ${created.spreadsheetUrl}`);
console.log(
  `Tabs:    Start Here, ${DATA_TABS.map((t) => `${t.title} (${payload[t.key].rows.length})`).join(', ')}`,
);
console.log('');
