# Meta Account Structure — Vendo Playbook

How Vendo decides the campaign, ad set and ad structure of a Meta account: when to consolidate, when to segment, when to use ABO or CBO, how many ads go in an ad set, how to size tests, and what the support layers (retargeting, existing customers, catalogue ads) should look like. The source material is written for large ecommerce brands, mostly in US/Australian markets; this version restates it for UK dental, ecommerce and lead-gen accounts at Vendo budget levels. Source: Blue Sense Digital, "ABO vs CBO (Which One You Should Use)" and "How To Structure A Meta Ads Account At Every Spend Tier In 2026" (2026).

**Core principle: consolidate by default, segment only for a commercial reason.** Meta keeps conversion data largely within each campaign, so every extra campaign splits the signal the algorithm learns from. Add structure only when the business genuinely needs it (different margins, non-overlapping audiences, separate locations or regions, or very low conversion volume), and make sure every layer still produces data you can read and act on.

## How to apply this at Vendo

Vendo's internal Meta campaign setup SOPs (dental and service-based) always take precedence over this playbook. Where the source disagrees with a Vendo standard, the Vendo standard wins and is flagged below as **Vendo standard:**.

**Every Vendo client sits in the source's lowest spend tier.** The source's "small" tier runs up to roughly £40,000 a month (approx. conversion). Vendo's dental packages run media spend of roughly £1,500 to £3,000 a month, with bolt-ons adding a few thousand more. Read the lowest-tier guidance as the ceiling of complexity, and simplify further for single-practice budgets.

**Dental (private UK practices, high-ticket treatments, long consideration).**
- Follow the dental SOP: campaign budget (CBO), campaigns named `VD | Location | Treatment | Objective type` (e.g. `VD | Sutton | SMO | VC`), treatments grouped into themes (Smile Makeover, Missing Teeth, General), 3–5 mile radius, View Content as the conversion event.
- The theme grouping *is* the consolidation step: three themes rather than one campaign per treatment. Do not split further (by age, placement, or individual treatment) without a commercial reason.
- Multi-practice groups: separate catchments are a legitimate reason to segment by location, because each practice is a non-overlapping audience with its own targets. Confirm the ad's target areas with the practice; they are often different from the practice's own town.
- Run fewer concepts at once rather than thinning each ad set below three ads.
- Read results as cost per lead, where View Content counts as leads in reporting. Never compare View Content CPL against instant-form CPL; they are separate benchmarks.

**Ecommerce (Shopify brands).**
- The source framework applies most directly here: one testing campaign by concept, an existing-customer layer where repeat purchase justifies it, catalogue (dynamic product) ads judged on 7-day click and kept as a capped support layer.
- Answer the five structure questions (below) per brand. Margin spread, product categories and regions decide the structure, not a template.
- Use the ABO/CBO seasonal switch: CBO for peak trading (Black Friday through December), ABO for the January–February testing window.
- Anchor performance on Shopify revenue, not pixel or Triple Whale attribution, when deciding whether a structure is working.
- Billing in a local currency is the one sound reason for a separate ad account by region (Veltuff bills in DKK). Reporting convenience is not.

**Plant hire and other lead-gen services.**
- Follow the service-based SOP: Leads objective, website conversion with the Lead event, location as the main filter, Advantage+ placements, daily budget = monthly ÷ 30.4. Instant forms need internal sign-off under the SOP.
- High-value hire with low lead volume behaves like the source's "high AOV, low conversion volume" case: consolidate hard, and be cautious with CBO across many ad sets (see the ABO vs CBO section).

**Rules that apply to every client.**
- **Vendo standard:** attribution is 7-day click only on every ad set. No engaged-view, no view-through. Set it before publishing; it cannot be changed afterwards without duplicating the ad set.
- **Vendo standard:** ad names follow `<Ad set concept> | Format | Talent | Detail | YYMMDD`. Never leave "Copy" in a name, and drop unknown fields rather than padding with "-".
- **Vendo standard:** ad spend is the client's pass-through media budget, never Vendo revenue. Test budgets, scaling increases and production spend all come out of the client's agreed budget; any increase needs client agreement first.
- **Vendo standard:** Vendo never offers a client a campaign pause. If the structure is failing the four-question diagnostic, the options are to continue or restructure.

## How Meta decides where the money goes

**What you see is not what Meta optimises.** Ads Manager shows last-click credit and ad-level ROAS or CPA. Meta optimises sequences of impressions across several ads, against the target set at the **ad set** level. An ad that looks weak on last-click is often the one warming people up for the ad that takes the credit. Bidding and optimisation are inherited from the ad set, so any bid controls belong there, never at ad level.

**The breakdown effect.** Breakdowns (placement, age, gender, region) show blended returns, not incremental ones. If Stories shows a better return than Feed but Feed holds most of the spend, Meta has usually already tried pushing more into Stories and found no extra return there. Spend distribution at breakdown level is right most of the time. Do not build separate campaigns or ad sets off breakdown data unless you are a very experienced buyer with a specific reason.

**Broad targeting reads the creative.** Meta now analyses the creative and finds the people it thinks will respond, then spreads outward into colder audiences as you scale (which is why ads fatigue and campaigns weaken at higher spend). The source treats interest targeting and lookalikes as dead: interests ignore intent, and the source cites a report claiming around 30% of interest-group members are misassigned. Test landing pages instead of interests.

**Vendo standard:** for local businesses, location is the main filter, not interests. Dental campaigns run a 3–5 mile radius with an audience-size ceiling (under about 750,000 people for budgets under £10 a day, under about 1.5 million above that). Within that radius, keep targeting broad and let the creative do the work.

**Rising costs.** The source claims Meta CPMs inflate around 20–30% a year in its own (mostly non-UK) client data. Treat that as a direction of travel, not a UK benchmark. The practical point holds: efficiency gains come from creative and conversion rate, not from targeting tricks.

## Consolidation versus segmentation

**Why consolidation wins.** Campaigns do not fully share conversion data with each other. An account getting 100 conversions a month split across four campaigns leaves each optimising on about 25, which means worse results through small samples. Accounts tend to stabilise once a campaign gets roughly 100–200 conversions a month. At ad set level the penalty for splitting is much smaller (perhaps 5–10% efficiency, noticeable mainly at scale).

**Vendo standard (dental):** View Content fires far more often than a booked consultation, which is one reason it works as the optimisation event. It gives Meta enough signal to optimise on even at modest budgets. The real reason is compliance: Meta's health-data rules block sending lead events back for private healthcare, so View Content is the permitted proxy. It is not a learning-phase tactic.

**Segment only in these cases:**

1. **Different unit economics.** Categories with very different margins, or full-price vs heavily discounted stock. Consolidate them and spend drifts to the discounted items where margin is thinnest.
2. **Non-overlapping audiences.** For example, a men's range and a women's range in one ad set get served to the wrong gender, because targeting lives at ad set level. For dental, separate practice catchments count here.
3. **High order value or high treatment value with low conversion volume.** With very few conversions, Meta falls back on click-through rate and cost per click, which barely correlate with revenue. These accounts need tighter control (see ABO vs CBO).
4. **Regional inventory or billing.** Stock held in-region with its own sell-through targets, or a separate site or subdomain per region.

**The two non-negotiables for any structure:**

- **Data integrity:** the structure produces data you can read and act on (read, decide, wait, decide again).
- **Commercial alignment:** the structure mirrors how the business makes money (products, margins, locations, goals).

**Five questions before building:**

1. How many product categories or treatment themes are there?
2. How wide is the margin spread between them?
3. Are there genuinely distinct personas that do not overlap?
4. How many regions or locations, and where does the stock or the practice sit?
5. What is the creative throughput? Ten ads a month supports almost no segmentation.

**Two worked examples from the source (same revenue, different structures).** A single-product consumable brand with one persona ran one broad cold campaign per region, with concept testing at ad set level, existing customers excluded, and a small existing-customer campaign. A fashion brand with 50 products, four personas and three regions ran separate campaigns per region (because stock and seasons differed by hemisphere) with category segmentation pushed down to ABO ad sets, plus a catalogue retargeting campaign and an existing-customer campaign. Same revenue, different margin, persona and region profile, different structure.

**What no longer earns its keep** (for almost every Vendo account): daily bid tweaks, daily budget fiddling on small samples, interest targeting, lookalike audiences. **What still matters:** structure aligned to the business, concept-level ad sets, landing page testing, and controlling spend on existing customers.

## The structure by spend tier

The source sets three tiers. Figures below are approximate conversions from the source and are given for orientation only.

| Tier (approx. £/month) | Structure |
| --- | --- |
| **Under ~£40,000** (every Vendo client) | One testing campaign with ad sets by concept (persona × angle × offer), 3–5 ads each; optional scaling campaign only once ads max out; a small existing-customer campaign only where repeat purchase justifies it. Exclude existing customers from cold. 7-day click attribution. |
| **~£40,000 to ~£200,000** | Same core, plus two or three cold campaigns only where there is a commercial reason (a distinct funnel or persona, a category with better lifetime value, a new-arrivals campaign). High creative volume; judge results at concept level. |
| **~£200,000+** | Adds a second ad account on the same pixel with different bidding, a page strategy to get past Meta's live-ad cap, and a mix of bid strategies. Not relevant to current Vendo clients. |

### The core structure at Vendo budgets

**1. Testing campaign (the heart of the account).**
- Ad sets are **concepts**: a persona, an angle and an offer. Creatives made for that concept sit in its ad set.
- **Never touch what is working.** If a concept's ad set is performing and you have new creative for it, launch the new creative as a new ad set beside it. Adding ads to a working ad set resets its sequencing. If the ad set is not performing, adding new creative to it is fine.
- Exclude existing customers from cold testing so returning buyers do not flatter weak ads (ecommerce; for dental, only where the practice's patient list can lawfully be used for this).
- **Vendo standard:** 7-day click attribution.

**2. Scaling campaign (only once earned).**
- Duplicating a maxed-out winner into a separate scaling campaign buys roughly 20% extra daily spend through that creative. The source puts the threshold at ads already spending about £300+ a day (approx.); at around £50 a day the gain is too small to justify the complexity.
- At Vendo budgets this almost never applies. Fix the landing page, the offer or the creative instead.
- When it does apply (larger ecommerce), move winning **post IDs** into the scaling campaign so social proof carries over, and leave the originals running.

**3. Retargeting and existing customers (optional, capped).**
- Around 90% of accounts do not need a website-visitor retargeting campaign; the cold campaign already serves warm visitors. Check via the audience-segment breakdown (new / engaged / existing) once audience segments are set up in advertiser settings.
- Existing-customer spend depends on repeat behaviour. Near-zero repeat (most dental treatments, one-off purchases) means do not bother; high repeat (consumables) means a small, frequency-controlled layer.

**Why this works at small budgets:** conversion volume is low, so consolidation is essential; you need structured creative testing because you do not yet have a proven winner; and the offer range is usually simple enough not to need more.

### How to judge each campaign

- **Testing:** judge at ad set (concept) level against target CPA or ROAS over a sensible rolling window. At low volume, read nothing shorter than about five days. Hitting target means raise the ad set budget in steps of about 20% a day (within the client's agreed budget). Missing target means diagnose the creative, make more ads or concepts, and wind that ad set down.
- **Scaling:** judge at campaign level only.
- **Retargeting:** judge on incremental return and frequency (the source uses under 7 impressions per person per 30 days for retargeting; Vendo's cold-ad frequency standard is separate, see the frequency playbook).

**Common mistakes at the small tier:** testing inside the scaling campaign; no exclusions on the scaling campaign; killing tests far too early; and sizing budgets from Meta's "50 conversions in 7 days" learning-phase advice, which produces absurd budgets for most businesses.

## ABO vs CBO: a risk decision, not a right answer

- **ABO** (budget set per ad set): you decide where the spend goes, so you can force spend into tests.
- **CBO** (budget set at campaign level): Meta distributes one budget across ad sets, chasing the best incremental return.

| | CBO | ABO |
| --- | --- | --- |
| Spend pattern | Roughly 80% of spend into 20% of ads, often just one or two | You decide (e.g. half to the winner, the rest across tests) |
| Efficiency | Generally better (the source puts the gap at about 10%) | Slightly lower |
| Risk | High: when the winner fatigues, the backups are unproven | Lower: tests get spend, so you build a bench of proven winners |
| Best for | Thin margins, peak season, needing efficiency now | Testing periods, consistency, low conversion volume |

**Feeding new creative into a CBO does not fix the risk.** A new ad set each week still gets starved, because Meta has no reason to move budget off the current winner. Nothing gets proven.

**Fatigue follows daily spend, not total spend.** Every ad has a roughly fixed lifetime spend capacity. Ramp it hard and it burns out in about a week; run the same ad at a lower daily spend and it can last about a month. ABO's spread of spend extends winner lifespans and surfaces new winners more steadily.

**Low conversion volume: lean ABO.** When conversions are thin (high order value, high treatment value or low daily spend), CBO optimises "upstream" on click-through rate, cost per click, hook rate and watch time. The source's example: an ad set with a 4% click-through rate and a 1x return took all the spend over ad sets returning 3x and 5x. The source tested this with customer and site-visitor exclusions in place, so it is not a retargeting effect.

**Seasonal switch.** Structure follows the phase of the business and changes through the year:

| Phase | Typical months | Goal | Structure |
| --- | --- | --- | --- |
| Scaling | November–December | Maximum efficiency, risk matters less | CBO, pile spend into the top ads |
| Testing | January–February | Find winners for the year ahead | ABO, rigorous concept testing |

**CBO with minimum ad set spend: the sources disagree.** The ABO vs CBO video found that forcing minimum spend onto test ad sets inside a CBO underperformed a plain ABO (cause unknown; possibly Meta deprioritises constrained ad sets). The spend-tier video and the Vendo creative strategy playbook describe the same agency using CBO with minimum and maximum spend limits as its preferred large-account setup (about 60% of budget controlled, 40% left to Meta), while calling it overkill around £8,000 a month (approx.). Treat min/max limits as a large-account tool. At Vendo budgets, pick ABO or CBO and run it cleanly.

**Vendo standard (dental):** the dental SOP uses campaign budget (CBO). This is compatible with the source's low-volume caution because View Content gives the campaign far more signal than booked consultations would. Still watch for the upstream failure mode: if one theme's ad set takes nearly all the spend on high click-through rate while lead quality from the CRM is poor, raise it rather than letting the CBO run on.

**Vendo standard (service-based and plant hire):** follow the service-based SOP for budget level. Where lead volume is very low across several ad sets, prefer fewer ad sets over relying on CBO to sort them.

**Ecommerce:** choose by risk tolerance and season, using the table above. Vendo's ecommerce restructures typically run CBO for scaling alongside ABO for testing.

## Building ad sets

**How many ads per ad set.** Meta sequences different ads to the same person, mainly within an ad set, because the chance of a purchase drops sharply after two or three views of the same creative.

- **Minimum three.** With one ad, Meta has nothing to sequence to. If the account has one ad per ad set, consolidate: fewer ad sets, more ads in each.
- **Working range:** the ABO vs CBO video aims for 3–6 (up to 10); the spend-tier video gives 3–15, and 3–5 at the small tier; the Vendo creative strategy playbook puts 10+ ads per concept as the ideal for a reliable verdict.
- **At Vendo budgets:** 3–6 ads per ad set, with fewer concepts live rather than thinning ads per concept. Far too many ads (dozens to a hundred) creates too many pathways and risks a never-ending learning phase.

**One concept, one audience per ad set.** Every ad in an ad set should resonate with the same person.

**Keep all awareness stages together.** Put the long storytelling ad and the short offer ad for the same persona in the same ad set. Meta can sequence them, and splitting them creates a trap: the bottom-of-funnel ad set shows a strong return, the top-of-funnel one shows a weak return, and nobody will put more money into the "weak" one even though it feeds the other. For dental, a cheap "book your consultation" ad is often converting people warmed by the educational ads; do not switch off the higher-CPL cold ads on CPL alone.

**Concept matrix.** Plan concepts as persona × angle × offer × ad type, and mirror them in ad sets. The source's teeth-whitening example:

| Persona | Angle | Offer | Ad type |
| --- | --- | --- | --- |
| Coffee drinkers | Whitening without sensitivity | Standard product | UGC |
| Brides | White teeth for your wedding in 14 days | Fast-turnaround bundle | Real-bride testimonial, before and after |
| Smokers | Removing ongoing stains | Subscription | Founder talking head |

When a concept wins, double down: more creative volume for it, a named offer, a matching landing page. For dental, personas come from the treatment problem (a denture wearer whose plate slips, an adult who hides their smile in photos), and before-and-after or patient-story content must follow GDC and ASA/CAP rules.

**Naming.** The source names ad sets by persona / angle / offer / content type / launch date, never "March 7 creatives", so concepts can be filtered and judged across the campaign.

**Vendo standard:** campaign names follow the relevant SOP (dental: `VD | Location | Treatment | Objective type`). Ad set names carry the concept. Ad names follow `<Ad set concept> | Format | Talent | Detail | YYMMDD`, e.g. `Fire Rated | UGC Video | Ryan | Stop Scrolling | 260929`.

## Sizing a test

**Daily testing budget = (target conversions × expected CPA) ÷ test length in days.**

Illustrative numbers only, not a benchmark: 20 target leads × £50 expected cost per lead ÷ 14 days ≈ £71 a day. Meta's "50 conversions in 7 days" advice on the same numbers would need 50 × £50 ÷ 7 ≈ £357 a day for one concept, which is why it is the wrong guide for almost every Vendo account.

**Kill or keep.** Spend at least 3× the target CPA on a concept before deciding (5× if the budget allows):
- 3+ conversions: keep.
- 2: give it a bit more.
- 0–1: cut.

**Test length.** Usually about a week, which covers day-of-week swings and time to purchase. Big brands with short purchase cycles can read in 3–4 days. Small budgets with long consideration (dental treatments, high-value hire) need 10–14 days. Never judge a top-of-funnel ad after one day; the people it warmed up will convert through other ads.

At single-practice dental budgets, the formula usually shows you can afford only one or two proper concept tests at a time. That is the honest answer to give the team, not a reason to under-fund every test.

## Retargeting, catalogue ads and existing customers

- **Retargeting is a capped support layer, not a growth driver.** On cold acquisition ask "where can we spend more?"; on retargeting and existing customers ask "where can we spend less?". Audits often find around half of spend going to existing and engaged audiences with weak incremental value.
- **Do not segment retargeting by warmth** (add-to-cart vs checkout vs page viewers). It raises CPMs and the conversion-rate gain never covers it.
- **Frequency is the core retargeting measure**, alongside incremental return.
- **Catalogue (dynamic product) ads over-claim.** They serve just before purchase and take far more credit than they earn. In the source's audit of a large furniture brand, one catalogue ad set took 57% of the budget and showed about 7x on default attribution but 1.9x on 7-day click. Judge them on 7-day click (Vendo standard) and, for Shopify brands, against Shopify revenue.
- **The catalogue-ad death spiral.** Catalogue ads look great, budget shifts to them, the brand decides new creative is not needed, top-of-funnel spend and production are cut, the funnel feeding the catalogue ads empties, and the account declines over months. Catalogue-ad performance mirrors top-of-funnel investment.
- **Set existing-customer spend as a budget, not a percentage:** number of existing customers × CPM × desired monthly frequency. Govern it with marginal profitability and frequency. A percentage swings with list size and cold budget and tells you nothing on its own.

## Settings to check on every build

- **Flexible ads: off.** You cannot see which creative drove the result, cropping is uncontrolled, and Meta can assemble unapproved carousels.
- **Cost and bid caps: off** for every current Vendo account. The source treats them as worth the attention only around £160,000 a month (approx.) and above.
- **One-day view attribution: off.** **Vendo standard:** 7-day click only, with engaged-view and view-through both set to none.
- **Advantage+ creative optimisations: off**, on each ad and at advertiser-settings level, where automated rules can switch them back on. This is separate from **Advantage+ placements**, which the Vendo service-based SOP keeps on (no manual placements without approval).
- **Audience sync health (ecommerce):** check the email platform's customer-list sync to Meta (e.g. Klaviyo) has not broken. If it has, existing customers are treated as new and both data and spend allocation degrade.

## The four-question diagnostic

1. Does the structure produce data we can read and act on?
2. Does it match how the client actually makes money (treatments, products, margins, locations)?
3. Is it appropriate for the client's spend and creative throughput?
4. Are the support layers (catalogue ads, retargeting, existing customers) aligned with how often customers actually come back?

Any "no" means restructure. **Vendo standard:** the options put to a client are continue or restructure, never a pause.

## Quick reference

| Check | Source says | Vendo standard |
| --- | --- | --- |
| Default stance | Consolidate; segment only for a commercial reason | Same; dental SOP themes and locations are the segmentation |
| Spend tier | Lowest tier up to roughly £40,000/month (approx.) | Every Vendo client is in it; simplify further for single practices |
| ABO vs CBO | Risk vs efficiency; ABO for low volume; CBO in peak season | Dental SOP: campaign budget (CBO) on View Content; ecommerce: CBO scaling + ABO testing |
| CBO with min spend | Disputed between the two source videos | Large-account tool only; not at Vendo budgets |
| Ads per ad set | Minimum 3; 3–6 (up to 10) or 3–15 | 3–6; fewer live concepts on small budgets |
| Ad set contents | One concept, one audience, all awareness stages together | Same |
| Working ad set | Never touch it; launch new creative beside it | Same |
| Test budget | (target conversions × CPA) ÷ days; 3–5× CPA per concept; about a week | Same; 10–14 days for dental and high-value hire; inside the agreed client budget |
| Attribution | 7-day click | **7-day click only**, set before publishing |
| Naming | Persona / angle / offer / type / date | Campaign per SOP; ads by concept, format, talent, detail, launch date (see Building ad sets) |
| Targeting | Broad; interests and lookalikes are dead | Location radius is the filter; broad within it |
| Retargeting | Capped support layer, judged on frequency and incremental return | Same |
| Ecommerce truth | Incremental attribution | Shopify revenue as the anchor |
| Failing structure | Restructure | Continue or restructure; never offer a pause |
