import { parseShootDate } from '../frameio/folder-audit.js';

/**
 * Which folder is the shoot folder for a raw clip, given the clip's ancestor folders (nearest first).
 * The SOP keeps raw clips under "<shoot folder> / Raw Footage / …", so the parent of "Raw Footage" wins;
 * otherwise the nearest dated shoot folder ("October 3rd 2026 | Paid Ads & Organic Content").
 */
export function pickShootFolder(ancestors: Array<{ id: string; name: string }>): string | null {
  const raw = ancestors.findIndex((a) => /^(raw footage|raws?|raw files)$/i.test(a.name.trim()));
  if (raw >= 0 && ancestors[raw + 1]) return ancestors[raw + 1].id;
  return ancestors.find((a) => parseShootDate(a.name))?.id ?? null;
}
