/**
 * Brand Hub re-index script — walks DRIVE_FOLDER_BRANDS, discovers client subfolders,
 * and populates the brand_hub table for all indexable files.
 *
 * Usage:
 *   npm run brand:reindex
 *
 * Requires in .env.local:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *   DRIVE_ADMIN_USER_ID  — user ID whose Google token is used for Drive API calls
 *   DRIVE_FOLDER_BRANDS  — root folder ID for all client brand assets
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createHash } from 'node:crypto';
import { getGoogleAccessToken } from '../../web/lib/google-tokens.js';
import { upsertBrandFromDrive } from '../../web/lib/queries/brand.js';
import { extractContent, hashContent } from '../../web/lib/drive-sync.js';

// --- Logging helpers ---

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [BRANDS] ${msg}`);
}

function logError(msg: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errMsg = err instanceof Error ? err.message : String(err ?? '');
  console.error(`[${ts}] [ERROR] [BRANDS] ${msg}${errMsg ? ': ' + errMsg : ''}`);
}

// --- Types ---

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface DriveFilesListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// MIME types to index as brand content — excludes spreadsheets (extractContent returns null for them)
const INDEXABLE_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',
  'text/plain',
  'text/markdown',
]);

const FOLDER_MIME = 'application/vnd.google-apps.folder';

// --- Helper functions ---

/**
 * Derive a stable integer client ID from a Drive folder ID.
 * Uses first 8 hex chars of SHA-256(folderId) parsed as a positive integer.
 */
function deriveClientId(driveFolderId: string): number {
  return parseInt(createHash('sha256').update(driveFolderId, 'utf8').digest('hex').slice(0, 8), 16);
}

/**
 * Slugify a client folder name for use as client_slug.
 * "Kana Health Group" → "kana-health-group"
 */
function slugifyClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * List all files in a folder, recursing into sub-folders.
 * Returns flat list of non-folder files.
 */
async function listFilesInFolder(
  folderId: string,
  accessToken: string,
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  const subFolderEntries: Array<{ id: string; name: string }> = [];

  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,modifiedTime),nextPageToken',
      pageSize: '100',
    });

    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`files.list failed: ${res.status} ${body}`);
    }

    const data = await res.json() as DriveFilesListResponse;

    for (const file of data.files) {
      if (file.mimeType === FOLDER_MIME) {
        subFolderEntries.push({ id: file.id, name: file.name });
      } else {
        allFiles.push(file);
      }
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  // Recurse into sub-folders
  for (const subFolder of subFolderEntries) {
    const subFiles = await listFilesInFolder(subFolder.id, accessToken);
    allFiles.push(...subFiles);
  }

  return allFiles;
}

/**
 * List immediate subfolder entries (client folders) within a given parent folder.
 */
async function listClientSubfolders(
  parentFolderId: string,
  accessToken: string,
): Promise<Array<{ id: string; name: string }>> {
  const results: Array<{ id: string; name: string }> = [];
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${parentFolderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id,name),nextPageToken',
      pageSize: '100',
    });

    if (nextPageToken) {
      params.set('pageToken', nextPageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`files.list (subfolders) failed: ${res.status} ${body}`);
    }

    const data = await res.json() as DriveFilesListResponse;
    for (const file of data.files) {
      results.push({ id: file.id, name: file.name });
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return results;
}

// --- Main ---

async function main(): Promise<void> {
  const brandsFolder = process.env.DRIVE_FOLDER_BRANDS;
  if (!brandsFolder) {
    log('DRIVE_FOLDER_BRANDS not set — nothing to index');
    process.exit(0);
  }

  const adminUserId = process.env.DRIVE_ADMIN_USER_ID;
  if (!adminUserId) {
    logError('DRIVE_ADMIN_USER_ID must be set in .env.local');
    process.exit(1);
  }

  const accessToken = await getGoogleAccessToken(adminUserId);
  if (!accessToken) {
    logError('No Google access token found for admin user. Connect Google account in Settings.');
    process.exit(1);
  }

  log(`Starting brand re-index for admin user: ${adminUserId}`);
  log(`Brands folder: ${brandsFolder}`);

  // Discover client subfolders
  let clientFolders: Array<{ id: string; name: string }>;
  try {
    clientFolders = await listClientSubfolders(brandsFolder, accessToken);
  } catch (err) {
    logError('Failed to list client subfolders in DRIVE_FOLDER_BRANDS', err);
    process.exit(1);
  }

  log(`Discovered ${clientFolders.length} client folder(s)`);

  let totalClientsIndexed = 0;
  let totalFilesIndexed = 0;
  let totalFilesSkipped = 0;

  for (const clientFolder of clientFolders) {
    const clientName = clientFolder.name;
    const clientSlug = slugifyClientName(clientName);
    const clientId = deriveClientId(clientFolder.id);

    log(`Processing client: ${clientName} (slug=${clientSlug}, id=${clientId})`);

    let files: DriveFile[];
    try {
      files = await listFilesInFolder(clientFolder.id, accessToken);
    } catch (err) {
      logError(`Failed to list files for client '${clientName}'`, err);
      continue;
    }

    const indexableFiles = files.filter(f => INDEXABLE_MIME_TYPES.has(f.mimeType));

    if (indexableFiles.length === 0) {
      log(`  ${clientName}: no indexable files — skipping`);
      continue;
    }

    let clientFilesIndexed = 0;
    let clientFilesSkipped = 0;

    for (const file of indexableFiles) {
      try {
        const content = await extractContent(file.id, file.mimeType, accessToken);

        if (content === null) {
          log(`  Skipping non-indexable file: ${file.name} (${file.mimeType})`);
          clientFilesSkipped++;
          continue;
        }

        const contentHash = hashContent(content);

        await upsertBrandFromDrive({
          driveFileId: file.id,
          title: file.name,
          content,
          contentHash,
          clientId,
          clientName,
          clientSlug,
          driveModifiedAt: file.modifiedTime,
        });

        clientFilesIndexed++;
      } catch (err) {
        logError(`Failed to index file '${file.name}' (${file.id}) for client '${clientName}'`, err);
        clientFilesSkipped++;
      }
    }

    log(`  ${clientName}: indexed ${clientFilesIndexed}, skipped ${clientFilesSkipped}`);
    totalClientsIndexed++;
    totalFilesIndexed += clientFilesIndexed;
    totalFilesSkipped += clientFilesSkipped;
  }

  // Summary
  log('--- Re-index Summary ---');
  log(`  Clients discovered: ${clientFolders.length}`);
  log(`  Clients indexed:    ${totalClientsIndexed}`);
  log(`  Files indexed:      ${totalFilesIndexed}`);
  log(`  Files skipped:      ${totalFilesSkipped}`);
  log('Brand re-index complete');
}

main().catch((err) => {
  logError('Unexpected error', err);
  process.exit(1);
});
