/**
 * Meta ad spend → Google Sheet — the "Paid Social Clients" tab of the
 * deliverables tracker.
 *
 * Spend is read in Chrome from the Ads Reporting business view (all 58 ad
 * accounts in the Vendo Digital business, one row per account, "Amount spent"
 * in each account's own currency) by the /ad-spend-sheet command, saved as a
 * SpendInput JSON file, and written here. The Meta API token has been dead
 * since April 2026, and Toby chose the Ads Reporting view as the source.
 *
 * Each client row gets one cell per month holding that month's total Meta
 * spend, in GBP. The tab's month headers are real dates (format "mmmm yy"),
 * one column per month, running left to right.
 *
 * Writing a month:
 *   - If it is the month after the last column, a new column is added,
 *     formatted to match, with the over/on-budget conditional formatting
 *     extended to cover it.
 *   - If its column already exists, it is restated (spend Meta posts late).
 *   - Anything else — the current month, a gap — is refused.
 * `missingMonths` lists the completed months that still need a column, so
 * the command can backfill them one at a time in order.
 *
 * Spend is converted to GBP at the month's average ECB rate (Frankfurter) —
 * Dentistry.ie bills in EUR, Veltuff in DKK, Iconic Dent in USD (Toby,
 * 2026-10-01: "convert all to GBP").
 *
 * Ad accounts are matched to rows by name. Multi-account clients are listed
 * in GROUP_RULES and summed. Anything with spend that matches no row is
 * reported, never guessed at.
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
export const GROUP_RULES: Array<{ row: string; match: RegExp }> = [
  // Ravensdale Dental Group: the main account plus per-practice "RDG - …" ones.
  { row: 'Ravensdale Dental Group - Dentistry.ie', match: /^(Ravensdale Dental Group\b|RDG\b)/i },
  // Kana Health: group account plus the five practices (OH/MK/WH/WS/EB).
  {
    row: 'Kana Health',
    match: /^(Kana Health|Oxford House|MK Smiles|Wilson House|Woburn Sands|Edward Byrnes)\b/i,
  },
];

/** Ad accounts that are never client spend. */
const EXCLUDED_ACCOUNTS = [/^Vendo Digital\b/i, /^Toby Raeburn\b/i];

/** One ad account's spend as read from Ads Reporting. */
export interface AccountSpend {
  name: string;
  /** ISO code, e.g. GBP / EUR / DKK / USD. */
  currency: string;
  amount: number;
}

export interface SpendInput {
  /** YYYY-MM */
  month: string;
  accounts: AccountSpend[];
}

export interface AdSpendSheetOptions {
  /** Report what would be written without touching the sheet. */
  dryRun?: boolean;
}

export interface RowSpend {
  account: string;
  row: number;
  gbp: number;
  /** "Account name (CUR 1,234.56)" for every account summed into the row. */
  sources: string[];
}

export interface AdSpendSheetResult {
  tab: string;
  month: string;
  column: string;
  created: boolean;
  dryRun: boolean;
  rows: RowSpend[];
  /** Sheet rows with no matching ad account (left untouched). */
  unmatchedRows: string[];
  /** Ad accounts with spend that match no sheet row. */
  unmatchedAccounts: string[];
  /** Exchange rates used, e.g. { EUR: 0.8594 }. */
  rates: Record<string, number>;
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

function currentMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// --- Amount parsing ---

/**
 * Parse an Ads Reporting "Amount spent" cell ("£9,253.78", "€764.32",
 * "kr.67,230.28", "$2,202.21") into currency + amount.
 *
 * "kr." is DKK — Veltuff is the only krone account. "$" is USD — Iconic Dent.
 */
export function parseAmount(text: string): { currency: string; amount: number } {
  const t = text.trim();
  const prefixes: Array<[RegExp, string]> = [
    [/^£/, 'GBP'],
    [/^€/, 'EUR'],
    [/^kr\.?/i, 'DKK'],
    [/^(US)?\$/, 'USD'],
  ];
  for (const [re, currency] of prefixes) {
    if (re.test(t)) {
      const amount = Number(t.replace(re, '').replace(/,/g, '').trim());
      if (!Number.isFinite(amount)) throw new Error(`Unreadable amount "${text}"`);
      return { currency, amount };
    }
  }
  throw new Error(`Unknown currency in amount "${text}"`);
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

/** Completed months newer than the last column, oldest first. */
export function findMissingMonths(layout: SpendLayout, now: Date): string[] {
  const lastComplete = previousMonth(currentMonth(now));
  const out: string[] = [];
  for (let m = nextMonth(layout.lastMonth); m <= lastComplete; m = nextMonth(m)) out.push(m);
  return out;
}

/** Whether `month` can be written: an existing column, or the next new one. */
export function checkWritableMonth(layout: SpendLayout, month: string, now: Date): void {
  if (month > previousMonth(currentMonth(now))) {
    throw new Error(`${month} is not a completed month yet`);
  }
  if (!layout.monthCols.has(month) && month !== nextMonth(layout.lastMonth)) {
    throw new Error(
      `${month} has no column and is not the next one after ${layout.lastMonth} — ` +
        `backfill the months in between first`,
    );
  }
}

// --- Account matching ---

/** Strip ad-account noise ("Ad Account", "Meta Ads", "- UK", "1.0", ®). */
export function cleanAccountName(name: string): string {
  return name
    .replace(/[®™]/g, '')
    .replace(/\bad\s*acc(ount)?\b/gi, ' ')
    .replace(/\bmeta\s+ads\b/gi, ' ')
    .replace(/\b\d+\.\d+\b/g, ' ')
    .replace(/(^|[\s-])uk\b/gi, ' ')
    .replace(/[\s-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve each ad account name to a sheet row name, or null.
 * Exclusions, then group rules, then name matching against the tab's rows.
 */
export function matchAccounts(
  accountNames: string[],
  rowNames: string[],
): Map<string, string | null> {
  const rowsByNorm = new Map<string, string>();
  for (const name of rowNames) rowsByNorm.set(normaliseClient(name), name);

  const out = new Map<string, string | null>();
  for (const raw of accountNames) {
    const name = raw.trim();
    if (EXCLUDED_ACCOUNTS.some((re) => re.test(name))) {
      out.set(raw, null);
      continue;
    }
    const group = GROUP_RULES.find((g) => g.match.test(name));
    if (group) {
      out.set(raw, rowNames.includes(group.row) ? group.row : null);
      continue;
    }
    out.set(raw, resolveClient(cleanAccountName(name), rowsByNorm));
  }
  return out;
}

export function isExcludedAccount(name: string): boolean {
  return EXCLUDED_ACCOUNTS.some((re) => re.test(name.trim()));
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

interface SheetContext {
  token: string;
  spreadsheetId: string;
  gid: number;
  title: string;
  columnCount: number;
  quoted: string;
  grid: string[][];
  layout: SpendLayout;
}

async function loadSheet(): Promise<SheetContext> {
  const spreadsheetId = process.env.DELIVERABLES_SHEET_ID?.trim();
  if (!spreadsheetId) throw new Error('DELIVERABLES_SHEET_ID must be set');
  const gid = Number(process.env.AD_SPEND_SHEET_GID?.trim() || DEFAULT_TAB_GID);

  const token = await mintSheetsAccessToken();
  const tab = (await listSheets(token, spreadsheetId)).find((s) => s.sheetId === gid);
  if (!tab) throw new Error(`No tab with gid ${gid} in the deliverables spreadsheet`);
  const quoted = quoteSheetName(tab.title);
  const grid = await readGrid(token, spreadsheetId, `${quoted}!A1:CZ200`, 'UNFORMATTED_VALUE');
  return {
    token,
    spreadsheetId,
    gid,
    title: tab.title,
    columnCount: tab.columnCount,
    quoted,
    grid,
    layout: findSpendLayout(grid),
  };
}

/** Completed months that still need a column, oldest first. */
export async function listMissingMonths(): Promise<string[]> {
  const ctx = await loadSheet();
  return findMissingMonths(ctx.layout, new Date());
}

export async function runAdSpendSheet(
  input: SpendInput,
  options: AdSpendSheetOptions = {},
): Promise<AdSpendSheetResult> {
  const start = Date.now();
  const dryRun = options.dryRun ?? false;
  const { month } = input;
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Bad month "${month}", expected YYYY-MM`);

  const ctx = await loadSheet();
  const { layout, grid, quoted } = ctx;
  checkWritableMonth(layout, month, new Date());

  const created = !layout.monthCols.has(month);
  const col = created ? layout.lastMonthCol + 1 : layout.monthCols.get(month)!;

  // A new column must be genuinely empty — never write over something
  // someone typed to the right of the months.
  if (created) {
    const used = [layout.headerRow, ...layout.accountRows.map((r) => r.row)].find(
      (r) => (grid[r]?.[col] ?? '').trim() !== '',
    );
    if (used !== undefined) {
      throw new Error(
        `Column ${columnLetter(col)} (for ${month}) is not empty at row ${used + 1} — aborting`,
      );
    }
  }

  // --- Match + convert ---
  const rowNames = layout.accountRows.map((r) => r.account);
  const matches = matchAccounts(input.accounts.map((a) => a.name), rowNames);

  const rates: Record<string, number> = {};
  for (const cur of new Set(input.accounts.map((a) => a.currency))) {
    rates[cur] = await averageRateToGbp(cur, month);
  }

  const byRow = new Map<string, { gbp: number; sources: string[] }>();
  const unmatchedAccounts: string[] = [];
  for (const a of input.accounts) {
    const row = matches.get(a.name);
    if (!row) {
      if (a.amount > 0 && !isExcludedAccount(a.name)) {
        unmatchedAccounts.push(`${a.name.trim()} (${a.currency} ${a.amount.toFixed(2)})`);
      }
      continue;
    }
    const acc = byRow.get(row) ?? { gbp: 0, sources: [] };
    acc.gbp += a.amount * rates[a.currency];
    acc.sources.push(`${a.name.trim()} (${a.currency} ${a.amount.toFixed(2)})`);
    byRow.set(row, acc);
  }

  const rows: RowSpend[] = [];
  const unmatchedRows: string[] = [];
  for (const { row, account } of layout.accountRows) {
    const spend = byRow.get(account);
    if (!spend) {
      unmatchedRows.push(account);
      continue;
    }
    rows.push({
      account,
      row: row + 1,
      gbp: Math.round(spend.gbp * 100) / 100,
      sources: spend.sources,
    });
  }

  // --- Write ---
  let cellsWritten = 0;
  if (!dryRun) {
    if (created) await addMonthColumn(ctx, col);
    const letter = columnLetter(col);
    const writes: CellWrite[] = rows.map((r) => ({
      range: `${quoted}!${letter}${r.row}`,
      value: r.gbp,
    }));
    if (created) {
      writes.push({ range: `${quoted}!${letter}${layout.headerRow + 1}`, value: monthToSerial(month) });
    }
    cellsWritten = await batchUpdateValues(ctx.token, ctx.spreadsheetId, writes);
  }

  consoleLog(
    LOG_SOURCE,
    `${dryRun ? '[dry run] ' : ''}${month} → ${columnLetter(col)}: ${rows.length} rows, ` +
      `${cellsWritten} cells written, ${unmatchedRows.length} unmatched rows, ` +
      `${unmatchedAccounts.length} unmatched accounts`,
  );

  return {
    tab: ctx.title,
    month,
    column: columnLetter(col),
    created,
    dryRun,
    rows,
    unmatchedRows,
    unmatchedAccounts,
    rates,
    cellsWritten,
    durationMs: Date.now() - start,
  };
}

/**
 * Format the new column to match the month columns, and widen the tab's
 * conditional format rules (over/on budget, header fill) to cover it.
 */
async function addMonthColumn(ctx: SheetContext, col: number): Promise<void> {
  const { layout, gid: sheetId } = ctx;
  const lastRow = Math.max(...layout.accountRows.map((r) => r.row)) + 1; // exclusive

  const requests: unknown[] = [];
  if (col + 1 > ctx.columnCount) {
    requests.push({
      appendDimension: { sheetId, dimension: 'COLUMNS', length: col + 1 - ctx.columnCount },
    });
  }
  const cellRange = (startRow: number, endRow: number) => ({
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: col,
    endColumnIndex: col + 1,
  });
  requests.push(
    {
      repeatCell: {
        range: cellRange(layout.headerRow, layout.headerRow + 1),
        cell: { userEnteredFormat: { numberFormat: HEADER_FORMAT } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    {
      repeatCell: {
        range: cellRange(layout.headerRow + 1, lastRow),
        cell: { userEnteredFormat: { numberFormat: SPEND_FORMAT } },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
  );

  const rules = await getConditionalFormats(ctx.token, ctx.spreadsheetId, sheetId);
  requests.push(...extendConditionalFormats(rules, sheetId, layout, col + 1));

  await batchUpdateSpreadsheet(ctx.token, ctx.spreadsheetId, requests);
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
