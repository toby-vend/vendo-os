# /veltuff-weekly — Weekly Veltuff Meta + Shopify Report

Generate the weekly Vendo report email to Stuart Hames (Veltuff), mirroring his "eCommerce & Marketing WK nn" format. Run Tuesday morning, covering the prior ISO week (Mon–Sun).

**Current mode (v1): upload-driven.** Toby uploads both the Meta and Shopify data exports; no API syncs are used. The output is message text that Toby copies and sends manually. (The API pipeline — `sync-meta-ads.ts` + `scripts/functions/veltuff-weekly-meta.ts` — exists but is dormant until the Meta token is refreshed and details are ironed out.)

**Read first:** `context/clients/veltuff-report-style.md` — structure, voice rules, and the standing content requirements (full-budget-spent line, fee maths, Shopify sales basis). Follow it exactly.

## Steps

1. **Read the uploads**
   - Meta export(s): newest file(s) in `data/veltuff/uploads/meta/`
   - Shopify export(s): newest file(s) in `data/veltuff/uploads/shopify/`
   Accept whatever format Toby dropped in (CSV, XLSX, PDF, screenshots). Confirm the date range in each file actually covers the report week; if a file is stale or a market is missing, tell Toby exactly what's missing before composing — do not fill gaps by estimating.

2. **Extract the week's numbers**
   - Meta per market (UK in £, EU in Kr. where the data allows): spend, purchases/conversions, revenue, ROAS, CPA, CTR, and WoW/YoY deltas if the export includes comparison periods.
   - Shopify: gross sales, orders, AOV, returning customer rate, refund rate. Sales basis rule: gross sales from original order values — Shopify retro-deducts submitted return requests, so say which basis the export uses if it's ambiguous.
   - Blended: ROAS across channels and CAC if the data supports it.

3. **Compose the email**
   - Subject: `Vendo Weekly — Paid Performance WK<nn>` (match Stuart's ISO week numbering).
   - Structure and voice exactly per the style guide. First Tuesday of the month: include a Month End Summary section.
   - Must address: whether the full Meta budget was spent (targets in `data/veltuff/budgets.json`; if still null, note targets are pending Stuart's budget sheet), and the fee-maths line (blended benefit of performance vs spend net of Vendo fees).
   - Never invent numbers. Every figure must come from the uploads or Stuart's own stated figures (attributed as such). If a number is unavailable, omit the line or mark it as pending — do not estimate.
   - Save to `outputs/reports/veltuff/WK<nn>.md`.

4. **Hand off for manual send**
   Present the finished email text to Toby in the chat (recipient: stuart.hames@veltuff.com), plus any data caveats from steps 1–2. Toby copies it into Gmail and sends. Do not create drafts or send anything.
