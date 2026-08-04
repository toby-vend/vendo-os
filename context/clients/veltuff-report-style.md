# Veltuff — Weekly Report Style Guide

How to write the weekly Vendo report to Stuart Hames (stuart.hames@veltuff.com). Derived from his own "eCommerce & Marketing WK nn" Monday emails (WK 29, WK 31 samples, Jul–Aug 2026). Our report mirrors his cadence and voice so it reads as part of the same conversation.

## Cadence and delivery

- **Send:** Tuesday morning, as a **standalone thread** (not a reply to his email).
- **Subject:** `Vendo Weekly — Paid Performance WK nn` (ISO week number, matching his numbering).
- **Coverage window:** the prior ISO week, Monday–Sunday. Verified against Stuart's own WK31 dashboard: "Jul 27, 2026 – Aug 2, 2026" = ISO-8601 week 31, reported the following Monday. His week numbers are ISO week numbers. Month End Summaries use the calendar month (Jul 1–31), separate from the week grid.
- **Mode (v1):** Claude composes the message text from Toby's uploaded data; Toby copies it into Gmail and sends manually. Never auto-send.
- First Tuesday of the month: add a **Month End Summary** section above the weekly section, as he does.

## Structure

```
Morning Stuart,

Vendo summary for Week nn below.

[Month End Summary — first Tuesday of month only]

Week nn Summary

Meta — UK
- bullets

Meta — EU
- bullets

Shopify view
- bullets

Key Actions
- bullets

Any questions let me know.

Thanks
```

## Voice rules (match his exactly)

- Open "Morning Stuart," (he writes "Morning all,").
- Plain bullets. One metric + one comment per line. No tables, no bold, no headings beyond section names, no emojis, no em dashes.
- Every headline metric carries **YoY %** and, where we have targets, **vs budget %**: "Spend £2,610 -24% YoY and -8% vs budget."
- UK figures in £, EU figures in Kr. (DKK). ROAS as a percentage ("424%"), not a multiple.
- His metric vocabulary: Gross sales, orders, AOV, CvR, blended ROAS, Meta ROAS, PPC ROAS, CAC, returning customer rate, GP1, refund rate, AP orders, clearance share.
- Be blunt about misses. State the miss, then the hypothesis, then the action. He writes "My gut feel is…" — we can flag judgement the same way, but ours should lean on data.
- No praise, no filler, no agency-speak. Short declaratives.
- Close: "Any questions let me know." then "Thanks".

## Standing content requirements (from Stuart's emails — always address)

1. **Full Meta budget spent?** Yes/no with the number. He has chased underspend twice; budget confusion previously caused a shortfall. If underspent, say why and what changes.
2. **The fee maths.** Part of the media budget funds Vendo's fees. He explicitly asked (3 Aug 2026): "I really need your top line report with the other metrics to demonstrate the wider benefit of spending less on ad spend to cover your fees." Include a line comparing spend net of fees against performance delivered (ROAS/CAC improvement, revenue attributed).
3. **Shopify sales basis.** Shopify retroactively deducts sales for submitted return requests (a Jul-2025 bulk closure inflated LY July by ~£10K). Always compute gross sales from original order values and state the basis when quoting YoY.
4. **Meta narrative continuity.** Track the threads he cares about: prospecting/upper-funnel creative vs DPA (catalogue) performance, Meta ROAS vs LY (+62–78% improvements are the trend), CAC trajectory (down from £27 to ~£18).

## Metric priorities (Stuart's, stated 2026-08-04)

Headline metrics — lead every market section with these:
1. **ROAS** — Meta ROAS and blended ROAS/MER (total sales ÷ total ad spend).
2. **Sales increase** — revenue and orders, WoW and YoY.
3. **Awareness → overall performance** — how Meta's upper-funnel presence lifts the whole account. Always report reach, frequency, CPM, CPC, CTR, and prospecting vs retargeting spend split, and connect them to total Shopify sessions/direct traffic where the data allows ("reach up X%, CPM down Y%, and total site sessions/direct sales moved Z%"). Meta-attributed ROAS alone undersells this — the blended view is the proof.

## Weekly upload pack (what Toby exports)

**Meta Ads Manager** — one CSV, campaign level, daily or weekly breakdown, covering the report week (plus the prior week and the same week LY if using compare or a wider range). Columns:
- Amount spent, Purchases, Purchases conversion value, Purchase ROAS
- Reach, Frequency, Impressions, CPM
- Link clicks, CPC (cost per link click), CTR (link click-through rate)
- Optional but useful: Landing page views, Adds to cart, Checkouts initiated, ThruPlays
Campaign names carry the prospecting/retargeting/DPA split — keep them in the export.

**Shopify** (Analytics → Reports) — per store (UK and EU):
- Total sales over time (weekly granularity, prior-year comparison on) — gross sales, discounts, returns, net
- Total orders + AOV over time
- Online store sessions over time and conversion rate over time
- Sessions/sales by traffic source or channel (for the direct/branded lift signal)
- Returning customer rate
Sales basis rule applies: gross from original order values; note that Shopify retro-deducts submitted return requests.

**Month-end pack** — after each calendar month closes, Toby additionally uploads the same Meta and Shopify exports for the full calendar month (1st–last day, prior-year comparison on where available). This feeds the Month End Summary section in the first report after month close, mirroring Stuart's own format (his months are calendar months, separate from the week grid). Name the files so the period is obvious, e.g. `meta-2026-07.csv`, `shopify-uk-2026-07.csv`.

## Data sources

**v1 (current): upload-driven.** Toby uploads both exports each week; no API data is used.
- Meta: newest file(s) in `data/veltuff/uploads/meta/`
- Shopify: newest file(s) in `data/veltuff/uploads/shopify/`
- Budgets: `data/veltuff/budgets.json` (weekly spend and ROAS targets per market) — populate from Stuart's budget sheet when received.

**Later (dormant):** `data/vendo.db` → `meta_insights` via `sync-meta-ads.ts` + `scripts/functions/veltuff-weekly-meta.ts` (account 496760751455236, VELTUFF® UK, DKK-billed; purchase revenue in `action_values`/omni_purchase). Blocked on a fresh META_ACCESS_TOKEN; EU account mapping unconfirmed.
