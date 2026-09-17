/**
 * Builder for the Squat Success Meta ad copy sheet.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-ad-copy-sheet.ts <payload.json> [existingSpreadsheetId]
 *
 * Same shape and styling as the Compound sheet: a Start Here tab carrying the
 * standing context, then data tabs with the header on row 1 and no merged cells,
 * because Google rejects a frozen-column boundary that cuts through a merge.
 *
 * Uses GOOGLE_SHEETS_REFRESH_TOKEN (spreadsheets scope).
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
  frozenCols?: number;
}
interface Payload {
  build: Tab;
  adcopy: Tab;
  creatives: Tab;
  variants: Tab;
  briefs: Tab;
  confirm: Tab;
  destination: string;
  date: string;
  creativeFolder?: string;
}

const payloadPath = process.argv[2];
if (!payloadPath) throw new Error('Pass the payload JSON path as the first argument');
const payload = JSON.parse(readFileSync(payloadPath, 'utf-8')) as Payload;

const TITLE = 'Squat Success x Vendo — Meta Ad Copy (The Dental Freedom Blueprint)';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Vendo brand: deep green-black canvas, one luminous mint accent.
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const FLAG = { red: 0.992, green: 0.906, blue: 0.906 };
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
  { key: 'build' as const, title: 'Ad Copy', sheetId: 6, frozenCols: 3, rowHeight: 300 },
  { key: 'adcopy' as const, title: 'Copy Blocks', sheetId: 1, frozenCols: 2, rowHeight: 320 },
  { key: 'creatives' as const, title: 'Creative Map', sheetId: 2, frozenCols: 3, rowHeight: 250 },
  { key: 'variants' as const, title: 'Short & Retargeting', sheetId: 3, frozenCols: 2, rowHeight: 200 },
  { key: 'briefs' as const, title: 'RT Creative Briefs', sheetId: 5, frozenCols: 2, rowHeight: 260 },
  { key: 'confirm' as const, title: 'To Confirm', sheetId: 4, frozenCols: 1, rowHeight: 130 },
];

// --- Start Here copy ---------------------------------------------------------
type IntroRow = { text: string; kind: 'h1' | 'h2' | 'body' | 'warn' | 'spacer' };
const INTRO: IntroRow[] = [
  { kind: 'h1', text: 'Squat Success x Vendo — Meta ad copy' },
  {
    kind: 'body',
    text:
      'Primary text, headlines and descriptions for The Dental Freedom Blueprint book funnel. ' +
      'The Ad Copy tab is the build sheet: one row per creative, with its preview and its copy ' +
      'side by side, so nothing needs cross-referencing while loading Ads Manager. Copy Blocks ' +
      'holds the eleven angles once each, which is where to edit wording. Short & Retargeting ' +
      'carries the short-form and retargeting text, and RT Creative Briefs documents the three ' +
      'warm-audience statics.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'The offer, exactly as the landing page states it' },
  {
    kind: 'body',
    text:
      'The Dental Freedom Blueprint by Dr Bobby Bhandal is free. The reader covers £4.95 UK postage. ' +
      'Printed to order in the UK, despatched within 5 to 7 working days, UK addresses only for now. ' +
      'No subscription. Postage refunded, no questions, if the book is not useful. Nine chapters, ' +
      'about four hours of reading. Destination: ' + payload.destination,
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Structure of the copy' },
  {
    kind: 'body',
    text:
      'Every long-form block follows the same ten beats: hook in line one, emoji proof stack, offer ' +
      'reveal, "if you are sick of" pain list, desire run, first CTA, origin story, the "why free" ' +
      'objection handler, specifics, then a two-line P.S. block. The link appears three or four times ' +
      'through the body rather than once at the end, and the first 125 characters carry the hook ' +
      'because Meta hides the rest behind "See more".',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'How to run it' },
  {
    kind: 'body',
    text:
      'One copy block per angle, run against several creatives. The Ad Copy tab repeats a block\'s ' +
      'text on every creative that shares it, which is deliberate: it is a build sheet, not a ' +
      'source of truth. Edit wording on Copy Blocks and it flows back through on the next build. ' +
      'Do not rewrite copy that works: when a block is performing, swap the creative and leave the ' +
      'words alone. Worth having live at once: curiosity led (SS-01), proof led (SS-02), ' +
      'testimonial led (SS-03), anti-ad (SS-04) and pain led (SS-05). The persona blocks (SS-08 to ' +
      'SS-11) are for tighter audiences once the broad angles have a winner.',
  },
  {
    kind: 'body',
    text:
      'Headline alternates are in their own column. Meta rotates multiple text options within one ad, ' +
      'so load the primary headline plus the alternates rather than building duplicate ads.',
  },
  {
    kind: 'body',
    text:
      'UTM convention: ' + payload.destination + '?utm_source=meta&utm_medium=paid&utm_campaign=dfb-book' +
      '&utm_content=<creative ref>&utm_term=<copy block ref>. That keeps the creative and the copy ' +
      'block separable in reporting, which is the whole point of writing one block against many creatives.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Rules this copy is written to' },
  {
    kind: 'body',
    text:
      'NO INVENTED FIGURES. Every number traces to book.squatsuccess.co.uk or the Br Dent J 2025 stat ' +
      'printed on creative 2e. The proof stacks use what is substantiated: nine chapters, ten years an ' +
      'associate, an empty unit in Leamington Spa, 5 to 7 working days, £4.95.',
  },
  {
    kind: 'body',
    text:
      'PERSONAL ATTRIBUTES. Meta does not allow an ad to assert it knows the reader\'s situation, so ' +
      'every pain list is framed "so if you are sick of" rather than "you are sick of". Keep that ' +
      'framing if you edit a line.',
  },
  {
    kind: 'body',
    text:
      'NO EARNINGS CLAIMS. No block contains a revenue, profit, practice value or return figure, so ' +
      'none currently needs an income disclaimer. Adding one changes that.',
  },
  {
    kind: 'body',
    text:
      'TESTIMONIALS. The Dr Aisha and Dr Matt quotes in SS-03 are verbatim from the landing page and ' +
      'are about the Squat Success programme, not the book. SS-03 says so in the copy. Do not let an ' +
      'edit blur that into a claim about the book.',
  },
  { kind: 'spacer', text: '' },
  {
    kind: 'warn',
    text:
      'NOT YET WRITTEN: the post-purchase upsell. It needs a real offer, a real price and a real ' +
      'deadline, and inventing any of those is both dishonest and a compliance problem. See the ' +
      'To Confirm tab.',
  },
  {
    kind: 'warn',
    text:
      'NO SCARCITY LINE. The template calls for "only X copies left". The book is printed to order, ' +
      'which makes a copy limit untrue, so the P.S. carries despatch terms and the refund instead. ' +
      'If there is a genuine limit, say so and it goes in.',
  },
  ...(payload.creativeFolder
    ? ([
        { kind: 'spacer', text: '' },
        { kind: 'h2', text: 'The creatives' },
        {
          kind: 'body',
          text:
            'All 52 exports (24 concepts across feed, story and landscape ratios) are here: ' +
            payload.creativeFolder +
            '  The Creative Map tab shows the feed cut of each one, and Open in Drive goes to that file.',
        },
        {
          kind: 'warn',
          text:
            'That folder is link-shared as view-only, because Google fetches =IMAGE thumbnails without ' +
            'the viewer\'s credentials and a private file renders as a broken cell. Anyone with the link ' +
            'can see the creatives. Say the word and it can be restricted, at the cost of the previews.',
        },
      ] as IntroRow[])
    : ([
        {
          kind: 'warn',
          text:
            'PREVIEWS. The exports are not in Drive, so the Creative Map lists file stems rather than ' +
            'thumbnails. Run the upload script and rebuild to add them.',
        },
      ] as IntroRow[])),
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
              frozenColumnCount: payload[t.key].frozenCols ?? t.frozenCols,
            },
          },
        })),
      ],
    });

const id = created.spreadsheetId;

// On a rebuild the tabs were sized for the previous column set, and a write past
// the grid edge is rejected. Resize before writing any values. A tab added since
// the last build will not exist yet, so create it first rather than trying to
// resize a sheet id the spreadsheet has never heard of.
if (existingId) {
  const current = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    `/${id}?fields=sheets.properties(sheetId,title)`,
    'GET',
  );
  const titleById = new Map(current.sheets.map((sh) => [sh.properties.sheetId, sh.properties.title]));

  // Retitle before adding anything. A tab can be renamed and its old name reused by
  // a new tab in the same build, and addSheet rejects a name that is still taken.
  const renames = DATA_TABS.filter(
    (t) => titleById.has(t.sheetId) && titleById.get(t.sheetId) !== t.title,
  );
  if (renames.length > 0) {
    await api(`/${id}:batchUpdate`, 'POST', {
      requests: renames.map((t) => ({
        updateSheetProperties: {
          properties: { sheetId: t.sheetId, title: t.title },
          fields: 'title',
        },
      })),
    });
    console.log(
      `renamed: ${renames.map((t) => `${titleById.get(t.sheetId)} -> ${t.title}`).join(', ')}`,
    );
  }

  const present = new Set(titleById.keys());
  const missing = DATA_TABS.filter((t) => !present.has(t.sheetId));
  if (missing.length > 0) {
    await api(`/${id}:batchUpdate`, 'POST', {
      requests: missing.map((t, i) => ({
        addSheet: {
          properties: {
            sheetId: t.sheetId,
            title: t.title,
            index: DATA_TABS.indexOf(t) + 1 + i,
            gridProperties: {
              rowCount: payload[t.key].rows.length + 2,
              columnCount: payload[t.key].head.length,
              frozenRowCount: 1,
              frozenColumnCount: payload[t.key].frozenCols ?? t.frozenCols,
            },
          },
        },
      })),
    });
    console.log(`added tabs: ${missing.map((t) => t.title).join(', ')}`);
  }

  await api(`/${id}:batchUpdate`, 'POST', {
    requests: [
      {
        updateSheetProperties: {
          properties: {
            sheetId: INTRO_ID,
            gridProperties: { rowCount: INTRO.length + 4, columnCount: 1 },
          },
          fields: 'gridProperties(rowCount,columnCount)',
        },
      },
      ...DATA_TABS.map((t) => ({
        updateSheetProperties: {
          properties: {
            sheetId: t.sheetId,
            gridProperties: {
              rowCount: payload[t.key].rows.length + 2,
              columnCount: payload[t.key].head.length,
              frozenRowCount: 1,
              frozenColumnCount: payload[t.key].frozenCols ?? t.frozenCols,
            },
          },
          fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
        },
      })),
    ],
  });
}

// --- values ------------------------------------------------------------------
await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
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
        ? { ...base, textFormat: { bold: true, fontSize: 11, fontFamily: 'Arial' } }
        : row.kind === 'warn'
          ? {
              ...base,
              backgroundColor: FLAG,
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
  const height = row.kind === 'h1' ? 54 : row.kind === 'spacer' ? 14 : row.kind === 'h2' ? 30 : 74;
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: INTRO_ID, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: height },
      fields: 'pixelSize',
    },
  });
});

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
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
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
        properties: { pixelSize: Math.min(Math.round(w * 7.2), 560) },
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

  const previewCols = tab.head
    .map((h, i) => (h.startsWith('Preview (') ? i : -1))
    .filter((i) => i >= 0);
  for (const previewCol of previewCols) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1 + dataRows,
          startColumnIndex: previewCol,
          endColumnIndex: previewCol + 1,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            padding: { top: 4, bottom: 4, left: 4, right: 4 },
          },
        },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,padding)',
      },
    });
  }

  // To Confirm: flag the first column so open items read as open at a glance.
  if (t.key === 'confirm') {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1 + dataRows, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: FLAG,
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
