# Veltuff — Weekly Meta + Shopify Report (mirroring Stuart's format)

**Date:** 2026-08-04
**Client:** Veltuff UK (contact: Stuart Hames, stuart.hames@veltuff.com)
**Goal:** Send Stuart a weekly Vendo report on Meta performance with a Shopify overlay, matching the cadence and structure of his own "eCommerce & Marketing WK nn" Monday emails. He has explicitly requested this: *"I really need your top line report with the other metrics to demonstrate the wider benefit of spending less on ad spend to cover your fees."* (email, 3 Aug 2026)

---

## 1. Style absorption — Stuart's report format

Source: "eCommerce & Marketing WK 29" (20 Jul) and "eCommerce & Marketing WK 31 & Month End Summary" (3 Aug). Sent Monday mornings (10:23 / 12:54) to the full Veltuff + Vendo group, covering the prior ISO week. First Monday of the month adds a "Month End Summary" section on top.

**Skeleton:**
```
Subject: eCommerce & Marketing WK nn [& Month End Summary]

Morning all,

Please see below the summary Week nn. Dashboards also attached.

[Month End Summary — first Monday of month only]

Week nn Summary

UK
- bullet metrics

EU
- bullet metrics

Key Actions
- short bullets

B2B Marketing
- short bullets

Any questions please let me know.

Thanks
```

**Voice rules:**
- Plain bullets, one metric-plus-comment per line. No tables, no headers beyond the section names, no images in body (dashboards attached as PDF).
- Every headline metric carries **YoY %** and **vs budget %** (e.g. "Gross sales £13,074 -24% & -31% on budget").
- UK in £, EU in Kr. (DKK). Metrics vocabulary: Gross sales/Revenue, orders, AOV, CvR, blended ROAS, Meta ROAS, PPC ROAS, CAC, returning customer rate, GP1, refund rate, traffic, AP (account/large) orders, clearance share of cost.
- Honest about misses, no spin — states the miss, then the hypothesis ("My gut feel is…"), then the action ("A deep dive on this will occur").
- Percentages as bare numbers (+18% YoY, -23%), ROAS as percentage (560%), no em dashes needed — his style is short declaratives.
- Ends "Any questions please let me know. / Thanks".

**Standing context to always address (from his emails):**
1. Whether the **full Meta budget was spent** — he has chased this twice; budget confusion previously caused underspend.
2. The **fee-coverage narrative** — part of media budget funds Vendo's fees; our report must show blended benefit (what improved ROAS/CAC delivered vs the reduced spend).
3. **Shopify return-request quirk** — Shopify retroactively deducts sales when return requests are submitted; a Jul-2025 bulk closure of ~18 months of stale requests inflated LY July by ~£10K. YoY sales comparisons must use consistent gross-sales basis and state it.

---

## 2. Our report — proposed shape

Mirror his skeleton but from the Vendo side, sent as a reply in his Monday thread (or own thread — Toby to decide):

```
Subject: Re: eCommerce & Marketing WK nn  (or "Vendo Weekly — Paid Performance WK nn")

Morning Stuart,

Vendo summary for Week nn below.

Meta — UK
- Spend £X vs budget £Y (full budget spent: yes/no + reason)
- ROAS X% (+/-% WoW, +/-% YoY), purchases N, CPA £X
- CAC contribution, top/bottom creative movers, prospecting vs DPA split
Meta — EU
- same, in Kr.

Shopify overlay
- Gross sales, orders, AOV for the week (basis: original order values,
  excluding retro return-request adjustments)
- Blended ROAS, returning customer rate, Meta-attributed revenue share

The fee maths
- Spend net of fees vs performance delivered — the "wider benefit" line he asked for

Key actions
- what we're changing this week

Any questions let me know.
```

---

## 3. Build plan

### Phase 0 — data plumbing (prerequisites)
1. **Revive Meta sync** — `meta_insights` is stale (max date 2026-04-05). Re-auth `META_ACCESS_TOKEN` if needed, run `sync-meta-ads.ts --backfill` (90 days). Veltuff UK account present (`496760751455236`, DKK). **Open question:** his report splits UK/EU — confirm whether EU Meta spend runs from the same DKK account (campaign-level split) or a second account we need access to.
2. **Connect Shopify** — currently not connected (empty `SHOPIFY_API_KEY` placeholder only). Ask Stuart for custom-app Admin API tokens (`read_orders`, `read_customers`) for the UK store and EU/DK store, or grant via Leadsie (Shopify is one of its 31 platforms). Build `scripts/sync/sync-shopify.ts` → weekly gross sales, orders, AOV, returning-customer rate, refund rate per store. Compute gross sales from original order values so retro return adjustments don't distort YoY.
   - **Fallback if API access stalls:** run v1 with Meta data + the numbers from Stuart's own Monday email/PDF (he sends them first), and add the API later.

### Phase 1 — generator
3. `scripts/functions/generate-veltuff-weekly.ts` — ISO-week window (Mon–Sun), pulls Meta + Shopify from `vendo.db`, computes WoW/YoY/vs-budget deltas, renders the email from a template encoding the style rules above. Budgets stored in a small `data/veltuff-budgets.json` (weekly spend + ROAS targets per market — get from Stuart's budget sheet).
4. `context/clients/veltuff-report-style.md` — the style guide above, so any session/agent can regenerate consistently.

### Phase 2 — delivery + automation
5. **Draft, not auto-send** (autonomy guardrail: external client comms need approval). Generator writes the email to `outputs/reports/veltuff/WKnn.md` and creates a Gmail draft (needs Gmail MCP re-auth with compose scopes, or a Gmail API script using existing Google OAuth infra).
6. **Schedule:** cron Monday ~07:00 — run Meta+Shopify sync, generate, draft. Toby reviews and sends Monday afternoon after Stuart's email lands (so ours can reference his numbers) — timing TBC with Toby.
7. Once trusted (4–6 weeks clean), consider graduating to auto-send per the Autonomy Ladder.

---

## 4. Decisions needed from Toby
1. Shopify access route: custom-app API tokens vs Leadsie vs start without (v1 from his PDF numbers).
2. Reply-in-his-thread vs standalone Vendo thread.
3. Landing time: Monday PM (after his) vs Tuesday AM.
4. Confirm EU Meta account situation.
