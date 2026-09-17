/**
 * Mirrors the client's "Book Launch" Drive folder into the Vendo-owned folder the
 * ad copy sheet previews from.
 *
 *   node --env-file=.env.local --import tsx/esm \
 *     scripts/reports/squat-sync-creatives.ts [sourceFolderId] [destFolderId]
 *
 * Why a mirror rather than pointing the sheet straight at the client folder:
 * =IMAGE() is fetched by Google's servers without the viewer's credentials, so the
 * source folder would have to be link-shared publicly for previews to render, and
 * it is not. The mirror is Vendo-owned and already shared.
 *
 * Two tokens, because no single one can do both halves:
 *   - read  .secrets/.gdrive-server-credentials.json  (drive.readonly, gdrive MCP)
 *   - write .secrets/google-drive-tokens.json         (drive.file, npm run drive:auth)
 *
 * Matching files are updated IN PLACE so their Drive IDs survive, which means the
 * formulas already in the sheet keep working without a rebuild. New files are
 * uploaded. Files that have vanished from source are reported, never deleted.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync, writeFileSync } from 'fs';

const SOURCE_FOLDER = process.argv[2] ?? '1Q2aCRaf87j0_-Un7_J3HTwWlvbgwXomf';
const ASSETS_PATH = 'data/squat-success-creative-assets.json';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing');

const existingAssets = existsSync(ASSETS_PATH)
  ? (JSON.parse(readFileSync(ASSETS_PATH, 'utf-8')) as { folderId: string })
  : null;
const DEST_FOLDER = process.argv[3] ?? existingAssets?.folderId;
if (!DEST_FOLDER) throw new Error('No destination folder. Run squat-upload-creatives.ts first.');

async function mint(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return ((await resp.json()) as { access_token: string }).access_token;
}

// The read token was minted by the gdrive MCP server against its own OAuth client,
// not GOOGLE_CLIENT_ID, so it has to be refreshed with those credentials.
const mcpClient = (
  JSON.parse(readFileSync('.secrets/gcp-oauth.keys.json', 'utf-8')) as {
    installed: { client_id: string; client_secret: string };
  }
).installed;

const readToken = await mint(
  (JSON.parse(readFileSync('.secrets/.gdrive-server-credentials.json', 'utf-8')) as {
    refresh_token: string;
  }).refresh_token,
  mcpClient.client_id,
  mcpClient.client_secret,
);
const writeToken = await mint(
  (JSON.parse(readFileSync('.secrets/google-drive-tokens.json', 'utf-8')) as {
    refresh_token: string;
  }).refresh_token,
  CLIENT_ID!,
  CLIENT_SECRET!,
);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum?: string;
}

async function list(folderId: string, token: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,md5Checksum)',
      pageSize: '200',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`List ${folderId} failed: ${await resp.text()}`);
    const page = (await resp.json()) as { nextPageToken?: string; files: DriveFile[] };
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out.filter((f) => !f.mimeType.includes('folder'));
}

const source = await list(SOURCE_FOLDER, readToken);
const dest = await list(DEST_FOLDER, writeToken);
const destByName = new Map(dest.map((f) => [f.name, f]));

console.log(`source: ${source.length} files`);
console.log(`dest:   ${dest.length} files`);

async function download(fileId: string): Promise<Buffer<ArrayBuffer>> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${readToken}` } },
  );
  if (!resp.ok) throw new Error(`Download ${fileId} failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// Buffer<ArrayBuffer>, not plain Buffer: BodyInit rejects Buffer<ArrayBufferLike>.
function multipart(
  meta: object,
  bytes: Buffer<ArrayBuffer>,
): { body: Buffer<ArrayBuffer>; boundary: string } {
  const boundary = `b${Date.now()}${Math.random().toString(36).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, boundary };
}

const ids: Record<string, string> = {};
let added = 0;
let updated = 0;
let unchanged = 0;

for (const src of source) {
  const existing = destByName.get(src.name);

  // md5 is the only reliable "did the artwork actually change" signal; modifiedTime
  // moves on a re-upload even when the bytes are identical.
  if (existing && existing.md5Checksum && existing.md5Checksum === src.md5Checksum) {
    ids[src.name] = existing.id;
    unchanged += 1;
    continue;
  }

  const bytes = await download(src.id);

  if (existing) {
    // Update content in place so the ID, and every formula already referencing it,
    // survives the refresh.
    const { body, boundary } = multipart({}, bytes);
    const resp = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${writeToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!resp.ok) throw new Error(`Update ${src.name} failed: ${await resp.text()}`);
    ids[src.name] = existing.id;
    updated += 1;
    console.log(`  updated ${src.name}`);
  } else {
    const { body, boundary } = multipart({ name: src.name, parents: [DEST_FOLDER] }, bytes);
    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${writeToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!resp.ok) throw new Error(`Upload ${src.name} failed: ${await resp.text()}`);
    ids[src.name] = ((await resp.json()) as { id: string }).id;
    added += 1;
    console.log(`  added   ${src.name}`);
  }
}

const orphans = dest.filter((f) => !source.some((s) => s.name === f.name)).map((f) => f.name);

writeFileSync(
  ASSETS_PATH,
  JSON.stringify(
    {
      folderId: DEST_FOLDER,
      folderUrl: `https://drive.google.com/drive/folders/${DEST_FOLDER}`,
      sourceFolderId: SOURCE_FOLDER,
      sourceFolderUrl: `https://drive.google.com/drive/folders/${SOURCE_FOLDER}`,
      syncedAt: new Date().toISOString(),
      files: ids,
    },
    null,
    2,
  ),
);

console.log('');
console.log(`added ${added}, updated ${updated}, unchanged ${unchanged}`);
if (orphans.length > 0) {
  console.log(`no longer in source (left in place, not deleted): ${orphans.join(', ')}`);
}
console.log(`manifest: ${ASSETS_PATH}`);
console.log('');
