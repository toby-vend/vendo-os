/**
 * Drive re-index script — walks configured Google Drive folders and populates the skills table.
 *
 * Usage:
 *   npm run drive:reindex              # Walk all configured folders and upsert file metadata
 *   npm run drive:reindex:watch        # Same, then register a Drive webhook watch channel
 *
 * Requires in .env.local:
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *   DRIVE_ADMIN_USER_ID  — user ID whose Google token is used for Drive API calls
 *   DRIVE_FOLDER_PAID_SOCIAL, DRIVE_FOLDER_SEO, DRIVE_FOLDER_PAID_ADS, DRIVE_FOLDER_GENERAL
 *   DRIVE_FOLDER_BRANDS  — brands folder (skipped for skills; reserved for brand_hub)
 *   DRIVE_WEBHOOK_URL    — optional override; defaults to VERCEL_PROJECT_PRODUCTION_URL/api/drive/webhook
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getGoogleAccessToken } from '../../web/lib/google-tokens.js';
import { upsertSkillFromDrive } from '../../web/lib/queries/drive.js';
import { registerWatchChannel } from '../../web/lib/drive-sync.js';

const WATCH = process.argv.includes('--watch');

// --- Logging helpers ---

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [DRIVE] ${msg}`);
}

function logError(msg: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errMsg = err instanceof Error ? err.message : String(err ?? '');
  console.error(`[${ts}] [ERROR] [DRIVE] ${msg}${errMsg ? ': ' + errMsg : ''}`);
}

// --- Folder config ---

const FOLDER_CONFIG: Record<string, string | undefined> = {
  paid_social: process.env.DRIVE_FOLDER_PAID_SOCIAL,
  seo: process.env.DRIVE_FOLDER_SEO,
  paid_ads: process.env.DRIVE_FOLDER_PAID_ADS,
  general: process.env.DRIVE_FOLDER_GENERAL,
};

// Brands folder handled separately — not a skill channel
const BRANDS_FOLDER = process.env.DRIVE_FOLDER_BRANDS;

// --- Types ---

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

interface DriveFilesListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// MIME types to index as skills
const INDEXABLE_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'text/plain',
  'text/markdown',
]);

const FOLDER_MIME = 'application/vnd.google-apps.folder';

// --- Drive API helpers ---

/**
 * List all files in a folder, recursing into sub-folders.
 */
async function listFilesInFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  const subFolders: string[] = [];

  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,modifiedTime,size),nextPageToken',
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
        subFolders.push(file.id);
      } else {
        allFiles.push(file);
      }
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  // Recurse into sub-folders
  for (const subFolderId of subFolders) {
    const subFiles = await listFilesInFolder(subFolderId, accessToken);
    allFiles.push(...subFiles);
  }

  return allFiles;
}

// --- Main ---

async function main(): Promise<void> {
  // Resolve admin user
  const adminUserId = process.env.DRIVE_ADMIN_USER_ID;
  if (!adminUserId) {
    logError('DRIVE_ADMIN_USER_ID must be set in .env.local');
    process.exit(1);
  }

  // Get Google access token
  const accessToken = await getGoogleAccessToken(adminUserId);
  if (!accessToken) {
    logError('No Google access token found for admin user. Connect Google account in Settings.');
    process.exit(1);
  }

  log(`Starting Drive re-index for admin user: ${adminUserId}`);

  // Walk folders
  let totalFiles = 0;
  let totalUpserted = 0;
  let totalFolders = 0;

  for (const [channel, folderId] of Object.entries(FOLDER_CONFIG)) {
    if (!folderId) {
      log(`Skipping channel '${channel}' — env var not set`);
      continue;
    }

    log(`Walking folder '${channel}' (${folderId})...`);
    totalFolders++;

    let files: DriveFile[];
    try {
      files = await listFilesInFolder(folderId, accessToken);
    } catch (err) {
      logError(`Failed to list files in folder '${channel}'`, err);
      continue;
    }

    log(`  Found ${files.length} files in '${channel}'`);
    totalFiles += files.length;

    for (const file of files) {
      if (!INDEXABLE_MIME_TYPES.has(file.mimeType)) continue;

      try {
        await upsertSkillFromDrive({
          driveFileId: file.id,
          title: file.name,
          channel,
          driveModifiedAt: file.modifiedTime,
        });
        totalUpserted++;
      } catch (err) {
        logError(`Failed to upsert skill for file '${file.name}' (${file.id})`, err);
      }
    }
  }

  // Register watch channel if --watch flag passed
  let channelRegistered = false;
  if (WATCH) {
    const webhookUrl =
      process.env.DRIVE_WEBHOOK_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/drive/webhook`
        : null);

    if (!webhookUrl) {
      logError('Cannot register watch channel: set DRIVE_WEBHOOK_URL or VERCEL_PROJECT_PRODUCTION_URL');
    } else {
      log(`Registering watch channel at: ${webhookUrl}`);
      try {
        const channel = await registerWatchChannel(adminUserId, webhookUrl);
        log(`Watch channel registered:`);
        log(`  channelId:  ${channel.channelId}`);
        log(`  resourceId: ${channel.resourceId}`);
        log(`  expiration: ${new Date(channel.expiration).toISOString()}`);
        log(`  pageToken:  ${channel.pageToken}`);
        channelRegistered = true;
      } catch (err) {
        logError('Failed to register watch channel', err);
      }
    }
  }

  // Summary
  log('--- Re-index Summary ---');
  log(`  Folders walked:  ${totalFolders}`);
  log(`  Files found:     ${totalFiles}`);
  log(`  Skills upserted: ${totalUpserted}`);
  if (WATCH) {
    log(`  Watch channel:   ${channelRegistered ? 'registered' : 'FAILED'}`);
  }
  log('Re-index complete');
}

main().catch((err) => {
  logError('Unexpected error', err);
  process.exit(1);
});
