# Build Creative Sheet — Client → Figma Variables

> Turn a dental client into a Figma-ready Variables sheet. Fetch the practice website, draft the ~94 creative variables (prices, USPs, CTAs, practice details, offers), leave anything uncertain or not-offered blank, and output an `.xlsx` the team QCs and imports straight into Figma.

---

## What this does

Vendo builds dental creatives in Figma driven by **Variables** imported from a spreadsheet. The master template (`scripts/creative/master-template.xlsx`) defines 94 variables across 18 treatment categories. This command drafts the `Value` column for a given client so the team only has to QC and fill gaps — not type 94 fields from scratch.

**The honest split:**
- **Factual** (practice name, address, location, "from" prices, open-day dates/offers) → pulled from the website. Blank if not published.
- **USPs** → drafted from the site's own copy. These are AI drafts the team finalises.
- **CTAs** → seeded from Vendo defaults in the field spec. The team tweaks wording.
- **Treatments the practice doesn't offer** → left entirely blank.

Never invent prices, addresses, offers, or open-day dates. If it isn't on the site, leave it blank.

---

## Arguments

- `/build-creative-sheet <client name>` — single client; resolve its website from the OS
- `/build-creative-sheet <https://practice-url>` — single client by URL
- `/build-creative-sheet <client name> --url <https://...>` — single client, explicit URL
- `/build-creative-sheet --batch` — all active dental clients in the OS
- `/build-creative-sheet --batch <name1>, <name2>, ...` — a specific list

---

## Reference files

- Field spec: `scripts/creative/figma-field-spec.json` — every field's name, category, `source_type`, extraction `hint`, and CTA `default`.
- Generator: `scripts/creative/generate-figma-sheet.ts` — deterministic; writes only the Value column.
- Template: `scripts/creative/master-template.xlsx`.

---

## Instructions

### Step 1 — Resolve the client(s) and website

For a single client:
1. If a URL was given, use it.
2. Else look up the client in the DB to derive the domain:
   ```bash
   node --env-file=.env.local --import tsx scripts/query/<...> # or:
   python3 -c "import sqlite3;c=sqlite3.connect('data/vendo.db');import sys;print(c.execute(\"SELECT name,email FROM clients WHERE lower(name) LIKE ? OR lower(display_name) LIKE ?\",('%'+sys.argv[1].lower()+'%',)*2).fetchall())" "<client>"
   ```
   Derive the website from the email domain (e.g. `robin@stclearsdental.co.uk` → `https://stclearsdental.co.uk`). If the domain is generic (gmail/outlook/etc.), ask the user for the URL.
3. **Resolve the canonical URL before fetching** — the email domain often redirects to the live marketing site. Follow redirects first:
   ```bash
   curl -sS -o /dev/null -w "%{url_effective}\n" -L --max-time 20 -A "Mozilla/5.0" "https://<domain>"
   ```
   (e.g. `stclearsdental.co.uk` → `www.stclearsdentalstudio.co.uk`). Fetch the resolved URL. If WebFetch returns 422 on the apex, use the resolved `www`/canonical URL.

For `--batch`:
```bash
python3 -c "import sqlite3;c=sqlite3.connect('data/vendo.db');[print(r[0]+'|'+(r[1] or '')) for r in c.execute(\"SELECT name,email FROM clients WHERE vertical='dental' AND status='active' ORDER BY name\").fetchall()]"
```
Process each. For batch, spawn one agent per client (parallel) to keep it fast — each agent runs Steps 2–4 and calls the generator. Skip (and report) any client whose URL can't be resolved.

### Step 2 — Fetch the website

Read the spec first: `scripts/creative/figma-field-spec.json`.

Fetch the homepage, then the pages most likely to carry the data:
- treatments / services
- fees / pricing / prices
- membership / plan
- about / about-us
- any current offers / open-day / events page

Use WebFetch. Pull 3–6 pages max per client. If a treatment has its own page (implants, Invisalign, whitening), fetch it for prices and USP material.

### Step 3 — Draft the values

For each field in the spec, by `source_type`:

- **factual / factual_price** — Extract verbatim from the site. Keep the practice's own currency symbol and "from" wording (e.g. `£39`, `From £2,400`). If not published, leave blank. Do not estimate.
- **factual_offer** — Open-day dates, savings, spaces-left, offer details, membership inclusions/price. Only fill if a current, specific offer/event is on the site. Otherwise blank.
- **usp** — Draft a short, benefit-led line from the site's copy for that treatment (finance available, free consultation, years of experience, technology, guarantees). Keep it tight and on-brand. These are drafts for QC.
- **cta** — Use the `default` in the spec unless the site strongly implies a better fit.

**Treatment not offered:** if the site shows no sign a practice provides a treatment (no page, no mention), leave every field in that category blank — including its CTA and USPs.

**Never fabricate.** No placeholder names, prices, or dates. Blank is correct when unsure.

### Step 4 — Generate the sheet

Write the drafted values to a temp JSON keyed by exact field name, then run the generator:

```bash
# values.json = { "Collection/Variable Name": "value", ... }
node --import tsx scripts/creative/generate-figma-sheet.ts \
  --client "<Client Name>" \
  --values /tmp/<slug>-values.json
```

Output lands at `outputs/creatives/<slug>/<slug>-figma-variables-<YYYY-MM-DD>.xlsx`. The generator prints a fill/blank summary and warns on any unknown field names (fix typos and re-run if so).

### Step 5 — QC handoff

Report back, per client:
- output path
- count filled vs blank
- which treatment categories were **drafted** vs **left blank because not offered** vs **blank because not published** (this is the QC guide — the team fills the gaps in the xlsx, sanity-checks drafted USPs/CTAs and prices, then imports to Figma)

For batch, end with a one-line table: client | filled/94 | path.

---

## Guardrails

- Factual data (prices, addresses, offers, dates) comes ONLY from the website. Never from memory or inference.
- USP/CTA drafts are clearly the AI's starting point — the team owns final copy.
- The xlsx must keep the template's exact structure (the generator guarantees this — never hand-edit Name/Type columns).
- This is an **Inform/Recommend** function: it drafts, the team QCs. It never publishes creatives.
