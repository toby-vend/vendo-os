# Compound — accountant batch (RiskSave review, 6 Oct 2026)

17 concepts × 4 ratios (4:5, 1:1, 9:16, 1.91:1) from RiskSave's accountant batch ticket
(`~/Downloads/Compound_accountant_batch_RS_review.xlsx`). Source: Claude Design project
"Compound branding cheat sheet" (3345d961-3ec4-4bb5-8dac-4760245e66c0) — `Compound Callout Ads.dc.html`
and `Compound Accountant Creatives Premium.dc.html` (copy of the original in `src/`).

## Amends (8 Oct 2026)
- CQ-01, CQ-12: CTA "See the quicker way" → "See how it works" (Nest comparison, COBS 4.5.6R).
- L-01: "Scheme record" quote card → "Example · a typical client setup" rows; risk warning now carries
  the no-advice and employer's-decision lines.
- L-02, L-03: unevidenced "1 hour per client" claim removed (headline, card and "typical time saved" line).
  L-02 headline now "Pension admin, done in the same sitting as payroll."
- All 17: FCA status line added to the risk panel (paid placement, batch condition 1).
- Nest 10+/50+/100+/200+ variants dropped — not in the reviewed batch.

## Build
`python3 build.py` renders the dc sources in headless Chrome, writes `src/harness.html` (Figma capture page)
and `qa/*.png`. Serve `src/` and capture `harness.html` with the Figma MCP.
