import type { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  size?: string;
  webViewLink?: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface OAuthKeys {
  installed: {
    client_id: string;
    client_secret: string;
    token_uri: string;
  };
}

const CREDENTIALS_PATH = process.env.GDRIVE_CREDENTIALS_PATH
  || resolve(process.cwd(), '.secrets/.gdrive-server-credentials.json');
const OAUTH_PATH = process.env.GDRIVE_OAUTH_PATH
  || resolve(process.cwd(), '.secrets/gcp-oauth.keys.json');

async function getAccessToken(): Promise<string> {
  const tokenData: TokenData = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const oauthKeys: OAuthKeys = JSON.parse(readFileSync(OAUTH_PATH, 'utf-8'));

  // If token is still valid (with 60s buffer), use it
  if (tokenData.expiry_date > Date.now() + 60_000) {
    return tokenData.access_token;
  }

  // Refresh the token
  const res = await fetch(oauthKeys.installed.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauthKeys.installed.client_id,
      client_secret: oauthKeys.installed.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await res.json() as { access_token: string; expires_in: number };
  // Update stored credentials
  const updated = {
    ...tokenData,
    access_token: refreshed.access_token,
    expiry_date: Date.now() + refreshed.expires_in * 1000,
  };

  const { writeFileSync } = await import('fs');
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(updated), 'utf-8');

  return refreshed.access_token;
}

const MIME_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Doc',
  'application/vnd.google-apps.spreadsheet': 'Sheet',
  'application/vnd.google-apps.presentation': 'Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/vnd.google-apps.form': 'Form',
  'application/pdf': 'PDF',
  'image/png': 'Image',
  'image/jpeg': 'Image',
  'video/mp4': 'Video',
};

function mimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] || 'File';
}

function driveLink(file: DriveFile): string {
  if (file.webViewLink) return file.webViewLink;
  if (file.mimeType === 'application/vnd.google-apps.folder') {
    return `https://drive.google.com/drive/folders/${file.id}`;
  }
  return `https://drive.google.com/file/d/${file.id}/view`;
}

function formatSize(bytes?: string): string {
  if (!bytes) return '';
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const driveRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const search = q.search?.trim() || '';
    const type = q.type || '';
    const pageToken = q.pageToken || '';

    let apiUrl = 'https://www.googleapis.com/drive/v3/files?'
      + 'pageSize=30'
      + '&orderBy=modifiedTime%20desc'
      + '&fields=files(id,name,mimeType,modifiedTime,owners,size,webViewLink),nextPageToken';

    // Build query filter
    const queryParts: string[] = ['trashed=false'];
    if (search) {
      queryParts.push(`fullText contains '${search.replace(/'/g, "\\'")}'`);
    }
    if (type) {
      const mimeMap: Record<string, string> = {
        doc: 'application/vnd.google-apps.document',
        sheet: 'application/vnd.google-apps.spreadsheet',
        slides: 'application/vnd.google-apps.presentation',
        folder: 'application/vnd.google-apps.folder',
        pdf: 'application/pdf',
        video: 'video/mp4',
      };
      if (mimeMap[type]) {
        queryParts.push(`mimeType='${mimeMap[type]}'`);
      }
    }
    apiUrl += '&q=' + encodeURIComponent(queryParts.join(' and '));
    if (pageToken) apiUrl += '&pageToken=' + encodeURIComponent(pageToken);

    let files: DriveFile[] = [];
    let nextPageToken = '';
    let error = '';

    try {
      const token = await getAccessToken();
      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.text();
        error = `Google Drive API error (${res.status}): ${errBody.slice(0, 200)}`;
      } else {
        const data = await res.json() as { files: DriveFile[]; nextPageToken?: string };
        files = data.files || [];
        nextPageToken = data.nextPageToken || '';
      }
    } catch (e: unknown) {
      error = `Failed to connect to Google Drive: ${(e as Error).message}`;
    }

    const templateData = {
      files,
      nextPageToken,
      error,
      search,
      type,
      mimeLabel,
      driveLink,
      formatSize,
    };

    if (request.headers['hx-request']) {
      reply.render('drive-results', templateData);
      return;
    }

    reply.render('drive', templateData);
  });
};
