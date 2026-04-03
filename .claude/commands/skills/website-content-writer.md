# Website Content Writer

Generates structured website copy for client websites. Produces homepage, service pages, about pages, and supporting content using brand voice and SEO inputs.

## Inputs Required

- **Client name** — which client?
- **Page type** — homepage, service page, about page, contact page, or landing page
- **Primary keyword** — main SEO target for the page
- **Secondary keywords** (optional) — supporting terms
- **Brand voice** — e.g. professional, friendly, clinical, bold, warm
- **Key USPs** — 3-5 unique selling points
- **Target audience** — who is this page for?
- **Competitor URLs** (optional) — for differentiation

## Process

1. Read the client record and brand hub entry if available.
2. Review any existing website content notes from Fathom meetings.
3. Generate structured copy following the page-specific template below.
4. Apply SEO best practices (keyword placement, heading hierarchy, meta tags).
5. Save to `outputs/content/[client-name]-[page-type]-[date].md`.

## Output Format

### Homepage

```markdown
# [Client Name] — Website Homepage Copy

## Meta Tags
- **Meta title:** [max 60 characters, includes primary keyword]
- **Meta description:** [max 155 characters, includes keyword + CTA]

## Hero Section
- **H1:** [primary headline — clear value proposition, includes keyword]
- **Subheadline:** [supporting statement, 1-2 sentences]
- **CTA Button:** [action text]

## Trust Bar
- [Trust signal 1 — e.g. "500+ patients treated"]
- [Trust signal 2 — e.g. "4.9★ on Google"]
- [Trust signal 3 — e.g. "Est. 2010"]

## Services Overview (H2)
[Intro paragraph — 2-3 sentences]

### [Service 1] (H3)
[50-80 words describing the service, benefits-focused]
**CTA:** [link text]

### [Service 2] (H3)
[Same structure]

### [Service 3] (H3)
[Same structure]

## Why Choose [Client] (H2)
[3-4 paragraphs covering key differentiators]

## Social Proof (H2)
[Testimonial placement guidance — 2-3 testimonials]

## FAQ Section (H2)
[4-6 FAQs with schema-ready Q&A format]

## Final CTA Section
- **Headline:** [urgency or value-driven]
- **Body:** [1-2 sentences]
- **CTA Button:** [action text]
```

### Service Page

```markdown
# [Service Name] — Service Page Copy

## Meta Tags
- **Meta title:** [service + location + brand, max 60 chars]
- **Meta description:** [benefit-driven, max 155 chars]

## H1
[Service name with keyword — clear, not stuffed]

## Introduction (200-300 words)
[What the service is, who it's for, key benefits]

## How It Works (H2)
[Step-by-step process, 3-5 steps]

## Benefits (H2)
[Bullet points or short paragraphs — 4-6 benefits]

## Who Is This For? (H2)
[Audience description — pain points addressed]

## Pricing / What to Expect (H2)
[Transparency section — starting prices or "book a consultation"]

## FAQ (H2)
[4-6 questions specific to this service]

## CTA
[Final call to action with urgency]
```

### About Page

```markdown
# About [Client Name]

## Meta Tags
- **Meta title:** [About + brand, max 60 chars]
- **Meta description:** [brand story hook, max 155 chars]

## Our Story (H2)
[Brand origin, mission, values — 200-300 words]

## Our Team (H2)
[Team member bios — name, role, 2-3 sentences each]

## Our Approach (H2)
[What makes the client different — methodology, philosophy]

## Our Values (H2)
[3-5 core values with brief descriptions]

## CTA
[Invitation to connect — consultation, contact, visit]
```

## Quality Checks
- Meta title ≤ 60 characters
- Meta description ≤ 155 characters
- H1 includes primary keyword naturally
- Heading hierarchy is correct (H1 → H2 → H3, no skips)
- Copy is benefits-focused, not feature-focused
- No keyword stuffing — reads naturally
- Tone matches specified brand voice
- UK English throughout
- All placeholder text replaced with specific copy
