/**
 * Frame.io media I/O for the AI video-edit pipeline (plans/2026-10-03-frameio-ai-video-edits.md, Phase 1).
 *
 *  - downloadOriginal   original upload → local file (streams via curl; files are often 500MB+)
 *  - uploadLocalFile    local file → new Frame.io file in a folder (multi-part S3 PUTs)
 *  - stackNewVersion    put a new upload on top of an existing asset's version stack
 *  - listComments / createComment / setCommentCompleted
 *
 * V4 references (checked 3 Oct 2026, next.developer.frame.io):
 *  GET   /accounts/{a}/files/{id}?include=media_links.original
 *  GET   /accounts/{a}/version_stacks/{id}                 (head_version)
 *  POST  /accounts/{a}/folders/{folder}/files/local_upload  { name, file_size } → upload_urls[]
 *        each part: PUT, header x-amz-acl: private, Content-Type = media_type from the create response
 *  GET   /accounts/{a}/files/{id}/status                   (upload_complete)
 *  POST  /accounts/{a}/folders/{folder}/version_stacks     { file_ids: [oldest … newest] } (2–10 files)
 *  PATCH /accounts/{a}/files/{id}/move                     { parent_id: version_stack_id }
 *  POST  /accounts/{a}/folders/{folder}/folders            { name }
 *  GET   /accounts/{a}/files/{id}/comments
 *  POST  /accounts/{a}/files/{id}/comments                 { text, timestamp? }
 *  PATCH /accounts/{a}/comments/{id}                       { completed }
 * There is no public endpoint for threaded replies, so revision notes are posted as one summary comment.
 */
import { spawn } from 'child_process';
import { openSync, readSync, closeSync, statSync } from 'fs';
import { getResource, listAll, sendJson, type FrameioComment } from './client.js';

export const ACCOUNT_ID = '915ca91e-31fe-4f6a-bfb6-29e661cf1297';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Accept a bare id or any Frame.io URL (view links end with the asset / folder id). */
export function idFrom(input: string): string {
  const ids = input.match(UUID);
  if (!ids?.length) throw new Error(`No Frame.io id found in "${input}"`);
  return ids[ids.length - 1];
}

export interface AssetInfo {
  id: string;
  name: string;
  type: 'file' | 'version_stack' | string;
  parent_id: string | null;
  project_id: string;
  file_size?: number | null;
  media_type?: string | null;
  status?: string | null;
  view_url: string;
  head_version?: AssetInfo | null;
}

/** Resolve an id that may be a file or a version stack; for stacks the head (newest) version is returned too. */
export async function getAsset(id: string, accountId = ACCOUNT_ID): Promise<AssetInfo> {
  // A version stack id on the files endpoint returns 422 "is not a file" (not 404), so fall through on both.
  let file: AssetInfo | null = null;
  try {
    file = await getResource<AssetInfo>(`/accounts/${accountId}/files/${id}`);
  } catch (err) {
    if ((err as { status?: number }).status !== 422) throw err;
  }
  if (file) return file;
  const stack = await getResource<AssetInfo>(`/accounts/${accountId}/version_stacks/${id}`);
  if (stack) return { ...stack, type: 'version_stack' };
  throw new Error(`Frame.io asset ${id} not found (neither a file nor a version stack)`);
}

/** The file id whose media to use: the asset itself, or the head version of a stack. */
export function playableFileId(asset: AssetInfo): string {
  if (asset.type === 'version_stack') {
    if (!asset.head_version?.id) throw new Error(`Version stack "${asset.name}" has no head version`);
    return asset.head_version.id;
  }
  return asset.id;
}

export async function getOriginalUrl(fileId: string, accountId = ACCOUNT_ID): Promise<{ url: string; name: string; size: number | null }> {
  const f = await getResource<AssetInfo & { media_links?: { original?: { download_url?: string | null; url?: string | null } } }>(
    `/accounts/${accountId}/files/${fileId}?include=media_links.original`,
  );
  const url = f?.media_links?.original?.download_url ?? f?.media_links?.original?.url ?? null;
  if (!f || !url) throw new Error(`No original download link for file ${fileId} (still processing, or no access)`);
  return { url, name: f.name, size: f.file_size ?? null };
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

/** Download the original upload to `outPath` (curl: resumable, handles very large files). */
export async function downloadOriginal(fileId: string, outPath: string, accountId = ACCOUNT_ID): Promise<{ name: string; bytes: number }> {
  const { url, name, size } = await getOriginalUrl(fileId, accountId);
  await run('curl', ['-fsSL', '--retry', '3', '--retry-delay', '5', '-C', '-', '-o', outPath, url]);
  const bytes = statSync(outPath).size;
  if (size && bytes !== size) throw new Error(`Downloaded ${bytes} bytes but Frame.io reports ${size}`);
  return { name, bytes };
}

const CONTENT_TYPES: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

/** Create a file in `folderId` and upload `localPath` into it. Returns the new file. */
export async function uploadLocalFile(localPath: string, folderId: string, name: string, accountId = ACCOUNT_ID): Promise<AssetInfo> {
  const fileSize = statSync(localPath).size;
  const created = await sendJson<AssetInfo & { upload_urls: Array<{ size: number; url: string }> }>(
    'POST', `/accounts/${accountId}/folders/${folderId}/files/local_upload`, { data: { name, file_size: fileSize } },
  );
  if (!created?.upload_urls?.length) throw new Error('Frame.io did not return upload URLs');
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const contentType = created.media_type ?? CONTENT_TYPES[ext] ?? 'application/octet-stream';

  const fd = openSync(localPath, 'r');
  try {
    let offset = 0;
    for (const [i, part] of created.upload_urls.entries()) {
      const buf = Buffer.alloc(part.size);
      const read = readSync(fd, buf, 0, part.size, offset);
      offset += read;
      for (let attempt = 1; ; attempt += 1) {
        const res = await fetch(part.url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType, 'x-amz-acl': 'private' },
          body: buf.subarray(0, read),
        });
        if (res.ok) break;
        if (attempt >= 3) throw new Error(`Upload part ${i + 1}/${created.upload_urls.length} failed: HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if (offset !== fileSize) throw new Error(`Uploaded ${offset} of ${fileSize} bytes`);
  } finally {
    closeSync(fd);
  }

  // Wait for Frame.io to register the completed upload (it then transcodes in the background).
  for (let i = 0; i < 60; i += 1) {
    const s = await getResource<{ upload_complete?: boolean }>(`/accounts/${accountId}/files/${created.id}/status`);
    if (s?.upload_complete) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return created;
}

/**
 * Put `newFileId` on top of `existingId`'s version stack. If `existingId` is a lone file,
 * a new stack is created from [existing, new]; if it is already a stack, the file is moved into it.
 * Both must sit in the same folder (Frame.io requirement for creating a stack).
 */
export async function stackNewVersion(existingId: string, newFileId: string, accountId = ACCOUNT_ID): Promise<AssetInfo> {
  const existing = await getAsset(existingId, accountId);
  if (existing.type === 'version_stack') {
    await sendJson('PATCH', `/accounts/${accountId}/files/${newFileId}/move`, { data: { parent_id: existing.id } });
    return getAsset(existing.id, accountId);
  }
  if (!existing.parent_id) throw new Error(`Asset ${existingId} has no parent folder`);
  const stack = await sendJson<AssetInfo>('POST', `/accounts/${accountId}/folders/${existing.parent_id}/version_stacks`, {
    data: { file_ids: [existing.id, newFileId] },
  });
  if (!stack) throw new Error('Frame.io did not return the new version stack');
  return { ...stack, type: 'version_stack' };
}

/** A folder's name and parent (parent_id is null at the project root). */
export async function getFolder(id: string, accountId = ACCOUNT_ID): Promise<{ id: string; name: string; parent_id: string | null }> {
  const folder = await getResource<{ id: string; name: string; parent_id: string | null }>(`/accounts/${accountId}/folders/${id}`);
  if (!folder) throw new Error(`Frame.io folder ${id} not found`);
  return folder;
}

/** Folders from the asset's parent up to the project root, nearest first. */
export async function ancestorFolders(asset: { parent_id: string | null }, accountId = ACCOUNT_ID): Promise<Array<{ id: string; name: string }>> {
  const chain: Array<{ id: string; name: string }> = [];
  let next = asset.parent_id;
  for (let i = 0; next && i < 20; i += 1) {
    const f = await getFolder(next, accountId);
    chain.push({ id: f.id, name: f.name });
    next = f.parent_id;
  }
  return chain;
}

/** Walk (and create where missing) a folder path under a parent, matching names case-insensitively. Returns the last folder id. */
export async function ensureFolderPath(parentId: string, names: string[], accountId = ACCOUNT_ID): Promise<string> {
  let current = parentId;
  for (const name of names) {
    const children = await listAll<{ id: string; name: string; type: string }>(`/accounts/${accountId}/folders/${current}/children?page_size=100`);
    const found = children.find((c) => c.type === 'folder' && c.name.trim().toLowerCase() === name.trim().toLowerCase());
    current = found ? found.id : (await createFolder(current, name, accountId)).id;
  }
  return current;
}

/** Create a subfolder (e.g. a missing concept folder). Returns the new folder. */
export async function createFolder(parentFolderId: string, name: string, accountId = ACCOUNT_ID): Promise<AssetInfo> {
  const folder = await sendJson<AssetInfo>('POST', `/accounts/${accountId}/folders/${parentFolderId}/folders`, { data: { name } });
  if (!folder) throw new Error(`Frame.io did not return the new folder "${name}"`);
  return folder;
}

/** All comments on a file, oldest first. Timestamps are frame numbers (null for general comments). */
export async function listComments(fileId: string, accountId = ACCOUNT_ID): Promise<FrameioComment[]> {
  const all = await listAll<FrameioComment>(`/accounts/${accountId}/files/${fileId}/comments?page_size=100`);
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Post a comment. `timestampFrames` pins it to a frame; omit for a general comment. */
export async function createComment(fileId: string, text: string, timestampFrames?: number, accountId = ACCOUNT_ID): Promise<FrameioComment | null> {
  const data: Record<string, unknown> = { text };
  if (typeof timestampFrames === 'number') data.timestamp = Math.max(0, Math.round(timestampFrames));
  return sendJson<FrameioComment>('POST', `/accounts/${accountId}/files/${fileId}/comments`, { data });
}

export async function setCommentCompleted(commentId: string, completed = true, accountId = ACCOUNT_ID): Promise<void> {
  await sendJson('PATCH', `/accounts/${accountId}/comments/${commentId}`, { data: { completed } });
}
