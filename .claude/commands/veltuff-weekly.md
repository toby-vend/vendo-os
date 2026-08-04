# /veltuff-weekly — Weekly Veltuff Meta + Shopify Report

Generate the weekly Vendo report email to Stuart Hames (Veltuff), mirroring his "eCommerce & Marketing WK nn" format. Run Tuesday morning, covering the prior ISO week (Mon–Sun).

**Read first:** `context/clients/veltuff-report-style.md` — structure, voice rules, and the three standing content requirements (full-budget-spent line, fee maths, Shopify sales basis). Follow it exactly.

## Steps

1. **Refresh Meta data**
   ```bash
   npx tsx scripts/sync/sync-meta-ads.ts
   ```
   If it fails with HTTP 401, META_ACCESS_TOKEN in `.env.local` has expired — stop and ask Toby to refresh it from Meta Business Manager. Do not proceed with stale data without flagging it.

2. **Compute Meta metrics**
   ```bash
   npx tsx scripts/functions/veltuff-weekly-meta.ts
   ```
   Writes `outputs/reports/veltuff/WK<nn>-meta.json`. Check `data_quality.notes` per market — surface any caveats (missing revenue, no YoY history, unconverted currency) to Toby rather than papering over them.

3. **Read the Shopify upload**
   Use the most recent file in `data/veltuff/uploads/` (Toby drops Shopify exports / Stuart's Web_Orders_Report there). If the newest file predates the report week, tell Toby what's missing and either wait or mark the Shopify section as based on the prior upload. Remember the sales basis rule: gross sales from original order values; Shopify retro-deducts submitted return requests.

4. **Compose the email**
   - Subject: `Vendo Weekly — Paid Performance WK<nn>`
   - Structure and voice exactly per the style guide. First Tuesday of the month: include a Month End Summary section.
   - Must include: whether the full Meta budget was spent (targets in `data/veltuff/budgets.json`; if still null, say targets are pending Stuart's budget sheet), and the fee-maths line (blended benefit of performance vs spend net of Vendo fees).
   - Never invent numbers. Every figure must come from the metrics JSON, the upload, or Stuart's own stated figures (attributed as such). If a number is unavailable, omit the line or mark it as pending — do not estimate.
   - Save to `outputs/reports/veltuff/WK<nn>.md`.

5. **Create the Gmail draft** (never send)
   Use the Gmail MCP `create_draft` tool — to: stuart.hames@veltuff.com, from Toby's account, body from the composed email. If Gmail MCP returns an insufficient-scopes error, present the email text to Toby to paste manually and note the connector needs re-authenticating.

6. **Hand off**
   Tell Toby: the draft is ready for review, plus any data caveats from steps 1–3. Toby approves and sends. Do not send on his behalf.
