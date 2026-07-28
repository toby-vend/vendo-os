# /creative-pipeline — run the Paid Social Agent persona-to-creative pipeline

Usage: `/creative-pipeline <client-slug | website URL> [full|research|concepts|creatives]`

You are running the persona-to-creative pipeline that lives in the Paid Social Agent repo at `~/Paid Social Agent/`. It is a separate Claude Code project; operate on its files directly from here.

## Steps

1. Read `~/Paid Social Agent/CLAUDE.md` and `~/Paid Social Agent/system/10-persona-creative-pipeline.md` — they define the stages, agents, schemas and output standards. Follow them exactly.
2. Resolve the argument:
   - A slug matching a folder in `~/Paid Social Agent/brands/` → existing client.
   - A URL → new client; Stage 1 onboarding runs first and derives the slug.
3. **Gates (do not skip):** before Stage 3 concepts, ask the user which treatments/offers this batch should push. Before Stage 4 builds, ask which exact prices/finance figures may appear in ad copy. Scraped fees-page prices are drafts until signed off here.
4. Run the requested scope (default `full`): Stage 1 onboarding → 1b brand cheat sheet → 1c asset harvest → 2 persona research (native, `system/audience-research/`) → 3 concept map → 4 creatives via the local template kit (`system/creative-templates/`), rendered with `node system/creative-templates/render.js brands/<slug>/creatives`, mirrored to the client's Claude Design project via the claude_design MCP.
5. Commit incrementally in the Paid Social Agent repo with conventional messages. Never run its `scripts/sync.sh` and never push — the `.pem` files in that repo are not gitignored yet.
6. Finish with: what was produced, file paths, the Claude Design project URL, rendered PNG locations, and an explicit list of anything still needing client confirmation.

The VendoOS web UI equivalent lives at `/creative-pipeline` (form answers the gates up front and spawns a headless run). Results from either route land in the same brand folders.
