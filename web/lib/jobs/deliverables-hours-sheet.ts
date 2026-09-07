/**
 * Deliverables hours → Google Sheet — weekly Friday.
 *
 * Writes month-to-date Harvest hours per client into the deliverables
 * tracker, split into AM and CM columns.
 *
 * Split rule (set by Toby, 2026-09-07):
 *   AM = the whole "Account Management — *" family, plus every
 *        "… — Client Communication" task on any service line.
 *   CM = everything else logged against that client.
 *
 * Task names changed taxonomy around June 2026 — the current form is
 * "Category — Subtask" with an em-dash, but legacy hyphenated names are
 * still in use (Toby's largest single task, "Creative - Client
 * Communication", is one). classifyTask normalises the separator so both
 * forms land in the same bucket.
 *
 * Reads the Harvest API directly rather than harvest_time_entries: that
 * table is populated by a manual local `npm run sync:harvest` and runs
 * days stale, which would silently under-report on a Friday evening.
 *
 * Writes are idempotent — each run overwrites the current month's column
 * pair with the month-to-date total, so re-running is always safe.
 */
import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';
import {
  mintSheetsAccessToken,
  listSheets,
  readGrid,
  batchUpdateValues,
  columnLetter,
  quoteSheetName,
  type CellWrite,
} from '../google-sheets.js';

const LOG_SOURCE = 'deliverables-hours-sheet';

const HARVEST_BASE = 'https://api.harvestapp.com/v2';

/**
 * Harvest clients that stand in for internal work rather than a real
 * client. Never written to the sheet.
 */
const INTERNAL_CLIENT_PATTERNS = [
  /^ZZZ\*/i,
  /^VD \|/i,
  /^A\* /i,
  /^Vendo Digital Operations$/i,
  /^Website Project Tracker$/i,
];

export interface DeliverablesSheetOptions {
  /** Harvest user id to report on. Defaults to DELIVERABLES_SHEET_USER_ID. */
  userId?: number;
  /** Month to write, as YYYY-MM. Defaults to the current month. */
  month?: string;
  /** Compute and report the writes without sending them. */
  dryRun?: boolean;
}

export interface PlannedWrite {
  account: string;
  harvestClient: string;
  row: number;
  amRange: string;
  amHours: number;
  cmRange: string;
  cmHours: number;
}

export interface DeliverablesSheetResult {
  month: string;
  tab: string;
  userName: string;
  entries: number;
  written: number;
  dryRun: boolean;
  planned: PlannedWrite[];
  /** Sheet rows with no Harvest client mapping. */
  unmatchedRows: string[];
  /** Harvest clients with hours that have no row on this tab. */
  unmatchedClients: string[];
  durationMs: number;
}

interface HarvestEntry {
  spent_date: string;
  hours: number;
  client: { name: string } | null;
  task: { name: string } | null;
  user: { name: string } | null;
}

// --- Harvest ---

async function fetchHarvestEntries(
  userId: number,
  from: string,
  to: string,
): Promise<HarvestEntry[]> {
  const accountId = process.env.HARVEST_ACCOUNT_ID?.trim();
  const token = process.env.HARVEST_ACCESS_TOKEN?.trim();
  if (!accountId || !token) {
    throw new Error('HARVEST_ACCOUNT_ID and HARVEST_ACCESS_TOKEN must be set');
  }

  const out: HarvestEntry[] = [];
  let page = 1;
  // Hard page ceiling — one person's month is a handful of pages; anything
  // beyond this means a bad date range rather than real data.
  const MAX_PAGES = 20;

  while (page <= MAX_PAGES) {
    const url =
      `${HARVEST_BASE}/time_entries?user_id=${userId}` +
      `&from=${from}&to=${to}&per_page=100&page=${page}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Harvest-Account-Id': accountId,
        'User-Agent': 'VendoOS (vendo-os@vendodigital.co.uk)',
      },
    });

    if (resp.status === 429) {
      const wait = Number(resp.headers.get('Retry-After') ?? '5') * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Harvest API ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      time_entries?: HarvestEntry[];
      total_pages?: number;
    };
    out.push(...(data.time_entries ?? []));
    if (page >= (data.total_pages ?? 1)) break;
    page += 1;
  }

  return out;
}

// --- Classification ---

/** Lowercase, collapse whitespace, normalise em/en dashes to a hyphen. */
function normaliseTask(name: string): string {
  return name.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

export type Bucket = 'am' | 'cm' | 'skip';

export function classifyTask(taskName: string): Bucket {
  const t = normaliseTask(taskName);
  // Holiday/sick logged against a client is a mis-log, not client work.
  if (t.startsWith('leave -') || t === 'holiday' || t === 'sick') return 'skip';
  if (t.startsWith('account management')) return 'am';
  if (t.includes('client communication')) return 'am';
  return 'cm';
}

function isInternalClient(name: string): boolean {
  return INTERNAL_CLIENT_PATTERNS.some((p) => p.test(name));
}

/**
 * Normalise a client name for fuzzy matching: lowercase, strip punctuation
 * and the generic practice suffixes that differ between the sheet and
 * Harvest ("Rothley Lodge" vs "Rothley Lodge Dental Practice").
 */
export function normaliseClient(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[&]/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stripped = base
    .replace(
      // "dentistry" is deliberately absent — it is a brand name here
      // ("Dentistry.ie"), not a generic suffix.
      /\b(dental|practice|clinic|studio|surgery|centre|center|group|ltd|limited|the)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Some client names are made up entirely of those generic words —
  // "Dentistry.ie" strips to nothing. An empty key is worse than a noisy
  // one: it matches every account name under containment, so fall back to
  // the unstripped form.
  return stripped || base;
}

// --- Sheet parsing ---

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Accepted header spellings for a YYYY-MM, e.g. "September 2026"/"Sept 26". */
function monthLabelVariants(month: string): Set<string> {
  const [y, m] = month.split('-');
  const full = MONTH_NAMES[Number(m) - 1];
  const short = full.slice(0, 3);
  const sept = full === 'september' ? ['sept'] : [];
  const yy = y.slice(2);
  const out = new Set<string>();
  for (const name of [full, short, ...sept]) {
    for (const year of [y, yy]) {
      out.add(`${name} ${year}`);
      out.add(`${name}${year}`);
    }
  }
  return out;
}

function normaliseHeader(v: string): string {
  return v.replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface GridLayout {
  headerRow: number;
  accountCol: number;
  amCol: number;
  cmCol: number;
}

/**
 * Locate the header row, the account-name column, and the AM/CM column pair
 * belonging to `month`.
 *
 * Throws rather than guessing. A wrong column here would overwrite a real
 * month's figures, so every assumption is asserted: the month label must be
 * found, and the two columns beneath it must actually read "AM Hrs"/"CM Hrs".
 */
export function findLayout(grid: string[][], month: string): GridLayout {
  const variants = monthLabelVariants(month);

  let headerRow = -1;
  let accountCol = -1;
  for (let r = 0; r < grid.length && headerRow < 0; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (normaliseHeader(grid[r][c]) === 'account name') {
        headerRow = r;
        accountCol = c;
        break;
      }
    }
  }
  if (headerRow < 0) throw new Error('Could not find the "Account name" header row');

  // Month labels sit in a merged cell above the header row. A merged cell
  // reports its value only in its top-left position, which is the "AM Hrs"
  // column of the pair.
  let monthCol = -1;
  for (let r = Math.max(0, headerRow - 3); r < headerRow; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (variants.has(normaliseHeader(grid[r][c]))) {
        monthCol = c;
        break;
      }
    }
    if (monthCol >= 0) break;
  }
  if (monthCol < 0) {
    throw new Error(
      `Could not find a "${month}" column header on this tab ` +
        `(looked for: ${[...monthLabelVariants(month)].join(', ')})`,
    );
  }

  const header = grid[headerRow];
  const amLabel = normaliseHeader(header[monthCol] ?? '');
  const cmLabel = normaliseHeader(header[monthCol + 1] ?? '');
  if (amLabel !== 'am hrs' || cmLabel !== 'cm hrs') {
    throw new Error(
      `Columns under the ${month} header read "${amLabel}"/"${cmLabel}", ` +
        `expected "am hrs"/"cm hrs" — aborting rather than overwriting the wrong cells`,
    );
  }

  return { headerRow, accountCol, amCol: monthCol, cmCol: monthCol + 1 };
}

/** Non-client labels that appear in the account column below the client rows. */
const NON_CLIENT_ROWS = new Set([
  'total', 'totals', 'working month', 'expected billable time',
  'capacity', 'current workload', 'deliverables', 'account name',
]);

export function readAccountRows(
  grid: string[][],
  layout: GridLayout,
): Array<{ row: number; account: string }> {
  const out: Array<{ row: number; account: string }> = [];
  for (let r = layout.headerRow + 1; r < grid.length; r++) {
    const account = (grid[r]?.[layout.accountCol] ?? '').trim();
    if (!account) continue;
    // Footer labels are written with trailing punctuation on some tabs
    // ("Current Workload:"), so compare without it.
    if (NON_CLIENT_ROWS.has(normaliseHeader(account).replace(/[:\s]+$/, ''))) continue;
    out.push({ row: r, account });
  }
  return out;
}

// --- Audit trail ---

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS deliverables_sheet_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      month TEXT NOT NULL,
      tab TEXT NOT NULL,
      user_name TEXT,
      entries INTEGER NOT NULL,
      cells_written INTEGER NOT NULL,
      unmatched_rows INTEGER NOT NULL,
      unmatched_clients INTEGER NOT NULL,
      dry_run INTEGER NOT NULL DEFAULT 0
    )
  `);
}

// --- Main ---

export async function runDeliverablesHoursSheet(
  options: DeliverablesSheetOptions = {},
): Promise<DeliverablesSheetResult> {
  const start = Date.now();
  await ensureSchema();

  const spreadsheetId = process.env.DELIVERABLES_SHEET_ID?.trim();
  const gid = Number(process.env.DELIVERABLES_SHEET_GID?.trim() ?? 'NaN');
  const userId = options.userId ?? Number(process.env.DELIVERABLES_SHEET_USER_ID?.trim() ?? 'NaN');
  if (!spreadsheetId) throw new Error('DELIVERABLES_SHEET_ID must be set');
  if (!Number.isFinite(gid)) throw new Error('DELIVERABLES_SHEET_GID must be set');
  if (!Number.isFinite(userId)) throw new Error('DELIVERABLES_SHEET_USER_ID must be set');

  const now = new Date();
  const month =
    options.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const from = `${month}-01`;
  // End of the target month, clamped to today so a mid-month run reports
  // month-to-date rather than reaching into the future.
  const [my, mm] = month.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(my, mm, 0)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const to = monthEnd < today ? monthEnd : today;

  consoleLog(LOG_SOURCE, `Building ${month} (${from} → ${to}) for Harvest user ${userId}`);

  // --- Harvest ---
  const entries = await fetchHarvestEntries(userId, from, to);
  const userName = entries.find((e) => e.user?.name)?.user?.name ?? `user ${userId}`;

  const byClient = new Map<string, { am: number; cm: number }>();
  for (const e of entries) {
    const client = e.client?.name?.trim();
    if (!client || isInternalClient(client)) continue;
    const bucket = classifyTask(e.task?.name ?? '');
    if (bucket === 'skip') continue;
    const acc = byClient.get(client) ?? { am: 0, cm: 0 };
    acc[bucket] += e.hours ?? 0;
    byClient.set(client, acc);
  }

  // --- Sheet ---
  const accessToken = await mintSheetsAccessToken();
  const sheets = await listSheets(accessToken, spreadsheetId);
  const target = sheets.find((s) => s.sheetId === gid);
  if (!target) {
    throw new Error(
      `No tab with gid ${gid} in this spreadsheet (found: ${sheets
        .map((s) => `${s.title}=${s.sheetId}`)
        .join(', ')})`,
    );
  }

  const quoted = quoteSheetName(target.title);
  const grid = await readGrid(accessToken, spreadsheetId, `${quoted}!A1:CZ200`);
  const layout = findLayout(grid, month);
  const accountRows = readAccountRows(grid, layout);

  // --- Match sheet rows to Harvest clients ---
  const harvestByNorm = new Map<string, string>();
  for (const name of byClient.keys()) harvestByNorm.set(normaliseClient(name), name);

  const planned: PlannedWrite[] = [];
  const unmatchedRows: string[] = [];
  const matchedHarvest = new Set<string>();

  for (const { row, account } of accountRows) {
    const harvestClient = resolveClient(account, harvestByNorm);
    if (!harvestClient) {
      unmatchedRows.push(account);
      continue;
    }
    matchedHarvest.add(harvestClient);
    const totals = byClient.get(harvestClient) ?? { am: 0, cm: 0 };
    // +1 because grid indices are 0-based and A1 rows are 1-based.
    const a1Row = row + 1;
    planned.push({
      account,
      harvestClient,
      row: a1Row,
      amRange: `${quoted}!${columnLetter(layout.amCol)}${a1Row}`,
      amHours: round2(totals.am),
      cmRange: `${quoted}!${columnLetter(layout.cmCol)}${a1Row}`,
      cmHours: round2(totals.cm),
    });
  }

  const unmatchedClients = [...byClient.keys()].filter((c) => !matchedHarvest.has(c));

  // --- Write ---
  const dryRun = options.dryRun ?? false;
  let written = 0;
  if (!dryRun) {
    const writes: CellWrite[] = [];
    for (const p of planned) {
      writes.push({ range: p.amRange, value: p.amHours });
      writes.push({ range: p.cmRange, value: p.cmHours });
    }
    written = await batchUpdateValues(accessToken, spreadsheetId, writes);
  }

  await db.execute({
    sql: `INSERT INTO deliverables_sheet_runs
            (run_at, month, tab, user_name, entries, cells_written,
             unmatched_rows, unmatched_clients, dry_run)
          VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      month, target.title, userName, entries.length, written,
      unmatchedRows.length, unmatchedClients.length, dryRun ? 1 : 0,
    ],
  });

  consoleLog(
    LOG_SOURCE,
    `${dryRun ? '[dry run] ' : ''}${planned.length} rows, ${written} cells written, ` +
      `${unmatchedRows.length} unmatched rows, ${unmatchedClients.length} unmatched clients`,
  );

  return {
    month,
    tab: target.title,
    userName,
    entries: entries.length,
    written,
    dryRun,
    planned,
    unmatchedRows,
    unmatchedClients,
    durationMs: Date.now() - start,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve a sheet account name to a Harvest client name.
 *
 * Exact normalised match first, then a containment match in either direction
 * — the sheet trims suffixes Harvest keeps ("Rothley Lodge" vs "Rothley Lodge
 * Dental Practice") and occasionally prefixes a group name ("Ravensdale
 * Dental Group - Dentistry.ie" vs "Dentistry.ie"). Ambiguous containment
 * matches are rejected rather than guessed.
 */
export function resolveClient(
  account: string,
  harvestByNorm: Map<string, string>,
): string | null {
  const key = normaliseClient(account);
  if (!key) return null;

  const exact = harvestByNorm.get(key);
  if (exact) return exact;

  // Containment needs a floor: a very short key ("arc") is a substring of
  // too many unrelated names to be evidence of anything.
  const MIN_CONTAINMENT_LEN = 4;
  if (key.length < MIN_CONTAINMENT_LEN) return null;

  const partial = [...harvestByNorm.entries()].filter(
    ([k]) => k.length >= MIN_CONTAINMENT_LEN && (k.includes(key) || key.includes(k)),
  );
  return partial.length === 1 ? partial[0][1] : null;
}
