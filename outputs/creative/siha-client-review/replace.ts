/**
 * Retires Drive copies of exports that have changed, so upload.ts re-uploads them.
 *
 *   node --env-file=.env.local --import tsx/esm outputs/creative/siha-client-review/replace.ts \
 *     "ads/Bonding 2 - One visit - 1x1.png" "team/Meet the team 02 - Hannan.png" ...
 *
 * Each named file (dir/name.png, as keyed in manifest.json) is moved to the Drive bin and
 * dropped from the manifest. New uploads get new file IDs, so the sheet's =IMAGE() previews
 * can't serve a cached old version. Run upload.ts then build-sheet.ts afterwards.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = 'outputs/creative/siha-client-review';
const MANIFEST = join(ROOT, 'manifest.json');
const TOKEN_PATH = '.secrets/google-drive-tokens.json';

if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN && existsSync(TOKEN_PATH)) {
  const saved = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as { refresh_token?: string };
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
const token = ((await tokenRes.json()) as { access_token: string }).access_token;

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as { files: Record<string, string> };
for (const key of process.argv.slice(2)) {
  const id = manifest.files[key];
  if (!id) {
    console.log(`skip (not in manifest): ${key}`);
    continue;
  }
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!resp.ok) throw new Error(`Trash ${key} failed (${resp.status}): ${await resp.text()}`);
  delete manifest.files[key];
  console.log(`retired: ${key}`);
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
