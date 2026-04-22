import { put } from '@vercel/blob';
import crypto from 'crypto';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_FILES_PER_DRAFT = 6;

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
 * Upload a validated image to Vercel Blob. Returns the public URL and pathname.
 *
 * Uses `access: 'public'` because blob URLs include a random unguessable suffix
 * and the content is scoped to internal team suggestions. If stricter isolation
 * is ever needed, switch to access: 'private' and sign URLs on demand.
 */
export async function uploadImage(params: {
  sessionId: string;
  filename: string | null;
  image: ValidatedImage;
}): Promise<{ url: string; pathname: string }> {
  const suffix = crypto.randomBytes(4).toString('hex');
  const base = safeFilenameBase(params.filename) || 'screenshot';
  const pathname = `suggestions/${params.sessionId}/${base}-${suffix}.${params.image.extension}`;

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
