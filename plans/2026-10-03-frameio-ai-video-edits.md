# Frame.io AI Video Edits — first cut, human review, AI revisions

**Date:** 3 October 2026
**Requested by:** Toby
**Status:** Plan — awaiting approval

## Goal

Let the team start an AI edit of raw talking-head footage straight from Frame.io (or Vendo OS), get a v01 back in the right Social Ads concept folder named per the editor SOP, review it in Frame.io with normal comments, and have the AI apply those comments as v02, v03… on the same version stack. Humans keep sign-off: the AI never marks anything Final.

The edit itself is the approved v3 recipe from Max's vox pop episode (`~/motion-graphics/p1136482/build.py`): trim + grade + −14 LUFS audio, word-highlight captions, top-band cards, 2–3 plain full-screen text moments, punch-ins, typewriter/checklist/bar-fill cards, reframe, blurred-footage end card, quiet kit SFX.

## Decisions (confirmed 3 Oct 2026)

- **Worker:** an always-on office Mac runs the edits (Chrome + ffmpeg + Whisper + HyperFrames + Claude Code). Vercel only queues jobs.
- **Trigger:** both. Frame.io right-click custom actions as the main route; a Vendo OS page as the backup and status view.
- **Naming and filing:** the existing SOP, *Video Editor Asset Naming, Filing & Version Control (Frame.io → Meta Ads Manager)* v1.2.

## Flow

1. **Footage in** (unchanged SOP): `Client > Raw Footage > [shoot date]`. The strategist locks the concepts and creates the concept folders.
2. **Start:** right-click the raw clip → **Vendo AI Edit** → form: concept folder, ratio(s), brand (Vendo / client), length target, notes. Or use `/video-edits/new` in Vendo OS with the same fields.
3. **Queue:** Vercel writes a `video_edit_jobs` row (status `queued`) and replies to Frame.io with "Queued — you'll get a comment when v01 is up".
4. **Worker (office Mac, polls every 30s):**
   1. Download the **original** via `?include=media_links` (stream to disk; not the 25MB buffer used for transcription).
   2. Load the brand kit: Vendo uses the `vendo-brand` skill; clients use `Client > _Admin` (brand folder), and the job stops and asks if it's missing.
   3. Run Claude Code headless with a new `vendo-video-edit` skill (the v3 recipe as instructions + `build.py` template): trim, grade, audio, transcribe, plan, build, snapshot QC, render.
   4. Name the export `Persona | Angle | Offer | 9x16 | 50s | v01 | Internal.mp4` and upload it into `Social Ads > Treatments > [Treatment] > [Concept]`.
   5. Post a Frame.io comment with the edit notes: the cut list, every on-screen claim/offer for QA, cards and full-screen moments with timestamps, anything it wasn't sure of. Post to Slack.
5. **Review (human):** frame-accurate comments in Frame.io as normal.
6. **Revise:** right-click the asset → **Apply Comments** (or the button in Vendo OS). The worker pulls the open comments with timestamps, edits the saved project, renders **v02 on the same version stack** (status stays Internal / Client Review), marks each handled comment complete, and posts one summary comment on v02 listing every note and what was done (or why not). Frame.io's public V4 API has no threaded-reply endpoint, so per-comment replies aren't possible.
7. **Sign-off (human):** approve, rename to Final, post "Ready for Meta" (SOP step 7). The AI is never allowed to write `Final`.

## Guardrails

- Never invents offers, prices or claims; on-screen text comes from the speaker's words or the locked concept string. Dental claims are listed in the notes comment for QA.
- Uploads only into the concept folder named in the job, and only as `Internal` / `Client Review`.
- Version numbers come from the existing version stack (never reused, never skipped).
- Client footage never goes to third-party vision tools (`snapshot --describe false`).
- Job project folders are kept on the worker (`~/video-edits/<job-id>/`) so revisions edit the same build, not a fresh one.

## Build phases

| # | What | Proves |
|---|------|--------|
| 0 | **Folder audit** (started 3 Oct 2026). `web/lib/frameio/folder-audit.ts` checks every project against the SOP: required root folders, `Social Ads > Treatments > [Treatment] > [Concept]` structure, concept names (three parts, " \| " spacing, Title Case, no ages), export names (concept matches folder, ratio `9x16`, `30s`, `v01`, status), loose exports, raw clips in concept folders, edited exports in Raw Footage, paid-ad cuts in Testimonials/VSLs/Walkthroughs, informal markers, reused version numbers. Report-only with suggested fixes. `npm run audit:frameio` → `outputs/frameio-audit/<date>.md`. Next: store version stacks in the library sync, a Vendo OS scorecard page, weekly Slack summary. | How tidy Frame.io is today; gives AI uploads a rulebook to validate against |
| 1 | **In progress (3 Oct 2026).** Read side built and verified: `web/lib/frameio/media-io.ts` + `npm run frameio:io` (inspect / download / comments); downloading P1136482.MP4 (654 MB) matched the local copy byte for byte. Write side verified in `Vendo > _AI Edit Sandbox` (created 3 Oct 2026): upload v01, create a stack with v02, move v03 onto the existing stack, post a frame-pinned comment (frames = seconds × the file's fps), mark it complete. Gotcha: a version-stack id on `/files/{id}` returns 422 "not a file", not 404. Frame.io client additions: download original to disk, upload file / new version to a stack, post + reply + complete comments. CLI script `npm run frameio:edit -- <file-url> --concept "..."` run by hand on my machine. | API access works end to end with today's tokens |
| 2 | **Built (3 Oct 2026).** Built: `tools/video-edit/` (prep.py, compose.py + brand packs, EDIT_SPEC.md), skill `.claude/skills/vendo-video-edit`, runner `npm run video:edit` (sessions run in the job folder, git blocked, repo-change guard, final limiter). Unattended first cuts of P1136482 and a blind Helen and Joe snippet 22 delivered to `Vendo > _AI Edit Sandbox` as v01 with notes comments. Revision loop built and verified: 9 real review comments across both test edits applied by `npm run video:revise`, v02s stacked in the sandbox with comments ticked and a summary comment each (needed new composer features: B-roll, clock and question cards, card y, fade-to-black end, client logo + floating CTA in the ad frame). Still to do: end-hold option in prep. Original scope: `vendo-video-edit` skill + job runner (local): turns the v3 recipe into a reusable, brief-driven edit; runs headless via `claude -p`. | Repeatable edits without me steering |
| 3 | `video_edit_jobs` table + Vendo OS page (`/video-edits`): start an edit, see the queue, status, links. Worker on the office Mac (launchd, polls the queue). | Team can start edits without me |
| 4 | Frame.io custom actions (Vendo AI Edit, Apply Comments) → Vercel route → queue. | Right-click workflow inside Frame.io |
| 5 | Pilot on 3–5 real edits; tune the recipe from review comments; write the SOP addendum for editors. | Quality holds across clients |

## Checks before Phase 4

- Confirm our Frame.io plan supports V4 custom actions. Fallback: the Vendo OS button only.
- Office Mac: always on, never sleeps, has Chrome, ffmpeg, Node 22, whisper-cpp, Claude Code signed in, and `.env.local` with the Frame.io token key.

## Open questions

1. Which office Mac, and who looks after it if it goes offline?
2. Vendo's own organic content (e.g. Max's vox pop episode): the SOP only covers paid social. Where does it go? Proposed: `Vendo > [shoot date] | Paid Ads & Organic Content > Organic > [Title]`, named `Organic | [Title] | 9x16 | 50s | v01 | Internal.mp4`.
3. Who gets the Slack ping: the person who started the job, the Creative Strategist, or a channel such as #frame-io-feedback?
4. Cost: each edit is a Claude Code session plus a few minutes of machine time. Measure real usage per edit during the Phase 5 pilot before rolling out.
