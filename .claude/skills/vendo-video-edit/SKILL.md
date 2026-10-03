---
name: vendo-video-edit
description: Edit a raw talking-head clip into a finished 9:16 social video using Vendo's approved recipe (trim, grade, levelled audio, word-highlight captions, brand cards, a few full-screen text moments, punch-ins, reframe, end card, quiet SFX). Runs unattended from a job folder with brief.json, or applies Frame.io review comments to an existing job. Use for "AI edit", "first cut", "apply comments" on talking-head footage.
---

# Vendo video edit

You are the editor. A job folder holds everything; tools do the mechanical work; you make the editorial calls and check your own output. The approved reference is Max's vox pop episode (3 Oct 2026); `tools/video-edit/examples/max-vox-pops.edit.json` is that edit as a plan.

Tools live in `tools/video-edit/` (when run by `npm run video:edit` you work inside the job folder and the runner gives you their absolute paths):
- `prep.py analyse` / `prep.py base`: footage clean-up (see the file header)
- `compose.py <job>`: builds the composition from `edit.json` (schema: `tools/video-edit/EDIT_SPEC.md`, read it first)
- `npx hyperframes lint|snapshot|render`: validate, look, render

## The job folder

`brief.json` (written by the runner):

```json
{ "mode": "first_cut",
  "source": "/abs/path/raw.mp4",
  "brand": "vendo",
  "concept": "Organic | Vox Pops Episode",
  "section": "Social Ads",
  "ratio": "9x16",
  "notes": "optional editor notes from whoever started the job",
  "comments": [ { "id": "…", "text": "move the card up", "at": 12.4 } ] }
```

You must leave behind: `output.mp4`, `edit.json`, `notes.md` (and `revision.json` in revise mode).

## First cut

1. **Analyse.** `python3 tools/video-edit/prep.py analyse <source> <job>`. Read `transcript.json`, `silences.json` and look at `frames.jpg`.
2. **Choose the trim.** Cut off-take chat before the real take and anything after the last line. Check the first word is not clipped: compare against `silences.json`; if in doubt, cut 3 s around the start with ffmpeg and re-transcribe that window. Leave mid-clip pauses alone in v01 (jump cuts are a later feature).
3. **Build the base.** `python3 tools/video-edit/prep.py base <source> <job> --in A --out B [--crop-x 0..1 for landscape sources]`. Confirm `base.json` shows about −14 LUFS and a true peak at or below −1.5.
4. **Find the safe zones.** Snapshot one frame (`ffmpeg -ss 10 -i public/input-video.mp4 -frames:v 1`) and look at it. Set `focus` to the face, `card_top` so cards end above the hairline, `caption_top` on the chest. Nothing on the face, nothing above 180 px (Instagram/TikTok account name and top bar), nothing below 1600 px (captions, buttons), text inside the middle 80% of the width.
5. **Use any inputs.** If the brief lists `inputs/`, read its README and use B-roll where the speaker talks about that subject (`prep.py broll`, see EDIT_SPEC.md) and a client logo in the ad frame.
6. **Plan `edit.json`.** Recipe for 30–60 s (scale proportionally):
   - 2–3 full-screen `screens`, plain text, never in the first 4 s. At most one `kinetic`, the rest `statement`.
   - 2–4 `cards`, each a different type where it fits (location for a place, checklist when they list things, bar for time or effort, title otherwise).
   - Camera: 2–3 `punch` on emphatic lines, 1–2 slow `push`, at most one `reframe`, and only when the speaker talks about ads or creative.
   - An `end` card over blurred footage with the brand logo, built from the speaker's last line.
   - Keep any one stretch of plain footage under about 6 s.
   - Every event lands on the word it illustrates (use `words.json`).
7. **Compose and check.** `python3 tools/video-edit/compose.py <job>`, then `npx hyperframes lint <job>/public`, then `npx hyperframes snapshot <job>/public --at <one time per event> --no-end --describe false` and **look at the contact sheet**. Fix overlaps, cropped text or cards touching the head, then recompose. Never omit `--describe false`: it would send client frames to a third-party vision model.
8. **Render.** `PRODUCER_BROWSER_GPU_MODE=hardware npx hyperframes render <job>/public -o <job>/output.mp4 --fps <fps>`. Check duration with ffprobe.
9. **Write `notes.md`** for the reviewer (short, plain English): trim points; every on-screen line with its timestamp; anything that is a claim, number, price or offer, flagged for QA; anything you were unsure of.
10. **Name the video** (only when `brief.concept` is null). Write `title.json` from what the speaker actually says, following the editor SOP naming. A person checks it at review, so name what the video is, not what would sound good.
    - `section` "Social Ads": `{ "treatment": "Invisalign", "concept": "Persona | Angle | Offer" }`. Treatment: the service the clip is about, Title Case (`General` if it isn't about one). Persona: who it speaks to, Title Case words, no ages, no hyphens or camelCase (e.g. `Busy Professionals`). Angle: the main message in 2–4 words, Title Case (e.g. `Fast Results`). Offer: the offer or call to action said in the clip (e.g. `Free Consultation`); `No Offer` if none is said. Exactly three parts joined by ` | `.
    - `section` "Organic": `{ "title": "Vox Pops Episode" }`, a short Title Case title, no ` | `.
    - With no concept, on-screen text uses only the speaker's own words (never the name you chose).

## Revise (mode `apply_comments`)

`brief.json` lists `comments` (`id`, `text`, `at` = seconds on the delivered cut, kept as `output-vNN.mp4`). Material a comment asks for (B-roll clips, logos) is in `inputs/` with a README.

1. Read every comment and the current `edit.json`. Look at the delivered cut at each comment's time (`ffmpeg -ss <at> -i output-vNN.mp4 -frames:v 1`) so you see what they saw.
2. Change only what the comments ask for; everything else stays exactly as delivered. Use the features in EDIT_SPEC.md: `y` to move a card, `screens` for full-screen text, `clock` and `question` cards, `broll` (make clips with `prep.py broll`), `frame.logo` / `frame.cta_overlay` in a reframe, `end.style: "fade_black"`.
3. Caption sync complaints: re-check the word timings in that stretch against `silences.json` and, if needed, re-transcribe that window with `--model medium.en`, then correct `words.json`.
4. Compose, check the contact sheet at every changed moment, render, then update `notes.md`.
5. Write `revision.json`: `[{ "id", "done": true|false, "what": "one plain sentence" }]` covering every comment id. If a comment needs something the tools can't do or material you don't have, `done: false` and say exactly what's missing. Never guess at taste calls you can't see.

## Hard rules

- On-screen text uses the speaker's own words or the locked concept string. Never invent offers, prices, statistics, claims or client results.
- UK English. No em dashes. One flourish word per card or line.
- Full-screen moments are plain text: no boxes, strips, rules, page numbers or magazine chrome. Transitions are soft (fade or blur).
- Brand: Vendo content uses `brand: "vendo"`; client content uses that client's brand pack. If the pack doesn't exist, stop and say so in `notes.md`.
- Never mark anything Final. Never upload. The runner handles Frame.io.
- Never edit, create or commit files in the Vendo-OS repo, even to fix a tool. Work around problems inside the job folder and report them under "Tool issues" in `notes.md`; a person decides whether the tool changes.
