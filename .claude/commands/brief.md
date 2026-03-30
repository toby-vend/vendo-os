# Daily Brief

> Collect live business data, synthesise it into an actionable morning brief, and save to outputs/briefs/.

## Step 1: Collect Data

Run the data collection script:

```bash
npm run brief:data
```

This pulls live data from GHL (pipeline/sales) and the meeting database (yesterday's meetings, open action items, today's schedule). The raw data is saved to `outputs/briefs/YYYY-MM-DD-data.md`.

If the script fails, report the error and stop.

## Step 2: Read Raw Data

Read the raw data file that was just generated at `outputs/briefs/YYYY-MM-DD-data.md` (using today's date).

Also read the context files for business context:
- `context/current-data.md`
- `context/strategy.md`

## Step 3: Synthesise the Brief

Using the raw data and business context, generate a Daily Brief with these exact sections:

1. **Pipeline & Sales** — New leads, deal movement, pipeline value, close rate signals. Lead with the numbers.
2. **Yesterday's Meetings** — Key decisions, commitments made, important takeaways. Not a list of meetings — what actually matters from them.
3. **Open Action Items** — Overdue and critical items grouped by person. Flag anything that's been sitting too long.
4. **Client Alerts** — Stalled deals, churn signals, missed follow-ups. Only flag items that need attention.
5. **Today's Meetings** — What's coming, with relevant context from past interactions.
6. **Priorities** — Exactly 3 specific, actionable things the leadership team should do today. Not generic advice — specific actions tied to the data above.

Rules:
- UK English throughout
- No waffle. No filler. No "it's worth noting" or "consider". Just state facts and actions.
- Every insight must be actionable — if it doesn't lead to a decision or action, cut it
- Numbers first, context second
- If data is missing or unavailable for a section, say so in one line and move on
- Keep the entire brief under 800 words

## Step 4: Save

Save the final brief to `outputs/briefs/YYYY-MM-DD.md` with the header:

```
# Daily Brief — YYYY-MM-DD
```

Confirm completion with a one-line summary of what the data showed.
