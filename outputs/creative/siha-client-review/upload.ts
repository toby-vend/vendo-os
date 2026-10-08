/**
 * Uploads the Siha client-review exports into Toby's Drive folder and records the
 * file IDs so the review sheet can show previews.
 *
 *   node --env-file=.env.local --import tsx/esm outputs/creative/siha-client-review/upload.ts
 *
 * Creates one subfolder per exports/ directory inside PARENT_ID, link-shares each
 * subfolder (=IMAGE() in Sheets is fetched without the viewer's credentials, so
 * private files render as broken cells), and uploads every PNG. Re-running skips
 * files already present. Writes manifest.json: { folders: {dir: id}, files: {dir/name: id} }.
 *
 * Uses the drive.file token in .secrets/google-drive-tokens.json (npm run drive:auth).
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const PARENT_ID = '1ZzTDE4Ww4iCrUBWUdw0bMpcWPSQZasz0';
const ROOT = 'outputs/creative/siha-client-review';
const DIRS: Record<string, string> = {
  ads: 'Meta ads',
  team: 'Meet the team carousel',
  lp: 'Landing pages',
};
const MANIFEST = join(ROOT, 'manifest.json');

const TOKEN_PATH = '.secrets/google-drive-tokens.json';
if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
  if (saved.refresh_token) process.env.GOOGLE_DRIVE_REFRESH_TOKEN = saved.refresh_token;
}
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
const REFRESH = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH) {
  throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN must be set.');
}

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

async function children(folderId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await api<{ nextPageToken?: string; files: { id: string; name: string }[] }>(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      'GET',
    );
    for (const f of page.files) out.set(f.name, f.id);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

const manifest: { parentId: string; folders: Record<string, string>; files: Record<string, string> } =
  existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf-8'))
    : { parentId: PARENT_ID, folders: {}, files: {} };

for (const [dir, folderName] of Object.entries(DIRS)) {
  let folderId = manifest.folders[dir];
  if (!folderId) {
    const folder = await api<{ id: string }>(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
      'POST',
      { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [PARENT_ID] },
    );
    folderId = folder.id;
    await api(
      `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?supportsAllDrives=true`,
      'POST',
      { role: 'reader', type: 'anyone' },
    );
    manifest.folders[dir] = folderId;
    console.log(`folder created and link-shared: ${folderName} (${folderId})`);
  }

  const existing = await children(folderId);
  const pngs = readdirSync(join(ROOT, 'exports', dir)).filter((f) => f.endsWith('.png')).sort();
  for (const name of pngs) {
    if (existing.has(name)) {
      manifest.files[`${dir}/${name}`] = existing.get(name)!;
      continue;
    }
    const bytes = readFileSync(join(ROOT, 'exports', dir, name));
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
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name&supportsAllDrives=true',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!resp.ok) throw new Error(`Upload of ${name} failed (${resp.status}): ${await resp.text()}`);
    manifest.files[`${dir}/${name}`] = ((await resp.json()) as { id: string }).id;
    console.log(`  uploaded ${dir}/${name}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

console.log(`\n${Object.keys(manifest.files).length} files in Drive. Manifest: ${MANIFEST}`);
