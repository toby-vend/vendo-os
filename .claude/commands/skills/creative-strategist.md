# Creative Strategist

AI-powered creative brief and strategy generation tool for Vendo clients.

## Inputs Required

Ask the user for these inputs before generating:

- **Client name** — which client is this for?
- **Campaign objective** — e.g. brand awareness, lead generation, product launch, seasonal push
- **Target audience** — demographics, psychographics, pain points
- **Budget range** (optional) — to inform channel recommendations
- **Key messages or USPs** (optional) — anything the client wants emphasised
- **Competitors** (optional) — who are we positioning against?

## Process

1. Read `context/companies.md` and the client's record from the database to understand their business, sector, and current services.
2. If available, read recent Fathom meeting transcripts for the client to capture any strategic direction discussed.
3. Check `client_health` table for current performance tier and any flagged issues.
4. Generate a full creative strategy document following the output format below.
5. Save the output to `outputs/strategies/[client-name]-[date]-creative-strategy.md`.

## Output Format

```markdown
# Creative Strategy: [Client Name]
**Date:** [today]
**Prepared by:** Vendo Strategy Team

## 1. Situation Overview
- Client background and current position
- Key challenges and opportunities identified

## 2. Campaign Objective
- Primary objective
- Secondary objectives
- Success metrics / KPIs

## 3. Target Audience
### Primary Audience
- Demographics (age, location, income)
- Psychographics (values, motivations, fears)
- Online behaviour and media consumption

### Secondary Audience (if applicable)
- Same structure as above

## 4. Competitive Landscape
- Key competitors and their positioning
- White space / differentiation opportunities

## 5. Brand Positioning
- Positioning statement (one sentence)
- Brand personality / tone of voice
- Key differentiators

## 6. Messaging Pillars
| Pillar | Key Message | Supporting Proof Points |
|--------|-------------|----------------------|
| Pillar 1 | ... | ... |
| Pillar 2 | ... | ... |
| Pillar 3 | ... | ... |

## 7. Channel Strategy
| Channel | Role | Budget Split | KPI |
|---------|------|-------------|-----|
| Meta Ads | ... | ...% | ... |
| Google Ads | ... | ...% | ... |
| SEO / Content | ... | ...% | ... |
| Email | ... | ...% | ... |

## 8. Creative Direction
- Visual style guidance
- Imagery recommendations
- Copy tone and style notes
- Key creative concepts (2-3 directions)

## 9. Timeline
- Phase 1: [dates] — Setup and creative production
- Phase 2: [dates] — Launch and optimisation
- Phase 3: [dates] — Review and iterate

## 10. Next Steps
- [ ] Action item 1
- [ ] Action item 2
- [ ] Action item 3
```

## Quality Checks
- All sections populated with specific, actionable content (no placeholder text)
- Messaging aligns with the client's sector and audience
- Channel strategy is realistic for the stated budget
- Tone matches the client's brand voice
- UK English throughout
- No generic filler — every recommendation should be defensible
