# Ad Set Structure Guide: Compound

**Date:** 2026-09-10
**Scope:** Full Meta Ads build structure for the Compound launch. Phased, audience-led, sized to a £2,000/month Meta budget.
**Companion documents:** the ad copy sheet ([Google Sheet](https://docs.google.com/spreadsheets/d/1Q21mkKxtwZcjyoedJwN4myvJ0yUqxutqpWP4Che0-f4/edit), repo copy `compound-meta-2026-09-10.md`) and the RiskSave approval record.
**Sources:** Vendo growth proposal 23/07/2026 (budget, audiences), Compound kick-off call 27/08/2026, RiskSave approvals 09-10/09/2026.

---

## 1. The constraint that shapes everything

The proposal sets **£2,000/month Meta spend, which is about £66 a day**. Every structural decision below follows from that number.

Meta needs roughly 50 optimisation events per ad set per week to leave the learning phase. At £66/day against a B2B demo booking, the whole account will produce fewer events than a single ad set needs. Split that budget across the five audience folders in the creative pack and every ad set learns nothing, spends unevenly and reports noise.

There is also a cautionary precedent on this account: **£9,000 of Google Ads spend produced zero inbound leads in nine months**, with £50 clicks against a £50/day budget. That failure was partly structural, spreading a small budget thinly across high-cost intent. Do not repeat the shape of it on Meta.

**So: consolidate hard at launch, and let creative rather than ad set splits do the audience work.** There are 19 approved B2B creatives; they are a testing pipeline, not a reason for 19 ad sets.

---

## 2. Structural principles

1. **One buyer psychology per ad set, not one job title.** Accountants, IFAs and payroll bureaus all buy the same thing: relief from managing other people's pension admin. They belong in one ad set at this budget. Umbrella companies and employers are genuinely different purchases and get their own ad sets when they are funded and have somewhere to land.
2. **Creative does the targeting.** Broad UK, Advantage+ audience, no interest stacking. The first line of the primary text and the headline on the static tell the algorithm who to find. "You process 40 payrolls" self-selects a bureau far better than an interest cluster called Accounting.
3. **Creative is also the audience read.** Because segments share an ad set, you learn which audience is responding from *ad-level* results, not ad-set-level. That is the whole reason the ad names carry the copy reference.
4. **4 to 6 ads per ad set.** More than six and Meta starves most of them; the winner never gets clean data. Rotate from the approved pack rather than adding.
5. **Every live ad traces to an approval record.** Each ad name carries its Ref from the copy sheet (e.g. `B2B-02`), which maps to one approved creative and one approved set of copy. This is not tidiness — it is FCA audit trail. If RiskSave asks what is live, the answer is a list of Refs.
6. **Nothing goes live outside the approved pack.** No editing copy in Ads Manager, no swapping a headline to "test something". Any change is a new financial promotion and needs re-approval. Test by rotating in a different approved Ref.
7. **Winners are untouchable.** Never switch off an ad inside an ad set that is hitting KPI. New creative for a winning segment goes into a new ad set once budget supports it.
8. **Batch gating is a launch gate, not a guideline.** Every post in a set must be approved, or formally withdrawn in writing, before any post in that set may go live.

---

## 3. Naming convention

```
Campaign:  CMP P{phase} {AUDIENCE} {objective}
Ad set:    {campaign} | {code} {Segment} | {targeting}
Ad:        CMP P{phase} | {code} | {Ref} {Concept} | {ratio}
```

Worked examples:

```
Campaign:  CMP P1 B2B Leads
Ad set:    CMP P1 B2B Leads | A1 Practices | BROAD-UK-28-64
Ad:        CMP P1 | A1 | B2B-02 Unwanted-Job | 4x5
           CMP P1 | A1 | B2B-16 Objections | CAR
```

**Segment codes**

| Code | Segment | Creative folders |
|---|---|---|
| A1 | Practices | Accountants & IFAs, IFAs, Payroll Bureaus |
| A2 | Umbrella | Umbrella Companies |
| A3 | Employer | General Awareness |
| C1 | Lost-Pot | B2C Awareness |
| RMK | Retargeting | mixed |

**Ratio codes:** `1x1`, `4x5`, `9x16`, `1.91x1`, `CAR` for a five-card carousel.

**Rules**

- The `Ref` is mandatory and never changes. It is the join back to the copy sheet, the approved creative and the RiskSave sign-off date.
- Concept is the folder name, hyphenated, no spaces. Keep it short; the Ref carries the precision.
- Never put a client name, a fee, a projection or anything resembling a claim in a campaign or ad set name. Names appear in exports that go to the client and, potentially, to a regulator.
- Phase number stays with the campaign for its life. A campaign does not get promoted from P1 to P2; a new phase means a new campaign.

**UTMs** — set once at ad level, using Meta's dynamic parameters, so Attio and HubSpot can attribute without manual tagging:

```
utm_source=facebook
utm_medium=paid_social
utm_campaign={{campaign.name}}
utm_content={{ad.name}}
utm_term={{adset.name}}
```

This matters more than usual here. The account's history is spend without traceable leads, and full-funnel attribution into the CRM was a named priority on the kick-off call.

---

## 4. Phase 1 — launch (live now)

B2B only. B2C is batch-gated and cannot launch, so B2B takes the full budget rather than sitting idle.

### Campaign: `CMP P1 B2B Leads`

**Objective:** Leads. Ad set budget, not CBO — with one funded ad set, CBO adds nothing and removes control.
**Budget:** £66/day, the whole account.

#### Ad set: `CMP P1 B2B Leads | A1 Practices | BROAD-UK-28-64`

The single funded ad set at launch.

| Setting | Value |
|---|---|
| Geography | United Kingdom, all |
| Age / gender | 28-64, all |
| Audience | Broad, Advantage+ audience on. No detailed targeting, no lookalikes (no seed data yet) |
| Placements | Advantage+ placements. The pack has all four ratios, so every placement is covered natively |
| Optimisation | Conversions, Lead event, 7-day click / 1-day view |
| Destination | `/accountants/` and `/payroll-bureau/` per the Ref (see the copy sheet) |
| Budget | £66/day |
| KPI | Cost per demo booked. Cost per landing page view is diagnostic only |

**Ads (6, one per Ref):**

| Ref | Concept | Why it earns a slot |
|---|---|---|
| B2B-02 | Callout – Unwanted Job | Broadest pain, lowest job-title dependency. The volume play |
| B2B-15 | Callout – Other Peoples Clients | Self-selects bureaus without naming them |
| B2B-11 | Blame – Pension Bounced | Sharpest single moment of pain in the pack |
| B2B-17 | Open Apology (Payroll Bureaus) | Long-form founder voice; the differentiated swing |
| B2B-16 | Objections (Carousel) | Handles the three real blockers before the click |
| B2B-04 | Objection – Whole Price List | Price transparency as a hook. Free-for-practice is the strongest single fact |

Held in reserve for rotation: B2B-01, B2B-05, B2B-06, B2B-07, B2B-09, B2B-12, B2B-13, B2B-14, B2B-19, B2B-03.

**Note on B2B-04:** the partner-waiver clause in that copy is not on the approved creative and needs RiskSave sign-off or deletion before this ad is built. Substitute B2B-01 if it is unresolved at launch.

### Held, not built

- **`CMP P1 B2B Umbrella | A2`** — only one approved creative (B2B-10) and no landing page. One creative cannot sustain an ad set. Hold until there is a destination and at least three approved concepts.
- **`CMP P1 B2B Employer | A3`** — same problem (B2B-08 only, no page).
- **`CMP P1 B2C Awareness | C1`** — batch-gated. Build it paused so it is ready the moment the three On Hold creatives are resolved.

---

## 5. Phase 2 — B2C added (trigger: batch gate clears)

B2C was framed on the kick-off call as awareness and long-term audience building, not near-term lead volume. Structure it that way. At £66/day, asking B2C to produce cheap pension consolidations as well as funding B2B will do neither.

### Campaign: `CMP P2 B2C Awareness`

**Objective:** Traffic, optimised for landing page views. Not Leads — there is not enough budget to buy conversion events on both sides of the account, and this campaign's job is reach, brand recall and building a retargeting pool.

#### Ad set: `CMP P2 B2C Awareness | C1 Lost-Pot | BROAD-UK-25-45`

| Setting | Value |
|---|---|
| Geography | United Kingdom |
| Age / gender | 25-45, all. The proposition is "you have left pensions behind", which needs a few job changes behind it |
| Audience | Broad, Advantage+ audience |
| Placements | Advantage+. Stories and Reels carry the 9x16 pack well |
| Destination | `/employee/` |
| Budget | £20/day, taken from B2B (roughly 70/30 B2B/B2C) |
| KPI | Cost per landing page view, plus pool growth. Leads are upside, not the target |

**Ads (4):** B2C-01 Lost Pot Counter, B2C-03 and B2C-04 Pension Texting (the colour A/B, identical copy by design), B2C-05 Trademark – Called Dibs.

Hold B2C-02 and B2C-06 as the rotation bench.

---

## 6. Phase 3 — retargeting (trigger: 1,000+ in the pool)

### Campaign: `CMP P3 RMK Leads`

Do not build this at launch. A retargeting ad set against an empty pool spends on nobody and reports nothing. Wait until site traffic and video engagement give you a pool worth addressing, which on this budget is realistically week 5 to 8.

| Ad set | Audience | Notes |
|---|---|---|
| `CMP P3 RMK Leads \| RMK Practices \| 30D-SITE` | 30-day visitors to `/accountants/` and `/payroll-bureau/` | Objections and price-list creative land hardest here |
| `CMP P3 RMK Leads \| RMK Lost-Pot \| 30D-ENG` | 30-day video and profile engagers | Only once B2C has been running long enough to build one |

**Exclusion discipline:** exclude converters from every prospecting ad set from day one. Set it at build time, not when someone notices.

---

## 7. Budget by phase

| Phase | B2B | B2C | Retargeting | Total |
|---|---|---|---|---|
| P1 (now) | £66/day | held | not built | £66/day |
| P2 (B2C clears) | £46/day | £20/day | not built | £66/day |
| P3 (pool built) | £40/day | £16/day | £10/day | £66/day |

**If budget rises to £4,000/month**, the first thing to buy is not more audiences, it is separation: split A1 Practices into `A1 Accountants` and `A2 Bureaus` so each can be read and optimised independently. Add the Umbrella and Employer ad sets only once they have landing pages and three approved concepts each.

---

## 8. Measurement

- **Primary metric:** cost per demo booked, per segment, read at ad level.
- **Diagnostic only:** CPM, CTR, cost per landing page view. Useful for creative triage, useless as a success measure. The Google history on this account is exactly what happens when traffic metrics are mistaken for outcomes.
- **Attribution:** every lead must arrive in the CRM with its `utm_content`, which is the ad name, which is the Ref. Confirm which CRM before launch — the kick-off call named Attio, and the recent HubSpot thread suggests B2C leads route there instead. Those are different integrations and both need testing with a real submission.
- **Reporting cadence:** creative review weekly from week 2, but do not judge a creative before it has spent roughly 3x its target CPA. At this budget that is about a week per ad.
- **Do not** switch off the account's only funded ad set to "try something". There is no redundancy at £66/day.

---

## 9. Pre-launch blockers

Nothing goes live until these are closed. The first two are hard gates.

| # | Blocker | Owner | Status |
|---|---|---|---|
| 1 | **Meta FCA advertiser verification.** UK financial services advertisers must be verified before ads can run. It is in the Vendo setup scope in the proposal but I have found no confirmation it is complete. It is not instant, so start it now if it has not been done | Vendo | **Unconfirmed** |
| 2 | **Landing pages signed off by RiskSave.** All three are still with them | Compound / RiskSave | Pending |
| 3 | **Ad copy submitted to RiskSave.** The copy in the sheet is a financial promotion and has not itself been approved | Vendo → RiskSave | Not submitted |
| 4 | B2B-04 partner-waiver clause approved or removed | Vendo | Open |
| 5 | Pixel and Conversions API firing, Lead event verified with a real submission | Vendo | Confirm |
| 6 | CRM destination settled (Attio vs HubSpot) and tested end to end | Compound / Vendo | Open |
| 7 | B2C batch gate: the three On Hold creatives amended or formally withdrawn in writing | Compound → RiskSave | Open (blocks P2 only) |
