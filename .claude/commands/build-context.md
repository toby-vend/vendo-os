# Build Context — Guided Context Layer Builder

> Walk through each context file interactively, helping the founder populate their AI OS's brain. This is the most important step in building the AI OS.

---

## Philosophy

The Context layer is non-delegable. The founder must build it themselves. But that doesn't mean they have to do it alone — Claude asks the right questions, the founder provides the answers, and Claude structures the content.

Be conversational and efficient. Ask targeted questions. Don't ask for information the founder has already provided. Build momentum — each completed file should feel like visible progress.

---

## Instructions

### Step 1: Assess Current State

Read all 6 context files:
- `context/personal-info.md`
- `context/companies.md`
- `context/team.md`
- `context/strategy.md`
- `context/current-data.md`
- `context/integrations.md`

For each file, determine if it's: **Empty** (template only), **Partial** (some content), or **Complete** (fully populated).

### Step 2: Report Progress

Show a simple status table:

```
Context Layer Status:
  personal-info.md    [Empty / Partial / Complete]
  companies.md        [Empty / Partial / Complete]
  team.md             [Empty / Partial / Complete]
  strategy.md         [Empty / Partial / Complete]
  current-data.md     [Empty / Partial / Complete]
  integrations.md     [Empty / Partial / Complete]
```

### Step 3: Start Building

Work through files in this order (most foundational first):

1. **personal-info.md** — Who you are and how you think
2. **companies.md** — What you're building
3. **team.md** — Who's on your team
4. **strategy.md** — Where you're going
5. **current-data.md** — Where you actually are (numbers)
6. **integrations.md** — What tools and data sources you use

Skip any files that are already complete. Start with the first incomplete file.

### Step 4: For Each File

**Ask focused questions, one section at a time.** Don't dump all questions at once.

For example, for `personal-info.md`, start with:

> "Let's start with the most important file — who you are and how you think. First: what's your role? What are you ultimately accountable for across your business(es)?"

Then after they answer:

> "Good. Now, what's your north star — the one thing you optimise for above everything else?"

And so on through each section of the file.

**After gathering answers for a file:**
1. Write the complete, populated content to the file
2. Show the user what you wrote (brief summary, not the whole file)
3. Ask if anything needs adjusting
4. Move to the next file

### Step 5: Wrap Up

After all files are populated (or the user wants to stop):

1. Show the updated status table
2. Summarise what was built
3. Recommend the next step based on where they are in the build path:
   - If Context is now complete: "Your Context layer is done. Next step: plan your Data layer with `/create-plan`"
   - If partially complete: "Good progress. Run `/build-context` again next session to continue."

---

## Tone

- Conversational, not clinical
- Encouraging but not sycophantic
- Move at pace — don't over-explain each question
- If the founder gives short answers, ask follow-up questions to draw out more detail
- If they give detailed answers, structure them efficiently and move on

---

## Important Rules

- **Never fill in answers for the user.** Ask, don't assume. The whole point is that this comes from the founder's brain.
- **Use their actual words and phrasing** where possible. Don't corporate-speak their authentic voice.
- **Be specific about what you need.** "Tell me about your business" is too vague. "What service do you deliver, to whom, and how do you charge for it?" is actionable.
- **One file at a time.** Complete each file before moving to the next. Visible progress builds momentum.
- **Save frequently.** Write to the file after completing each section, not just at the end. Don't risk losing work.
