# Phase 14: Push Notifications - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

AMs receive OS-level push notifications on their phone when tasks complete or fail QA — no polling required. Push subscriptions are managed per-device and pruned automatically when stale. This phase adds VAPID key infrastructure, a `push_subscriptions` table, server-side send logic via `web-push`, client-side subscription management, and a Settings UI section. Notification preferences per type (PUSH-08) and client grouping (PUSH-09) are deferred to v2.

</domain>

<decisions>
## Implementation Decisions

### Notification content & tap behaviour
- Notification title is the event type: "Draft Ready" or "QA Failed"
- Body format: "{task type} — {client name}" (e.g. "Meta Ad Copy — Kana Health Group")
- QA failure body includes the failure reason: "{task type} — {client name} failed QA: {reason}"
- Tapping a notification opens the specific task page (/tasks/{id})
- Notification icon uses the existing PWA icon (/assets/icon-192.png)
- Each task completion sends an individual notification — no batching

### Notification triggers
- Only two status transitions trigger notifications: `draft_ready` and `failed`
- Only the AM who submitted the task (user_id on task_run) receives the notification
- Intermediate states (queued, generating, qa_check) do not trigger notifications
- PUSH-05 requirement to be narrowed to explicitly list draft_ready + failed as the only triggers

### Permission prompt UX
- Toast banner slides in at the top of the page after the first task completes
- Banner text: "Get notified when drafts are ready — [Enable notifications]"
- If dismissed without enabling, shows once more on the next task completion
- If dismissed twice, never shows again (flag stored in localStorage)
- On iOS without standalone mode: banner text changes to "To receive notifications, install VendoOS to your home screen first." with a link to the Install App section in Settings
- If browser permission is permanently denied: banner text changes to "Notifications are blocked. To enable, open your browser settings for this site." — informational only, no button

### Subscription management in Settings
- New "Push Notifications" section below the existing Install App section
- Shows current status: "Enabled on this device" / "Disabled on this device"
- Toggle button to enable or disable push on the current device only
- Shows total subscribed device count for context (e.g. "Subscribed on 2 devices")
- Includes a "Send test" button that fires a test push to the current device
- Disabling removes only the current device's subscription — other devices unaffected

### Claude's Discretion
- Toast banner animation and dismiss behaviour
- Exact CSS styling of the Settings push section (match existing sections)
- Service worker push event handler implementation details
- VAPID key generation script approach
- Dead subscription pruning implementation (scheduled vs on-send cleanup)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/notifications.ts`: Existing notification module (currently Slack DM + Gmail for invites). Could be extended with a push notification sender, or a new module could sit alongside it.
- `public/sw.js`: Service worker already active with Workbox CDN, handles caching strategies. Push event listener will be added here.
- `web/views/settings.eta`: Settings page already has Install App section — push section goes below it.
- `web/views/layouts/base.eta`: Global layout, already registers SW and includes manifest. Toast banner JS can hook in here.
- `/assets/icon-192.png`: PWA icon already exists for notification badge.

### Established Patterns
- Flash messages: The app already uses top-of-page banners for success/error/warning states (settings.eta shows this pattern). Toast banner should follow the same visual style.
- Fire-and-forget: Task execution uses fire-and-forget pattern (assembleContext in task-runs.ts). Push sends should follow the same pattern — send after status update, don't block the response.
- `@fastify/static` serves from `public/` — sw.js is already served this way.
- Database schema created in `web/lib/queries/auth.ts` via `ensureTables()` — push_subscriptions table should be added here.
- UNIQUE constraint on endpoint column (not user_id) — already decided in v1.1 research.

### Integration Points
- `web/lib/queries/task-runs.ts`: `updateTaskRunStatus` is where status changes happen — push notification send hooks into this flow.
- `web/lib/qa-checker.ts`: Sets status to draft_ready or failed after QA — another integration point for triggering push.
- `web/routes/task-runs.ts`: API routes for task operations.
- `web/routes/task-runs-ui.ts`: UI routes including the task detail page (tap target for notifications).

</code_context>

<specifics>
## Specific Ideas

No specific external references or "I want it like X" moments — decisions were clear and direct. Follow existing VendoOS patterns for visual consistency.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Per-type notification preferences (PUSH-08) and client grouping (PUSH-09) are already tracked in v2 requirements.

</deferred>

---

*Phase: 14-push-notifications*
*Context gathered: 2026-04-07*
