# Vendo Digital — Design System

A dark-first, growth-focused brand system for **Vendo Digital**, a data-driven
marketing agency that builds businesses through strategic advertising (Paid
Search, Paid Social, SEO), high-converting website design, and hands-on growth
partnership. The system also covers Vendo's internal operations product
(**Vendo OS**) and the **Vendo Dental** sub-brand.

> Tagline energy: *"We Are Vendo."* — confident, plain-spoken, results-first.

---

## Sources

This system was reverse-engineered from real brand + product material. None of
these are bundled assumptions — they are the canonical inputs. Keep them on hand:

| Source | What it gave us |
|---|---|
| `VD_2026_A4_BRAND_SHEET_GUIDELINE.pdf` | Official colour palette (hex/RGB/CMYK/Pantone), logo breakdown, typography (Manrope + Instrument Serif) |
| `Vendo Digital Stylescape.jpg` | Brand mood: dark canvas, mint accents, italic-serif flourish, team cards, stat callouts, pill buttons, icon language |
| `Vendo Dental - Practice Leaflet.pdf` | Sub-brand voice ("Dentistry, elevated."), spaced-caps editorial treatment, light/print register |
| `VD_LOGO_*` / `VD_ICON_*` (SVG + @4x PNG/JPG) | Official wordmark + "V." icon mark in Black / Green / White / Original |
| `Vendo-OS/` codebase (local mount) | Real product UI — dark glass dashboard, sidebar shell, stat cards, badges, tables, client reporting (`web/public/style.css`, `client-report.css`, `web/views/*.eta`) |

The Vendo OS product uses a brighter functional green (`#22C55E`) for interactive
/ success states; the **canonical brand green is the mint `#8EFEBB`** from the
brand sheet. Both live in the colour tokens (`--vendo-green` vs `--accent-signal`).

---

## Brand at a glance

- **Personality:** sharp, modern, growth-obsessed but human. Premium without being cold.
- **Canvas:** deep green-black (`#051412`). Vendo is dark-first.
- **Accent:** one luminous mint green, used sparingly and with intent.
- **Type:** Manrope does ~95% of the work; Instrument Serif italic is the editorial flourish.
- **Logo:** lowercase `Vendo.` wordmark; the period is part of the mark. Icon is `V.`

---

## Content fundamentals

How Vendo writes. Match this voice in every surface.

**Voice & tone.** Confident, direct, and outcome-led. Vendo speaks plainly and
backs claims with numbers. Marketing copy is punchy and benefit-first
("200% Traffic Increase", "200+ New Customers"). The Dental sub-brand softens
into a calmer, more editorial register ("Considered, unhurried dental care").

**Person.** Marketing/agency voice uses **"we"** for Vendo and **"you/your"** for
the client ("we set out to elevate every part of the experience", "plan treatment
around you"). Product UI (Vendo OS) is neutral and functional — labels, not
sentences ("Monthly Revenue", "Stalled >14d", "Proposals Out").

**Casing.**
- Display headlines: sentence case or title case, never ALL CAPS for long strings.
- **Eyebrows / kickers / meta labels: UPPERCASE with wide letter-spacing**
  (`--tracking-wide`). The Dental leaflet pushes this further into spaced caps
  (`V I S I T   U S   I N   S U T T O N`) — reserve that flourish for premium/print.
- UI stat labels: UPPERCASE, 11–12px, wide tracking, muted colour.

**The serif flourish.** A single word or two inside a headline is set in
*Instrument Serif italic* to add warmth and editorial contrast against bold
Manrope — e.g. **"We Are Vendo** *ecommerce*… *dental*". Use it for the emotive /
human word, not the whole line. Never more than one flourish per headline.

**Numbers & results.** Lead with the metric. Pair a big number with a short
label and an up-and-to-the-right arrow (`↗ 200%` / `Traffic Increase`). British
English and £ throughout (`en-GB`, "£23,800", "optimise", "colour").

**Emoji:** none. Vendo does not use emoji in brand or product surfaces. Status is
communicated with colour + iconography, never emoji.

**Vocabulary:** growth partner, strategic, data-driven, high-converting, ROAS,
pipeline, leads, CPL, ad spend. Avoid hype words without a number attached.

---

## Visual foundations

**Colour & vibe.** Dark-first. The page is deep green-black (`--vendo-black
#051412`); raised surfaces step up through a green-tinted ink ramp
(`#09221F` sage → `#0E2C28`). One accent — luminous mint `#8EFEBB` — carries
all the brand energy and is used surgically (buttons, key numbers, the logo dot,
the serif flourish underline). Neutrals are slightly warm-green-grey, not pure
grey. A brighter signal green `#22C55E` is reserved for functional success states
in product UI.

**Imagery.** Bright, warm, real photography — people, teams, lifestyle, devices —
often arranged as a vertical filmstrip / collage against the dark canvas (see the
stylescape's right edge). Team portraits sit on soft sage-green tinted
backgrounds inside cards. Imagery is saturated and optimistic, never desaturated
or moody. No stock-y gradients behind photos.

**Backgrounds.** Solid dark canvas is the default. Product dashboards layer two
near-invisible textures: a fine **dot-grid** (`--dot-grid`, 24px) and a subtle
fractal **noise** overlay at ~3% opacity, plus large, very-low-opacity radial
"orb" glows in green/white for depth. No busy patterns, no hard gradients in
content areas.

**Type in layout.** Huge, tight Manrope headlines (`--tracking-tight`, weight
700–800) against generous negative space. Body is Manrope 400–500 at comfortable
measure. The Instrument Serif italic provides rhythm and contrast. Stat numbers
are oversized and set in the accent colour.

**Corner radii.** Friendly but not bubbly. Buttons/inputs `10px`, cards `14px`,
large glass panels `20px`, hero panels `28px`. Pills/tags/avatars fully rounded
(`999px`). Icon chips are soft squares.

**Cards.** Two registers. (1) *Product glass cards*: translucent sage fill
(`rgba(9,34,31,.55)`) + 40px backdrop-blur + 1px hairline white border
(`rgba(255,255,255,.08)`) + soft drop shadow `0 8px 32px rgba(0,0,0,.35)`,
radius 14–20px. (2) *Marketing cards*: solid sage surface, hairline border, photo
or stat content, same radii. No coloured left-border-accent cards. No heavy
borders.

**Shadows & elevation.** Shadows are soft, dark, and diffuse (tuned for a dark
canvas), never crisp or light. The mint accent gets an optional **glow**
(`0 0 24px rgba(142,254,187,.18)`) on primary buttons and active states. Inner
hairline highlights (`inset 0 1px 0 rgba(255,255,255,.04)`) lift glass panels.

**Borders & dividers.** Almost always a 1px hairline at low-opacity white
(`--border-hairline` 6%, `--border-subtle` 10%). Accent borders use mint at 30%.

**Transparency & blur.** Used deliberately for product chrome — sidebars,
topbars, stat cards, tables all use glassmorphism (`backdrop-filter: blur(40px)
saturate(180%)`). Marketing surfaces are mostly solid; blur is a product-UI
signature, not a marketing one.

**Motion.** Restrained and smooth. Default ease is a soft ease-out
(`--ease-standard`); entrances use an expressive ease (`--ease-emphasis`).
Durations 150–450ms. Fades and gentle rises, no bounces. Background orbs drift
very slowly (20–30s loops). Respect `prefers-reduced-motion`.

**Hover states.** Borders shift to mint, text shifts to mint, glass borders
brighten (6%→12%), primary buttons lighten toward `--accent-hover` and gain glow.
No large scale jumps.

**Press states.** Subtle — a slightly deeper accent (`--accent-press`) and/or a
1px nudge; no aggressive shrink.

**Focus.** A 3px mint focus ring at 45% opacity (`--focus-ring`) for accessibility
on dark surfaces.

**Layout rules.** Product is a fixed left sidebar (256px, collapsible to 72px) +
64px topbar + scrolling glass content, all inset 16px from the viewport on the
dark canvas (a "floating panels" look). Marketing is a centered max-1200px
column with full-bleed dark sections and generous vertical rhythm
(`--section-y` 96px).

---

## Iconography

**Style.** Thin, rounded-stroke **line icons** — see the stylescape's contact row
(phone, cursor/click, mail, location pin) shown both as white/neutral strokes and
as mint-green strokes. Stroke weight is light (~1.5–2px), corners and terminals
are rounded, fills are rare. This matches the **Lucide** icon set almost exactly.

**System of record.** Vendo OS ships inline SVG / emoji-free glyphs in its views.
For this design system we standardise on **[Lucide](https://lucide.dev)** (loaded
from CDN) as the closest match to the brand's existing line-icon language —
consistent 24×24 grid, ~2px rounded strokes. ⚠️ *Substitution flag:* the brand
has no proprietary icon font; Lucide is our documented stand-in. If Vendo
provides a bespoke set, swap it in here.

**Usage.**
- Default icon colour is `--text-secondary`; active/brand icons are `--accent`.
- Icons live in soft-square "chips" (`--radius-xs`/`sm`, sage or accent-soft fill)
  in product UI, or as bare strokes in marketing rows.
- Sizes: 16px (dense UI), 20px (default), 24px (touch / marketing).
- **No emoji as icons. No unicode dingbats.** Arrows for stats use a real arrow
  glyph or Lucide `arrow-up-right`.

**Logo & mark.** Official files in `assets/logo/`:
`VD_LOGO_{BLACK,GREEN,WHITE}.svg` (wordmark) and
`VD_ICON_{BLACK,GREEN,WHITE}.svg` (the `V.` mark). On dark canvas use **White**
or **Green**; on light use **Black**. The dot is integral — never remove it.

---

## Index / manifest

**Foundations**
- `styles.css` — root entry (import this one file)
- `tokens/colors.css` · `typography.css` · `spacing.css` · `effects.css` · `fonts.css`

**Assets** — `assets/logo/` (official wordmarks + icon marks, SVG + raster)

**Components** — `components/` (Components group in the Design System tab)
- `core/` — Button · Tag · Badge · Card · StatCard · Avatar · Logo · Icon
- `forms/` — Input · Switch

**UI kits** — `ui_kits/` (full-screen recreations; see each kit's README)
- `marketing-site/` — Vendo Digital agency website (hero, services, team, CTA)
- `os-dashboard/` — Vendo OS internal ops dashboard (sidebar, KPI grid, clients table)

**Specimen cards** — `guidelines/` (`*.card.html`, rendered in the Design System tab)

**Skill** — `SKILL.md` (portable Agent Skill manifest)

See the Design System tab for live foundation, component, and UI-kit cards.
