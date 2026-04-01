import type { FastifyPluginAsync } from 'fastify';
import { getGoogleAccessToken } from '../lib/google-tokens.js';
import type { SessionUser } from '../lib/auth.js';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  size?: string;
  webViewLink?: string;
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
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    // Check if user has connected their Google account
    let token: string | null = null;
    try {
      token = await getGoogleAccessToken(user.id);
    } catch (e) {
      console.error('[Drive] Token error:', (e as Error).message);
    }
    if (!token) {
      reply.render('drive', {
        files: [],
        nextPageToken: '',
        error: '',
        search: '',
        type: '',
        notConnected: true,
        mimeLabel,
        driveLink,
        formatSize,
      });
      return;
    }

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
      notConnected: false,
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
