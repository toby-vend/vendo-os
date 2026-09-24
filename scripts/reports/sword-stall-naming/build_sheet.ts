/**
 * Builds the Sword Stall Meta ad naming map as a Google Sheet.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/sword-stall-naming/build_sheet.ts <naming_rows.json>
 *
 * Input comes from build_rows.py. Tabs: Start Here, Ad Mapping, Dictionary.
 * The Proposed name column is a TEXTJOIN formula over the field columns, so
 * editing any field updates the name. Header on row 1, no merged cells
 * (frozen columns cannot cut through merges).
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync } from 'fs';
import { mintSheetsAccessToken } from '../../../web/lib/google-sheets.js';

const TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}

interface Row {
  ad_id: string; name: string; adset: string; campaign: string; status: string;
  spend: number; roas: number; format: string; talent: string; angle: string;
  subject: string; hook: string; edit: string; launch: string; flags: string[];
}

const rows = JSON.parse(readFileSync(process.argv[2], 'utf-8')) as Row[];
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const FIELD_TINT = { red: 0.93, green: 0.99, blue: 0.96 };
const NAME_TINT = { red: 0.894, green: 0.976, blue: 0.929 };
const GREY = { red: 0.93, green: 0.93, blue: 0.93 };
const DRAFT_TINT = { red: 0.96, green: 0.97, blue: 1 };

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

const DICT: [string, string, string][] = [
  ['Format', 'UGC', 'Creator-filmed video'],
  ['Format', 'TH', 'Talking head, presenter to camera'],
  ['Format', 'ASMR', 'Product sound and handling, no talking'],
  ['Format', 'LOGO', 'Brand or logo animation'],
  ['Format', 'STATIC', 'Single image'],
  ['Format', 'DPA', 'Catalogue (dynamic product) ad'],
  ['Talent', 'Skippy', 'Sword Stall presenter'],
  ['Talent', 'TBC', 'UGC creator not yet named, replace with their first name'],
  ['Talent', 'None', 'No person on camera'],
  ['Angle', 'Gift', 'Buying for someone else (Rachel persona)'],
  ['Angle', 'Fandom', 'Fan of a film, show or game (Tom persona)'],
  ['Angle', 'Collector', 'Building a display collection (Dale persona)'],
  ['Angle', 'Craft', 'Quality, build and unboxing (Ade persona)'],
  ['Angle', 'History', 'Historical accuracy (Geoff persona)'],
  ['Angle', 'Impulse', 'Cheapest way in, easy yes (Liv persona)'],
  ['Angle', 'Offer', 'Voucher, layaway, delivery cut-off, stock'],
  ['Angle', 'Trust', 'FAQs, legality, reassurance'],
  ['Angle', 'Brand', 'Brand awareness, no specific pitch'],
  ['Angle', 'Retarget', 'Cart and catalogue retargeting'],
  ['Subject', 'Range', 'General catalogue, no single fandom'],
  ['Subject', 'LOTR', 'Lord of the Rings / Hobbit'],
  ['Subject', 'Witcher', 'The Witcher'],
  ['Subject', 'Supernatural', 'Supernatural'],
  ['Subject', 'AssassinsCreed', "Assassin's Creed"],
  ['Subject', 'GhostOfTsushima', 'Ghost of Tsushima'],
  ['Subject', 'Katana', 'Katanas (non-licensed)'],
  ['Hook', '(free text)', 'Short CamelCase label for the opening line, e.g. HaveIGot, StopScrolling'],
  ['Edit', 'V1 / V2…', 'Cut version'],
  ['Edit', 'Subs / NoSubs / Captions', 'Subtitle treatment'],
  ['Launch', 'YYMMDD', 'Date the creative first went live anywhere; copies keep the original date'],
];

const INTRO = [
  ['Sword Stall Meta ad naming map'],
  [''],
  ['Every ad name follows one structure, separated by " | ":'],
  ['Format | Talent | Angle | Subject | Hook | Edit | Launch'],
  ['Example: UGC | TBC | Gift | LOTR | HaveIGot | Subs | 250922'],
  [''],
  ['How to use this sheet'],
  ['1. Review the green field columns on the Ad Mapping tab. Edit any field; the Proposed name updates itself.'],
  ['2. Check the Check column: it lists anything guessed or missing (UGC creator names, the meaning of PASTOR, two ambiguous LOTR/Witcher ads).'],
  ['3. Tick Approved on each row that is ready. Claude then applies the approved names in Ads Manager.'],
  [''],
  ['Rules'],
  ['- Never leave "- Copy" in a name; rename when duplicating.'],
  ['- Copies of a creative keep the same name and Launch date, so Motion groups them. The ad set shows where it runs.'],
  ['- Renaming a live ad does not reset learning.'],
  ['- Rejected ads are listed for completeness; archive them rather than renaming.'],
  ['- New shoot edits are named in this format before upload.'],
  [''],
  ['Source: Ads Manager export (ads with delivery 25 Jun to 22 Sep 2026) plus the 20 draft ads in VD | Sales | Creative Testing | ABO. Launch dates grouped by Motion creative ID.'],
];

const HEAD = ['Status', 'Campaign', 'Ad set', 'Ad ID', 'Current name', '90-day spend (£)', '90-day ROAS',
  'Format', 'Talent', 'Angle', 'Subject', 'Hook', 'Edit', 'Launch', 'Proposed name', 'Check', 'Approved'];
const data = rows.map((r, i) => {
  const n = i + 2;
  return [r.status, r.campaign, r.adset, `'${r.ad_id}`, r.name, r.spend ? Math.round(r.spend * 100) / 100 : '',
    r.roas ? Math.round(r.roas * 100) / 100 : '', r.format, r.talent, r.angle, r.subject, r.hook, r.edit,
    `'${r.launch}`, `=TEXTJOIN(" | ",FALSE,H${n}:N${n})`, r.flags.join('; '), false];
});
const dictRows = DICT.map(d => [...d]);

const created = await api<{ spreadsheetId: string; spreadsheetUrl: string }>('', 'POST', {
  properties: { title: 'Sword Stall — Meta Ad Naming Map' },
  sheets: [
    { properties: { sheetId: 0, title: 'Start Here' } },
    { properties: { sheetId: 1, title: 'Ad Mapping', gridProperties: { frozenRowCount: 1, frozenColumnCount: 5 } } },
    { properties: { sheetId: 2, title: 'Dictionary', gridProperties: { frozenRowCount: 1 } } },
  ],
});
const id = created.spreadsheetId;

await api(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [
    { range: "'Start Here'!A1", values: INTRO },
    { range: "'Ad Mapping'!A1", values: [HEAD, ...data] },
    { range: "'Dictionary'!A1", values: [['Field', 'Value', 'Meaning'], ...dictRows] },
  ],
});

const last = data.length + 1;
const col = (c: number, sheetId = 1, start = 1, end = last) =>
  ({ sheetId, startRowIndex: start, endRowIndex: end, startColumnIndex: c, endColumnIndex: c + 1 });
const header = (sheetId: number, cols: number) => ({
  repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
    cell: { userEnteredFormat: { backgroundColor: INK, textFormat: { foregroundColor: MINT, bold: true }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } },
    fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)',
  },
});
const width = (sheetId: number, i: number, px: number) => ({
  updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' },
});
const listRule = (c: number, field: string) => ({
  setDataValidation: {
    range: col(c),
    rule: { condition: { type: 'ONE_OF_LIST', values: DICT.filter(d => d[0] === field).map(d => ({ userEnteredValue: d[1] })) }, strict: false, showCustomUi: true },
  },
});
const tintRows = (status: string, color: typeof GREY) => ({
  addConditionalFormatRule: {
    rule: {
      ranges: [{ sheetId: 1, startRowIndex: 1, endRowIndex: last, startColumnIndex: 0, endColumnIndex: 5 }],
      booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=$A2="${status}"` }] }, format: { backgroundColor: color } },
    },
    index: 0,
  },
});

const widths = [70, 230, 200, 150, 320, 90, 70, 70, 70, 80, 120, 140, 80, 70, 420, 320, 80];
await api(`/${id}:batchUpdate`, 'POST', {
  requests: [
    header(1, HEAD.length),
    header(2, 3),
    ...widths.map((w, i) => width(1, i, w)),
    width(2, 0, 90), width(2, 1, 200), width(2, 2, 480), width(0, 0, 900),
    { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 16 } } }, fields: 'userEnteredFormat.textFormat' } },
    ...[3, 6, 11].map(r => ({ repeatCell: { range: { sheetId: 0, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } })),
    { repeatCell: { range: { sheetId: 1, startRowIndex: 1, endRowIndex: last, startColumnIndex: 7, endColumnIndex: 14 }, cell: { userEnteredFormat: { backgroundColor: FIELD_TINT } }, fields: 'userEnteredFormat.backgroundColor' } },
    { repeatCell: { range: col(14), cell: { userEnteredFormat: { backgroundColor: NAME_TINT, textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    { repeatCell: { range: col(15), cell: { userEnteredFormat: { wrapStrategy: 'WRAP', textFormat: { foregroundColor: { red: 0.7, green: 0.25, blue: 0.1 } } } }, fields: 'userEnteredFormat(wrapStrategy,textFormat)' } },
    { repeatCell: { range: col(5), cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } } }, fields: 'userEnteredFormat.numberFormat' } },
    { repeatCell: { range: col(6), cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00"x"' } } }, fields: 'userEnteredFormat.numberFormat' } },
    { setDataValidation: { range: col(16), rule: { condition: { type: 'BOOLEAN' } } } },
    listRule(7, 'Format'), listRule(8, 'Talent'), listRule(9, 'Angle'), listRule(10, 'Subject'),
    tintRows('Rejected', GREY), tintRows('Draft', DRAFT_TINT),
    { setBasicFilter: { filter: { range: { sheetId: 1, startRowIndex: 0, endRowIndex: last, startColumnIndex: 0, endColumnIndex: HEAD.length } } } },
    { updateDimensionProperties: { range: { sheetId: 1, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: 'pixelSize' } },
  ],
});

console.log(created.spreadsheetUrl);
