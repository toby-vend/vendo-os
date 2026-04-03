# Dental Content Planning

Specialist content calendar and topic planner for dental clients. Designed for Vendo's dental vertical with compliance awareness and seasonal planning built in.

## Inputs Required

- **Client name** — which dental practice?
- **Planning period** — e.g. "Q2 2026", "June 2026", "next 3 months"
- **Key treatments to promote** — e.g. Invisalign, implants, whitening, general dentistry
- **Content channels** — e.g. social media, blog, email, Google Business Profile
- **Compliance region** — UK (GDC), Australia (AHPRA), or other
- **Any specific events or offers** (optional) — e.g. practice anniversary, new dentist joining

## Process

1. Read the client record from the database for context on their services and audience.
2. Check recent Fathom meeting notes for any content direction discussed.
3. Map the planning period against the seasonal hooks calendar below.
4. Generate a content calendar with treatment focus rotation.
5. Apply compliance filters based on the selected region.
6. Save to `outputs/content-plans/[client-name]-[period]-content-plan.md`.

## Seasonal Hooks Calendar

| Month | Seasonal Hook | Treatment Tie-in |
|-------|--------------|-----------------|
| January | New Year, New Smile | Whitening, Invisalign, smile makeovers |
| February | Valentine's Day | Whitening, veneers |
| March | World Oral Health Day (20 Mar) | Check-ups, hygiene, children's dentistry |
| April | Easter / Spring | Family dentistry, children's check-ups |
| May | National Smile Month (UK) | General awareness, hygiene tips |
| June | Summer prep | Whitening, Invisalign progress |
| July/August | Back-to-school prep | Children's check-ups, orthodontics |
| September | Back-to-school | Mouthguards (sports), children's dental |
| October | Stoptober / Halloween | Sugar awareness, decay prevention |
| November | Mouth Cancer Awareness Month | Screening, early detection |
| December | Christmas / Year-end | Gift vouchers, cosmetic consultations, emergency prep |

## Compliance Guidance

### UK (GDC)
- Do NOT use before/after photos without explicit written consent and clear labelling
- Avoid "guaranteed" outcomes — use "may", "can help", "designed to"
- Do not make claims about being "the best" without substantiation
- Include appropriate disclaimers on treatment pages
- Testimonials must be genuine and not misleading

### Australia (AHPRA)
- NO testimonials allowed in advertising
- NO before/after images in advertising
- Avoid creating unreasonable expectations
- Do not use terms like "specialist" unless registered as one
- All claims must be verifiable

## Output Format

```markdown
# Content Plan: [Client Name]
**Period:** [planning period]
**Channels:** [selected channels]

## Monthly Themes

### [Month 1]
**Theme:** [seasonal hook + treatment focus]
**Treatment spotlight:** [primary treatment]

| Week | Channel | Content Type | Topic | CTA | Notes |
|------|---------|-------------|-------|-----|-------|
| W1 | Instagram | Carousel | ... | ... | ... |
| W1 | Blog | Article (800w) | ... | ... | ... |
| W2 | Facebook | Video script | ... | ... | ... |
| W2 | Email | Newsletter | ... | ... | ... |
| W3 | Instagram | Reel/Story | ... | ... | ... |
| W3 | GBP | Post | ... | ... | ... |
| W4 | Facebook | Testimonial | ... | ... | ... |
| W4 | Blog | Article (600w) | ... | ... | ... |

### [Month 2]
[Same structure]

### [Month 3]
[Same structure]

## Content Pillars
1. **Educate** — oral health tips, treatment explainers, myth-busting
2. **Trust** — team introductions, patient stories (compliant), behind-the-scenes
3. **Promote** — treatment spotlights, offers, seasonal campaigns
4. **Engage** — polls, Q&As, interactive content, community

## Blog Topics (SEO)
| # | Title | Target Keyword | Search Intent | Word Count |
|---|-------|---------------|---------------|------------|
| 1 | ... | ... | Informational | 800-1200 |
| 2 | ... | ... | Commercial | 600-800 |

## Compliance Notes
[Region-specific reminders based on selected compliance region]
```

## Quality Checks
- Minimum 3 content pieces per week across channels
- Treatment focus rotates — no single treatment dominates
- Seasonal hooks are used but not forced
- Compliance guidance applied to every content piece
- Blog topics target real search terms (use common dental search queries)
- UK English throughout
