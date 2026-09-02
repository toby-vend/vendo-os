# Vendo Digital — Marketing Site (UI kit)

A high-fidelity recreation of the **Vendo Digital** agency marketing site,
rebuilt from the brand stylescape and brand sheet.

## What it shows
- **Nav** — wordmark, links, client login + "Book a call" CTA, glass blur on scroll.
- **Hero** — "We Are Vendo *[growth]*" with a rotating Instrument-Serif italic
  flourish, dual CTAs, headline stat callouts, and a photo collage (placeholder
  slots — drop in real lifestyle/campaign imagery).
- **Services** — selectable service `Tag` chips + three value `Card`s.
- **Team** — senior team cards on sage-tinted portrait panels (`Avatar` fallback;
  swap in real headshots).
- **CTA + footer** — glow CTA panel, contact details, line-icon socials.

## Composition
- `index.html` — page shell, background, contact toast, app composition.
- `marketing-sections.jsx` — `Nav`, `Hero`, `Services`, `Team`, `Cta` sections,
  exported to `window` (`VNav`, `VHero`, …).

Built entirely from design-system primitives (`Button`, `Tag`, `Card`,
`StatCard`, `Avatar`, `Logo`, `Icon`) + tokens. Photography is represented with
labelled placeholder slots — this is a layout/visual recreation, not final copy.
