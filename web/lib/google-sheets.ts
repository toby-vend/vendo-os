/**
 * Minimal Google Sheets v4 client.
 *
 * Raw fetch, no googleapis dependency — same approach as the Google Ads and
 * GSC syncs (see web/lib/jobs/sync-google-ads.ts:mintAccessToken).
 *
 * Auth: GOOGLE_SHEETS_REFRESH_TOKEN, minted by scripts/auth/google-sheets-auth.ts.
 * Kept separate from GOOGLE_ADS_REFRESH_TOKEN so the two scopes can be
 * re-consented independently.
 */

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetMeta {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

/** A single cell write, in A1 notation including the sheet name. */
export interface CellWrite {
  range: string;
  value: string | number;
}

export async function mintSheetsAccessToken(): Promise<string> {
  // .trim() defends against trailing newlines in env values — Vercel and
  // .env files both occasionally preserve one, and Google's token endpoint
  // rejects it as "invalid_client".
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_SHEETS_REFRESH_TOKEN must be set',
    );
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets token refresh failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

/** Tab metadata for the whole spreadsheet. No cell data — cheap. */
export async function listSheets(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetMeta[]> {
  const url = `${BASE_URL}/${spreadsheetId}?fields=sheets.properties`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets metadata failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as {
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };
  return (data.sheets ?? []).map((s) => ({
    sheetId: s.properties?.sheetId ?? -1,
    title: s.properties?.title ?? '',
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    columnCount: s.properties?.gridProperties?.columnCount ?? 0,
  }));
}

/**
 * Read a range as a dense string grid.
 *
 * The values API omits trailing empty cells, so rows come back ragged. We pad
 * to the widest row: the column-index arithmetic downstream depends on every
 * row being the same length.
 *
 * Merged cells carry their value only in the top-left cell of the merge; the
 * rest read as ''. That is what makes the merged month headers land on the
 * "AM Hrs" column rather than spanning both — findMonthColumns relies on it.
 */
export async function readGrid(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const url =
    `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
    `?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets read failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { values?: unknown[][] };
  const rows = (data.values ?? []).map((r) => r.map((c) => (c == null ? '' : String(c))));
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => (r.length === width ? r : [...r, ...Array(width - r.length).fill('')]));
}

/** Write specific cells. RAW so "2.5" lands as a number, not a formula. */
export async function batchUpdateValues(
  accessToken: string,
  spreadsheetId: string,
  writes: CellWrite[],
): Promise<number> {
  if (writes.length === 0) return 0;
  const resp = await fetch(`${BASE_URL}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: writes.map((w) => ({ range: w.range, values: [[w.value]] })),
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Sheets write failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { totalUpdatedCells?: number };
  return data.totalUpdatedCells ?? 0;
}

/** 0-based column index → A1 letters (0 → A, 26 → AA). */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/** Quote a tab name for A1 notation. Sheets escapes ' by doubling it. */
export function quoteSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}
