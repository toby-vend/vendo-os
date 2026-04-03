# Google Ads RSA Copy Writer

Creates Responsive Search Ad (RSA) copy to Google Ads specifications. Generates headlines, descriptions, and pinning recommendations for maximum ad strength.

## Inputs Required

- **Client name** — which client?
- **Keyword theme** — primary keyword group this ad serves
- **Landing page URL** — the destination page
- **Key USPs** — 3-5 unique selling points
- **Offer** (optional) — any current promotion, discount, or incentive
- **Location** (optional) — for local targeting (e.g. "London", "Manchester")
- **Competitors to differentiate from** (optional)

## Process

1. Read the client record for brand context and services.
2. Review Google Ads performance data from `gads_campaign_spend` if available.
3. Generate 15 headlines and 4 descriptions following Google's exact specifications.
4. Provide pinning recommendations for maximum control with good ad strength.
5. Save to `outputs/ad-copy/[client-name]-gads-rsa-[date].md`.

## Google Ads RSA Specifications

| Element | Max Characters | Max Count |
|---------|---------------|-----------|
| Headline | 30 characters each | Up to 15 |
| Description | 90 characters each | Up to 4 |
| Display URL paths | 15 characters each | 2 paths |

### Ad Strength Requirements
- **Poor:** < 5 headlines, < 2 descriptions, low diversity
- **Average:** 5-9 headlines, 2-3 descriptions
- **Good:** 10-14 headlines, 3-4 descriptions, diverse messaging
- **Excellent:** 15 headlines, 4 descriptions, high diversity, keywords included

## Output Format

```markdown
# Google Ads RSA: [Client Name]
**Keyword Theme:** [theme]
**Landing Page:** [URL]
**Date:** [today]

---

## Headlines (max 30 characters each)

| # | Headline | Chars | Category | Pin Position |
|---|----------|-------|----------|-------------|
| 1 | [headline] | [count] | Keyword | Pin 1 |
| 2 | [headline] | [count] | Keyword | — |
| 3 | [headline] | [count] | Brand | Pin 1 (alt) |
| 4 | [headline] | [count] | Benefit | — |
| 5 | [headline] | [count] | Benefit | Pin 2 |
| 6 | [headline] | [count] | USP | — |
| 7 | [headline] | [count] | USP | — |
| 8 | [headline] | [count] | CTA | Pin 2 (alt) |
| 9 | [headline] | [count] | Social proof | — |
| 10 | [headline] | [count] | Offer | — |
| 11 | [headline] | [count] | Location | — |
| 12 | [headline] | [count] | Urgency | — |
| 13 | [headline] | [count] | Feature | — |
| 14 | [headline] | [count] | Question | — |
| 15 | [headline] | [count] | Differentiator | — |

## Descriptions (max 90 characters each)

| # | Description | Chars | Pin |
|---|-------------|-------|-----|
| 1 | [description] | [count] | Pin 1 |
| 2 | [description] | [count] | — |
| 3 | [description] | [count] | — |
| 4 | [description] | [count] | — |

## Display URL Paths
- Path 1: /[15 chars max]
- Path 2: /[15 chars max]

## Pinning Strategy

**Recommended pins:**
- **Position 1, Headline:** Pin headline #1 (keyword-rich) OR #3 (brand) — ensures relevance or brand presence
- **Position 2, Headline:** Pin headline #5 (benefit) OR #8 (CTA) — drives action
- **Position 1, Description:** Pin description #1 — strongest value proposition

**Why pin sparingly:** Over-pinning reduces Google's ability to optimise combinations. Only pin where brand safety or message coherence requires it.

## Headline Diversity Checklist
- [x] Contains primary keyword (2-3 headlines)
- [x] Contains brand name (1-2 headlines)
- [x] Benefits-focused (2-3 headlines)
- [x] Includes a CTA (1-2 headlines)
- [x] Social proof / numbers (1-2 headlines)
- [x] Location-specific (1 headline, if applicable)
- [x] Offer/promotion (1-2 headlines, if applicable)
- [x] Question format (1 headline)
- [x] Urgency/scarcity (1 headline)

## Ad Strength: Expected [Excellent]
```

## Copy Rules
- Every headline must make sense standing alone (Google combines them randomly)
- No two headlines should be near-identical — each must add unique value
- Avoid repeating the same CTA in multiple headlines
- Include the primary keyword in at least 2-3 headlines naturally
- Use title case for headlines (capitalise first letter of each major word)
- Descriptions should be complete sentences with a full stop
- Include a CTA in at least one description
- Avoid exclamation marks in headlines (Google policy)
- Do not use ALL CAPS
- No trademark symbols unless required

## Quality Checks
- All headlines ≤ 30 characters (hard requirement — even 31 is rejected)
- All descriptions ≤ 90 characters
- Display URL paths ≤ 15 characters each
- 15 headlines provided (for Excellent ad strength)
- 4 descriptions provided
- No duplicate or near-duplicate copy
- Character counts are accurate (count them)
- UK English throughout
