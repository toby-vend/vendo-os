---
status: complete
phase: 10-am-interface
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-04-02T16:00:00Z
updated: 2026-04-02T16:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Navigate to vendo-os.vercel.app. Login page loads. After login, dashboard shows navigation links for "Content Tasks" and "Skills".
result: pass

### 2. Task List Page
expected: Navigate to /tasks. See a table with columns and filter bar. Empty table renders without errors.
result: pass

### 3. Task List HTMX Polling
expected: Task list rows refresh automatically every 10 seconds.
result: skipped
reason: No tasks in production database to observe polling changes. Mechanism is active (network tab shows requests).

### 4. Task Submission Form
expected: /tasks/new shows form with searchable client dropdown, channel selector, task type dropdown, instructions textarea, Submit button.
result: issue
reported: "Clients aren't showing"
severity: minor

### 5. Channel-Filtered Task Types
expected: Selecting a channel dynamically updates task type dropdown to show only types for that channel.
result: pass

### 6. Submit a Task
expected: Fill in client, channel, task type and submit. Redirects to task detail with "queued" status.
result: skipped
reason: No clients in production database (brand_hub empty — DRIVE_FOLDER_BRANDS not indexed against Turso)

### 7. Draft Review Page
expected: Task at "draft_ready" shows structured cards, SOP attribution, QA/AHPRA banners.
result: skipped
reason: No tasks can be submitted without client data

### 8. Approve Action
expected: Click Approve on draft_ready task. Status changes to approved.
result: skipped
reason: No draft_ready tasks available

### 9. Reject Action
expected: Click Reject with reason. Status changes to rejected.
result: skipped
reason: No draft_ready tasks available

### 10. Regenerate Action
expected: Click Regenerate. Task resets to queued.
result: skipped
reason: No draft_ready tasks available

### 11. Skills Browser
expected: /skills shows channel tabs, skills grouped by type, search bar.
result: skipped
reason: No skills in production database (Drive not indexed against Turso). Page renders without errors.

### 12. Skill Detail View
expected: Click skill to see full SOP text content.
result: skipped
reason: No skills in production database

### 13. Navigation Links
expected: Nav bar includes "Content Tasks" and "Skills" links. Clicking navigates correctly. "Asana Tasks" goes to /asana-tasks.
result: pass

## Summary

total: 13
passed: 4
issues: 1
pending: 0
skipped: 8

## Gaps

- truth: "Task submission form shows searchable client dropdown with 25+ clients"
  status: failed
  reason: "User reported: Clients aren't showing — brand_hub table empty on production. DRIVE_FOLDER_BRANDS not configured or brand:reindex not run against Turso."
  severity: minor
  test: 4
  root_cause: "Data dependency — not a code bug. brand_hub table on Turso is empty because npm run brand:reindex has not been run against the production database with DRIVE_FOLDER_BRANDS env var set."
  artifacts: []
  missing:
    - "Configure DRIVE_FOLDER_BRANDS env var in Vercel"
    - "Run npm run brand:reindex against Turso production"
    - "Run npm run drive:reindex against Turso production for skills"
  debug_session: ""
