# Ad Spend Sheet — Monthly Meta Spend into Paid Social Clients

> Reads last month's Meta spend per ad account from Ads Reporting in Chrome and writes it, converted to GBP, into the **Paid Social Clients** tab of `VD | Paid Social Clients | Media Buyers`. Run automatically by the `com.vendodigital.ad-spend-sheet` launchd job (daily 10:00, no-op unless a month is missing), or by hand.

## Variables

month: $ARGUMENTS (optional — YYYY-MM to restate an existing month instead of filling missing ones)

---

## Instructions

Work autonomously. Never ask questions — this runs unattended. Never click Save, Share or Export in Ads Manager, and never change the saved report.

### 1. Decide which months to do

- If `month` was given, do just that month.
- Otherwise run `npm run -s sheet:ad-spend -- --missing`. It prints the completed months with no column yet, oldest first. If it prints nothing, stop: "Nothing to do".
- Do the months **in order, oldest first** — each one adds the next column.

### 2. Read the month in Chrome

For each month `YYYY-MM` (first day `F`, last day `L`):

1. Load the Chrome tools in one ToolSearch call, get tab context, and open a new tab at:
   `https://adsmanager.facebook.com/adsmanager/reporting/business_view?act=1915275659298894&ads_manager_write_regions=true&business_id=2966248696869064&selected_report_id=3611053872388540&time_range=F_L`
2. Wait for the grid. Confirm the date button reads `F – L` and the header shows **58 Ad accounts** (or close to it). If it shows a login page, stop and report that Chrome is logged out.
3. The grid is virtualised (~15 rows rendered) and does not respond to wheel scrolling. Collect rows with JavaScript, then drag the grid's vertical scrollbar thumb (right edge of the grid, x ≈ 1308) down in steps, collecting again after each drag, until the count equals the "N / N rows displayed" total:
   ```js
   window.__spend = window.__spend || {};
   for (const r of document.querySelectorAll('[role="table"] ._1gd4')) {
     const p = r.innerText.split('\n').map(s => s.trim()).filter(Boolean);
     const v = p.find(x => /^([£€$]|kr)/.test(x));
     if (v && p[0] !== 'Total results') window.__spend[p[0]] = v;
   }
   JSON.stringify({ n: Object.keys(window.__spend).length })
   ```
   Return results as JSON — `name = value` text gets blocked by the tool.
4. Save `data/ad-spend/YYYY-MM.json`:
   ```json
   { "month": "YYYY-MM", "source": "Ads Reporting business view, <date range>, read <today>", "accounts": [["Account name", "£1,234.56"], ...] }
   ```
   Amounts exactly as shown (currency symbol included). Close the tab.

### 3. Write

1. `npm run -s sheet:ad-spend -- --input data/ad-spend/YYYY-MM.json --dry-run` — check every sheet row maps to the right ad account.
2. If the dry run errors, stop and report the error. Otherwise run it again without `--dry-run`.

### 4. Report

One short summary per month: column written, rows filled, the exchange rates used, and the two "unmatched" lists from the output (rows with no spend, ad accounts with spend but no row) — those need Toby's decision.

## Matching rules

Lives in `web/lib/jobs/ad-spend-sheet.ts`: `GROUP_RULES` sums multi-account clients (Dentistry.ie = Ravensdale + every `RDG - …` account; Kana = group + practice accounts), `EXCLUDED_ACCOUNTS` drops our own accounts, everything else is matched by name. Add a rule there rather than renaming anything in Meta or the sheet.
