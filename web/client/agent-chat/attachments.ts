/**
 * File-attachment helpers for the chat input.
 *
 * The send path serialises images as data-URIs so we don't need any
 * upstream storage. Vercel serverless requests cap at ~4.5MB including
 * headers — we cap user-attached payload at 4MB total for headroom.
 */

export const MAX_TOTAL_BYTES = 4_000_000;
export const PASTE_AS_SNIPPET_THRESHOLD = 300; // chars

export type AttachmentStatus = 'pending' | 'ready' | 'too-large';

export interface AttachedFile {
  id: string;
  file: File;
  kind: 'image' | 'doc';
  /** ObjectURL for images so we can preview if we ever want one. */
  preview: string | null;
  /** Lazily populated by readAsDataUri after the file is staged. */
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

export function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export function totalAttachedBytes(files: AttachedFile[]): number {
  return files.reduce((sum, f) => sum + f.file.size, 0);
}
