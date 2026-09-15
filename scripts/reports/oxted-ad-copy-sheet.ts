/**
 * One-off builder for the Studio Glide Oxted evergreen Meta ad copy sheet.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/oxted-ad-copy-sheet.ts data/studio-glide/oxted-evergreen-ad-copy.json [existingSpreadsheetId]
 *
 * Tabs: Start Here, Ad Copy (one row per static, square 1x1 preview embedded),
 * Carousel Cards (per-card headline/description for 7a), Needs Fixing
 * (creatives whose on-image messaging conflicts with the evergreen landing page).
 *
 * Previews use =IMAGE() on the Drive file id of each *-square.png. Creatives not
 * yet in the Drive folder show a placeholder; add their ids to squareIds and rerun
 * with the spreadsheet id to fill them in.
 *
 * Same layout rule as compound-ad-copy-sheet.ts: header on row 1, no merged cells,
 * standing context on its own tab (frozen columns reject merged banners).
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

interface Ad {
  ref: string;
  set: string;
  file: string;
  onCreative: string;
  angle: string;
  pain: string;
  primary: string;
  headline: string;
  headlineAlt: string;
  description: string;
  cta: string;
  notes: string;
}
interface Card {
  card: string;
  file: string;
  id: string;
  onCreative: string;
  headline: string;
  description: string;
}
interface Hold {
  ref: string;
  file: string;
  onCreative: string;
  reason: string;
  fix: string;
}
interface Payload {
  folderId: string;
  squareIds: Record<string, string>;
  ads: Ad[];
  carousel: Card[];
  hold: Hold[];
}

const payloadPath = process.argv[2];
if (!payloadPath) throw new Error('Pass the payload JSON path as the first argument');
const payload = JSON.parse(readFileSync(payloadPath, 'utf-8')) as Payload;

const TITLE = 'Studio Glide Oxted x Vendo — Evergreen Meta Ad Copy';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const FOLDER_URL = `https://drive.google.com/drive/folders/${payload.folderId}`;

const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const COPY = { red: 0.894, green: 0.976, blue: 0.929 };
const WARN = { red: 0.992, green: 0.906, blue: 0.906 };
const RULE_LINE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };

const esc = (s: string) => s.replace(/"/g, '""');
// The carousel row previews its cover card.
const squareKey = (a: Ad) => (a.ref === '7a' ? '7a-01' : a.ref);
const preview = (key: string) =>
  payload.squareIds[key]
    ? `=IMAGE("https://lh3.googleusercontent.com/d/${payload.squareIds[key]}=w600", 1)`
    : 'Not in Drive folder yet';
const driveLink = (key: string) =>
  payload.squareIds[key]
    ? `=HYPERLINK("https://drive.google.com/file/d/${payload.squareIds[key]}/view", "Open square")`
    : `=HYPERLINK("${esc(FOLDER_URL)}", "Upload to folder")`;

// --- tab data ----------------------------------------------------------------
interface Tab {
  title: string;
  sheetId: number;
  head: string[];
  rows: string[][];
  widths: number[];
  frozenCols: number;
  rowHeight: number;
  /** 0-based columns tinted mint: the copy to paste into Ads Manager. */
  copyCols?: number[];
  previewCol?: number;
  warnCol?: number;
}

const adcopy: Tab = {
  title: 'Ad Copy',
  sheetId: 1,
  frozenCols: 2,
  rowHeight: 230,
  head: [
    'Ref',
    'Preview (Square 1x1)',
    'Set',
    'Creative file (square)',
    'Formats',
    'Open in Drive',
    'On-creative copy (do not repeat verbatim)',
    'Angle',
    'Pain point / aspiration agitated',
    'Primary Text',
    'Primary chars',
    'Headline',
    'Headline chars',
    'Headline (alt for testing)',
    'Description',
    'CTA Button',
    'Notes / checks before launch',
  ],
  rows: payload.ads.map((a) => [
    a.ref,
    preview(squareKey(a)),
    a.set,
    a.file,
    a.ref === '7a' ? 'Carousel, 8 cards (1080x1080)' : 'Square 1x1 (1080x1080) + Story 9x16 (1080x1920)',
    driveLink(squareKey(a)),
    a.onCreative,
    a.angle,
    a.pain,
    a.primary,
    String(a.primary.length),
    a.headline,
    String(a.headline.length),
    a.headlineAlt,
    a.description,
    a.cta,
    a.notes,
  ]),
  widths: [48, 210, 110, 170, 150, 100, 230, 140, 200, 460, 70, 170, 70, 170, 160, 90, 280],
  copyCols: [9, 11, 13, 14, 15],
  previewCol: 1,
};

const carousel: Tab = {
  title: 'Carousel Cards',
  sheetId: 2,
  frozenCols: 2,
  rowHeight: 210,
  head: ['Card', 'Preview (Square 1x1)', 'File', 'On-creative copy', 'Card Headline', 'Card Description'],
  rows: payload.carousel.map((c) => [
    c.card,
    preview(c.id),
    c.file,
    c.onCreative,
    c.headline,
    c.description,
  ]),
  widths: [110, 210, 180, 360, 220, 220],
  copyCols: [4, 5],
  previewCol: 1,
};

const hold: Tab = {
  title: 'Needs Fixing',
  sheetId: 3,
  frozenCols: 2,
  rowHeight: 210,
  head: ['Ref', 'Preview (Square 1x1)', 'File', 'On-creative copy', 'Why it is on hold', 'Fix to make it evergreen'],
  rows: payload.hold.map((h) => [h.ref, preview(h.ref), h.file, h.onCreative, h.reason, h.fix]),
  widths: [48, 210, 180, 320, 320, 320],
  previewCol: 1,
  warnCol: 4,
};

const DATA_TABS = [adcopy, carousel, hold];

// --- Start Here --------------------------------------------------------------
type IntroRow = { text: string; kind: 'h1' | 'h2' | 'body' | 'warn' | 'spacer' };
const missing = payload.ads.filter((a) => !payload.squareIds[squareKey(a)]).map((a) => a.ref);
const INTRO: IntroRow[] = [
  { kind: 'h1', text: 'Studio Glide Oxted x Vendo — evergreen Meta ad copy' },
  {
    kind: 'body',
    text:
      `Primary text, headline, alternative headline, description and CTA for ${payload.ads.length} evergreen statics ` +
      '(including the 8-card reviews carousel), with the square 1x1 version of each creative embedded next to its copy. ' +
      'The story 9x16 version of each creative shares the same copy.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'How the copy is written' },
  {
    kind: 'body',
    text:
      'Every primary text follows Problem, Agitate, Solution: the first line names a pain point or unmet aspiration ' +
      'and sits inside the ~125 characters visible before "See more"; the second paragraph agitates it; the third ' +
      'brings in Studio Glide; the last line lands the intro offer. Each row targets a different pain so the set can ' +
      'be tested by angle rather than by rewording.',
  },
  {
    kind: 'body',
    text:
      'Facts used are only those on the Oxted evergreen landing page: 3 classes for £29 (new members, one payment, any mix ' +
      'of Reformer, Mat and Barre), 50-minute classes, max 10 per class, all levels, 5.0 on Google, 53 Station Road East, ' +
      'two minutes from Oxted station, Ellice Road Car Park, booking opens 7 days ahead, reformers/props/towels provided, ' +
      'arrive 10 minutes early for set-up, and the published timetable.',
  },
  {
    kind: 'body',
    text:
      'No em dashes in the copy. Pain points are written around situations and habits (desk days, scrolling, contracts, ' +
      'nerves) rather than asserting anything about the reader\'s body or health, to stay inside Meta\'s personal ' +
      'attributes and health policies. No weight-loss or medical claims.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'Before anything goes live' },
  {
    kind: 'warn',
    text:
      'DESTINATION URL: the landing page was supplied as an HTML file, so the live URL is not in this sheet. Add it in Ads Manager.',
  },
  ...(missing.length
    ? [
        {
          kind: 'warn' as const,
          text:
            `MISSING FROM DRIVE: ${missing.join(', ')} are in the brand pack but not in the Drive creative folder, so they have no ` +
            'preview. Upload the square and story files, then rerun the builder to fill the previews in.',
        },
      ]
    : []),
  {
    kind: 'warn',
    text:
      `NEEDS FIXING TAB: ${payload.hold.length} creatives carry pre-launch messaging (priority list, "coming August 2026") or ` +
      'offers that are not on the landing page (£10 a class, £12 a class, 100 classes for £1,200). No copy is written for ' +
      'them; each row says what to change so it can run as evergreen.',
  },
  {
    kind: 'warn',
    text:
      'TIMETABLE AND PROOF CHECKS: 5b, 5c and 6j show class times that are not on the timetable. 6d/6n quote 114 reviews, ' +
      '6h quotes 1,208 poll votes, and 6g plus four carousel quotes are not on the landing page. Confirm each is genuine ' +
      'before spend (CAP code and Meta rules on testimonials and data claims). See the Notes column.',
  },
  { kind: 'spacer', text: '' },
  { kind: 'h2', text: 'How to use the Ad Copy tab' },
  {
    kind: 'body',
    text:
      'Ref matches the file prefix in Drive. Mint columns are the copy to paste into Ads Manager. Headline chars flags ' +
      'anything over Meta\'s ~27-character mobile guide; use the alt headline as the A/B test or the fallback if one truncates. ' +
      'Suggested test: group rows by Angle, run 3-4 angles against each other with equal budget, then iterate on the winner.',
  },
];

// --- API ---------------------------------------------------------------------
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
const gridFor = (t: Tab) => ({
  rowCount: t.rows.length + 2,
  columnCount: t.head.length,
  frozenRowCount: 1,
  frozenColumnCount: t.frozenCols,
});

const existingId = process.argv[3];
const created = existingId
  ? await api<{ spreadsheetId: string; spreadsheetUrl: string }>(
      `/${existingId}?fields=spreadsheetId,spreadsheetUrl`,
      'GET',
    )
  : await api<{ spreadsheetId: string; spreadsheetUrl: string }>('', 'POST', {
      properties: { title: TITLE, locale: 'en_GB' },
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
          properties: { sheetId: t.sheetId, title: t.title, index: i + 1, gridProperties: gridFor(t) },
        })),
      ],
    });
const id = created.spreadsheetId;

if (existingId) {
  // Start Here can shrink between runs (e.g. the missing-previews warning drops
  // out), so clear it rather than leave a stale trailing row.
  await api(`/${id}/values:batchClear`, 'POST', { ranges: [`'Start Here'`] });
  await api(`/${id}:batchUpdate`, 'POST', {
    requests: [
      {
        updateSheetProperties: {
          properties: { sheetId: INTRO_ID, gridProperties: { rowCount: INTRO.length + 4, columnCount: 1 } },
          fields: 'gridProperties(rowCount,columnCount)',
        },
      },
      ...DATA_TABS.map((t) => ({
        updateSheetProperties: {
          properties: { sheetId: t.sheetId, gridProperties: gridFor(t) },
          fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
        },
      })),
    ],
  });
}

await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [
    { range: `'Start Here'!A1`, majorDimension: 'ROWS', values: INTRO.map((r) => [r.text]) },
    ...DATA_TABS.map((t) => ({
      range: `'${t.title}'!A1`,
      majorDimension: 'ROWS',
      values: [t.head, ...t.rows],
    })),
  ],
});

// --- formatting --------------------------------------------------------------
const requests: unknown[] = [];
const colRange = (sheetId: number, start: number, end: number, rows: number) => ({
  sheetId,
  startRowIndex: 1,
  endRowIndex: 1 + rows,
  startColumnIndex: start,
  endColumnIndex: end,
});

requests.push({
  updateDimensionProperties: {
    range: { sheetId: INTRO_ID, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
    properties: { pixelSize: 900 },
    fields: 'pixelSize',
  },
});
INTRO.forEach((row, i) => {
  const base = { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' as const };
  const format =
    row.kind === 'h1'
      ? { ...base, backgroundColor: INK, padding: { top: 10, bottom: 10, left: 12, right: 12 }, textFormat: { foregroundColor: MINT, bold: true, fontSize: 15, fontFamily: 'Arial' } }
      : row.kind === 'h2'
        ? { ...base, textFormat: { bold: true, fontSize: 11, fontFamily: 'Arial' } }
        : row.kind === 'warn'
          ? { ...base, backgroundColor: WARN, padding: { top: 8, bottom: 8, left: 12, right: 12 }, textFormat: { fontSize: 10, fontFamily: 'Arial' } }
          : { ...base, padding: { top: 4, bottom: 4, left: 12, right: 12 }, textFormat: { fontSize: 10, fontFamily: 'Arial' } };
  requests.push({
    repeatCell: {
      range: { sheetId: INTRO_ID, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: format },
      fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat,padding)',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: INTRO_ID, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: row.kind === 'h1' ? 54 : row.kind === 'spacer' ? 14 : row.kind === 'h2' ? 30 : 74 },
      fields: 'pixelSize',
    },
  });
});

DATA_TABS.forEach((t) => {
  const { sheetId } = t;
  const cols = t.head.length;
  const rows = t.rows.length;

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
      range: colRange(sheetId, 0, cols, rows),
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
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows, startColumnIndex: 0, endColumnIndex: cols },
      innerHorizontal: RULE_LINE,
      innerVertical: RULE_LINE,
    },
  });
  for (let i = 1; i < rows; i += 2) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 0, endColumnIndex: cols },
        cell: { userEnteredFormat: { backgroundColor: BAND } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }
  (t.copyCols ?? []).forEach((c) => {
    requests.push({
      repeatCell: {
        range: colRange(sheetId, c, c + 1, rows),
        cell: { userEnteredFormat: { backgroundColor: COPY } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  });
  if (t.warnCol !== undefined) {
    requests.push({
      repeatCell: {
        range: colRange(sheetId, t.warnCol, t.warnCol + 1, rows),
        cell: { userEnteredFormat: { backgroundColor: WARN } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }
  requests.push({
    repeatCell: {
      range: colRange(sheetId, 0, 1, rows),
      cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 10, fontFamily: 'Arial' } } },
      fields: 'userEnteredFormat.textFormat',
    },
  });
  if (t.previewCol !== undefined) {
    requests.push({
      repeatCell: {
        range: colRange(sheetId, t.previewCol, t.previewCol + 1, rows),
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
  t.widths.forEach((w, c) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: w },
        fields: 'pixelSize',
      },
    });
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + rows },
      properties: { pixelSize: t.rowHeight },
      fields: 'pixelSize',
    },
  });
  if (t === adcopy) {
    requests.push({
      setBasicFilter: {
        filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 + rows, startColumnIndex: 0, endColumnIndex: cols } },
      },
    });
    // Headline over the 27-char mobile guide turns red.
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [colRange(sheetId, 12, 13, rows)],
          booleanRule: {
            condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '27' }] },
            format: { backgroundColor: WARN, textFormat: { bold: true } },
          },
        },
      },
    });
  }
});

await api(`/${id}:batchUpdate`, 'POST', { requests });

console.log('');
console.log(`Created: ${TITLE}`);
console.log(`URL:     ${created.spreadsheetUrl}`);
console.log(`Tabs:    Start Here, ${DATA_TABS.map((t) => `${t.title} (${t.rows.length})`).join(', ')}`);
console.log(`No preview (not in Drive): ${missing.join(', ') || 'none'}`);
console.log('');
