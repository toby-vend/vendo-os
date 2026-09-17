/**
 * Uploads the Squat Success Meta creatives to Drive and records their file IDs
 * so the ad copy sheet can show thumbnails.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-upload-creatives.ts <exports dir> [existingFolderId]
 *
 * Creates one folder, uploads every PNG in the exports directory, and link-shares
 * the folder. The share is required, not cosmetic: =IMAGE() in Sheets is fetched
 * by Google's servers without the viewer's credentials, so a private file renders
 * as a broken cell. Children inherit the folder permission.
 *
 * Writes data/squat-success-creative-assets.json: { folderId, files: {stem: id} }.
 * Re-running with the folder ID reuses the folder and skips files already in it,
 * so it is safe to run twice.
 *
 * Uses GOOGLE_DRIVE_REFRESH_TOKEN, or .secrets/google-drive-tokens.json.
 * Scope is drive.file, so this only ever touches files it created itself.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const TOKEN_PATH = '.secrets/google-drive-tokens.json';
if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_DRIVE_REFRESH_TOKEN = saved.refresh_token;
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
const REFRESH = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH) {
  throw new Error(
    'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN must be set. ' +
      'Run `npm run drive:auth` first.',
  );
}

const exportsDir = process.argv[2];
if (!exportsDir) throw new Error('Pass the exports directory as the first argument');
const existingFolderId = process.argv[3];

const FOLDER_NAME = 'Squat Success — Meta creatives (Dental Freedom Blueprint)';
const ASSETS_PATH = 'data/squat-success-creative-assets.json';

// --- auth --------------------------------------------------------------------

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH,
    grant_type: 'refresh_token',
  }),
});
if (!tokenRes.ok) throw new Error(`Drive token refresh failed: ${await tokenRes.text()}`);
const token = ((await tokenRes.json()) as { access_token: string }).access_token;

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`${method} ${url} failed (${resp.status}): ${await resp.text()}`);
  return (await resp.json()) as T;
}

// --- folder ------------------------------------------------------------------

let folderId = existingFolderId;
if (!folderId) {
  const folder = await api<{ id: string }>('https://www.googleapis.com/drive/v3/files', 'POST', {
    name: FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  });
  folderId = folder.id;
  console.log(`folder created: ${folderId}`);

  await api(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, 'POST', {
    role: 'reader',
    type: 'anyone',
  });
  console.log('folder link-shared (required for =IMAGE previews to render)');
} else {
  console.log(`reusing folder: ${folderId}`);
}

// --- existing children, so a re-run is a no-op --------------------------------

const existing = new Map<string, string>();
let pageToken: string | undefined;
do {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'nextPageToken,files(id,name)',
    pageSize: '200',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const page = await api<{ nextPageToken?: string; files: { id: string; name: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    'GET',
  );
  for (const f of page.files) existing.set(f.name, f.id);
  pageToken = page.nextPageToken;
} while (pageToken);

// --- upload ------------------------------------------------------------------

const pngs = readdirSync(exportsDir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort();
if (pngs.length === 0) throw new Error(`No PNGs found in ${exportsDir}`);

const ids: Record<string, string> = {};
let uploaded = 0;

for (const name of pngs) {
  if (existing.has(name)) {
    ids[name] = existing.get(name)!;
    continue;
  }
  const bytes = readFileSync(join(exportsDir, name));
  const boundary = `b${Date.now()}${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!resp.ok) throw new Error(`Upload of ${name} failed (${resp.status}): ${await resp.text()}`);
  const file = (await resp.json()) as { id: string };
  ids[name] = file.id;
  uploaded += 1;
  console.log(`  uploaded ${name}`);
}

writeFileSync(
  ASSETS_PATH,
  JSON.stringify(
    {
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      files: ids,
    },
    null,
    2,
  ),
);

console.log('');
console.log(`Folder:   https://drive.google.com/drive/folders/${folderId}`);
console.log(`Files:    ${Object.keys(ids).length} total, ${uploaded} uploaded this run`);
console.log(`Manifest: ${ASSETS_PATH}`);
console.log('');
