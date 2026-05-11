/**
 * Whisper-backed transcription for Frame.io video assets.
 *
 * Two-step pipeline (commit 6 lands step 1; commit 7 lands step 2):
 *   1. fetchFileWithMediaLinks() — pulls /v4/accounts/:id/files/:id with
 *      ?include=media_links, picks the smallest available rendition.
 *      downloadToBuffer() streams it into a 25MB-capped Buffer.
 *   2. whisperTranscribe() — POSTs the buffer to OpenAI's audio API.
 *
 * Results are cached forever in `frameio_transcripts` (PK on file_id) so
 * repeated Generate clicks don't re-pay the Whisper bill. Errors are
 * persisted too — on the assumption that a 25MB-too-large or 404 won't
 * fix itself, we don't retry on the next click.
 */
import { db } from '../queries/base.js';
import { FrameioApiError } from './client.js';
import { getValidAccessToken } from './auth.js';

const BASE_URL = 'https://api.frame.io/v4';
const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper API limit

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_transcripts (
      frameio_file_id TEXT PRIMARY KEY,
      transcript TEXT,
      language TEXT,
      duration_seconds INTEGER,
      source TEXT NOT NULL,
      error TEXT,
      bytes_processed INTEGER,
      generated_at TEXT NOT NULL
    )
  `);
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_frameio_transcripts_generated ON frameio_transcripts(generated_at)`); } catch { /* exists */ }
  schemaEnsured = true;
}

// ---------------------------------------------------------------------------
// Frame.io download
// ---------------------------------------------------------------------------

/**
 * V4 file response with media_links populated. The exact shape under
 * `media_links` is API-version dependent; we tolerate several common
 * shapes by typing it loosely and probing in pickSmallestRendition.
 */
export interface FileWithMediaLinks {
  id: string;
  name: string;
  file_size?: number | null;
  media_type?: string | null;
  media_links?: Record<string, MediaLink | MediaLink[] | undefined> | null;
  /** Some V4 responses expose `original` at the top level. */
  original?: MediaLink | null;
}

export interface MediaLink {
  url?: string | null;
  /** Some renditions report download_url instead. */
  download_url?: string | null;
  size?: number | null;
  filesize?: number | null;
  file_size?: number | null;
  type?: string | null;
  /** e.g. 'mp4_540p', 'mp3', 'm4a' */
  format?: string | null;
}

export interface PickedRendition {
  url: string;
  bytes: number | null;
  format: string;
  /** True when this rendition is audio-only (much cheaper to transcribe). */
  audioOnly: boolean;
}

/**
 * Fetch a Frame.io file with rendition media_links.
 *
 * The exact V4 field names for renditions are not stable across the
 * V4 alpha period; we log the raw shape on first run so we can adapt
 * if it changes underneath us.
 */
export async function fetchFileWithMediaLinks(
  accountId: string,
  fileId: string,
): Promise<FileWithMediaLinks | null> {
  const token = await getValidAccessToken();
  const url = `${BASE_URL}/accounts/${accountId}/files/${fileId}?include=media_links`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FrameioApiError(res.status, url, body);
  }
  const json = (await res.json()) as { data?: FileWithMediaLinks } | FileWithMediaLinks;
  return ((json as { data?: FileWithMediaLinks }).data ?? (json as FileWithMediaLinks)) ?? null;
}

/** Best-effort byte-count extraction from a MediaLink in unknown shape. */
function linkBytes(link: MediaLink): number | null {
  return link.size ?? link.filesize ?? link.file_size ?? null;
}

/** Best-effort URL extraction. */
function linkUrl(link: MediaLink): string | null {
  return link.url ?? link.download_url ?? null;
}

/**
 * Pick the smallest viable rendition for Whisper, preferring audio.
 * Returns null if we can't find anything we can download.
 */
export function pickSmallestRendition(file: FileWithMediaLinks): PickedRendition | null {
  const candidates: Array<{ link: MediaLink; format: string; audioOnly: boolean }> = [];

  const isAudioFormat = (f: string | null | undefined): boolean => {
    const s = (f ?? '').toLowerCase();
    return s.includes('mp3') || s.includes('m4a') || s.includes('audio') || s.includes('wav') || s.includes('aac');
  };

  // Walk media_links — values may be MediaLink, MediaLink[], or nested.
  if (file.media_links) {
    for (const [key, val] of Object.entries(file.media_links)) {
      if (!val) continue;
      const items: MediaLink[] = Array.isArray(val) ? val : [val];
      for (const item of items) {
        if (!linkUrl(item)) continue;
        const format = item.format ?? key;
        candidates.push({ link: item, format, audioOnly: isAudioFormat(format) || isAudioFormat(item.type) });
      }
    }
  }
  if (file.original && linkUrl(file.original)) {
    candidates.push({ link: file.original, format: file.original.format ?? 'original', audioOnly: false });
  }

  if (candidates.length === 0) return null;

  // Sort: audio first, then smallest byte count, with unknown sizes pushed last.
  candidates.sort((a, b) => {
    if (a.audioOnly !== b.audioOnly) return a.audioOnly ? -1 : 1;
    const aB = linkBytes(a.link) ?? Number.POSITIVE_INFINITY;
    const bB = linkBytes(b.link) ?? Number.POSITIVE_INFINITY;
    return aB - bB;
  });

  const winner = candidates[0];
  const url = linkUrl(winner.link)!;
  return { url, bytes: linkBytes(winner.link), format: winner.format, audioOnly: winner.audioOnly };
}

/**
 * Stream a URL into a Buffer, refusing once we cross the 25MB Whisper limit.
 *
 * We don't know the content length in advance for every rendition — some
 * Frame.io download endpoints serve chunked responses without it — so the
 * cap is enforced as we go. Anything over the limit returns ok:false so
 * the caller can persist a row and skip future retries.
 */
export async function downloadToBuffer(
  downloadUrl: string,
): Promise<{ ok: true; buffer: Buffer; bytes: number } | { ok: false; reason: 'too_large_for_whisper' | 'download_failed'; detail: string }> {
  let res: Response;
  try {
    res = await fetch(downloadUrl);
  } catch (err) {
    return { ok: false, reason: 'download_failed', detail: (err as Error).message ?? String(err) };
  }
  if (!res.ok) {
    return { ok: false, reason: 'download_failed', detail: `HTTP ${res.status}` };
  }

  // If Content-Length is reported and over cap, bail without streaming.
  const lenHeader = res.headers.get('content-length');
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > MAX_BYTES) {
      return { ok: false, reason: 'too_large_for_whisper', detail: `${len} bytes > ${MAX_BYTES}` };
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return { ok: false, reason: 'download_failed', detail: 'no response body' };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return { ok: false, reason: 'too_large_for_whisper', detail: `${total} bytes > ${MAX_BYTES}` };
    }
    chunks.push(value);
  }

  return { ok: true, buffer: Buffer.concat(chunks), bytes: total };
}

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

export interface CachedTranscript {
  fileId: string;
  transcript: string | null;
  language: string | null;
  durationSeconds: number | null;
  source: string;
  error: string | null;
  bytesProcessed: number | null;
  generatedAt: string;
}

interface CachedRow {
  frameio_file_id: string;
  transcript: string | null;
  language: string | null;
  duration_seconds: number | null;
  source: string;
  error: string | null;
  bytes_processed: number | null;
  generated_at: string;
}

/**
 * Batched membership check: returns the set of file_ids that already have
 * a non-null cached transcript. Used by the dashboard to swap the
 * Generate button's spinner copy for video assets.
 */
export async function getCachedTranscriptFileIds(fileIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (fileIds.length === 0) return out;
  await ensureSchema();
  const unique = Array.from(new Set(fileIds));
  const placeholders = unique.map(() => '?').join(',');
  try {
    const r = await db.execute({
      sql: `SELECT frameio_file_id FROM frameio_transcripts
             WHERE frameio_file_id IN (${placeholders})
               AND transcript IS NOT NULL`,
      args: unique,
    });
    for (const row of r.rows) {
      out.add(String((row as unknown as { frameio_file_id: string }).frameio_file_id));
    }
  } catch {
    /* table missing — empty set */
  }
  return out;
}

export async function getCachedTranscript(fileId: string): Promise<CachedTranscript | null> {
  await ensureSchema();
  try {
    const r = await db.execute({
      sql: `SELECT frameio_file_id, transcript, language, duration_seconds,
                   source, error, bytes_processed, generated_at
              FROM frameio_transcripts WHERE frameio_file_id = ?`,
      args: [fileId],
    });
    const row = r.rows[0] as unknown as CachedRow | undefined;
    if (!row) return null;
    return {
      fileId: row.frameio_file_id,
      transcript: row.transcript,
      language: row.language,
      durationSeconds: row.duration_seconds,
      source: row.source,
      error: row.error,
      bytesProcessed: row.bytes_processed,
      generatedAt: row.generated_at,
    };
  } catch {
    return null;
  }
}

export async function upsertTranscript(input: {
  fileId: string;
  transcript: string | null;
  language: string | null;
  durationSeconds: number | null;
  source: string;
  error: string | null;
  bytesProcessed: number | null;
}): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO frameio_transcripts
            (frameio_file_id, transcript, language, duration_seconds, source, error, bytes_processed, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(frameio_file_id) DO UPDATE SET
            transcript = excluded.transcript,
            language = excluded.language,
            duration_seconds = excluded.duration_seconds,
            source = excluded.source,
            error = excluded.error,
            bytes_processed = excluded.bytes_processed,
            generated_at = excluded.generated_at`,
    args: [
      input.fileId,
      input.transcript,
      input.language,
      input.durationSeconds,
      input.source,
      input.error,
      input.bytesProcessed,
      now,
    ],
  });
}

// ---------------------------------------------------------------------------
// Whisper
// ---------------------------------------------------------------------------

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-1';

interface WhisperVerboseJson {
  text: string;
  language?: string;
  duration?: number;
}

export async function whisperTranscribe(
  buffer: Buffer,
  filename: string,
): Promise<{ ok: true; text: string; language: string | null; durationSeconds: number | null }
  | { ok: false; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: 'openai_key_missing' };

  const form = new FormData();
  // Use a Blob so the multipart payload carries the filename + content type.
  // Node 20 has global FormData / Blob.
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' }),
    filename || 'audio',
  );
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  // Hard-coded English for now — every Vendo client speaks English in their
  // ads. Revisit if/when we onboard a non-English market.
  form.append('language', 'en');

  let res: Response;
  try {
    res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    return { ok: false, reason: `network: ${(err as Error).message ?? String(err)}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, reason: `whisper_http_${res.status}: ${body.slice(0, 240)}` };
  }

  let json: WhisperVerboseJson;
  try {
    json = (await res.json()) as WhisperVerboseJson;
  } catch (err) {
    return { ok: false, reason: `whisper_parse: ${(err as Error).message ?? String(err)}` };
  }

  return {
    ok: true,
    text: (json.text ?? '').trim(),
    language: json.language ?? null,
    durationSeconds: typeof json.duration === 'number' ? Math.round(json.duration) : null,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface GetTranscriptOptions {
  /** Skip the cache check and re-transcribe even if a row exists. */
  regenerate?: boolean;
}

export type TranscriptResult =
  | { ok: true; transcript: string; language: string | null; durationSeconds: number | null; source: string; cached: boolean }
  | { ok: false; reason: string; cached: boolean };

/**
 * Cache-first transcript retrieval.
 *
 * Returns the existing row when present (whether success or error — we
 * persist errors to prevent retry storms on a permanently-broken asset).
 * On cache miss: fetch media_links → pick rendition → download to buffer →
 * call Whisper → upsert.
 *
 * Pass { regenerate: true } from an admin "refresh transcript" link.
 */
export async function getOrCreateTranscript(
  accountId: string,
  fileId: string,
  options: GetTranscriptOptions = {},
): Promise<TranscriptResult> {
  if (!options.regenerate) {
    const cached = await getCachedTranscript(fileId);
    if (cached) {
      if (cached.transcript) {
        return {
          ok: true,
          transcript: cached.transcript,
          language: cached.language,
          durationSeconds: cached.durationSeconds,
          source: cached.source,
          cached: true,
        };
      }
      if (cached.error) {
        return { ok: false, reason: cached.error, cached: true };
      }
    }
  }

  let file: FileWithMediaLinks | null;
  try {
    file = await fetchFileWithMediaLinks(accountId, fileId);
  } catch (err) {
    const reason = (err as Error).message ?? String(err);
    await upsertTranscript({ fileId, transcript: null, language: null, durationSeconds: null, source: 'whisper-1', error: reason, bytesProcessed: null });
    return { ok: false, reason, cached: false };
  }
  if (!file) {
    const reason = 'file_not_found_or_no_access';
    await upsertTranscript({ fileId, transcript: null, language: null, durationSeconds: null, source: 'whisper-1', error: reason, bytesProcessed: null });
    return { ok: false, reason, cached: false };
  }

  const rendition = pickSmallestRendition(file);
  if (!rendition) {
    // Log full shape so we can adapt if V4 changes media_links structure.
    console.warn('[frameio.transcribe] no rendition picked', JSON.stringify({ fileId, name: file.name, media_links: file.media_links }).slice(0, 600));
    const reason = 'no_rendition_available';
    await upsertTranscript({ fileId, transcript: null, language: null, durationSeconds: null, source: 'whisper-1', error: reason, bytesProcessed: null });
    return { ok: false, reason, cached: false };
  }

  const downloaded = await downloadToBuffer(rendition.url);
  if (!downloaded.ok) {
    const reason = `${downloaded.reason}: ${downloaded.detail}`;
    await upsertTranscript({ fileId, transcript: null, language: null, durationSeconds: null, source: 'whisper-1', error: reason, bytesProcessed: null });
    return { ok: false, reason, cached: false };
  }

  const whisper = await whisperTranscribe(downloaded.buffer, `${file.name || fileId}.${rendition.format || 'bin'}`);
  if (!whisper.ok) {
    await upsertTranscript({ fileId, transcript: null, language: null, durationSeconds: null, source: 'whisper-1', error: whisper.reason, bytesProcessed: downloaded.bytes });
    return { ok: false, reason: whisper.reason, cached: false };
  }

  await upsertTranscript({
    fileId,
    transcript: whisper.text,
    language: whisper.language,
    durationSeconds: whisper.durationSeconds,
    source: 'whisper-1',
    error: null,
    bytesProcessed: downloaded.bytes,
  });
  return {
    ok: true,
    transcript: whisper.text,
    language: whisper.language,
    durationSeconds: whisper.durationSeconds,
    source: 'whisper-1',
    cached: false,
  };
}
