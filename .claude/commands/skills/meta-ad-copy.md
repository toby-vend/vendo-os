# Meta Ad Copy Writer

Generates primary text, headlines, and CTAs for Meta (Facebook/Instagram) ads. Outputs multiple variants for A/B testing across campaign objectives.

## Inputs Required

- **Client name** — which client?
- **Campaign objective** — awareness, traffic, leads, or sales/conversions
- **Target audience** — who are we speaking to?
- **Offer / hook** — what's the compelling reason to act?
- **Landing page URL** (optional) — for context on the destination
- **Tone** — e.g. professional, conversational, urgent, playful, clinical
- **Number of variants** — default 5
- **Ad format** — single image, carousel, video, or all

## Process

1. Read the client record and any brand guidelines from the brand hub.
2. Review recent Meta ad performance from `meta_insights` if available — identify what's working.
3. Generate ad copy variants following Meta's best practices and character limits.
4. Output in a structured, copy-paste-ready format.
5. Save to `outputs/ad-copy/[client-name]-meta-[date].md`.

## Platform Specifications

| Element | Recommended Length | Hard Limit |
|---------|-------------------|------------|
| Primary text | 125 characters (above "See more") | 2,200 characters |
| Headline | 27 characters (truncates on mobile) | 255 characters |
| Description | 27 characters | 255 characters |
| CTA button | Platform-provided options | N/A |

### Available CTA Buttons
- Learn More, Shop Now, Sign Up, Book Now, Contact Us, Get Offer, Get Quote, Subscribe, Apply Now, Download, Watch More

## Output Format

```markdown
# Meta Ad Copy: [Client Name]
**Objective:** [objective]
**Audience:** [audience]
**Date:** [today]

---

## Variant 1: [theme/angle name]

**Primary Text:**
[Copy — keep under 125 chars for full visibility. If longer, ensure the hook is in the first line before "See more".]

**Headline:** [27 chars recommended]
**Description:** [27 chars recommended]
**CTA Button:** [from approved list]

**Rationale:** [1 sentence on why this angle works for the audience]

---

## Variant 2: [theme/angle name]
[Same structure]

---

## Variant 3: [theme/angle name]
[Same structure]

---

## Variant 4: [theme/angle name]
[Same structure]

---

## Variant 5: [theme/angle name]
[Same structure]

---

## Testing Recommendations
- **Test variable:** [what differs between variants — angle, CTA, urgency level]
- **Recommended split:** [e.g. equal budget across top 3, then scale winner]
- **Minimum test duration:** 3-5 days with sufficient budget for statistical significance
- **Key metric:** [based on objective — CPL for leads, CTR for traffic, ROAS for sales]

## Carousel-Specific Copy (if applicable)
| Card | Headline | Description | Image Guidance |
|------|----------|-------------|---------------|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |
| 3 | ... | ... | ... |
```

## Copy Best Practices
- Lead with the benefit or pain point, not the brand name
- Use "you" language — speak directly to the audience
- Include social proof where natural (numbers, outcomes)
- Create urgency without being pushy (for sales/leads objectives)
- Match the tone to the audience and platform placement
- Avoid ALL CAPS for entire sentences (one word for emphasis is fine)
- Avoid excessive emojis — max 1-2 per variant
- Do not use clickbait or misleading claims

## Quality Checks
- All variants are genuinely different angles, not minor rewrites
- Character counts verified for each element
- CTA button matches the campaign objective
- No spelling/grammar errors
- Compliant with Meta advertising policies (no prohibited content)
- UK English throughout
