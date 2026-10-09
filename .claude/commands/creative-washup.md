---
description: Refresh the fortnightly creative wash-up page and Sheet from Motion + Fathom
---

# /creative-washup

Rebuild the creative wash-up pack for today's Creative Wash Up call. Usually run
unattended by launchd (`scripts/creative-washup/run.sh`, Fridays 09:00) in a tmux
window. No one is watching, so never stop to ask a question: make the sensible
call, note it in the log line at the end, and carry on. Always do the full run,
even if today's run folder already exists (run.sh decides whether to run at all).
Load tools you need with ToolSearch (e.g. `select:Artifact`).

Scripts live in `scripts/creative-washup/`. Shared caches live in
`data/creative-washup/` (`transcripts.json`, `tags.json`, `artifact.json`,
`sheet.json`). This run's folder is `data/creative-washup/runs/<today YYYY-MM-DD>/`
(call it RUN). The previous run folder is the latest other dated folder there.

## 1. Is there a call today?
Search Google Calendar for "Creative Wash Up". If no event (either "Creative Wash
Up" or "Static Creative Wash Up") starts today, print `No wash-up today` and stop.

## 2. Pull Motion
For every workspace in `scripts/creative-washup/workspaces.json` call
`mcp__claude_ai_Motion_Creative_Analytics__get_creative_insights` with
organizationId from that file, `insightType: SPEND`, `datePreset: LAST_14_DAYS`,
`limit: 25`, `insightGroups: ["defaultKpiMetrics","performance","motion","click","conversion"]`,
`filters: [[{"field":"spend","type":"GREATER_THAN","value":"15","metric":true}]]`.
Fire them in parallel batches; a `waiting` reply means call again with identical
parameters. Large replies are saved to a file and the reply names the path: save
it with `python3 -I scripts/creative-washup/save_raw.py RUN <slug> <that path>`.
A reply with an empty `insights` list means no spend: skip it. A small reply that
has insights inline: Write its full JSON text to `RUN/raw/<slug>.json`. Then run:

    python3 -I scripts/creative-washup/extract.py RUN
    python3 -I scripts/creative-washup/images.py RUN

## 3. Transcripts for new videos
For creatives in `RUN/creatives.json` with `is_video` true, spend of 30 or more,
and a `creativeEntityId` not yet in `data/creative-washup/transcripts.json`, call
`get_creative_transcript` (workspaceId, creativeEntityId, creativeOrigin,
creativeFormat "video"). Store the plain text under the creativeEntityId. Store
an empty string when it is music, under six words, or obvious filler ("Thank
you.", "Music"). Merge into the cache file; never drop existing entries.

## 4. Tag new creatives
For creatives whose `key` is not in `data/creative-washup/tags.json`, assign
format, angle, offer and persona using exactly the values in
`scripts/creative-washup/taxonomy.json`. Look at the image (`RUN/site/img/c<i>.jpg`,
i = index in creatives.json) for statics. Merge into the cache.

## 5. What did we say last time?
Fathom: `find_relevant_meetings` with `title_only: true`, query "creative wash up",
then `get_meeting_summary` for the most recent one or two calls before today.
Note the agreed actions and rules; this fortnight's themes should check them.

## 6. Write RUN/notes.json
Run `python3 -I scripts/creative-washup/build.py RUN --concepts-only` for the
concept tables. Use the previous run's notes.json as the shape:

    { "order": [client names, fixes first then biggest accounts],
      "fixes": [{"client","ads":[exact ad names],"sev":"Fix today|This week|Housekeeping","text"}],
      "themes": [{"title","body","ask"}],            // 4 to 6
      "clients": {"<client name>": ["1 to 4 talking points"]},
      "concepts": ["3 to 6 takeaways from the concept tables"] }

How to write it:
- **Fixes** are copy problems in live ads. Check every price, finance figure,
  review count and claim against the client's memory files in
  `~/.claude/projects/-Users-Toby-1-Vendo-OS/memory/` (e.g. Signature Smiles £90
  exam incl. x-rays, Bond full arch £14,995, MR Mouldings no review counts, Bond
  Aligner Club monthly figures, Zen bonding price). Flag inconsistencies between
  ads in the same account. Carry over last run's fixes that are still live.
- **Themes** measure the fortnight against what was agreed on past calls: 30%+
  thumbstop and 2%+ CTR (12 June), videos under 30 seconds (11 Sept), testing vs
  evergreen budget (25 Sept), persona-led statics (31 July), plus anything new
  from step 5. Each theme ends with a question for the room.
- **Client points** are about improving the creative: what to scale, re-hook,
  re-cut, retire or brief next, naming the ads and the numbers.
- Every number must come from RUN/creatives.json or the concept tables. Never
  invent figures, quotes or names.
- UK English. No em dashes. Plain, direct sentences. Dental View Content counts
  as leads and is always called "leads" (never "results" or "View Content"); never compare website leads with instant-form leads. Never suggest
  pausing a client's campaigns to them.
- Spend is in each account's currency (Dentistry.ie €, Veltuff DKK, Iconic Dent $).

## 7. Build and publish
    python3 -I scripts/creative-washup/build.py RUN

Then publish with the Artifact tool: first `action: "read"` on the url in
`data/creative-washup/artifact.json`, then publish `file_path: RUN/site/index.html`
with that `url`, `root: RUN/site`, and `files` listing `img/c0.jpg` up to the
last image. A publish takes at most 200 files, so send the images in batches of
200 (repeat the publish with the same url, file_path and root for each batch).

## 8. Sheet
    node --env-file=.env.local --import tsx/esm scripts/creative-washup/sheet.ts RUN

## 9. Finish
Log one line with `python3 -I scripts/creative-washup/log.py "<line>"`: creatives,
accounts, fixes found, page url, sheet url, and anything that failed or was
skipped. Then stop.
