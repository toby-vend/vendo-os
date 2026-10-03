# Plan: AI video edits run from inside Frame.io

**Date:** 2026-10-03
**Builds on:** plans/2026-10-03-frameio-ai-video-edits.md (Phases 0-2: folder audit, Frame.io media I/O, `video:edit` / `video:revise`)
**Process it serves:** Miro board "Asana: video edit process" (8 stages, 2 human gates) — https://miro.com/app/board/uXjVEejAoLo=/

## Goal

People run the whole edit process in Frame.io: right-click to make an AI cut or revision, comment to review, set Status to pass the two gates. No Terminal, no commands. Edits run on the editor's own MacBook (decided 3 Oct 2026). Brand packs stay a one-off setup from each client's Google Drive.

## What we confirmed on our Frame.io account (3 Oct)

- Custom actions API is available (`/workspaces/{id}/actions` returns an empty list): we can add right-click menu items.
- The existing "VendoOS" webhook already receives `metadata.value.updated`, `share.created`, `comment.*`, `file.*`. Events land in `frameio_events` and `/api/cron/frameio-process` drains them every minute.
- Account metadata has a **Status** select field (Needs Review, In Progress, Approved, Internally Approved, Client Approved, do not use) and an **Assignee** user field.

## How it works

```
Frame.io right-click "AI First Cut"  ──►  Vendo OS /api/frameio/action  ──►  video_jobs (Turso)
        (form: video name, brand, notes)                                         │
                                                                                  ▼
                                          editor's MacBook: background worker claims their job,
                                          runs the existing first-cut / revise pipeline, uploads to Frame.io
```

- Jobs are routed to the person who clicked (Frame.io user → email). Revisions go to the Mac that holds the job folder.
- The worker is a launchd background agent on each editor's Mac (starts at login, polls `video_jobs` every 30 s). If the laptop is closed the job waits; the Frame.io file gets a comment "Queued: waiting for <name>'s Mac".

## Status flow (the gates)

| Status | Set by | Means | Vendo OS does |
|---|---|---|---|
| In Progress | AI (on v01) | Editor is working on it | Assignee = Video Editor |
| Needs Review | Video Editor | Ready for Gate 1 | Assignee = Creative Strategist |
| Approved | Creative Strategist | Gate 1 passed | Assignee = Lead Video Editor |
| Internally Approved | Lead Video Editor | Gate 2 passed: can go to client | Assignee cleared |
| Client Approved | Client / Creative Strategist | Client signed off | Lead renames to Final |

Guardrails enforced by Vendo OS:
- AI actions refuse to run on a file at Internally Approved or later (no silent changes after sign-off).
- A share link containing a file that isn't Internally Approved → Slack alert to the Lead Video Editor.
- The AI never sets Approved, Internally Approved, Client Approved or renames to Final.

## Build steps

1. **Jobs table + action endpoint** — `video_jobs` table; `POST /api/frameio/action` (signature-verified) that returns the form, validates it, queues the job, and replies "Queued". Register "AI First Cut" (on files in Raw Footage) and "AI Revision" (on AI-delivered versions).
2. **Mac worker** — `npm run video:worker` + a one-time `npm run video:worker:install` (launchd agent). Claims jobs for that editor, reuses `video-edit-run.ts` / `video-edit-revise.ts` logic, writes progress back to the job and as a Frame.io comment, handles failure with a plain-English comment.
3. **Status gates** — extend the event processor for `metadata.value.updated` (set Assignee per the table) and `share.created` (premature-share alert); block AI actions past Internally Approved.
4. **Role mapping** — small admin setting: which person is Video Editor / Creative Strategist / Lead Video Editor per client (default team-wide).
5. **Setup checker update** — `video:doctor` also checks the worker is installed and running.
6. **SOP** — rewrite the editor guide as "AI Edits SOP": (a) set up your Mac once, (b) set up a new client brand once, (c) the 8 stages in Frame.io, matching the Miro board.
7. **Asana** (after the above works) — new template matching the 8 stages; Frame.io status changes tick the matching Asana tasks.

Each step: tests where there's logic (routing, status → assignee, signature check), typecheck, a live test in the `_AI Edit Sandbox` folder, commit.

## Open questions (need an answer before step 3)

- **Status options:** reuse the existing values as above, or add clearer ones ("Ready for Strategist", "Strategist Approved")? The Status field is account-wide, so new options appear for every project.
- **Who is Lead Video Editor** today (for the default role mapping)?

## Risks

- Custom action callback/form format is taken from Frame.io's custom actions model; confirm the exact payload on the first live registration in step 1.
- Editors' Macs asleep → jobs wait. Acceptable for now; the same queue can later feed one always-on machine with no process change.
- Shared `.env.local` on editor Macs (Turso + Frame.io credentials) remains the access model until per-user Frame.io connections (later phase).
- Vercel cron cap is reached; this plan adds no new cron (reuses `frameio-process`).
