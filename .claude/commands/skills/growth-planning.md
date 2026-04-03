# Strategist & Growth Planning

Creates quarterly growth strategy documents based on client performance data, meeting insights, and market context. Data-driven recommendations backed by evidence from the Vendo OS database.

## Inputs Required

- **Client name** — which client?
- **Planning period** — e.g. "Q3 2026", "next quarter"
- **Current monthly budget** (optional) — total ad spend across channels
- **Growth ambition** — maintain, moderate growth (10-20%), aggressive growth (30%+), or scale back
- **Any specific goals from the client** (optional) — e.g. "want to open a second location", "launching new service"

## Process

1. Read the client record from the database — current services, MRR, AM, CM, contract dates.
2. Pull recent ad performance from `meta_insights` and `gads_campaign_spend` — last 90 days of spend, CPL/CPA, ROAS trends.
3. Read the latest `client_health` score and breakdown.
4. Search recent Fathom meeting transcripts for the client — extract goals, concerns, strategic direction discussed.
5. Check `xero_invoices` for revenue trend (if available).
6. Check `client_profitability` for current margin.
7. Synthesise all data into a growth strategy document.
8. Save to `outputs/strategies/[client-name]-growth-plan-[quarter]-[date].md`.

## Output Format

```markdown
# Growth Plan: [Client Name]
**Quarter:** [planning period]
**Prepared:** [today]
**Account Manager:** [from client record]

---

## Executive Summary
[3-4 sentences: where the client is, where they should go, and the key strategic shift recommended.]

## Current Performance Snapshot

### Key Metrics (Last 90 Days)
| Metric | Value | Trend | Benchmark |
|--------|-------|-------|-----------|
| Monthly ad spend | £[X] | [up/down/flat] | — |
| Blended CPL/CPA | £[X] | [trend] | £[industry avg] |
| Total leads/conversions | [X] | [trend] | — |
| ROAS (if ecom) | [X] | [trend] | [target] |
| Health score | [X]/100 | [tier] | >70 healthy |
| Client MRR | £[X] | — | — |
| Profitability | [X]% margin | — | >40% target |

### Channel Performance
| Channel | Spend | Results | CPA/CPL | ROAS | Assessment |
|---------|-------|---------|---------|------|-----------|
| Meta Ads | £[X] | [X] | £[X] | [X] | [strong/needs work/underperforming] |
| Google Ads | £[X] | [X] | £[X] | [X] | [assessment] |
| SEO | — | [traffic] | — | — | [assessment] |
| Email | — | [opens/clicks] | — | — | [assessment] |

### Client Sentiment
[Summary from recent Fathom calls — what the client said about goals, satisfaction, concerns. Quote specific insights where possible.]

## Strategic Recommendations

### 1. [Primary Recommendation]
**What:** [specific action]
**Why:** [data-driven rationale — reference the metrics above]
**Expected impact:** [projected improvement]
**Investment required:** [budget, time, resources]
**Timeline:** [when to implement]

### 2. [Secondary Recommendation]
[Same structure]

### 3. [Tertiary Recommendation]
[Same structure]

## Budget Allocation

### Current vs Recommended
| Channel | Current Monthly | Recommended | Change | Rationale |
|---------|----------------|-------------|--------|-----------|
| Meta Ads | £[X] | £[X] | [+/- %] | [why] |
| Google Ads | £[X] | £[X] | [+/- %] | [why] |
| SEO | £[X] | £[X] | [+/- %] | [why] |
| New channel | — | £[X] | New | [why] |
| **Total** | **£[X]** | **£[X]** | **[+/- %]** | |

## Quarterly Goals

| # | Goal | Metric | Target | Deadline |
|---|------|--------|--------|----------|
| 1 | [specific, measurable goal] | [KPI] | [number] | [date] |
| 2 | [goal] | [KPI] | [number] | [date] |
| 3 | [goal] | [KPI] | [number] | [date] |

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| [risk 1] | [H/M/L] | [H/M/L] | [action] |
| [risk 2] | [H/M/L] | [H/M/L] | [action] |

## Upsell Opportunities
[Based on performance data and meeting insights — what additional Vendo services could benefit this client?]
- [Opportunity 1]: [rationale]
- [Opportunity 2]: [rationale]

## Next Steps
- [ ] Present plan to client in next review meeting
- [ ] [Specific action 1]
- [ ] [Specific action 2]
- [ ] Schedule Q+1 review for [date]
```

## Quality Checks
- All metrics pulled from actual database data (not invented)
- Recommendations are specific and actionable (not generic "optimise ads")
- Budget changes are justified with performance data
- Goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Client sentiment reflects actual meeting content
- Upsell suggestions are genuine opportunities, not forced
- Growth ambition matches the recommendation aggressiveness
- UK English throughout
- Currency in GBP unless client operates in another currency
