# SEO / Blog Content Writer

Generates SEO-optimised blog posts and articles for Vendo clients. Targets specific keywords with structured content designed to rank.

## Inputs Required

- **Client name** — which client?
- **Target keyword** — primary keyword to rank for
- **Secondary keywords** (optional) — related terms to include
- **Topic / angle** — what specifically to cover
- **Tone** — e.g. professional, conversational, authoritative, friendly
- **Word count target** — default 1,200 words
- **Content type** — blog post, guide, listicle, how-to, FAQ, comparison

## Process

1. Read the client record for brand voice and sector context.
2. If available, check Google Search Console data from `gsc_queries` for the client's current ranking on related terms.
3. Research the topic structure — identify the questions people ask, the subtopics to cover, and the search intent (informational, commercial, transactional).
4. Generate the full article following the output format.
5. Save to `outputs/content/[client-name]-blog-[keyword-slug]-[date].md`.

## Output Format

```markdown
# Blog Post: [Client Name]

## SEO Meta
- **Meta title:** [max 60 chars — includes primary keyword near the start]
- **Meta description:** [max 155 chars — includes keyword, benefit, CTA]
- **URL slug:** /blog/[keyword-slug]
- **Target keyword:** [primary]
- **Secondary keywords:** [list]
- **Search intent:** [informational / commercial / transactional]

## Schema Markup Recommendation
- Article schema (BlogPosting)
- FAQ schema (if FAQ section included)
- HowTo schema (if how-to format)

## Article

### [H1 — includes primary keyword naturally]

[Opening paragraph — hook the reader, establish the problem or topic, include primary keyword within first 100 words. 2-3 sentences.]

### [H2 — subtopic 1]

[2-4 paragraphs covering this subtopic. Include secondary keywords naturally. Use short paragraphs (2-3 sentences each) for readability.]

### [H2 — subtopic 2]

[Same structure. Include internal linking opportunity: "Read more about [related topic](/related-page)"]

### [H2 — subtopic 3]

[Continue coverage. Use bullet points or numbered lists where appropriate for scannability.]

### [H2 — subtopic 4] (if needed)

[Additional depth as required by word count target.]

### Frequently Asked Questions (H2)

**[Question 1]?**
[Answer — 2-3 sentences, direct and helpful.]

**[Question 2]?**
[Answer]

**[Question 3]?**
[Answer]

### [H2 — Conclusion / Next Steps]

[Wrap up with key takeaway. Include CTA relevant to the client's service. 2-3 sentences.]

---

## Internal Linking Suggestions
| Anchor Text | Target Page | Context |
|-------------|------------|---------|
| [text] | [URL/page] | [where in article] |
| [text] | [URL/page] | [where in article] |

## External Linking Suggestions
| Anchor Text | Target | Why |
|-------------|--------|-----|
| [text] | [authoritative source] | [adds credibility] |

## Image Recommendations
| Position | Alt Text | Description |
|----------|----------|-------------|
| After H1 | [keyword-rich alt] | [what the image should show] |
| Within section 2 | [descriptive alt] | [what the image should show] |

## Word Count: [actual count]
## Readability: [Flesch-Kincaid target: Grade 7-9 for general, Grade 10-12 for professional]
```

## Quality Checks
- Meta title ≤ 60 characters, includes primary keyword
- Meta description ≤ 155 characters, includes keyword and CTA
- H1 includes primary keyword naturally (not stuffed)
- Primary keyword appears in first 100 words
- Secondary keywords used at least once each
- Heading hierarchy correct (H1 → H2 → H3, no skips)
- At least 3 internal linking opportunities identified
- FAQ section uses question format (for FAQ schema eligibility)
- No keyword stuffing — reads naturally
- Paragraphs are short (2-3 sentences for web readability)
- Meets word count target (within 10%)
- UK English throughout
