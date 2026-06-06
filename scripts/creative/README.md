# Creative Sheets — Client → Figma Variables

Drafts the Figma **Variables** import sheet for a dental client so the team only has to QC and fill gaps instead of typing 94 fields by hand.

## The journey

```
/build-creative-sheet "St Clears Dental"   (or a URL, or --batch)
   → resolve website → fetch site → draft 94 values → write Value column → QC the xlsx → import to Figma
```

Run it via the slash command **`/build-creative-sheet`** (see `.claude/commands/build-creative-sheet.md`) — that handles website resolution, fetching and drafting. This folder holds the deterministic pieces it calls.

## Files

| File | Role |
|------|------|
| `master-template.xlsx` | The Figma Variables template (94 fields, `Name \| Type \| Value`). Source of truth — keep in sync with the version Figma imports. |
| `figma-field-spec.json` | Each field's category, `source_type` (factual / factual_price / factual_offer / usp / cta), extraction hint, and CTA default. Regenerate if the template changes. |
| `generate-figma-sheet.ts` | Clones the template and writes **only** the Value column, preserving structure so it re-imports cleanly. |

## Running the generator directly

```bash
# values.json = { "Collection/Variable Name": "value", ... }
npm run creative:sheet -- --client "St Clears Dental Studio" --values /tmp/values.json
# → outputs/creatives/<slug>/<slug>-figma-variables-<date>.xlsx
```

Unknown field names are warned and ignored. Empty/absent fields are left blank.

## Rules

- **Factual data** (prices, address, offers, open-day dates) comes only from the website — never invented.
- **USPs/CTAs** are AI drafts; the team owns final copy at QC.
- **Treatments a practice doesn't offer** are left blank.
- Outputs are gitignored (binary, regenerable, handed off externally).
