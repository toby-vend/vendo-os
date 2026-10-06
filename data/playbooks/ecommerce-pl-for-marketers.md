# The Ecommerce P&L for Marketers — Vendo Playbook

How Vendo reads, restructures and uses a client's P&L to set financially grounded marketing KPIs. All figures are expressed as percentages of revenue or per-order ratios — never absolute amounts — because Vendo clients bill in different currencies (GBP, DKK, EUR) and pay ad platforms directly.

**Currency and source note.** The source training is from an Australian agency and its worked examples are in a non-GBP currency (not stated on screen; probably Australian). None of those amounts is a UK benchmark, so this playbook keeps only ratios and percentages. Where a size threshold matters it is given as an approximate GBP conversion and labelled as such. Watch for mixed currencies inside one client: Veltuff's UK Meta ad account bills in DKK while its UK Shopify revenue is in GBP, so ad spend must be converted before any MER is calculated; some other clients bill in EUR. Keep each P&L in the client's trading currency, state the currency in every header, convert ad spend into that currency at a stated rate, and convert to GBP for cross-client totals.

**Core principle: a marketing win is not a financial win.** ROAS, traffic and in-platform KPIs can all improve while the client makes less money. Set KPIs on financial outcomes (contribution margin, acquisition MER) and work backwards into the ad account.

## How to apply this at Vendo

- **Ecommerce clients (e.g. Sword Stall, Veltuff, MR Mouldings).** Everything applies directly. The Sword Stall P&L follows this layout line for line (gross revenue → discounts → returns → shipping → net revenue → COGS → fulfilment → transaction fees → gross margin → direct advertising → contribution margin → opex → EBITDA → acquisition MER). The Veltuff weekly report's fee-coverage narrative is a contribution-margin argument, and this playbook is the framework behind it.
- **Dental clients (lead generation).** The four-block structure still works for a practice, but there is no Shopify. Revenue is treatment revenue from the practice's own systems, "cost of delivery" becomes clinician time, lab fees and materials, and the first-time vs returning split becomes new-patient vs existing-patient revenue. Most dental treatment is VAT-exempt, so the VAT section below mostly doesn't apply (check purely cosmetic services with the practice's accountant). Use this playbook for budget conversations with practice owners, not for weekly reporting.
- **Plant hire clients (lead generation).** Partial fit. Use the contribution-margin logic (can the hire margin carry the marketing cost?) and the "don't cut marketing reflexively" argument. The Shopify sections, discount/returns lines and first-time split mostly don't apply; repeat trade accounts play the role of returning customers.
- **MER always means total revenue ÷ total ad spend** — never attributed revenue. Attributed ROAS over- and under-attributes, and always flatters bottom-of-funnel activity.

**Vendo standards (these override the source where they differ):**

- **Ad spend is the client's cost, paid by the client directly to the platforms.** It sits in the client's direct advertising line. It is never Vendo revenue.
- **Vendo's management fee sits in opex**, alongside other contractor costs (the source puts creative and production contractors in opex too). If a client wants a "total cost of marketing" view, show it as a separate line (ad spend + agency fees + tools) underneath, so the four-block P&L stays clean.
- **Ecommerce revenue anchors on Shopify** (net sales + shipping, excluding VAT), never on pixel, Triple Whale or other platform-attributed revenue. In-platform numbers are for optimisation only.
- **Meta in-platform numbers use 7-day click attribution only**, and they never replace Shopify revenue in a P&L or MER calculation.

---

## 1. The four-block P&L structure

Raw Xero exports are built for bookkeepers, not decisions. (Most Vendo clients use Xero. If a client uses other software such as QuickBooks, Sage or FreeAgent, the same rules apply.) Rebuild every client P&L in a spreadsheet as:

```
Net sales (+ shipping collected), excluding VAT
− Cost of delivery               → GROSS MARGIN
− Direct advertising & marketing → CONTRIBUTION MARGIN
− Operating expenses             → NET PROFIT (EBITDA)
```

**Rules:**

- **One revenue definition:** net sales + shipping collected, **excluding VAT**. Clients routinely quote different internal figures (gross vs net, VAT in or out, B2B or wholesale included), which silently distorts every KPI built on top. The source's own example: a business believed it was running a 4.0 MER, but on a clean revenue definition it was 3.2. In the UK, VAT alone inflates revenue by 20% (a 3.0 MER on VAT-inclusive revenue is really 2.5). Pin the definition before setting any target. See section 2.
- **Cost of delivery is more than COGS.** Three components:
  1. COGS
  2. Transaction fees: the source uses a flat ~3% of revenue as a safe assumption. UK card rates are often lower, but PayPal, buy-now-pay-later (Klarna, Clearpay) and high-risk card processors can be higher. Derive the real rate from the fee lines in Xero (see section 9).
  3. Shipping & fulfilment: total carrier invoices (Royal Mail, DPD, Evri etc.) plus packaging and any 3PL charges, ÷ orders fulfilled. The client should know this per-order average off the top of their head.
  Stopping at COGS silently overstates margin by enough to turn an assumed 20% net profit into roughly 10%.
- **Direct advertising = in-platform spend + influencers only.** Creative, production and agency contractors sit in opex. Marketing is the only cost that should scale when revenue doubles, so separating it is what makes growth modelling possible ("if revenue doubled next month, what happens to profit?"). Doubling a small DTC brand should not need another employee, a bigger warehouse or more software. Only marketing rises.
- **Opex** is everything else; in DTC it is ~80–90% people, office/warehouse and software.
- **Always add a percentage-of-revenue column.** Percentages, not absolute amounts, make the P&L readable and comparable month to month.
- **Ask the client to restructure the P&L in Xero too**, so advertising has its own account codes (split by channel) outside overheads. Tracking categories can help separate channels.

**Contribution margin has three definitions — always clarify which is meant:**

| Term | Definition | Use instead |
|---|---|---|
| CM1 | Revenue − cost of delivery | Call it gross margin |
| CM2 | Revenue − cost of delivery − marketing | **The** contribution margin — reserve the term for this |
| CM3 | Revenue − everything | Call it net profit |

## 2. UK VAT — strip it before any ratio

This is the most common UK-specific error and it is not covered in the source (which assumes a sales-tax market where prices are shown before tax).

- **UK ecommerce prices are VAT-inclusive.** A £60 product at the standard 20% rate is £50 of revenue and £10 of VAT owed to HMRC. VAT is a pass-through to HMRC, not revenue, and must never appear in gross margin, contribution margin or MER.
- **Strip VAT from revenue:** for standard-rated goods, net = gross ÷ 1.2. Some goods are zero-rated (e.g. children's clothing, books) or mixed baskets apply, so use the store's tax report rather than a blanket ÷ 1.2 when the catalogue is mixed.
- **Shopify:** "Total sales" includes taxes; "Net sales" should exclude them when the store's tax settings are correct. Check once per client by reconciling a month of Shopify net sales against Xero sales excluding VAT. Never use order-value totals or ad-platform purchase values for revenue, as they can include VAT and shipping.
- **Ad spend and costs ex VAT too.** VAT-registered clients reclaim input VAT, so COGS, carrier, software and ad costs go into the P&L net of VAT. Check whether a platform invoice shows VAT before using its total.
- **Non-UK stores:** apply the same rule with the local VAT rate (e.g. Denmark is 25%), then state the currency.
- **Dental:** most treatment is VAT-exempt, so revenue is usually already net. **Plant hire:** hire is standard-rated, so strip VAT from hire revenue.

## 3. Thinking in percentage points

Sales = 100%; cost of delivery, marketing and opex each claim a share; profit is the remainder. Example allocation: 50% delivery + 20% marketing + 10% opex = 20% profit.

**The trap:** if cost of delivery is actually 60% because only COGS was counted, the assumed margin loses 10 points and the client ends the year at half the expected profit "wondering what happened". Founders below eight-figure revenue almost never know their numbers precisely. Vendo does the due diligence: take the real export, group its line items into the three buckets, and derive the true percentage allocations before recommending spend levels.

**Gross margin sets the ad budget.** You cannot know what a brand can afford to spend on acquisition without it.

**Traffic and in-platform KPIs are not the goal.** Larger agencies are often KPI'd on traffic (it converts to a spend requirement if conversion rate holds). Like ROAS, it produces marketing outcomes, not necessarily profit. Set the financial target first, then derive the in-platform targets from it.

## 4. The zero-profit trap — never cut marketing reflexively

A brand at 70% cost of delivery / 20% opex / 10% marketing / 0% profit will instinctively ask marketing to shrink. That is usually wrong — scaling DTC on a ~5% marketing allocation is essentially impossible, and demanding a very high ROAS on it doesn't change that.

The correct move is to **increase** marketing allocation to grow top-line revenue, which dilutes largely fixed opex as a percentage (the same opex is half the percentage at double the revenue). Target shape for such a brand: marketing ~20%, opex 5–10%, a small profit buffer. Only trim marketing towards 10–15% **after** scale, when a returning-customer base props up revenue.

Cutting spend reactively when a client is losing money usually worsens the position. In the source's example, the spend cut to match a monthly loss took out about one and a half times its own value in revenue, leaving the business further behind. The route to profitability is almost always: improve efficiency of current spend **and** spend more.

This argument meets heavy resistance on client calls. Knowing the P&L cold is what lets Vendo make the case confidently.

## 5. Demand levers — the four lines above net revenue

Add these above net revenue (all exportable from Shopify; they rarely flow into Xero):

| Line | Why it matters |
|---|---|
| Gross revenue | True product demand before deductions |
| Discounts | Heavier discounting raises cost of delivery as a % of revenue — same revenue, less profit. Track the discount rate as its own percentage. |
| Returns | A returns spike (e.g. a damaged batch) can wipe out a month's profit while every marketing KPI is green. Significant in fashion. |
| Shipping collected | Psychologically different revenue (value of shipping, not product). High shipping relative to product price can suppress demand — consider lowering shipping and raising product price. |

**Shopify quirks:**

- The discounts line only captures **checkout codes**, not markdowns (products repriced on site with a crossed-out price), so reported discounting understates total price reductions. Track markdowns separately.
- Shopify can deduct sales retrospectively when returns are processed, so a past month's figures can change. State the basis and date of any export.

**Why it matters:** most "why did gross margin drop?" questions trace to these lines — product mix, cost changes, discounting or returns. On a typical ~10% net margin, losing 4 points of gross margin is ~40% of net profit. Without these lines the cause is invisible and marketing gets blamed by default. The source's peak-month (November) example shows the problem: revenue was fine, profit was thin, and without the demand lines nobody could tell whether discounting caused it.

**Diagnostic:** if reducing the discount rate kills demand, the real problem is branding, positioning or price elasticity — not marketing efficiency.

## 6. The P&L as four efficiency questions

1. **Demand** (gross → net revenue)
2. **Efficiency in production** (cost of delivery) — elite is under 20%, i.e. 80%+ gross margin
3. **Efficiency in distribution** (advertising) — exceptional ROAS/CPA, strong product–market fit, or a powerful owned channel (an influencer, PR)
4. **Efficiency in operations** (opex) — 7–9% is only realistic above roughly £1.5–2.5m annual revenue (approx. conversion; the source's threshold is in a non-GBP currency); below that, expect opex above 10%

Every rapidly scaling DTC brand excels at at least one of the three efficiencies — and lean opex at scale is what funds 40–60% distribution allocations that out-advertise competitors.

## 7. First-time vs returning customers — the split that matters most

Build a **first-time-only P&L**: first-time revenue, discounts, returns and fees, carrying **100% of ad spend**. The returning-customer P&L carries zero.

Why all spend goes on first-time: paid social and search should be run as a new-customer acquisition engine with heavy exclusions on existing customers. Advertising to existing customers adds no incremental return over email/SMS — if they like the product, they return anyway.

**The question the first-time P&L answers: are we losing money on acquisition?** Blended profit routinely masks a loss-making acquisition engine funded by returning customers acquired months or years earlier. In the source's worked example, a month looked profitable blended, but first-time customers (60% of revenue) lost money and returning customers carried the result. Scaling spend from there just scales losses. Check cohort behaviour: blended CAC vs gross-profit contribution at 30/90/180 days, and whether cohorts ever repay CAC.

**Running first-time deliberately at a loss** requires granular cohort-lift tracking, external financing and a highly experienced operator. For most Vendo clients: don't.

**Fixing a loss-making first-time P&L:** cut back towards previously profitable spend levels, and make spend more incremental — the usual culprits are brand search, retargeting overspend and missing audience exclusions. Removing non-incremental spend drops straight through to profit; in the source's example, cutting the wasted spend roughly doubled net profit.

## 8. Acquisition MER beats blended MER

Blended MER swings with returning revenue that paid ads doesn't influence — a perfectly stable acquisition engine can show blended MER varying by more than 50% across a year purely on returning-revenue fluctuation. Managing ads to blended MER means reacting to noise and constantly changing strategy on a bad signal.

KPI on **acquisition MER** (first-time revenue ÷ ad spend) and set targets to the business's DNA:

- **Consumables / high repeat-rate** (naturally high returning revenue): first-time can run near break-even; repeat purchases fund profit.
- **Considered / one-off purchases** (furniture-like): first-time must be profitable in its own right — target roughly a 20% first-time net margin, implying around a 5× acquisition MER.

Never hold a paid ads partner accountable for returning revenue — it is driven by product drops, email/SMS cadence and business DNA, not ads.

If a metric is avoided because it's "hard to explain to the client", the fix is better communication, not a worse metric. Analysis nobody acts on is worthless — being able to explain *why returns caused last month's dip* or *why spend should be cut* is the deliverable. Match the explanation to the client: some owners want the contribution numbers, others (e.g. Veltuff) need softer evidence such as reach and creative performance alongside them.

## 9. Reading a real Xero export

What to expect when a client shares Xero (or other accounting software) access, and how to correct it:

- **Income split by payment provider** (Shopify Payments, PayPal, Klarna/Clearpay) — that's how cash hits the bank, not a useful view. Demand levers are usually missing entirely.
- **Stock booked to cost of sales when bought.** The source describes cash-basis accounting, which the source says is typical below roughly £3–5m revenue (approx. conversion) in its market. In the UK, limited companies must file annual accounts on an accruals basis, but small brands' monthly management accounts in Xero often have no month-end stock adjustment, so a whole stock purchase lands in one month and COGS swings wildly. The effect is the same: monthly gross margin and profit are near-meaningless. Use six-month averages or yearly totals, or ask whether the accountant posts monthly stock journals.
- **Advertising lumped as one line inside overheads** — pull it out into its own section, split by channel (Google, Meta, influencers, giveaways), above opex.
- **Personal or discretionary costs run through the business are common:** motor vehicles, meals, travel. Add them back as a visual adjustment (no tax effect). A client claiming 2–3% net profit may really be at ~15% once these are normalised. This is usually not malicious, and the owner often genuinely believes the business makes no money.
- **Normalise owner pay both ways.** Source examples add back an above-market owner salary. UK owner-directors often take a low salary plus dividends, and dividends sit below the P&L, so a UK P&L can also *overstate* profit. Put a market-rate owner salary in opex for analysis.
- **Variable costs hiding in opex** (transaction fees, postage, carrier, packaging) belong in cost of delivery — they scale with orders, not time.
- **Interest belongs below EBITDA**, not in opex. Structure profit as EBITDA → EBIT → net profit, or irregular inventory-loan repayments pollute monthly "profit" and drive bad decisions.
- **Question one-off spikes** (a large travel cost, a jump in office costs). One line can be what tipped a month negative.
- **Month-to-month profit swings mostly reflect stock purchase and repayment timing, not performance.** In the source's example, two months' very different results were explained almost entirely by stock timing and a change in ad spend. Diagnose before reacting.

## 10. The working process

The self-built four-block P&L (plus demand levers and the first-time split) is the working tool — anchored in proven data, refreshed monthly because cost of delivery moves with discounting and marketing KPIs must move with it:

1. Get the real P&L from Xero and derive **proven yearly percentages** — never accept a claimed "our COGS is X%": COGS %, fulfilment % of revenue (or per order), transaction fee %.
2. Pull ad spend straight from the platforms (ex VAT, in the account's currency).
3. Collect opex from the client every couple of months.
4. Generate the top-end numbers (gross revenue, discounts, returns, shipping collected) from Shopify, ex VAT.
5. Export a first-time-orders-only cut from Shopify for the acquisition P&L.
6. Anchor North Star KPIs to it: contribution amount vs monthly opex (tracked daily/weekly, so the month stays on course to break even or better), contribution margin % (holds efficiency **and** volume simultaneously), and acquisition MER.

The basic self-built P&L often beats the "real" accounting one for marketing decisions. Use the real export only to extract trustworthy percentages.

---

*Source: Blue Sense Digital three-part training, "How To Breakdown An eCommerce P&L As A Marketer" (Part 1: youtube.com/watch?v=CVFInzOIN0A; Part 2 Intermediate: youtube.com/watch?v=1BcyDtWoeD0; Part 3 Advanced: youtube.com/watch?v=wz5W7V6QwyI), processed 16 August 2026 and audited 6 October 2026. Reframed for Vendo: percentage-based, multi-currency-safe, UK VAT and Xero adapted, lead-gen mapping added.*
