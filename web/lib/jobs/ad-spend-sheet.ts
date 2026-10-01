/**
 * Meta ad spend → Google Sheet — the "Paid Social Clients" tab of the
 * deliverables tracker. Runs on the 1st of the month, alongside the hours job.
 *
 * Each client row gets one cell per month holding that month's total Meta
 * spend, in GBP. The tab's month headers are real dates (format "mmmm yy"),
 * one column per month, running left to right.
 *
 * What a run does:
 *   1. Any completed month newer than the last month column is added as a new
 *      column (backfilling every gap, not just last month), formatted to
 *      match, with the over/on-budget conditional formatting extended to it.
 *   2. During the month-end close window (days 1–5 by default) last month's
 *      column is restated, so spend Meta posts late still lands.
 *   3. Otherwise nothing is fetched or written.
 * The current, incomplete month is never written.
 *
 * Spend is converted to GBP at the month's average ECB rate (Frankfurter) —
 * Dentistry.ie bills in EUR, Veltuff in DKK, Iconic Dent in USD (Toby,
 * 2026-10-01: "convert all to GBP").
 *
 * Ad accounts are matched to rows by name. Multi-account groups (Dentistry.ie,
 * Kana Health) are listed explicitly in GROUP_RULES and summed. Anything with
 * spend that matches no row is reported, never guessed at.
 *
 * Auth: META_ACCESS_TOKEN must be a token that can see every client ad
 * account — a Business Manager system user token with ads_read, assigned to
 * each account. /me/adaccounts is used so a personal token works too.
 */
import { consoleLog } from '../monitors/base.js';
import {
  mintSheetsAccessToken,
  listSheets,
  readGrid,
  batchUpdateValues,
  batchUpdateSpreadsheet,
  getConditionalFormats,
  columnLetter,
  quoteSheetName,
  type CellWrite,
  type ConditionalFormatRule,
} from '../google-sheets.js';
import { normaliseClient, resolveClient, previousMonth } from './deliverables-hours-sheet.js';

const LOG_SOURCE = 'ad-spend-sheet';

const META_BASE = 'https://graph.facebook.com/v21.0';
const FX_BASE = 'https://api.frankfurter.dev/v1';

/** The "Paid Social Clients" tab. Override with AD_SPEND_SHEET_GID. */
const DEFAULT_TAB_GID = 1398305263;

/** Sheets date serials count days from 1899-12-30. */
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** Header number format, matching the existing month columns. */
const HEADER_FORMAT = { type: 'DATE', pattern: 'mmmm" "yy' };
const SPEND_FORMAT = { type: 'CURRENCY', pattern: '[$£-809]#,##0.00' };

/**
 * Clients whose spend is split across several ad accounts. Checked before
 * name matching, so these accounts never fall through to a fuzzy match.
 */
export const GROUP_RULES: Array<{
  row: string;
  match: (account: MetaAccount) => boolean;
}> = [
  // Ravensdale Dental Group runs one EUR account per practice, all "RDG - …".
  { row: 'Ravensdale Dental Group - Dentistry.ie', match: (a) => /^RDG\b/i.test(a.name.trim()) },
  // Kana Health: group account plus the five practices (OH/MK/WH/WS/EB).
  {
    row: 'Kana Health',
    match: (a) =>
      [
        '974870937223229', // Kana Health Group Ad Account
        '144068806258342', // Oxford House Dental Practice
        '3023686887933343', // MK Smiles
        '495585565982099', // Wilson House
        '841095773785601', // Woburn Sands
        '130564456676139', // Edward Byrnes
      ].includes(a.account_id),
  },
];

/** Ad accounts that are never client spend. */
const EXCLUDED_ACCOUNT_IDS = new Set([
  '1915275659298894', // Vendo Digital — our own advertising
  '231562525', // Toby Raeburn — personal account
]);

export interface MetaAccount {
  account_id: string;
  name: string;
  currency: string;
}

export interface AdSpendSheetOptions {
  /** Restate (or add, if it is the next one) a single month, as YYYY-MM. */
  month?: string;
  /** Compute and report the writes without sending them. */
  dryRun?: boolean;
}

export interface RowSpend {
  account: string;
  row: number;
  gbp: number;
  /** "Account name (CUR 1,234.56)" for every account summed into the row. */
  sources: string[];
}

export interface MonthSpend {
  month: string;
  column: string;
  created: boolean;
  rows: RowSpend[];
  /** Rows skipped because an account's currency could not be converted. */
  unconvertible: string[];
}

export interface AdSpendSheetResult {
  tab: string;
  dryRun: boolean;
  /** Empty when there was nothing to do. */
  months: MonthSpend[];
  /** Why nothing ran, when nothing ran. */
  skipped: string | null;
  /** Sheet rows with no matching ad account (left untouched). */
  unmatchedRows: string[];
  /** Ad accounts with spend in the period that match no sheet row. */
  unmatchedAccounts: string[];
  cellsWritten: number;
  durationMs: number;
}

// --- Dates ---

export function serialToMonth(serial: number): string {
  const d = new Date(SERIAL_EPOCH_MS + Math.floor(serial) * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Serial for the 1st of the month. */
export function monthToSerial(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, 1) - SERIAL_EPOCH_MS) / DAY_MS);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// --- Sheet layout ---

export interface SpendLayout {
  headerRow: number;
  accountCol: number;
  /** month → 0-based column, in sheet order. */
  monthCols: Map<string, number>;
  firstMonthCol: number;
  lastMonthCol: number;
  lastMonth: string;
  /** Client rows, 0-based. */
  accountRows: Array<{ row: number; account: string }>;
}

/** Labels that sit in the account column but are not clients. */
const NON_CLIENT_ROWS = new Set(['total', 'totals', 'account name']);

/**
 * Read the tab's structure from an UNFORMATTED grid (headers as date serials).
 *
 * Throws rather than guessing: month columns must be contiguous, ascending and
 * unique, because a wrong column here overwrites a real month's spend.
 */
export function findSpendLayout(grid: string[][]): SpendLayout {
  let headerRow = -1;
  let accountCol = -1;
  for (let r = 0; r < grid.length && headerRow < 0; r++) {
    const c = grid[r].findIndex((v) => v.trim().toLowerCase() === 'account name');
    if (c >= 0) {
      headerRow = r;
      accountCol = c;
    }
  }
  if (headerRow < 0) throw new Error('Could not find the "Account name" header row');

  const monthCols = new Map<string, number>();
  const header = grid[headerRow];
  for (let c = accountCol + 1; c < header.length; c++) {
    const raw = header[c].trim();
    // Date serials for 2009–2064; anything else ("Budget", "Report") is not a month.
    if (!/^\d+(\.\d+)?$/.test(raw)) continue;
    const serial = Number(raw);
    if (serial < 40_000 || serial > 60_000) continue;
    const month = serialToMonth(serial);
    if (monthCols.has(month)) throw new Error(`Month ${month} appears twice in the header row`);
    monthCols.set(month, c);
  }
  if (monthCols.size === 0) throw new Error('No date-formatted month headers found');

  const entries = [...monthCols.entries()];
  for (let i = 1; i < entries.length; i++) {
    const [prevM, prevC] = entries[i - 1];
    const [m, c] = entries[i];
    if (c !== prevC + 1 || m !== nextMonth(prevM)) {
      throw new Error(
        `Month headers are not one contiguous run: ${prevM} (col ${columnLetter(prevC)}) ` +
          `is followed by ${m} (col ${columnLetter(c)})`,
      );
    }
  }

  const accountRows: Array<{ row: number; account: string }> = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const account = (grid[r]?.[accountCol] ?? '').trim();
    if (!account || NON_CLIENT_ROWS.has(account.toLowerCase())) continue;
    accountRows.push({ row: r, account });
  }

  const [lastMonth, lastMonthCol] = entries[entries.length - 1];
  return {
    headerRow,
    accountCol,
    monthCols,
    firstMonthCol: entries[0][1],
    lastMonthCol,
    lastMonth,
    accountRows,
  };
}

/**
 * Which months to write on a given day.
 *
 * Every completed month after the last column is created. If no column is
 * missing, last month is restated inside the close window.
 */
export function planMonths(
  layout: SpendLayout,
  now: Date,
  closeDays: number,
  explicitMonth?: string,
): { months: string[]; skipped: string | null } {
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const lastComplete = previousMonth(current);

  if (explicitMonth) {
    if (explicitMonth > lastComplete) {
      throw new Error(`${explicitMonth} is not a completed month yet`);
    }
    if (layout.monthCols.has(explicitMonth) || explicitMonth === nextMonth(layout.lastMonth)) {
      return { months: [explicitMonth], skipped: null };
    }
    throw new Error(
      `${explicitMonth} has no column and is not the next one after ${layout.lastMonth}`,
    );
  }

  const missing: string[] = [];
  for (let m = nextMonth(layout.lastMonth); m <= lastComplete; m = nextMonth(m)) missing.push(m);
  if (missing.length > 0) return { months: missing, skipped: null };

  if (now.getUTCDate() <= closeDays) return { months: [lastComplete], skipped: null };
  return {
    months: [],
    skipped: `${lastComplete} is already on the sheet and day ${now.getUTCDate()} is past the ${closeDays}-day close window`,
  };
}

// --- Account matching ---

/** Strip ad-account noise ("Ad Account", "- UK", "1.0", ®) before name matching. */
export function cleanAccountName(name: string): string {
  return name
    .replace(/[®™]/g, '')
    .replace(/\bad\s*acc(ount)?\b/gi, ' ')
    .replace(/\b\d+\.\d+\b/g, ' ')
    .replace(/(^|[\s-])uk\b/gi, ' ')
    .replace(/[\s-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve each ad account to a sheet row name, or null.
 * Group rules first, then name matching against the rows on the tab.
 */
export function matchAccounts(
  accounts: MetaAccount[],
  rowNames: string[],
): Map<string, string | null> {
  const rowsByNorm = new Map<string, string>();
  for (const name of rowNames) rowsByNorm.set(normaliseClient(name), name);

  const out = new Map<string, string | null>();
  for (const a of accounts) {
    if (EXCLUDED_ACCOUNT_IDS.has(a.account_id)) {
      out.set(a.account_id, null);
      continue;
    }
    const group = GROUP_RULES.find((g) => g.match(a));
    if (group) {
      out.set(a.account_id, rowNames.includes(group.row) ? group.row : null);
      continue;
    }
    out.set(a.account_id, resolveClient(cleanAccountName(a.name), rowsByNorm));
  }
  return out;
}

// --- Meta ---

async function metaGet<T>(url: string, token: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 429 || resp.status >= 500) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
      continue;
    }
    const body = await resp.text();
    if (!resp.ok) {
      if (body.includes('"code":190')) {
        throw new Error(
          'Meta rejected META_ACCESS_TOKEN (OAuth 190) — reissue the Business Manager system user token',
        );
      }
      throw new Error(`Meta API ${resp.status}: ${body.slice(0, 300)}`);
    }
    return JSON.parse(body) as T;
  }
  throw new Error(`Meta API kept failing after retries: ${url.split('?')[0]}`);
}

async function listMetaAccounts(token: string): Promise<MetaAccount[]> {
  const out: MetaAccount[] = [];
  let url: string | undefined =
    `${META_BASE}/me/adaccounts?fields=account_id,name,currency&limit=200`;
  while (url) {
    const page: { data: MetaAccount[]; paging?: { next?: string } } = await metaGet(url, token);
    out.push(...page.data);
    url = page.paging?.next;
  }
  return out;
}

/** Spend per month, in the account's own currency, for an inclusive month range. */
async function fetchMonthlySpend(
  token: string,
  accountId: string,
  fromMonth: string,
  toMonth: string,
): Promise<Map<string, number>> {
  const timeRange = JSON.stringify({ since: `${fromMonth}-01`, until: monthEnd(toMonth) });
  let url: string | undefined =
    `${META_BASE}/act_${accountId}/insights?level=account&fields=spend` +
    `&time_increment=monthly&time_range=${encodeURIComponent(timeRange)}&limit=100`;

  const out = new Map<string, number>();
  while (url) {
    const page: {
      data: Array<{ date_start: string; spend?: string }>;
      paging?: { next?: string };
    } = await metaGet(url, token);
    for (const row of page.data) {
      const month = row.date_start.slice(0, 7);
      out.set(month, (out.get(month) ?? 0) + Number(row.spend ?? 0));
    }
    url = page.paging?.next;
  }
  return out;
}

// --- FX ---

/** Average daily ECB rate (currency → GBP) across a month. */
async function averageRateToGbp(currency: string, month: string): Promise<number> {
  if (currency === 'GBP') return 1;
  const url = `${FX_BASE}/${month}-01..${monthEnd(month)}?base=${currency}&symbols=GBP`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No FX rate for ${currency} (${resp.status})`);
  const data = (await resp.json()) as { rates?: Record<string, { GBP?: number }> };
  const daily = Object.values(data.rates ?? {})
    .map((r) => r.GBP)
    .filter((v): v is number => typeof v === 'number');
  if (daily.length === 0) throw new Error(`No FX rate for ${currency} in ${month}`);
  return daily.reduce((s, v) => s + v, 0) / daily.length;
}

// --- Main ---

export async function runAdSpendSheet(
  options: AdSpendSheetOptions = {},
): Promise<AdSpendSheetResult> {
  const start = Date.now();
  const dryRun = options.dryRun ?? false;

  const spreadsheetId = process.env.DELIVERABLES_SHEET_ID?.trim();
  if (!spreadsheetId) throw new Error('DELIVERABLES_SHEET_ID must be set');
  const gid = Number(process.env.AD_SPEND_SHEET_GID?.trim() || DEFAULT_TAB_GID);
  const closeDays = Number(process.env.DELIVERABLES_SHEET_CLOSE_DAYS?.trim() || '5');

  // --- Sheet ---
  const sheetsToken = await mintSheetsAccessToken();
  const tabs = await listSheets(sheetsToken, spreadsheetId);
  const tab = tabs.find((s) => s.sheetId === gid);
  if (!tab) throw new Error(`No tab with gid ${gid} in the deliverables spreadsheet`);
  const quoted = quoteSheetName(tab.title);

  const grid = await readGrid(sheetsToken, spreadsheetId, `${quoted}!A1:CZ200`, 'UNFORMATTED_VALUE');
  const layout = findSpendLayout(grid);
  const plan = planMonths(layout, new Date(), closeDays, options.month);

  const result: AdSpendSheetResult = {
    tab: tab.title,
    dryRun,
    months: [],
    skipped: plan.skipped,
    unmatchedRows: [],
    unmatchedAccounts: [],
    cellsWritten: 0,
    durationMs: 0,
  };
  if (plan.months.length === 0) {
    consoleLog(LOG_SOURCE, `Nothing to do: ${plan.skipped}`);
    result.durationMs = Date.now() - start;
    return result;
  }

  // Column for each month: existing, or the next free one after the last.
  const newMonths = plan.months.filter((m) => !layout.monthCols.has(m));
  const colFor = new Map(layout.monthCols);
  newMonths.forEach((m, i) => colFor.set(m, layout.lastMonthCol + 1 + i));

  // A new column must be genuinely empty — never write over something
  // someone typed to the right of the months.
  for (const m of newMonths) {
    const c = colFor.get(m)!;
    const used = [layout.headerRow, ...layout.accountRows.map((r) => r.row)].find(
      (r) => (grid[r]?.[c] ?? '').trim() !== '',
    );
    if (used !== undefined) {
      throw new Error(
        `Column ${columnLetter(c)} (for ${m}) is not empty at row ${used + 1} — aborting`,
      );
    }
  }

  // --- Meta ---
  const metaToken = process.env.META_ACCESS_TOKEN?.trim();
  if (!metaToken) throw new Error('META_ACCESS_TOKEN must be set');

  const accounts = await listMetaAccounts(metaToken);
  const rowNames = layout.accountRows.map((r) => r.account);
  const matches = matchAccounts(accounts, rowNames);

  const fromMonth = plan.months[0];
  const toMonth = plan.months[plan.months.length - 1];
  consoleLog(LOG_SOURCE, `Fetching spend ${fromMonth} → ${toMonth} for ${accounts.length} accounts`);

  const spendByAccount = new Map<string, Map<string, number>>();
  // Small concurrency — ~50 accounts, one call each.
  const queue = accounts.filter((a) => !EXCLUDED_ACCOUNT_IDS.has(a.account_id));
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        spendByAccount.set(a.account_id, await fetchMonthlySpend(metaToken, a.account_id, fromMonth, toMonth));
      }
    }),
  );

  const rateCache = new Map<string, number | Error>();
  async function rate(currency: string, month: string): Promise<number | Error> {
    const key = `${currency}:${month}`;
    if (!rateCache.has(key)) {
      rateCache.set(key, await averageRateToGbp(currency, month).catch((e: Error) => e));
    }
    return rateCache.get(key)!;
  }

  const unmatchedAccounts = new Set<string>();
  const matchedRows = new Set<string>();
  for (const a of accounts) {
    const row = matches.get(a.account_id);
    if (row) {
      matchedRows.add(row);
      continue;
    }
    if (EXCLUDED_ACCOUNT_IDS.has(a.account_id)) continue;
    const total = [...(spendByAccount.get(a.account_id)?.values() ?? [])].reduce((s, v) => s + v, 0);
    if (total > 0) unmatchedAccounts.add(`${a.name.trim()} (act_${a.account_id}, ${a.currency})`);
  }

  for (const m of plan.months) {
    const rows: RowSpend[] = [];
    const unconvertible: string[] = [];
    for (const { row, account } of layout.accountRows) {
      if (!matchedRows.has(account)) continue;
      let gbp = 0;
      const sources: string[] = [];
      let failed: string | null = null;
      for (const a of accounts) {
        if (matches.get(a.account_id) !== account) continue;
        const spend = spendByAccount.get(a.account_id)?.get(m) ?? 0;
        if (spend === 0) continue;
        const r = await rate(a.currency, m);
        if (r instanceof Error) {
          failed = `${account}: ${r.message}`;
          break;
        }
        gbp += spend * r;
        sources.push(`${a.name.trim()} (${a.currency} ${spend.toFixed(2)})`);
      }
      if (failed) unconvertible.push(failed);
      else rows.push({ account, row: row + 1, gbp: Math.round(gbp * 100) / 100, sources });
    }
    result.months.push({
      month: m,
      column: columnLetter(colFor.get(m)!),
      created: newMonths.includes(m),
      rows,
      unconvertible,
    });
  }

  result.unmatchedRows = rowNames.filter((n) => !matchedRows.has(n));
  result.unmatchedAccounts = [...unmatchedAccounts];

  // --- Write ---
  if (!dryRun) {
    if (newMonths.length > 0) {
      await addMonthColumns(sheetsToken, spreadsheetId, gid, tab.columnCount, layout, newMonths.length);
    }
    const writes: CellWrite[] = [];
    for (const ms of result.months) {
      if (ms.created) {
        writes.push({
          range: `${quoted}!${ms.column}${layout.headerRow + 1}`,
          value: monthToSerial(ms.month),
        });
      }
      for (const r of ms.rows) writes.push({ range: `${quoted}!${ms.column}${r.row}`, value: r.gbp });
    }
    result.cellsWritten = await batchUpdateValues(sheetsToken, spreadsheetId, writes);
  }

  consoleLog(
    LOG_SOURCE,
    `${dryRun ? '[dry run] ' : ''}${plan.months.join(', ')}: ${result.cellsWritten} cells written, ` +
      `${result.unmatchedRows.length} unmatched rows, ${result.unmatchedAccounts.length} unmatched accounts`,
  );
  result.durationMs = Date.now() - start;
  return result;
}

/**
 * Format `count` new columns after the last month to match it, and widen the
 * tab's conditional format rules (over/on budget, header fill) to cover them.
 */
async function addMonthColumns(
  token: string,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number,
  layout: SpendLayout,
  count: number,
): Promise<void> {
  const firstNew = layout.lastMonthCol + 1;
  const endNew = firstNew + count; // exclusive
  const lastRow = Math.max(...layout.accountRows.map((r) => r.row)) + 1; // exclusive

  const requests: unknown[] = [];
  if (endNew > columnCount) {
    requests.push({
      appendDimension: { sheetId, dimension: 'COLUMNS', length: endNew - columnCount },
    });
  }
  requests.push(
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: layout.headerRow,
          endRowIndex: layout.headerRow + 1,
          startColumnIndex: firstNew,
          endColumnIndex: endNew,
        },
        cell: { userEnteredFormat: { numberFormat: HEADER_FORMAT } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: layout.headerRow + 1,
          endRowIndex: lastRow,
          startColumnIndex: firstNew,
          endColumnIndex: endNew,
        },
        cell: { userEnteredFormat: { numberFormat: SPEND_FORMAT } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
  );

  const rules = await getConditionalFormats(token, spreadsheetId, sheetId);
  requests.push(...extendConditionalFormats(rules, sheetId, layout, endNew));

  await batchUpdateSpreadsheet(token, spreadsheetId, requests);
}

/**
 * Update requests that stretch every rule ending exactly at the last month
 * column so it ends at `newEnd` instead. Rules elsewhere are left alone.
 */
export function extendConditionalFormats(
  rules: ConditionalFormatRule[],
  sheetId: number,
  layout: Pick<SpendLayout, 'firstMonthCol' | 'lastMonthCol'>,
  newEnd: number,
): unknown[] {
  const out: unknown[] = [];
  rules.forEach((rule, index) => {
    let changed = false;
    const ranges = rule.ranges.map((r) => {
      if (
        r.endColumnIndex === layout.lastMonthCol + 1 &&
        (r.startColumnIndex ?? 0) >= layout.firstMonthCol
      ) {
        changed = true;
        return { ...r, endColumnIndex: newEnd };
      }
      return r;
    });
    if (changed) {
      out.push({ updateConditionalFormatRule: { sheetId, index, rule: { ...rule, ranges } } });
    }
  });
  return out;
}
