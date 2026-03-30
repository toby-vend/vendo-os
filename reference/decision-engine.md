# The Decision Learning Engine

> This document explains the 5-step decision learning loop — the mechanism by which your AI OS learns how you think and progressively earns the autonomy to decide on your behalf.

---

## Why This Matters

The endgame of your AI OS is not just to present data. It's to think like you. To understand that when you face a particular type of decision, in a particular context, you consistently go a particular way — and to eventually make that call on your behalf.

But the only way to get there is one decision at a time. Every decision you log trains the system. Every outcome you track validates or corrects its understanding. Over months, patterns emerge. The system doesn't just have your data — it has your judgement.

That's not a chatbot. That's a digital chief operating officer.

---

## The 5-Step Loop

```
    ┌──────────────┐
    │  1. DECIDE   │  ← You make a significant business decision
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │   2. LOG     │  ← System records: what, why, options, expected outcome
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │  3. MATCH    │  ← System finds similar past decisions
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │  4. LEARN    │  ← After 30 days: what actually happened?
    └──────┬───────┘
           |
    ┌──────┴───────┐
    │   5. EARN    │  ← System earns autonomy through accuracy
    └──────┬───────┘
           |
           └───────→ (loops back to step 1)
```

---

### Step 1: Decide

You face a significant business decision. Not every decision — just the ones that matter. Hiring, pricing, strategy shifts, tool investments, client decisions, process changes.

**What qualifies as a "significant decision":**
- It affects revenue, team, or client relationships
- You considered multiple options before choosing
- Someone else might have decided differently
- You'd want to remember the reasoning later

**What doesn't qualify:**
- Routine, obvious choices (which meeting room to book)
- Decisions with only one viable option
- Trivial operational tasks

---

### Step 2: Log

Use the `/decide` command to capture the decision. The system records:

| Field | What to capture |
|-------|----------------|
| **Decision** | What you decided, in one sentence |
| **Context** | What situation led to this decision? What's happening in the business? |
| **Options considered** | What alternatives did you evaluate? |
| **Reasoning** | Why this option over the others? What was the deciding factor? |
| **Expected outcome** | What do you think will happen as a result? |
| **Category** | What type of decision is this? (pricing, hiring, strategy, client, product, etc.) |
| **Companies affected** | Which business(es) does this impact? |
| **Confidence** | How confident are you? (High / Medium / Low) |

**The key insight:** Capturing *why* is more important than capturing *what*. "I chose to raise prices" is useless. "I chose to raise prices because our close rate is 40% which suggests we're underpriced, and I'd rather have fewer clients at higher margins than more clients stretching the team" — that's what trains the system.

---

### Step 3: Match

When you log a new decision, the system searches your decision history for similar past decisions. Over time, this becomes incredibly powerful:

- "You made a similar pricing decision 4 months ago. You raised prices by 20% and close rate dropped from 40% to 32%, but revenue per client increased 25% and profit margin improved. Net positive."
- "Last time you faced a hiring vs. automation decision, you chose to hire. Outcome: the hire took 3 months to ramp up. Worth considering automation this time."
- "You've made 6 decisions about client scope creep. In 5 of them, you chose to have the boundary conversation early. Success rate: 80%."

**Early days:** With few logged decisions, matching won't return much. That's fine — the value compounds. After 50+ decisions, the system starts surfacing genuinely useful patterns.

**Implementation note:** Initially, matching is done by reading through your decision files. As your decision count grows, you can add semantic search (vector database) to find decisions by meaning rather than keywords.

---

### Step 4: Learn

After 30 days (or whatever interval makes sense for the decision type), the system prompts you to review:

- **What actually happened?** Did the expected outcome materialise?
- **Was it the right call?** Knowing what you know now, would you decide the same way?
- **What surprised you?** Anything unexpected that should inform future decisions?
- **Outcome rating:** Success / Partial success / Neutral / Negative

This closes the feedback loop. Without it, the system has predictions but no ground truth.

**The 30-day review can surface in your Daily Brief:** "You made a pricing decision 30 days ago. Time to review the outcome."

---

### Step 5: Earn

As the system accumulates decisions with tracked outcomes, patterns emerge:

- **Decision clusters** — Groups of similar decisions where you consistently go the same way
- **Success patterns** — Types of decisions where your hit rate is >80%
- **Risk patterns** — Types of decisions where outcomes are unpredictable
- **Confidence calibration** — Are your "high confidence" decisions actually more successful?

These patterns are the foundation of progressive autonomy (see `reference/autonomy-ladder.md`):

- **High-accuracy patterns** → System can recommend with confidence
- **Medium-accuracy patterns** → System presents options with historical data
- **Low-accuracy or novel decisions** → System presents data but defers to you

The system earns autonomy by demonstrating that its recommendations match your actual decisions at a high rate. It doesn't guess — it learns.

---

## Decision File Format

When you run `/decide`, the system creates a markdown file in `data/decisions/` with this structure:

```markdown
# Decision: [One-line summary]

**Date:** YYYY-MM-DD
**Category:** [pricing / hiring / strategy / client / product / process / tool / other]
**Companies affected:** [Which business(es)]
**Confidence:** [High / Medium / Low]

## Context
[What situation led to this decision?]

## Options Considered
1. **[Option A]** — [Brief description]
2. **[Option B]** — [Brief description]
3. **[Option C]** — [Brief description] (if applicable)

## Decision
[What you chose and why. Be specific about the reasoning.]

## Expected Outcome
[What you think will happen as a result.]

## Review (30 days)
**Review date:** YYYY-MM-DD
**Actual outcome:** [What actually happened]
**Right call?** [Yes / Partially / No]
**Surprises:** [Anything unexpected]
**Rating:** [Success / Partial / Neutral / Negative]
**Lesson:** [What to remember for similar future decisions]
```

---

## Getting Started

1. **Run `/decide` for your next significant business decision** — Don't wait for the perfect decision. Just start logging.
2. **Aim for 2-3 decisions per week** — Not every decision, just the significant ones.
3. **Set a 30-day calendar reminder** to review your first batch of decisions.
4. **After 20+ decisions**, start looking for patterns. What categories do you decide on most? Where are you most confident? Where are outcomes most unpredictable?
5. **After 50+ decisions**, the matching capability becomes genuinely useful. Past decisions start informing current ones.

The Decision Engine is a long game. Its value compounds exponentially. The founders who start logging decisions today will have an enormous advantage in 6 months.

---

_Log early, log often. Every decision is a training data point for your future AI COO._
