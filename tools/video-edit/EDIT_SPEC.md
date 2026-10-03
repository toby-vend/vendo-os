# edit.json reference

`compose.py` turns this file plus `words.json` into the composition. All times are seconds on the **trimmed** timeline (the same clock as `words.json`). Canvas is 1080x1920.

```json
{
  "brand": "vendo",              // folder in tools/video-edit/brands/
  "duration": 50.5,              // from base.json
  "fps": 25,                     // from base.json
  "focus": [540, 820],           // x,y of the speaker's face: punch-ins zoom around this point
  "card_top": 200,               // top of the card band (must clear the top of the head)
  "caption_top": 1300,           // captions sit on the chest, clear of face and the bottom app UI (> 1600)
  "captions": true,
  "sfx": true,                   // ticks, fill, snap, chime are added automatically from the events below
  "cards": [],
  "screens": [],
  "camera": [],
  "end": {}
}
```

## cards (top band over the footage)

| type | fields | use for |
|---|---|---|
| `title` | `start, end, kicker, title_html, title_at, size?` (70) | one strong phrase |
| `location` | `start, end, kicker, text, type_at` | a place: types itself out next to a pin |
| `checklist` | `start, end, kicker, items: [{text, at}]` | a list the speaker counts through; each tick lands on its word |
| `bar` | `start, end, kicker, title_html, fill_at, fill_dur?, fill_to?` | time, effort, progress |

`title_html` may contain one `<em>word</em>`: the brand's flourish style (Vendo: Instrument Serif italic in mint). One flourish per card.

## screens (full-screen text, covers the footage; the speaker's audio continues)

```json
{ "style": "kinetic", "start": 4.7, "end": 6.95, "beats": [
    { "lines": [ { "text": "Incredibly", "at": 4.8 }, { "text": "well.", "at": 5.2 } ], "exit_at": 5.8 },
    { "lines": [ { "text": "The", "at": 6.0, "size": 84 }, { "text": "vox pops.", "at": 6.2, "size": 136, "accent": true } ] } ] }

{ "style": "statement", "start": 38.3, "end": 41.05, "lines": [
    { "text": "To see the", "at": 38.55, "size": 140 },
    { "text": "impact.", "at": 39.15, "size": 210, "accent": true, "dur": 0.8 } ],
  "sub": { "text": "optional small line", "at": 40.0 } }
```

Kinetic = uppercase sans, lines slam in (accent line pops in the accent colour with a snap). Statement = big serif, lines blur into focus, `accent` lines in the flourish style. Plain text only: no boxes, rules or page numbers.

## camera (moves the footage wrapper; processed in time order)

| type | fields | effect |
|---|---|---|
| `punch` | `at, scale` (1.12), `out` | fast zoom in on an emphatic line, hard cut back to 1 at `out` |
| `push` | `at, scale` (1.07), `dur` | slow zoom that holds until the next move |
| `reset` | `at, dur?` | back to 1 (hard by default) |
| `reframe` | `at, until, headline_html, headline_at, frame: {name, cta}` | footage shrinks into a phone-style ad frame with a headline above |

A reframe should end under a full-screen `screen` (so the reset is hidden); otherwise it eases back over 0.7 s.

## end (blurred footage + closing line + logo)

```json
{ "at": 44.2,
  "lines": [ { "text": "Regularly", "at": 44.3, "size": 150 }, { "text": "innovating.", "at": 45.25, "size": 180, "accent": true } ],
  "sub": { "text": "New ideas, again and again", "at": 47.5 },
  "logo_at": 48.6 }
```

Captions are hidden automatically during screens, reframes and the end card.
