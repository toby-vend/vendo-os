---
name: vendo-digital-design
description: Use this skill to generate well-branded interfaces and assets for Vendo Digital (a data-driven marketing agency), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colours, type, fonts, logo assets, and UI-kit components for prototyping the Vendo Digital marketing brand and the Vendo OS product.
user-invocable: true
---

# Vendo Digital — Design System

Read `readme.md` in this skill first — it is the full design guide (brand context,
content fundamentals, visual foundations, iconography, and a file index). Then
explore the other files as needed.

## What's here
- `styles.css` — the single global entry point. Link this one file; it `@import`s
  all tokens (`tokens/colors.css`, `typography.css`, `spacing.css`, `effects.css`,
  `fonts.css`) and the webfonts (Manrope + Instrument Serif).
- `assets/logo/` — official `Vendo.` wordmark + `V.` icon marks (SVG + raster),
  in Black / Green / White.
- `components/` — reusable React primitives (Button, Tag, Badge, Card, StatCard,
  Avatar, Logo, Icon, Input, Switch). Each has a `.d.ts` contract and `.prompt.md`.
- `ui_kits/` — full-screen recreations: `marketing-site/` (agency website) and
  `os-dashboard/` (Vendo OS internal product).
- `guidelines/` — foundation specimen cards.

## How to use it
- **Visual artifacts** (slides, mocks, throwaway prototypes): copy the assets you
  need out of `assets/`, link `styles.css`, and build static HTML using the tokens
  and the patterns documented in `readme.md`. Match the dark-first canvas, the one
  mint accent, Manrope headings, and the Instrument-Serif italic flourish.
- **Production code**: read the token files and `readme.md` to become an expert in
  the brand, then apply the CSS custom properties and component patterns directly.

## Brand in one line
Dark-first (deep green-black `#051412`), one luminous mint accent (`#8EFEBB`),
Manrope everywhere with a single Instrument-Serif italic flourish per headline.
Confident, results-first voice. British English, £. No emoji.

If invoked without guidance, ask what the user wants to build, ask a few focused
questions (surface, audience, marketing vs product), then act as an expert Vendo
designer and output HTML artifacts or production code as appropriate.
