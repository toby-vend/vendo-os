# Landing page harness

Builds a client's landing page designs from three files and a page recipe, then renders, checks and captures
them into Figma. The rules it follows are in `data/playbooks/landing-pages/`. The command that drives it is
`/client-landing-pages`.

```
outputs/creative/<client>-lp/
  brand.json          the brand layer (below)
  client.json         name, address, rating, review_count, cta, booking_url, single_site ... ({{tokens}} in copy)
  facts.json          every price and claim on the pages, with sources; "confirmed" phrases silence warnings
  pages/<type>.json   {"title", "cta"?, "form", "sections": [...], "thank_you": {...}}
  assets/             fonts + logos (in git); photos, team, cut-outs, awards, B&A (gitignored, from Drive)
  NOTES.md            decisions, copy changes vs the draft, open checks for the client
  review.json         review pack settings (Drive folder, title, intro, pages)
```

## Commands (run from this folder)
```bash
python3 build.py ../../outputs/creative/<client>-lp [page-type ...]   # writes <client>-lp/<type>/*.html
./render.sh ../../outputs/creative/<client>-lp <page-type> [height]   # PNGs into <client>-lp/renders/
python3 lint.py ../../outputs/creative/<client>-lp [page-type ...]    # content check, exit 1 on failures
python3 lint.py --html saved-page.html --client c.json --facts f.json # check any page, e.g. a live LP
./figma-capture.sh ../../outputs/creative/<client>-lp <type>/lp-desktop.html <captureId>
python3 tools/team_crop.py crop <out-dir> <photos...>                 # mid-chest-up team crops (660x880)
python3 tools/team_crop.py spec <photo>                               # face-box spec for the hero device
python3 tools/cutout.py <in.jpg> <out.png>                            # background removal for break-outs
# from the repo root, once Toby says the pack can go to the client:
node --env-file=.env.local --import tsx/esm scripts/lp-harness/review-pack/review-pack.ts outputs/creative/<client>-lp [sheetId]
```
Each page type writes `lp-desktop.html` / `lp-mobile.html` (fixed 1440 / 390 artboards for capture),
`index.html` (live responsive preview, mobile below 1024px), and the same three for the thank-you page.
Open `index.html` through a local server to see the live behaviour (sticky header, Book Now bar, marquee).
Add `#static` to view the capture layout instead.

## brand.json
```jsonc
{
  "palette": {            // roles, not colours: every section reads these through its tone
    "ink", "ink2", "muted",          // headings, body, captions
    "bg", "panel", "card",           // page background, alternate band, card fill
    "accent", "on_accent",           // labels, icons, the offer button
    "dark", "dark2", "on_dark", "on_dark2",   // inverted bands and cards on them
    "field_border"?, "btn_on_dark"?
  },
  "fonts": {"family", "fallback", "faces": [{"file", "weight", "style"?}]},
  "type": {               // display, h1, h2, h3, body, label, price
    "display": {"weight", "size", "size_m", "line", "tracking", "case", "font"?, "style"?,
                "bold": 600 | {"weight", "font", "style", "color"}}    // the emphasised word (<b>) in a headline
  },
  "shape": {"card", "button", "field", "photo", "thumb"},     // radii in px (999 = pill)
  "button": {"height", "pad", "weight", "size", "tracking", "case"},
  "device": {"type": "sframe|arch|rounded|circle", "cutout": true, "fill": 0.86,
             "backdrop"?: {"color": "panel", "dx": 24, "dy": 24}},
  "hero": {"glow"?},
  "rhythm": {"default": "light", "<block>": "light|panel|card|dark"},   // which tone each section sits in
  "icons": {"stroke": 1.5},
  "logo": {"dark", "light", "footer"?, "width", "width_m", "width_footer"},
  "css_extra"?: "brand-only CSS, e.g. a grain overlay or a signature rule"
}
```
The palette alone is a recolour. The device, the headline style, the shapes and the rhythm are what make a page
the client's: take them from the signed-off guideline and the client's approved ads, and get Toby's sign-off
on a one-page brand spec before building pages (Phase 1 of the command).

## Blocks
See `data/playbooks/landing-pages/kit-sections.md` for every block, the Vendo Dental Kit block it maps to, and
its content fields (the Siha recipes in `outputs/creative/siha-lp/pages/` use every one). Section content may
contain inline HTML (`<b>`, `<br>`, `&amp;`) and `{{tokens}}` from client.json. Any section takes `"tone"` to
override the rhythm, and `"desktop_only"` / `"mobile_only"`.

## Reference
`outputs/creative/siha-lp/` is the Siha build (Oct 2026) on this harness and the regression fixture: rebuilding it
must match the v1 Siha pages (`outputs/creative/siha-lp-*/`) at 1440 and 390.
