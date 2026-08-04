/**
 * Veltuff weekly Meta metrics — computes the numbers for the weekly client report.
 *
 * Reads campaign-level meta_insights for the accounts in data/veltuff/meta-accounts.json,
 * aggregates the report week (last complete ISO week Mon–Sun by default), and compares
 * against the previous week (WoW) and the same ISO week last year (YoY, when history exists).
 *
 * Purchase counts come from actions[omni_purchase]; purchase revenue from
 * action_values[omni_purchase] (requires sync-meta-ads.ts run after 2026-08-04 —
 * earlier syncs did not request action_values).
 *
 * Usage:
 *   npx tsx scripts/functions/veltuff-weekly-meta.ts            # last complete ISO week
 *   npx tsx scripts/functions/veltuff-weekly-meta.ts --week 31  # specific week (current year)
 *   npx tsx scripts/functions/veltuff-weekly-meta.ts --week 31 --year 2026
 *
 * Output: outputs/reports/veltuff/WK<nn>-meta.json + readable summary on stdout.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from '../utils/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

interface AccountConfig {
  account_id: string;
  label: string;
  market: string;
  account_currency: string;
  report_currency: string;
  fx_rate: number | null;
}

interface WeekTotals {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roasPct: number | null;   // revenue / spend * 100
  cpa: number | null;
  ctrPct: number | null;
  hasRevenue: boolean;      // false when action_values missing for the period
}

interface CampaignRow {
  name: string;
  spend: number;
  purchases: number;
  revenue: number;
  roasPct: number | null;
}

// --- ISO week helpers ---------------------------------------------------------

function isoWeekOf(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** Monday of the given ISO week. */
function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekRange(year: number, week: number): { from: string; to: string } {
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { from: fmtDate(start), to: fmtDate(end) };
}

// --- Aggregation --------------------------------------------------------------

function sumAction(json: string | null, type: string): number {
  if (!json) return 0;
  try {
    const arr = JSON.parse(json) as Array<{ action_type: string; value: string }>;
    const hit = arr.find(a => a.action_type === type);
    return hit ? parseFloat(hit.value) || 0 : 0;
  } catch {
    return 0;
  }
}

function aggregate(rows: Array<Record<string, unknown>>): WeekTotals {
  let spend = 0, impressions = 0, clicks = 0, purchases = 0, revenue = 0;
  let anyActionValues = false;

  for (const r of rows) {
    spend += (r.spend as number) || 0;
    impressions += (r.impressions as number) || 0;
    clicks += (r.clicks as number) || 0;
    purchases += sumAction(r.actions as string | null, 'omni_purchase');
    const rev = sumAction(r.action_values as string | null, 'omni_purchase');
    if (r.action_values) anyActionValues = true;
    revenue += rev;
  }

  return {
    spend, impressions, clicks, purchases, revenue,
    roasPct: anyActionValues && spend > 0 ? (revenue / spend) * 100 : null,
    cpa: purchases > 0 ? spend / purchases : null,
    ctrPct: impressions > 0 ? (clicks / impressions) * 100 : null,
    hasRevenue: anyActionValues,
  };
}

function queryWeek(db: any, accountId: string, from: string, to: string): Array<Record<string, unknown>> {
  const res = db.exec(
    `SELECT campaign_name, spend, impressions, clicks, actions, action_values
     FROM meta_insights
     WHERE account_id = '${accountId}' AND level = 'campaign'
       AND date >= '${from}' AND date <= '${to}'`
  );
  if (!res.length) return [];
  const cols = res[0].columns as string[];
  return res[0].values.map((v: unknown[]) =>
    Object.fromEntries(cols.map((c, i) => [c, v[i]]))
  );
}

function campaignBreakdown(rows: Array<Record<string, unknown>>): CampaignRow[] {
  const byName = new Map<string, { spend: number; purchases: number; revenue: number }>();
  for (const r of rows) {
    const name = (r.campaign_name as string) || '(unknown)';
    const entry = byName.get(name) || { spend: 0, purchases: 0, revenue: 0 };
    entry.spend += (r.spend as number) || 0;
    entry.purchases += sumAction(r.actions as string | null, 'omni_purchase');
    entry.revenue += sumAction(r.action_values as string | null, 'omni_purchase');
    byName.set(name, entry);
  }
  return [...byName.entries()]
    .map(([name, e]) => ({
      name,
      spend: e.spend,
      purchases: e.purchases,
      revenue: e.revenue,
      roasPct: e.spend > 0 && e.revenue > 0 ? (e.revenue / e.spend) * 100 : null,
    }))
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

function pctChange(current: number, prior: number): number | null {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function convert(totals: WeekTotals, fx: number | null): WeekTotals {
  if (!fx) return totals;
  return {
    ...totals,
    spend: totals.spend * fx,
    revenue: totals.revenue * fx,
    cpa: totals.cpa !== null ? totals.cpa * fx : null,
  };
}

// --- Main ---------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const weekArg = args.includes('--week') ? parseInt(args[args.indexOf('--week') + 1]) : null;
  const yearArg = args.includes('--year') ? parseInt(args[args.indexOf('--year') + 1]) : null;

  // Default: last complete ISO week (the week containing 7 days ago is safest on a Tuesday)
  let year: number, week: number;
  if (weekArg) {
    week = weekArg;
    year = yearArg || new Date().getFullYear();
  } else {
    const lastMonday = new Date();
    lastMonday.setDate(lastMonday.getDate() - 7);
    ({ year, week } = isoWeekOf(lastMonday));
  }

  const config = JSON.parse(readFileSync(resolve(ROOT, 'data/veltuff/meta-accounts.json'), 'utf-8'));
  const accounts: AccountConfig[] = config.accounts;

  const current = weekRange(year, week);
  const prior = weekRange(week === 1 ? year - 1 : year, week === 1 ? 52 : week - 1);
  const lastYear = weekRange(year - 1, week);

  const db = await getDb();
  const report: Record<string, unknown> = {
    week, year,
    range: current,
    generated_at: new Date().toISOString(),
    markets: {} as Record<string, unknown>,
  };

  for (const acct of accounts) {
    const curRows = queryWeek(db, acct.account_id, current.from, current.to);
    const priorRows = queryWeek(db, acct.account_id, prior.from, prior.to);
    const lyRows = queryWeek(db, acct.account_id, lastYear.from, lastYear.to);

    const cur = convert(aggregate(curRows), acct.fx_rate);
    const wow = convert(aggregate(priorRows), acct.fx_rate);
    const yoy = convert(aggregate(lyRows), acct.fx_rate);

    (report.markets as Record<string, unknown>)[acct.market] = {
      label: acct.label,
      account_id: acct.account_id,
      currency: acct.fx_rate ? acct.report_currency : acct.account_currency,
      fx_applied: acct.fx_rate,
      week: cur,
      wow: {
        totals: wow,
        spend_change_pct: pctChange(cur.spend, wow.spend),
        roas_change_pts: cur.roasPct !== null && wow.roasPct !== null ? cur.roasPct - wow.roasPct : null,
        purchases_change_pct: pctChange(cur.purchases, wow.purchases),
      },
      yoy: yoy.spend > 0 ? {
        totals: yoy,
        spend_change_pct: pctChange(cur.spend, yoy.spend),
        roas_change_pts: cur.roasPct !== null && yoy.roasPct !== null ? cur.roasPct - yoy.roasPct : null,
        purchases_change_pct: pctChange(cur.purchases, yoy.purchases),
      } : null,
      campaigns: campaignBreakdown(curRows),
      data_quality: {
        rows_in_week: curRows.length,
        has_revenue: cur.hasRevenue,
        notes: [
          ...(cur.hasRevenue ? [] : ['action_values missing — re-run sync-meta-ads.ts (post 2026-08-04 fix) for purchase revenue/ROAS']),
          ...(yoy.spend > 0 ? [] : ['no LY data in DB for YoY — quote YoY from Stuart\'s figures or omit']),
          ...(acct.fx_rate ? [] : ['amounts in account currency (' + acct.account_currency + ') — set fx_rate in meta-accounts.json to convert']),
        ],
      },
    };
  }

  closeDb();

  const outDir = resolve(ROOT, 'outputs/reports/veltuff');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `WK${String(week).padStart(2, '0')}-meta.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // Readable summary
  console.log(`Veltuff Meta — WK${week} (${current.from} → ${current.to})`);
  for (const [market, mAny] of Object.entries(report.markets as Record<string, any>)) {
    const m = mAny;
    const w = m.week;
    console.log(`\n${market} (${m.label}, ${m.currency})`);
    console.log(`  Spend: ${w.spend.toFixed(2)}  (WoW ${fmtPct(m.wow.spend_change_pct)})`);
    console.log(`  Purchases: ${w.purchases}  Revenue: ${w.revenue.toFixed(2)}  ROAS: ${w.roasPct !== null ? w.roasPct.toFixed(0) + '%' : 'n/a'}`);
    console.log(`  CPA: ${w.cpa !== null ? w.cpa.toFixed(2) : 'n/a'}  CTR: ${w.ctrPct !== null ? w.ctrPct.toFixed(2) + '%' : 'n/a'}`);
    if (m.data_quality.notes.length) console.log(`  Notes: ${m.data_quality.notes.join(' | ')}`);
  }
  console.log(`\nWritten: ${outPath}`);
}

function fmtPct(v: number | null): string {
  if (v === null) return 'n/a';
  return (v >= 0 ? '+' : '') + v.toFixed(0) + '%';
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
