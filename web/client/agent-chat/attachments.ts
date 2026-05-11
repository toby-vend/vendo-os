/**
 * File-attachment helpers for the chat input.
 *
 * The send path serialises images as data-URIs so we don't need any
 * upstream storage today. Vercel serverless requests are capped at ~4.5MB
 * including all headers and bodies — we cap user-attached payload at 4MB
 * total so the rest of the body has headroom.
 */

export const MAX_TOTAL_BYTES = 4_000_000;
export const PASTE_AS_SNIPPET_THRESHOLD = 300; // chars

export type AttachmentStatus = 'pending' | 'ready' | 'too-large';

export interface AttachedFile {
  id: string;
  file: File;
  kind: 'image' | 'doc';
  /** ObjectURL for images so we can preview; null for non-images. */
  preview: string | null;
  /** Lazily populated once readAsDataURL finishes. */
  dataUri: string | null;
  status: AttachmentStatus;
}

export interface PastedSnippet {
  id: string;
  content: string;
  createdAt: string; // ISO
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const IMAGE_TYPE_PATTERN = /^image\//;
const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp|svg|bmp|heic|heif)$/i;

export function isImage(file: File): boolean {
  return IMAGE_TYPE_PATTERN.test(file.type) || IMAGE_EXT_PATTERN.test(file.name);
}

/**
 * Build an AttachedFile entry from a raw File. Preview URL is generated
 * synchronously for images; the dataUri is read asynchronously by the
 * caller via `readAsDataUri()` once the file is staged.
 */
export function prepareAttachment(file: File): AttachedFile {
  const image = isImage(file);
  return {
    id: newId(),
    file,
    kind: image ? 'image' : 'doc',
    preview: image ? URL.createObjectURL(file) : null,
    dataUri: null,
    status: 'pending',
  };
}

/**
 * Resolve to the base64 data-URI for an attachment. Used at send-time to
 * package the file into the JSON request body.
 */
export function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns the cumulative payload size in bytes for a batch of attachments.
 * Used to enforce MAX_TOTAL_BYTES before send and to render a soft warning
 * in the UI.
 */
export function totalAttachedBytes(files: AttachedFile[]): number {
  return files.reduce((sum, f) => sum + f.file.size, 0);
}
