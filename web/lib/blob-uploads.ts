/**
 * Shared image upload helper — validates a buffer's magic-number signature
 * and uploads to Vercel Blob with a caller-supplied path prefix.
 *
 * Used by both `suggestions-uploads.ts` (suggestion screenshots) and
 * `reports.ts` (client report performance screenshots). Anything with the
 * same PNG/JPEG/WebP requirement should use this rather than rolling its own.
 */
import { put } from '@vercel/blob';
import crypto from 'crypto';

// 4MB — Vercel serverless functions cap request bodies at ~4.5MB by default,
// so anything over this would 413 before reaching the handler.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export interface ValidatedImage {
  contentType: AllowedContentType;
  bytes: Buffer;
  extension: 'png' | 'jpg' | 'webp';
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

/**
 * Validate an uploaded file by inspecting its first bytes (magic number) rather
 * than trusting the client-supplied Content-Type. Rejects anything that isn't
 * a PNG, JPEG, or WebP.
 */
export function validateImageBuffer(buffer: Buffer): ValidatedImage {
  if (buffer.length === 0) {
    throw new UploadValidationError('File is empty.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new UploadValidationError(`File exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit.`);
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { contentType: 'image/png', bytes: buffer, extension: 'png' };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', bytes: buffer, extension: 'jpg' };
  }

  // WebP: 'RIFF'....'WEBP'
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { contentType: 'image/webp', bytes: buffer, extension: 'webp' };
  }

  throw new UploadValidationError('Only PNG, JPEG, and WebP images are supported.');
}

/**
 * Upload a validated image to Vercel Blob.
 *
 * Path layout: `{pathPrefix}/{base}-{8hex}.{ext}` — e.g.
 *   `suggestions/abc-123/screenshot-fa1b2c3d.png`
 *   `reports/42/google_ads-9e8d7c6b.png`
 *
 * `access: 'public'` is intentional — blob URLs include an unguessable suffix
 * and content is non-sensitive (internal team-authored screenshots / reports).
 */
export async function uploadImage(params: {
  pathPrefix: string;
  filename: string | null;
  image: ValidatedImage;
}): Promise<{ url: string; pathname: string }> {
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = safeFilenameBase(params.filename) || 'screenshot';
  const cleanPrefix = params.pathPrefix.replace(/^\/+|\/+$/g, '');
  const pathname = `${cleanPrefix}/${base}-${suffix}.${params.image.extension}`;

  const blob = await put(pathname, params.image.bytes, {
    access: 'public',
    contentType: params.image.contentType,
    addRandomSuffix: false,
  });

  return { url: blob.url, pathname: blob.pathname };
}

function safeFilenameBase(name: string | null): string {
  if (!name) return '';
  const stripped = name.replace(/\.[^.]+$/, '');
  return stripped.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
}

// ── CSV uploads (campaign data exports) ─────────────────────────────────────

// CSVs are tiny relative to images; keep a tight cap so a stray binary doesn't
// bloat the DB / prompt. ~2MB of CSV is tens of thousands of rows.
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
// Cap the text we persist + feed to the AI (a campaign export is well under this).
export const MAX_CSV_TEXT_CHARS = 60_000;

export interface ValidatedCsv {
  /** UTF-8 text, trimmed to MAX_CSV_TEXT_CHARS. */
  text: string;
  /** Whether the text was truncated to fit the cap. */
  truncated: boolean;
}

/** Treat an upload as a CSV when its filename ends .csv or .tsv/.txt. */
export function looksLikeCsvFilename(name: string | null): boolean {
  return !!name && /\.(csv|tsv|txt)$/i.test(name.trim());
}

/**
 * Validate an uploaded CSV by confirming it is non-empty UTF-8 text (no binary
 * NUL bytes) within the size cap. We do not enforce a strict schema — campaign
 * exports vary — only that it's readable text the AI can parse.
 */
export function validateCsvBuffer(buffer: Buffer): ValidatedCsv {
  if (buffer.length === 0) throw new UploadValidationError('CSV file is empty.');
  if (buffer.length > MAX_CSV_BYTES) {
    throw new UploadValidationError(`CSV exceeds ${MAX_CSV_BYTES / 1024 / 1024}MB limit.`);
  }
  // Reject binary content masquerading as CSV (NUL byte in the first 8KB).
  const head = buffer.subarray(0, 8192);
  if (head.includes(0x00)) {
    throw new UploadValidationError('That doesn’t look like a CSV — it appears to be a binary file.');
  }
  const raw = buffer.toString('utf8').replace(/\r\n/g, '\n').trim();
  if (!raw) throw new UploadValidationError('CSV file has no readable content.');
  const truncated = raw.length > MAX_CSV_TEXT_CHARS;
  return { text: truncated ? raw.slice(0, MAX_CSV_TEXT_CHARS) : raw, truncated };
}

/**
 * Upload raw CSV bytes to Vercel Blob (text/csv) so the team can re-download
 * the original export. The parsed text is stored separately in the DB for the
 * AI; this is purely the source-of-truth file.
 */
export async function uploadCsv(params: {
  pathPrefix: string;
  filename: string | null;
  bytes: Buffer;
}): Promise<{ url: string; pathname: string }> {
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = safeFilenameBase(params.filename) || 'campaign-data';
  const cleanPrefix = params.pathPrefix.replace(/^\/+|\/+$/g, '');
  const pathname = `${cleanPrefix}/${base}-${suffix}.csv`;

  const blob = await put(pathname, params.bytes, {
    access: 'public',
    contentType: 'text/csv',
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
}
