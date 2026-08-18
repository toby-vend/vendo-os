# The Ecommerce P&L for Marketers — Vendo Playbook

How Vendo reads, restructures and uses a client's P&L to set financially grounded marketing KPIs. All figures are expressed as percentages of revenue or per-order ratios — never absolute amounts — because Vendo clients bill in different currencies (GBP, DKK, EUR) and pay ad platforms directly.

**Core principle: a marketing win is not a financial win.** ROAS, traffic and in-platform KPIs can all improve while the client makes less money. Set KPIs on financial outcomes (contribution margin, acquisition MER) and work backwards into the ad account.

## How to apply this at Vendo

- **Ecommerce clients (e.g. Veltuff).** Everything applies directly. The weekly Meta + Shopify report's fee-coverage narrative is a contribution-margin argument — this playbook is the underlying framework.
- **Lead-gen clients (dental and other service businesses).** The P&L structure still applies, but "cost of delivery" becomes cost of treatment/service delivery, and the first-time vs returning split maps to new-patient vs existing-patient revenue.
- **MER always means total revenue ÷ total spend** — never attributed revenue. Attributed ROAS over- and under-attributes, and always flatters bottom-of-funnel activity.

---

## 1. The four-block P&L structure

Raw accounting exports (Xero/QuickBooks) are structured for bookkeepers, not decisions. Rebuild every client P&L in a spreadsheet as:

```
Net sales (+ shipping collected)
− Cost of delivery               → GROSS MARGIN
− Direct advertising & marketing → CONTRIBUTION MARGIN
− Operating expenses             → NET PROFIT
```

**Rules:**

- **One revenue definition:** net sales + shipping collected, excluding taxes. Clients routinely quote different internal figures (gross vs net, with/without B2B or tax), which silently distorts every KPI built on top — a claimed MER can be materially overstated purely by definition drift. Pin the definition before setting any target.
- **Cost of delivery is more than COGS.** Three components:
  1. COGS
  2. Transaction fees — assume a flat ~3% of revenue
  3. Shipping & fulfilment — total carrier invoice ÷ orders fulfilled, as a per-order average the client should know off the top of their head
  Stopping at COGS silently overstates margin by enough to turn an assumed 15–20% net profit into single digits.
- **Direct advertising = in-platform spend + influencers only.** Creative and production contractors sit in opex. Marketing is the only cost that should scale when revenue doubles — separating it is what makes growth modelling possible ("if revenue doubled next month, what happens to profit?").
- **Opex** is everything else; in DTC it is ~80–90% people, office/warehouse and software.
- **Always add a percentage-of-revenue column.** Percentages, not absolute amounts, make the P&L readable and comparable month to month.

**Contribution margin has three definitions — always clarify which is meant:**

| Term | Definition | Use instead |
|---|---|---|
| CM1 | Revenue − cost of delivery | Call it gross margin |
| CM2 | Revenue − cost of delivery − marketing | **The** contribution margin — reserve the term for this |
| CM3 | Revenue − everything | Call it net profit |

## 2. Thinking in percentage points

Sales = 100%; cost of delivery, marketing and opex each claim a share; profit is the remainder. Example allocation: 50% delivery + 20% marketing + 10% opex = 20% profit.

**The trap:** if cost of delivery is actually 60% because only COGS was counted, the assumed margin loses 10 points and the client ends the year at half the expected profit "wondering what happened". Sub-eight-figure founders almost never know their numbers precisely — Vendo does the due diligence: take the real export, group its line items into the three buckets, and derive the true percentage allocations before recommending spend levels.

**Gross margin sets the ad budget.** You cannot know what a brand can afford to spend on acquisition without it.

## 3. The zero-profit trap — never cut marketing reflexively

A brand at 70% cost of delivery / 20% opex / 10% marketing / 0% profit will instinctively ask marketing to shrink. That is usually wrong — scaling DTC on a ~5% marketing allocation is essentially impossible.

The correct move is to **increase** marketing allocation to grow top-line revenue, which dilutes largely fixed opex as a percentage (the same opex is half the percentage at double the revenue). Target shape for such a brand: marketing ~20%, opex 5–10%, a small profit buffer. Only trim marketing towards 10–15% **after** scale, when a returning-customer base props up revenue. Cutting spend reactively when a client is losing money usually worsens the position — that spend was generating the top line. The route to profitability is almost always: improve efficiency of current spend **and** spend more.

This argument meets heavy resistance on client calls. Knowing the P&L cold is what lets Vendo make the case confidently.

## 4. Demand levers — the four lines above net revenue

Add these above net revenue (all exportable from Shopify; they rarely flow into accounting software):

| Line | Why it matters |
|---|---|
| Gross revenue | The baseline |
| Discounts | Heavier discounting raises COGS as a % of revenue — same revenue, less profit. Track the discount rate as its own percentage. |
| Returns | A returns spike (e.g. a damaged batch) can wipe out a month's profit while every marketing KPI is green. Significant in fashion. |
| Shipping collected | Psychologically different revenue (value of shipping, not product). High shipping relative to product price can suppress demand — consider lowering shipping and raising product price. |

**Shopify quirk:** the discounts line only captures **checkout codes**, not markdowns (products repriced on-site), so reported discounting understates total price reductions.

**Why it matters:** most "why did gross margin drop?" questions trace to these lines — product mix, cost changes, discounting or returns. On a typical ~10% net margin, losing 4 points of gross margin is ~40% of net profit. Without these lines the cause is invisible and marketing gets blamed by default.

**Diagnostic:** if reducing the discount rate kills demand, the real problem is branding, positioning or price elasticity — not marketing efficiency.

## 5. The P&L as four efficiency questions

1. **Demand** (gross → net revenue)
2. **Efficiency in production** (cost of delivery) — elite is under 20%, i.e. 80%+ gross margin
3. **Efficiency in distribution** (advertising) — exceptional ROAS/CPA, strong product–market fit, or a powerful owned channel
4. **Efficiency in operations** (opex) — 7–9% is only realistic at meaningful scale (roughly eight figures); below that expect 10%+

Every rapidly scaling DTC brand excels at at least one of the three efficiencies — and lean opex at scale is what funds 40–60% distribution allocations that out-advertise competitors.

## 6. First-time vs returning customers — the split that matters most

Build a **first-time-only P&L**: first-time revenue, discounts, returns and fees, carrying **100% of ad spend**. The returning-customer P&L carries zero.

Why all spend goes on first-time: paid social and search should be run as a new-customer acquisition engine with heavy exclusions on existing customers. Advertising to existing customers adds no incremental return over email/SMS — if they like the product, they return anyway.

**The question the first-time P&L answers: are we losing money on acquisition?** Blended profit routinely masks a loss-making acquisition engine funded by returning customers acquired months or years earlier. A month can look healthy blended while first-time is underwater — scaling spend from there just scales losses. Check cohort behaviour: blended CAC vs gross-profit contribution at 30/90/180 days, and whether cohorts ever repay CAC.

**Running first-time deliberately at a loss** requires granular cohort-lift tracking, external financing and a highly experienced operator. For most Vendo clients: don't.

**Fixing a loss-making first-time P&L:** cut back towards previously profitable spend levels, and make spend more incremental — the usual culprits are brand search, retargeting overspend and missing audience exclusions. Removing non-incremental spend drops straight through to profit.

## 7. Acquisition MER beats blended MER

Blended MER swings with returning revenue that paid ads doesn't influence — a perfectly stable acquisition engine can show blended MER varying by more than 50% across a year purely on returning-revenue fluctuation. Managing ads to blended MER means reacting to noise and constantly changing strategy on a bad signal.

KPI on **acquisition MER** (first-time revenue ÷ ad spend) and set targets to the business's DNA:

- **Consumables / high repeat-rate** (naturally high returning revenue): first-time can run near break-even; repeat purchases fund profit.
- **Considered / one-off purchases** (furniture-like): first-time must be profitable in its own right — target roughly a 20% first-time net margin, implying around a 5× acquisition MER.

Never hold a paid ads partner accountable for returning revenue — it is driven by product drops, email/SMS cadence and business DNA, not ads.

If a metric is avoided because it's "hard to explain to the client", the fix is better communication, not a worse metric. Analysis nobody acts on is worthless — being able to explain *why returns caused last month's dip* or *why spend should be cut* is the deliverable.

## 8. Reading a real accounting export

What to expect when a client shares Xero/QuickBooks access, and how to correct it:

- **Income split by payment provider** (Shopify Payments, PayPal, BNPL providers) — that's how cash hits the bank, not a useful view. Demand levers are usually missing entirely.
- **Cash accounting** (typical below roughly seven-figure-to-mid-seven-figure scale): expenses reconcile when cash moves, so an entire stock purchase lands in one month and COGS swings wildly month to month. Monthly gross margin and profit are near-meaningless — use six-month averages or yearly totals. (Accrual accounting expenses stock as it sells and shows true period profit, but needs a proper accountant; clients stay on cash for simplicity and tax timing.)
- **Advertising lumped as one line inside opex** — pull it out into its own section, split by channel, above opex.
- **Personal write-offs are near-universal in seven-figure brands:** motor vehicles, meals, travel. Add them back as a visual adjustment. A client claiming 2–3% net profit may really be at ~15% once an owner salary and recurring write-offs are accounted for — usually not malicious, and the owner often genuinely believes the business makes no money.
- **Variable costs hiding in opex** (transaction fees, postage/shipping) belong in cost of delivery — they scale with orders, not time.
- **Interest belongs below EBITDA**, not in opex. Structure profit as EBITDA → EBIT → net profit, or inventory-loan repayment timing pollutes monthly "profit" and drives bad decisions.
- **Month-to-month profit swings under cash accounting mostly reflect purchase and repayment timing, not performance.** Diagnose before reacting.

## 9. The working process

The self-built four-block P&L (plus demand levers and the first-time split) is the working tool — anchored in proven data, refreshed monthly because cost of delivery moves with discounting and marketing KPIs must move with it:

1. Get the real P&L and derive **proven yearly percentages** — never accept a claimed "our COGS is X%": COGS %, fulfilment % of revenue (or per order), transaction fee %.
2. Pull ad spend straight from the platforms.
3. Collect opex from the client every couple of months.
4. Generate the top-end numbers (revenue, discounts, returns, shipping collected) from Shopify.
5. Export a first-time-orders-only cut from Shopify for the acquisition P&L.
6. Anchor North Star KPIs to it: contribution amount vs monthly opex (tracked daily/weekly), contribution margin % (holds efficiency **and** volume simultaneously), and acquisition MER.

---

*Source: three-part P&L training series processed via yt-doc on 2026-08-16 (full timestamped notes in `outputs/yt-docs/`). Reframed for Vendo: percentage-based, multi-currency-safe, lead-gen mapping added.*
