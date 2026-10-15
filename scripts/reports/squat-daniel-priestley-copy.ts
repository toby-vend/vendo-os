/**
 * Squat Success Live: client-facing ad copy sheet for the eight Daniel Priestley
 * talking-head videos (B01 to B08) in Drive "Social Content › Daniel Priestley".
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-daniel-priestley-copy.ts [spreadsheetId]
 *
 * Copy rules (see memory: UGC copy = speaker's words):
 *   - Each primary text follows the points Daniel makes in that clip, in order,
 *     written in brand voice (not his first person).
 *   - Facts only from the clip or the live LP: 13 and 14 Nov 2026, Birmingham,
 *     one two-day ticket, Daniel's three-hour workshop on the Saturday, Avenue
 *     Dental from zero patients, his books and Diary of a CEO credit.
 *   - No ticket price, no deadline, no em or en dashes. Throws if either slips in
 *     or a primary text passes Meta's 2,200 character limit.
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

const SPREADSHEET = process.argv[2] ?? '1Grs-HIe9C_70-iQVIpfe4M5LAlmcZ3rzDMnrLGTVV9w';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TAB = 'Ad Copy';
const LP = 'lp.squatsuccess.co.uk';
const DEST = 'https://lp.squatsuccess.co.uk/squat-success-event-november-2026/';

const DETAILS = `📅 Friday 13 and Saturday 14 November 2026 (Daniel's workshop is on the Saturday)
📍 Birmingham
🎟️ One ticket covers both days`;

const CTA = `👉 Find out more and get your ticket: ${LP}`;

interface Ad {
  ref: string;
  file: string;
  id: string;
  length: string;
  covers: string;
  primary: string;
  headline: string;
  description: string;
}

const ADS: Ad[] = [
  {
    ref: 'B01',
    file: 'B01_authority_broll_21s_9x16.mp4',
    id: '1wNIunEIqIvv9aBv2X89RSLviiggBteL7',
    length: '21s',
    covers: 'Daniel introduces himself, joining Dr Bobby in Birmingham, three-hour workshop on how to become oversubscribed.',
    primary: `Daniel Priestley is coming to Birmingham.

On Saturday 14 November he joins Dr Bobby Bhandal and the Squat Success community for a three-hour workshop on one big idea: how to become oversubscribed.

Daniel wrote the book on it. He is the author of Oversubscribed and Key Person of Influence, and the most returned guest on The Diary of a CEO. This is three hours of his thinking, applied to dentistry, in one room.

His workshop is part of Squat Success Live, two days for dentists opening or growing a private squat practice.

${DETAILS}

Spaces are limited.

${CTA}`,
    headline: 'Daniel Priestley, live in Birmingham',
    description: '13 and 14 Nov, Birmingham',
  },
  {
    ref: 'B02',
    file: 'B02_problem_broll_23s_9x16.mp4',
    id: '1zN8LD9j5w8-RlGeO3_M9bs_rOCd6gi_g',
    length: '23s',
    covers: 'After working with thousands of business owners: two types of business, one chasing customers, one with more demand than it can handle.',
    primary: `There are two types of business.

The first is chasing customers. Every month is a scramble to fill the diary.

The second has more demand than it can handle.

That is what Daniel Priestley has seen after working with thousands of business owners. On Saturday 14 November he brings it to dentists in Birmingham.

So if the diary still feels like a monthly scramble, his three-hour workshop at Squat Success Live is about moving your practice into the second group.

${DETAILS}

${CTA}`,
    headline: 'Which type is your practice?',
    description: 'Two days. One ticket.',
  },
  {
    ref: 'B03',
    file: 'B03_outcome_broll_20s_9x16.mp4',
    id: '12KDpncrNr9lbU2BEdi5XQ-gO5ehEGhl4',
    length: '20s',
    covers: 'What the businesses doing well have: a waiting list, campaigns, choosing who they work with, confident pricing.',
    primary: `What do the businesses that are doing well have in common?

According to Daniel Priestley:
✅ They have a waiting list
✅ They run campaigns
✅ They choose who they work with, instead of fighting for every client
✅ They set their prices with confidence

That is what he wants for your practice, and it is what his three-hour workshop at Squat Success Live is built around.

${DETAILS}

${CTA}`,
    headline: 'Build a practice with a waiting list',
    description: '13 and 14 Nov, Birmingham',
  },
  {
    ref: 'B04',
    file: 'B04_curiosity_broll_15s_9x16.mp4',
    id: '1VVmlnnyqRxawC4ph6vGA58-1wNqKsDCt',
    length: '15s',
    covers: 'The difference is not luck, it is positioning and campaigns. He will show the three campaigns you should be running.',
    primary: `Why do some practices have a waiting list while others are scrambling for patients?

It isn't luck. Daniel Priestley puts it down to two things: your positioning, and the types of campaigns you run.

At Squat Success Live in Birmingham, he will show you the three campaigns you should be running.

${DETAILS}

${CTA}`,
    headline: 'The three campaigns to be running',
    description: 'Two days. One ticket.',
  },
  {
    ref: 'B05',
    file: 'B05_dentistry_broll_36s_9x16.mp4',
    id: '1T8jhaTBYFn2gze0OBRere6ze2KblUB9_',
    length: '36s',
    covers: 'The workshop, then why dentistry is one of the best industries to become oversubscribed in: trusted, local, already doing what people value.',
    primary: `Daniel Priestley would argue dentistry is one of the best industries in the world to become oversubscribed in.

His reasoning is simple. You are already trusted. You are already local. You are already doing the things people value.

What usually holds a practice back is the campaigns and the demand generation. Get those right, and in Daniel's words, it's a perfect marriage.

On Saturday 14 November he joins Dr Bobby Bhandal and the Squat Success community in Birmingham for a three-hour workshop on exactly that: how to become oversubscribed.

${DETAILS}

${CTA}`,
    headline: 'Why dentistry is built for this',
    description: '13 and 14 Nov, Birmingham',
  },
  {
    ref: 'B06',
    file: 'B06_socialproof_broll_30s_9x16.mp4',
    id: '1upBLhtWbWpvSK3jdVthyg2r35xH1p-K4',
    length: '30s',
    covers: 'Bobby has already proved it: built his practice from zero patients, now helping dentists across the UK. Working with the community was an easy yes.',
    primary: `When Dr Bobby Bhandal asked Daniel Priestley to work with the Squat Success community, it was an easy yes.

Bobby has already proved it. He built Avenue Dental from zero patients, and now he helps dentists do the same across the UK.

Daniel calls them exactly the right people he loves working with. On Saturday 14 November he is in Birmingham to help get them oversubscribed.

His three-hour workshop is part of Squat Success Live. Day 1 is the blueprint for opening a private squat. Day 2 is building the business, including Daniel's workshop.

${DETAILS}

${CTA}`,
    headline: 'Why Daniel Priestley said yes',
    description: 'Two days. One ticket.',
  },
  {
    ref: 'B07',
    file: 'B07_invitation_broll_28s_9x16.mp4',
    id: '1CDkuBVjzToSB_IEL7XocDyy-mRalnDuN',
    length: '28s',
    covers: 'What the workshop covers: standing out in a crowded market, building demand before you need it, a practice patients line up for.',
    primary: `Three hours. One big idea: how to become oversubscribed.

Daniel Priestley's workshop at Squat Success Live goes deep on:
✅ How to stand out in a crowded marketplace
✅ How to build real demand before you need it
✅ How to create the kind of practice patients are lining up for

Saturday 14 November, Birmingham. Let's get oversubscribed.

${DETAILS}

${CTA}`,
    headline: 'Three hours with Daniel Priestley',
    description: '13 and 14 Nov, Birmingham',
  },
  {
    ref: 'B08',
    file: 'B08_fullpitch_broll_46s_9x16.mp4',
    id: '1ggW1Rj0mGbxN3GMGI3u3V_U3V1XQoYy0',
    length: '46s',
    covers: 'Full pitch: two types of business, what the ones doing well have, positioning and the three campaigns, for dentists opening or already running a practice.',
    primary: `There are two types of business. One chases customers, and every month is a scramble. The other has more demand than it can handle.

The ones doing well have a waiting list. They run campaigns. They choose who they work with, and they set their prices with confidence.

The difference isn't luck. Daniel Priestley puts it down to positioning and the campaigns you run, and at Squat Success Live he will show you the three campaigns you should be running.

About to open a practice? Already running one? Either way, this one is for you.

${DETAILS}

${CTA}`,
    headline: 'Get your practice oversubscribed',
    description: 'Two days. One ticket.',
  },
];

for (const a of ADS) {
  const all = [a.primary, a.headline, a.description, a.covers].join('\n');
  if (/[–—]/.test(all)) throw new Error(`${a.ref}: contains an em or en dash`);
  if (/£\s?\d/.test(all)) throw new Error(`${a.ref}: contains a price`);
  if (a.primary.length > 2200) throw new Error(`${a.ref}: primary text is ${a.primary.length} chars`);
  if (a.headline.length > 40) throw new Error(`${a.ref}: headline over 40 chars`);
}
const openers = ADS.map((a) => a.primary.split('\n')[0]);
if (new Set(openers).size !== openers.length) throw new Error('Two ads open on the same line');

const HEAD = ['Ad', 'Video', 'Preview', 'Length', 'What Daniel covers', 'Primary text', 'Headline', 'Description', 'Button', 'Landing page'];
const q = (s: string) => s.replace(/"/g, '""');
const rows = ADS.map((a) => [
  a.ref,
  `=HYPERLINK("https://drive.google.com/file/d/${a.id}/view", "${q(a.file)}")`,
  `=IMAGE("https://lh3.googleusercontent.com/d/${a.id}=w400", 1)`,
  a.length,
  a.covers,
  a.primary,
  a.headline,
  a.description,
  'Learn More',
  DEST,
]);

async function api(token: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}/${SPREADSHEET}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json)}`);
  return json;
}

const token = await mintSheetsAccessToken();
const meta = await api(token, '?fields=sheets.properties', 'GET');
const sheetId: number = meta.sheets[0].properties.sheetId;

await api(token, '/values:batchUpdate', 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [{ range: `'${meta.sheets[0].properties.title}'!A1`, values: [HEAD, ...rows] }],
});

const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const GOLD = { red: 167 / 255, green: 140 / 255, blue: 96 / 255 };
const widths = [60, 220, 170, 70, 230, 460, 220, 170, 100, 220];
const n = rows.length + 1;

await api(token, ':batchUpdate', 'POST', {
  requests: [
    { updateSheetProperties: { properties: { sheetId, title: TAB, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 } }, fields: 'title,gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } },
    ...widths.map((px, i) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } })),
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: n }, properties: { pixelSize: 470 }, fields: 'pixelSize' } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: n, startColumnIndex: 0, endColumnIndex: HEAD.length }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP', textFormat: { fontFamily: 'Arial', fontSize: 10 } } }, fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)' } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: INK, verticalAlignment: 'MIDDLE', textFormat: { bold: true, foregroundColor: GOLD, fontFamily: 'Arial', fontSize: 10 } } }, fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 36 }, fields: 'pixelSize' } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: n, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: n, startColumnIndex: 6, endColumnIndex: 7 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
    { updateBorders: { range: { sheetId, startRowIndex: 0, endRowIndex: n, startColumnIndex: 0, endColumnIndex: HEAD.length }, innerHorizontal: { style: 'SOLID', color: { red: 0.85, green: 0.85, blue: 0.85 } }, bottom: { style: 'SOLID', color: { red: 0.85, green: 0.85, blue: 0.85 } } } },
  ],
});

console.log(`Wrote ${rows.length} ads: https://docs.google.com/spreadsheets/d/${SPREADSHEET}/edit`);
