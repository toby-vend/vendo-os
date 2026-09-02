# Vendo OS — Dashboard (UI kit)

A high-fidelity recreation of the **Vendo OS** internal operations dashboard,
rebuilt from the real product code (`Vendo-OS/web/public/style.css`,
`web/views/dashboard.eta`).

## What it shows
- **Floating glass shell** — 16px inset, dot-grid + mint-orb canvas, rounded glass
  sidebar / topbar / content panels (the product's signature look).
- **Sidebar** — Vendo OS mark, primary nav with active state, user footer.
- **Topbar** — page title, search `Input`, notifications, "New report" CTA.
- **Dashboard view** — KPI `StatCard` grids (revenue, margin, pipeline, ad
  performance) + a spend-vs-leads bar chart.
- **Clients view** — searchable table with `Avatar`, channel `Tag`s and status
  `Badge`s (active / generating / draft ready / overdue — mirrors the real task
  status badges).

## Composition
- `index.html` — glass shell, dot-grid canvas, nav state, view routing.
- `os-sections.jsx` — `Sidebar`, `Topbar`, `DashboardView`, `ClientsView`,
  `PlaceholderView`, exported to `window` (`OsSidebar`, `OsDashboard`, …).

Interactions: switch sidebar sections (Dashboard ↔ Clients are fully built;
others show a placeholder), filter the clients table from search. Data is
representative sample data, not live.
