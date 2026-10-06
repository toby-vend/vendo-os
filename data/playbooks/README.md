# Playbooks — index

Curated strategy playbooks, UK-adapted for Vendo. Claude Code reads these files directly (no vector store). Before any work in a playbook's area, read the matching playbook first and apply it; where a playbook and Vendo's own standards differ, the playbook says so and Vendo's standard wins.

| Area | Read this | Use it for |
|---|---|---|
| Meta account structure | [meta-account-structure.md](meta-account-structure.md) | Campaign/ad set structure, ABO vs CBO, ads per ad set, test budget sizing, retargeting/catalogue/existing-customer layers |
| Meta creative strategy | [meta-creative-strategy-400m.md](meta-creative-strategy-400m.md) | Concepts (persona × angle × offer), hooks, testing volume, metric order (spend first), production budgets |
| Meta creative system 2026 | [meta-creative-system-2026.md](meta-creative-system-2026.md) | Andromeda bundling and sequencing, hook grading, format economics, DPAs and partnership ads, fatigue, AI in production |
| Meta static ads | [meta-static-ads.md](meta-static-ads.md) | Planning, building, testing and judging static image ads |
| Meta ad copy | [meta-ad-copy.md](meta-ad-copy.md) | Primary text, headlines and scripts; awareness and sophistication; the nine beats; UK compliance |
| Meta frequency & fatigue | [meta-frequency-creative-fatigue.md](meta-frequency-creative-fatigue.md) | Diagnosing fatigue and creative-diversity problems from frequency |
| Google Ads | [google-ads-strategy-2026.md](google-ads-strategy-2026.md) | Account structure, PMax vs Shopping, bidding, search/negatives, landing pages, feeds, 90-day rollout (dental, ecom, plant hire) |
| Ecommerce finance | [ecommerce-pl-for-marketers.md](ecommerce-pl-for-marketers.md) | Rebuilding a client P&L (UK VAT, Xero), contribution margin, first-time P&L, MER |
| Email & SMS | [bfcm-email-sms-2026.md](bfcm-email-sms-2026.md) | BFCM and Q4 Klaviyo planning, 2026 UK dates, PECR consent, CMA/ASA promotion rules |

All playbooks are GBP-only (non-UK source figures are converted and marked approx., or labelled as not a UK benchmark). The same docs live on the shared Drive under Vendo: Templates, Checklists & Resources → Vendo: Paid Media & Creative. If you edit one here, update the Drive copy too.

`yt-doc/` holds the raw video documents (source-currency figures, not for direct use) (`cheatsheet.md` for a quick read, `revision.md` for detail, `transcript.md` for exact quotes and timestamps). The `.md` files at this level are the Vendo-adapted versions; prefer those.

## Adding a playbook

1. Run `yt-doc "<youtube-url>" --out data/playbooks/yt-doc` (or add the source document).
2. Write a UK-adapted `data/playbooks/<slug>.md` in the same format as the others, marking Vendo adaptations.
3. Add a row to the table above.
