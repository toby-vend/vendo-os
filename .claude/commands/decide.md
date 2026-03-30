# Decide — Log a Business Decision

> Log a significant business decision to train your AI OS's Decision Engine. Every decision logged is a training data point for future autonomy.

## Variables

question: $ARGUMENTS (optional — the decision or question you're working through)

---

## Instructions

### If a decision/question was provided:

Guide the user through logging this decision by asking focused questions. Capture all the fields below, then create the decision file.

### If no arguments provided:

Ask: "What decision are you working through? Give me the short version and I'll help you think it through and log it."

---

## Information to Capture

Ask for each of these. If the user gives a detailed initial description, extract what you can and only ask about what's missing.

1. **Decision** — What did you decide (or what are you deciding)?
2. **Context** — What situation led to this? What's happening in the business?
3. **Options considered** — What alternatives did you evaluate? (At least 2)
4. **Reasoning** — Why this option over the others? What was the deciding factor?
5. **Expected outcome** — What do you think will happen as a result?
6. **Category** — What type? (pricing / hiring / strategy / client / product / process / tool / other)
7. **Companies affected** — Which business(es)?
8. **Confidence** — How confident are you? (High / Medium / Low)

---

## Before Logging

If the user is still deciding (not yet committed), help them think through it:

1. **Check for similar past decisions** — Read files in `data/decisions/` to find related decisions. Share relevant outcomes.
2. **Apply their decision filters** — Read `context/strategy.md` and evaluate the options against their stated priorities and filters.
3. **Surface relevant context** — Check `context/current-data.md` for any metrics that inform this decision.
4. **Present a clear recommendation** — Based on their context, filters, and past decisions, suggest which option aligns best. But always defer to their judgement.

---

## Create the Decision File

Save to `data/decisions/YYYY-MM-DD-{descriptive-name}.md` using this format:

```markdown
# Decision: [One-line summary]

**Date:** YYYY-MM-DD
**Category:** [category]
**Companies affected:** [company/companies]
**Confidence:** [High / Medium / Low]

## Context
[What situation led to this decision]

## Options Considered
1. **[Option A]** — [Brief description]
2. **[Option B]** — [Brief description]
3. **[Option C]** — [Brief description] (if applicable)

## Decision
[What was chosen and why. Capture the specific reasoning — this is the most valuable part.]

## Expected Outcome
[What the user expects will happen]

---

## 30-Day Review

**Review date:** YYYY-MM-DD (30 days from decision date)
**Status:** Pending

> When this review date arrives, revisit this decision:
> - What actually happened?
> - Was it the right call?
> - What surprised you?
> - Rating: Success / Partial / Neutral / Negative
> - What lesson should inform future similar decisions?
```

---

## After Logging

1. Confirm the decision has been saved
2. Show the file path
3. Note the 30-day review date
4. If there are similar past decisions in `data/decisions/`, mention them briefly
5. Say: "Decision logged. This is training data point #[N] for your AI OS."

Count the total number of decision files to give the running total. This reinforces the compounding value.
