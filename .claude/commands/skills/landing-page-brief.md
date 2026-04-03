# Landing Page Brief

Guided brief builder for landing pages. Produces a structured brief document and optionally creates an Asana task for the design/dev team.

## Inputs Required

- **Client name** — which client?
- **Campaign name** — what campaign is this landing page for?
- **Campaign objective** — lead generation, event registration, product purchase, download
- **Target audience** — who will visit this page?
- **Offer / hook** — what are we offering? (e.g. free consultation, 20% off, ebook)
- **Primary CTA** — the one action we want visitors to take
- **Traffic source** — Meta ads, Google Ads, email, organic
- **Desired URL slug** (optional)
- **Design references** (optional) — any URLs or style notes
- **Create Asana task?** — yes/no (default: yes)

## Process

1. Read the client record for brand guidelines, tone, and current services.
2. Collect all inputs from the user via the questions above.
3. Generate the structured brief following the output format.
4. Save to `outputs/briefs/[client-name]-[campaign]-landing-page-brief-[date].md`.
5. If Asana task requested, create a task using the Asana MCP tool:
   - Use `mcp__asana__asana_create_task` with:
     - **name:** "LP Build: [Client] — [Campaign Name]"
     - **notes:** The full brief content
     - **assignee:** Design/dev team lead (ask user or use default)
     - **due_on:** Ask user or default to +10 business days
     - **projects:** Ask user for the Asana project GID

## Output Format

```markdown
# Landing Page Brief

## Overview
| Field | Value |
|-------|-------|
| Client | [client name] |
| Campaign | [campaign name] |
| Objective | [objective] |
| Traffic Source | [source] |
| Target URL | [domain]/[slug] |
| Due Date | [date] |

## Target Audience
- **Who:** [demographics]
- **Pain point:** [what problem are they facing?]
- **Desire:** [what outcome do they want?]
- **Objections:** [what might stop them converting?]

## Offer
- **Primary offer:** [the hook]
- **Value proposition:** [why should they care?]
- **Urgency/scarcity:** [if applicable — e.g. limited time, limited spots]

## Page Structure

### Above the Fold
- **Headline:** [benefit-driven, includes keyword if from search]
- **Subheadline:** [supporting statement]
- **Hero image/video:** [description of what should be shown]
- **CTA Button:** [text] — [colour recommendation]
- **Trust signals:** [e.g. reviews, logos, certifications]

### Problem / Agitation
[2-3 sentences describing the problem the audience faces]

### Solution
[How the client's service/product solves it — 3-4 bullet points]

### Social Proof
- Testimonial 1: [specific or placeholder guidance]
- Testimonial 2: [specific or placeholder guidance]
- Stats/numbers: [e.g. "500+ clients served"]

### How It Works
1. [Step 1]
2. [Step 2]
3. [Step 3]

### FAQ
1. [Question] — [Answer]
2. [Question] — [Answer]
3. [Question] — [Answer]

### Final CTA
- **Headline:** [urgency-driven restatement]
- **CTA Button:** [same as above-the-fold CTA]

## Form Fields (if lead gen)
| Field | Required? | Notes |
|-------|-----------|-------|
| Name | Yes | First name only for lower friction |
| Email | Yes | |
| Phone | Optional | Include if client needs phone leads |
| [Custom] | ... | ... |

## Technical Notes
- Mobile-first design
- Page load target: < 3 seconds
- Tracking: [Meta Pixel / Google Tag / both]
- Thank-you page: [URL or "create new"]
- Form submission: [destination — CRM, email, webhook]

## Design Notes
[Any specific style guidance, brand colours, imagery direction]
```

## Quality Checks
- Brief is complete enough for a designer to build without follow-up questions
- CTA is clear and singular (one primary action)
- Form has minimal fields for the objective (fewer = higher conversion)
- Mobile experience considered
- Tracking requirements specified
- UK English throughout
