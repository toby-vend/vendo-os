/**
 * Zen House Dental Meta statics: uploads the PNG exports to a link-shared Drive folder
 * and builds a shareable sheet with one tab per practice (previews beside the copy).
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/zen-house-ad-copy-sheet.ts <payload.json> [folderId] [spreadsheetId]
 *
 * The payload is { Banstead: Row[], Battersea: Row[] }, built from
 * outputs/creative/zen-house-meta-statics/copy-*.md. Paths in it are relative to that folder.
 * The folder is link-shared because =IMAGE() is fetched without the viewer's credentials.
 * Re-running with the folder and sheet IDs keeps unchanged files, re-uploads changed ones and rewrites the tabs.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { mintSheetsAccessToken } from '../../web/lib/google-sheets.js';

interface Row {
  id: string;
  treatment: string;
  concept: string;
  ad1: string;
  ad9: string;
  f1: string;
  f9: string;
  headline: string;
  primary: string;
}

const HARNESS = 'outputs/creative/zen-house-meta-statics';
const ASSETS_PATH = 'data/zen-house-creative-assets.json';
const FOLDER_NAME = 'Zen House Dental | Meta statics | Oct 2026';
const TITLE = 'Zen House Dental x Vendo | Meta ads | Oct 2026';

const payload = JSON.parse(readFileSync(process.argv[2], 'utf-8')) as Record<string, Row[]>;
let folderId = process.argv[3];
const existingSheet = process.argv[4];

// --- Drive (drive.file token) ------------------------------------------------
const DRIVE_TOKEN_PATH = '.secrets/google-drive-tokens.json';
if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN && existsSync(DRIVE_TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(DRIVE_TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_DRIVE_REFRESH_TOKEN = saved.refresh_token;
}
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!.trim(),
    grant_type: 'refresh_token',
  }),
});
if (!tokenRes.ok) throw new Error(`Drive token refresh failed: ${await tokenRes.text()}`);
const driveToken = ((await tokenRes.json()) as { access_token: string }).access_token;

async function call<T>(url: string, method: string, token: string, body?: unknown): Promise<T> {
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`${method} ${url} failed (${resp.status}): ${(await resp.text()).slice(0, 500)}`);
  return (await resp.json()) as T;
}

if (!folderId) {
  folderId = (
    await call<{ id: string }>('https://www.googleapis.com/drive/v3/files', 'POST', driveToken, {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    })
  ).id;
  await call(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, 'POST', driveToken, {
    role: 'reader',
    type: 'anyone',
  });
  console.log(`folder created and link-shared: ${folderId}`);
}

const existing = new Map<string, { id: string; md5: string }>();
let pageToken: string | undefined;
do {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'nextPageToken,files(id,name,md5Checksum)',
    pageSize: '200',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const page = await call<{ nextPageToken?: string; files: { id: string; name: string; md5Checksum: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    'GET',
    driveToken,
  );
  for (const f of page.files) existing.set(f.name, { id: f.id, md5: f.md5Checksum });
  pageToken = page.nextPageToken;
} while (pageToken);

// FORCE_REUPLOAD=<regex> re-uploads matching files even if unchanged (to escape a stale Sheets cache).
const force = process.env.FORCE_REUPLOAD ? new RegExp(process.env.FORCE_REUPLOAD) : null;
const ids: Record<string, string> = {};
for (const rel of Object.values(payload).flat().flatMap((r) => [r.f1, r.f9])) {
  const name = basename(rel);
  const bytes = readFileSync(join(HARNESS, rel));
  const prior = existing.get(name);
  if (prior && !force?.test(name) && prior.md5 === createHash('md5').update(bytes).digest('hex')) {
    ids[rel] = prior.id;
    continue;
  }
  // A changed image gets a new file ID: Sheets caches =IMAGE() by URL, so replacing
  // bytes under the same ID keeps showing the old picture.
  if (prior) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${prior.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${driveToken}` },
    });
  }
  const boundary = `b${Date.now()}${Math.random().toString(36).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n` +
        `--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]) as Buffer<ArrayBuffer>;
  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!resp.ok) throw new Error(`Upload of ${name} failed (${resp.status}): ${await resp.text()}`);
  ids[rel] = ((await resp.json()) as { id: string }).id;
  console.log(`  uploaded ${name}`);
}
// Remove files from earlier runs that no longer match an ad name (e.g. a renamed talent label).
const wanted = new Set(Object.values(ids));
for (const [name, { id: fileId }] of existing) {
  if (wanted.has(fileId)) continue;
  if (Object.values(payload).flat().some((r) => basename(r.f1) === name || basename(r.f9) === name)) continue;
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${driveToken}` },
  });
  console.log(`  removed stale ${name}`);
}
writeFileSync(ASSETS_PATH, JSON.stringify({ folderId, files: ids }, null, 2));

// --- Sheet -------------------------------------------------------------------
const SHEETS_TOKEN_PATH = '.secrets/google-sheets-tokens.json';
if (!process.env.GOOGLE_SHEETS_REFRESH_TOKEN && existsSync(SHEETS_TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(SHEETS_TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_SHEETS_REFRESH_TOKEN = saved.refresh_token;
}
const sheetsToken = await mintSheetsAccessToken();
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const INK = { red: 0x05 / 255, green: 0x14 / 255, blue: 0x12 / 255 };
const MINT = { red: 0x8e / 255, green: 0xfe / 255, blue: 0xbb / 255 };
const BAND = { red: 0.957, green: 0.965, blue: 0.961 };
const RULE_LINE = { style: 'SOLID', color: { red: 0.85, green: 0.87, blue: 0.86 } };

const HEAD = ['Ref', 'Treatment', 'Concept', 'Feed (1:1)', 'Story (9:16)', 'Headline', 'Primary text', 'Ad names'];
const WIDTHS = [50, 120, 130, 300, 175, 220, 520, 260];
const ROW_H = 310;
const TABS = Object.keys(payload).map((site, i) => ({ site, sheetId: i + 1 }));

const img = (rel: string) => `=IMAGE("https://lh3.googleusercontent.com/d/${ids[rel]}=w600", 1)`;

const sheet = existingSheet
  ? await call<{ spreadsheetId: string; spreadsheetUrl: string }>(
      `${BASE}/${existingSheet}?fields=spreadsheetId,spreadsheetUrl`,
      'GET',
      sheetsToken,
    )
  : await call<{ spreadsheetId: string; spreadsheetUrl: string }>(BASE, 'POST', sheetsToken, {
      properties: { title: TITLE },
      sheets: TABS.map((t, i) => ({
        properties: {
          sheetId: t.sheetId,
          title: t.site,
          index: i,
          gridProperties: {
            rowCount: payload[t.site].length + 1,
            columnCount: HEAD.length,
            frozenRowCount: 1,
            frozenColumnCount: 3,
          },
        },
      })),
    });
const id = sheet.spreadsheetId;

await call(`${BASE}/${id}/values:batchUpdate`, 'POST', sheetsToken, {
  valueInputOption: 'USER_ENTERED',
  data: TABS.map((t) => ({
    range: `'${t.site}'!A1`,
    majorDimension: 'ROWS',
    values: [
      HEAD,
      ...payload[t.site].map((r) => [
        r.id,
        r.treatment,
        r.concept,
        img(r.f1),
        img(r.f9),
        r.headline,
        r.primary,
        `${r.ad1}\n${r.ad9}`,
      ]),
    ],
  })),
});

const requests: unknown[] = [];
for (const { site, sheetId } of TABS) {
  const n = payload[site].length;
  const all = { sheetId, startRowIndex: 0, endRowIndex: n + 1, startColumnIndex: 0, endColumnIndex: HEAD.length };
  requests.push(
    {
      repeatCell: {
        range: { ...all, endRowIndex: 1 },
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
      repeatCell: {
        range: { ...all, startRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'TOP',
            padding: { top: 6, bottom: 6, left: 8, right: 8 },
            textFormat: { fontSize: 10, fontFamily: 'Arial' },
          },
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,padding,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { ...all, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 5 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { ...all, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 11, fontFamily: 'Arial' } } },
        fields: 'userEnteredFormat.textFormat',
      },
    },
    { updateBorders: { range: all, innerHorizontal: RULE_LINE, innerVertical: RULE_LINE } },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: n + 1 },
        properties: { pixelSize: ROW_H },
        fields: 'pixelSize',
      },
    },
    ...WIDTHS.map((w, c) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: w },
        fields: 'pixelSize',
      },
    })),
  );
  for (let i = 1; i < n; i += 2) {
    requests.push({
      repeatCell: {
        range: { ...all, startRowIndex: 1 + i, endRowIndex: 2 + i },
        cell: { userEnteredFormat: { backgroundColor: BAND } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }
}
await call(`${BASE}/${id}:batchUpdate`, 'POST', sheetsToken, { requests });

console.log(`Folder: https://drive.google.com/drive/folders/${folderId}`);
console.log(`Sheet:  ${sheet.spreadsheetUrl}`);
