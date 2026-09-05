# Sword Stall P&L builder

Builds the four-block e-commerce P&L (revenue → cost of delivery → gross margin → direct advertising → contribution margin → opex → net profit) for The Sword Stall.

```
python3 scripts/reports/sword-stall-pnl/build_pnl.py <out.xlsx> scripts/reports/sword-stall-pnl/q2-2026-assumptions.json
```

Inputs: Shopify "Total sales by product variant w COGS" export (path hard-coded at the top of the script), Shopify "Total sales over time" daily export in `data/sword-stall/uploads/shopify/`, Google Ads spend from `vendo.db` (`gads_campaign_spend`), Meta spend from the Triple Whale daily feed export. Assumptions and opex live in the JSON so they can be updated without touching the script. Requires `openpyxl`.

## Google Sheet

Native Google Sheet (editable): https://docs.google.com/spreadsheets/d/1Rb5o2OpnpSzsIPmaIo2tegIk1exMhxK-AcagZS0ZIB4/edit

`build_pnl_sheet.py` is the version in the Blue Sense layout (Gross Revenue → Discount → Return → Shipping → Net Revenue → COGS → Fulfilment & Shipping → Transaction Fees → Gross Margin → Direct Advertising & Marketing → Contribution Margin → OpEx → EBITDA → aMER → aROAS), with detail blocks and a % of net revenue block underneath. Cell colour = basis (white actual, amber estimated, deeper amber assumed, red unknown).

To refresh the Google Sheet: rebuild the xlsx, upload it to Drive via Chrome (patch `HTMLInputElement.prototype.click` for file inputs, New → File upload, then `file_upload` on the created input – the Drive MCP connector rejects the base64 payload), open it and File → Save as Google Sheets. Formulas, fills and number formats survive the conversion.

## Multi-month version (Jan–Aug 2026 and onwards)

```
python3 scripts/reports/sword-stall-pnl/build_pnl_sheet_range.py <out.xlsx> scripts/reports/sword-stall-pnl/2026-jan-aug-assumptions.json --from=2026-01 --to=2026-08
```

Same layout, months as a parameter, real monthly COGS instead of a pro-rated quarter. Native Google Sheets: Jan–Aug 2026 https://docs.google.com/spreadsheets/d/1c5pYjMKAH_ojGd6vgasf4vdrvmlR8kEEGLp8ARQ-gyo/edit · Oct 2025–Aug 2026 https://docs.google.com/spreadsheets/d/1UKUHxlm5iphMceTqi0OKSgpbOns5sChNQWjbv_o1j_c/edit (`2025-10-to-2026-08-assumptions.json`, carries Toby's 5 Sep edits: carrier £4, affiliate £0, Gorgias £0 before Apr 2026, Shopify apps £150)

Inputs live in `data/sword-stall/uploads/shopify/ql/` and come from ShopifyQL run inside the Shopify admin (the Export button and the Shopify MCP both need a download/OAuth step, so this avoids them):
1. Open any report under Analytics → Reports in Chrome, hook `window.fetch` to capture the `AnalyticsShopifyQlQuery` POST, then replay it with your own ShopifyQL (`window.__ql(ql)` in the 4 Sep 2026 session).
2. Daily sales: `FROM sales SHOW orders, gross_sales, discounts, sales_reversals, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales TIMESERIES day SINCE … UNTIL … LIMIT 1000`.
3. COGS per month: `FROM sales SHOW net_items_sold, gross_sales, discounts, returns, net_sales, taxes, total_sales, cost_of_goods_sold, net_sales_with_cost_recorded GROUP BY product_title, product_variant_title, product_variant_sku SINCE <month start> UNTIL <month end> LIMIT 20000`, one call per month.
4. Getting the JSON out of the page: `navigator.clipboard.writeText(JSON.stringify(out))` then `pbpaste > file` (CSP blocks fetch/form POSTs to localhost; the JS tool truncates large returns).
5. Meta comes from the Ads Manager campaign exports in `uploads/meta/` (monthly rows plus a daily export for any month the monthly file only partly covers); Google Ads from `vendo.db` (`npm run sync:gads -- --days=N` to backfill); Vendo fee from `xero_invoices` where synced, otherwise the JSON fallback (marked MIXED).

Assumptions JSON: `monthly` may be a number, a list (one per month) or a `{"YYYY-MM": value}` dict; `status` may be a string or a per-month list; `"xero": true` on an opex line pulls it from Xero.
