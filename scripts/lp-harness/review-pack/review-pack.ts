/**
 * Client review pack for landing pages: full-page PNGs in a link-shared Drive folder, plus a Google Sheet the
 * client comments on (commenter access, right-click › Comment). Generalised from the Siha pack (Oct 2026).
 *
 *   node --env-file=.env.local --import tsx/esm scripts/lp-harness/review-pack/review-pack.ts <client-folder> [spreadsheetId]
 *
 * Needs <client-folder>/review.json:
 *   { "parentId": "<Drive folder for the pack>", "title": "<Client> x Vendo — Landing pages for review",
 *     "intro": "<one or two plain sentences>", "pages": [{ "type": "new-patient", "label": "Oral health assessment" }] }
 * and renders from scripts/lp-harness/render.sh. Pass the existing spreadsheet ID to rebuild in place, so the
 * client's cell comments survive; new pages are appended as rows.
 *
 * Link-sharing the folder is required (=IMAGE() is fetched without the viewer's credentials) and is outward-facing:
 * only run this once Toby has said the pack can go to the client. Sharing the sheet itself is Toby's to do.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mintSheetsAccessToken } from '../../../web/lib/google-sheets.js';

const root = process.argv[2];
if (!root) throw new Error('Usage: review-pack.ts <client-folder> [spreadsheetId]');
interface Review { parentId: string; title: string; intro: string; pages: { type: string; label: string }[] }
const review = JSON.parse(readFileSync(join(root, 'review.json'), 'utf-8')) as Review;
const VIEWS = [
  ['desktop', 'Desktop'],
  ['mobile', 'Mobile'],
  ['ty-desktop', 'Thank you page - Desktop'],
  ['ty-mobile', 'Thank you page - Mobile'],
] as const;

// --- crop the render canvas (#2a2a2a padding) off each PNG ---------------------------------------
const exportsDir = join(root, 'renders', 'exports');
mkdirSync(exportsDir, { recursive: true });
function crop(src: string, dst: string): void {
  // cropdetect finds the light artboard inside the dark capture canvas; the last reported box is the stable one
  const box = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${src}" -vf cropdetect=limit=0.2:round=2:reset=0:skip=0 -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1`])
    .toString()
    .trim();
  if (!box.startsWith('crop=')) throw new Error(`Could not find the artboard in ${src}`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', box, dst]);
}
const files: { page: string; view: string; name: string; path: string }[] = [];
for (const p of review.pages) {
  for (const [key, label] of VIEWS) {
    const src = join(root, 'renders', `${p.type}-${key}.png`);
    if (!existsSync(src)) throw new Error(`Missing render ${src}: run render.sh ${root} ${p.type}`);
    const name = `${p.label} - ${label}.png`;
    const dst = join(exportsDir, name);
    crop(src, dst);
    files.push({ page: p.label, view: label, name, path: dst });
  }
}

// --- Drive -----------------------------------------------------------------------------------
for (const [env, path] of [
  ['GOOGLE_SHEETS_REFRESH_TOKEN', '.secrets/google-sheets-tokens.json'],
  ['GOOGLE_DRIVE_REFRESH_TOKEN', '.secrets/google-drive-tokens.json'],
] as const) {
  if (!process.env[env] && existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, 'utf-8')) as { refresh_token?: string };
    if (saved.refresh_token) process.env[env] = saved.refresh_token;
  }
}
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!.trim(),
    grant_type: 'refresh_token',
  }),
});
if (!tokRes.ok) throw new Error(`Drive token refresh failed: ${await tokRes.text()}`);
const driveToken = ((await tokRes.json()) as { access_token: string }).access_token;
async function drive<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${url} failed (${r.status}): ${await r.text()}`);
  return (await r.json()) as T;
}

const manifestPath = join(root, 'review-manifest.json');
const manifest: { folderId?: string; files: Record<string, string>; spreadsheetId?: string } = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
  : { files: {} };
if (!manifest.folderId) {
  const f = await drive<{ id: string }>('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', 'POST', {
    name: 'Landing pages',
    mimeType: 'application/vnd.google-apps.folder',
    parents: [review.parentId],
  });
  await drive(`https://www.googleapis.com/drive/v3/files/${f.id}/permissions?supportsAllDrives=true`, 'POST', { role: 'reader', type: 'anyone' });
  manifest.folderId = f.id;
}
for (const f of files) {
  // Re-upload on every run (the design changes between rounds); update in place so links in the sheet stay valid.
  const bytes = readFileSync(f.path);
  const boundary = `b${Date.now()}${Math.random().toString(36).slice(2)}`;
  const existing = manifest.files[f.name];
  const meta = JSON.stringify(existing ? { name: f.name } : { name: f.name, parents: [manifest.folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart&fields=id&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true';
  const r = await fetch(url, { method: existing ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!r.ok) throw new Error(`Upload of ${f.name} failed (${r.status}): ${await r.text()}`);
  manifest.files[f.name] = ((await r.json()) as { id: string }).id;
  console.log(`  ${existing ? 'updated' : 'uploaded'} ${f.name}`);
}

// --- Sheet -----------------------------------------------------------------------------------
const sheetsToken = await mintSheetsAccessToken();
async function sheets<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, { method, headers: { Authorization: `Bearer ${sheetsToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} failed (${r.status}): ${(await r.text()).slice(0, 400)}`);
  return (await r.json()) as T;
}
let id = process.argv[3] || manifest.spreadsheetId;
if (!id) {
  const s = await drive<{ id: string }>('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', 'POST', {
    name: review.title,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: [review.parentId],
  });
  id = s.id;
}
manifest.spreadsheetId = id;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const link = (name: string, label: string) => `=HYPERLINK("https://drive.google.com/file/d/${manifest.files[name]}/view", "${label}")`;
const preview = (name: string) => `=IMAGE("https://lh3.googleusercontent.com/d/${manifest.files[name]}=w400", 1)`;
const head = ['Page', 'Preview (top of the page)', 'Desktop', 'Mobile', 'Thank-you page (desktop)', 'Thank-you page (mobile)'];
const rows = review.pages.map((p) => [
  p.label,
  preview(`${p.label} - Desktop.png`),
  link(`${p.label} - Desktop.png`, 'Open desktop page'),
  link(`${p.label} - Mobile.png`, 'Open mobile page'),
  link(`${p.label} - Thank you page - Desktop.png`, 'Open thank-you (desktop)'),
  link(`${p.label} - Thank you page - Mobile.png`, 'Open thank-you (mobile)'),
]);
const intro = [
  [review.title],
  [review.intro],
  ['How to leave feedback: click the cell you want to comment on, then right-click › Comment. We see every comment and reply in the thread.'],
  [`=HYPERLINK("https://drive.google.com/drive/folders/${manifest.folderId}", "All full-size files")`],
];
const meta = await sheets<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`/${id}?fields=sheets.properties(sheetId,title)`, 'GET');
const first = meta.sheets[0].properties.sheetId;
const hasPages = meta.sheets.some((s) => s.properties.sheetId === 1);
await sheets(`/${id}:batchUpdate`, 'POST', {
  requests: [
    { updateSpreadsheetProperties: { properties: { title: review.title, locale: 'en_GB' }, fields: 'title,locale' } },
    { updateSheetProperties: { properties: { sheetId: first, title: 'Start here' }, fields: 'title' } },
    hasPages
      ? { updateSheetProperties: { properties: { sheetId: 1, title: 'Landing pages', gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } }, fields: 'title,gridProperties(frozenRowCount,frozenColumnCount)' } }
      : { addSheet: { properties: { sheetId: 1, title: 'Landing pages', gridProperties: { rowCount: rows.length + 1, columnCount: head.length, frozenRowCount: 1, frozenColumnCount: 1 } } } },
  ],
});
// Values only: comments are anchored to cells, so rewriting values in place keeps them.
await sheets(`/${id}/values:batchUpdate`, 'POST', {
  valueInputOption: 'USER_ENTERED',
  data: [
    { range: `'Start here'!A1`, values: intro },
    { range: `'Landing pages'!A1`, values: [head, ...rows] },
  ],
});
const INK = { red: 0x14 / 255, green: 0x14 / 255, blue: 0x14 / 255 };
await sheets(`/${id}:batchUpdate`, 'POST', {
  requests: [
    { updateDimensionProperties: { range: { sheetId: first, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 820 }, fields: 'pixelSize' } },
    { repeatCell: { range: { sheetId: first, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } },
    { repeatCell: { range: { sheetId: first, startRowIndex: 1, endRowIndex: 4 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat.wrapStrategy' } },
    { repeatCell: { range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: INK, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    { updateDimensionProperties: { range: { sheetId: 1, dimension: 'ROWS', startIndex: 1, endIndex: rows.length + 1 }, properties: { pixelSize: 260 }, fields: 'pixelSize' } },
    ...[200, 300, 170, 170, 200, 200].map((w, c) => ({ updateDimensionProperties: { range: { sheetId: 1, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } })),
  ],
});
console.log(`\n${review.title}\nhttps://docs.google.com/spreadsheets/d/${id}/edit\nFolder: https://drive.google.com/drive/folders/${manifest.folderId}`);
