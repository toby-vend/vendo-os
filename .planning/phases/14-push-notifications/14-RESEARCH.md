# Phase 14: Push Notifications — Research

**Researched:** 2026-04-07
**Domain:** Web Push API, VAPID, service worker push events, PWA push on iOS
**Confidence:** HIGH

## Summary

Web Push Notifications for a PWA are a well-standardised stack: VAPID keys on the server, the Push API in the browser, a service worker `push` event handler, and the `web-push` npm library for server-side sending. The entire flow is built on open standards (RFC 8030, RFC 8188, VAPID spec), so there are no proprietary moving parts.

The primary complexity for VendoOS is iOS gating: Apple only supports Web Push in PWAs running in standalone mode (iOS 16.4+, outside the EU). The UI must detect this condition and show install instructions rather than a broken permission request. This is PUSH-07 and was already decided clearly in CONTEXT.md.

The second complexity is subscription lifecycle management: subscriptions are per-device, stored by endpoint URL (UNIQUE constraint), and must be pruned when a push service returns HTTP 410. The `web-push` library throws a structured error with a `statusCode` property, making this straightforward to handle in the send path.

**Primary recommendation:** Install `web-push@3.6.7`, add `push_subscriptions` table in `ensureTables()`, expose two Fastify API routes (`POST /api/push/subscribe`, `DELETE /api/push/subscribe`), hook send into `updateTaskRunOutput` and the `failed` branch in `qa-checker.ts`, and handle the permission/install UX entirely client-side in the service worker and base.eta script block.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification content & tap behaviour**
- Notification title is the event type: "Draft Ready" or "QA Failed"
- Body format: "{task type} — {client name}" (e.g. "Meta Ad Copy — Kana Health Group")
- QA failure body includes the failure reason: "{task type} — {client name} failed QA: {reason}"
- Tapping a notification opens the specific task page (/tasks/{id})
- Notification icon uses the existing PWA icon (/assets/icon-192.png)
- Each task completion sends an individual notification — no batching

**Notification triggers**
- Only two status transitions trigger notifications: `draft_ready` and `failed`
- Only the AM who submitted the task (user_id on task_run) receives the notification
- Intermediate states (queued, generating, qa_check) do not trigger notifications
- PUSH-05 requirement to be narrowed to explicitly list draft_ready + failed as the only triggers

**Permission prompt UX**
- Toast banner slides in at the top of the page after the first task completes
- Banner text: "Get notified when drafts are ready — [Enable notifications]"
- If dismissed without enabling, shows once more on the next task completion
- If dismissed twice, never shows again (flag stored in localStorage)
- On iOS without standalone mode: banner text changes to "To receive notifications, install VendoOS to your home screen first." with a link to the Install App section in Settings
- If browser permission is permanently denied: banner text changes to "Notifications are blocked. To enable, open your browser settings for this site." — informational only, no button

**Subscription management in Settings**
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

### Deferred Ideas (OUT OF SCOPE)
- Per-type notification preferences (PUSH-08)
- Client grouping (PUSH-09)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUSH-01 | VAPID keys generated and stored as environment variables | `web-push generateVAPIDKeys()` CLI or programmatic; store as VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in Vercel env vars |
| PUSH-02 | Push subscription endpoint stores subscriptions per user in database | `push_subscriptions` table with UNIQUE on endpoint, added in `ensureTables()`; routes POST/DELETE /api/push/subscribe |
| PUSH-03 | User receives push notification when draft is ready for review | Hook into `updateTaskRunOutput` in task-runs.ts; call `sendPushToUser(userId, payload)` after status set to draft_ready |
| PUSH-04 | User receives push notification when task fails QA | Hook into failed-status path in qa-checker.ts; same `sendPushToUser` call |
| PUSH-05 | (Narrowed) Only draft_ready and failed transitions trigger notifications | Implemented by placement of send calls — only in those two code paths |
| PUSH-06 | Dead subscriptions (HTTP 410) auto-cleaned on failed send | `web-push` rejects with `err.statusCode === 410`; catch in send loop and DELETE that endpoint row |
| PUSH-07 | iOS push gated behind standalone mode detection with install instructions | Client-side: `window.navigator.standalone` + `display-mode: standalone` media query; show instructions if iOS + not standalone |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `web-push` | 3.6.7 | Server-side VAPID key management and encrypted push sends | The canonical Node.js Web Push library; used by the MDN codelab and web.dev docs |
| Web Push API (browser) | — | `PushManager.subscribe()`, `PushSubscription`, `Notification` | W3C standard built into all modern browsers; no library needed client-side |
| Service Worker `push` event | — | Receives push message from push service, calls `self.registration.showNotification()` | W3C standard; already in sw.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/web-push` | Latest | TypeScript types for web-push | Add as devDependency alongside web-push |
| `node:crypto` | built-in | `webcrypto.getRandomValues()` for any client-side key operations | Already in use for token crypto — no new dep |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| web-push | firebase-admin (FCM) | FCM adds Google dependency, requires SDK key; web-push is standards-compliant and works with all push services including APNs |
| On-send 410 pruning | Scheduled cron cleanup | Cron adds complexity and leaves stale rows longer; on-send is immediate and simpler — matches Claude's Discretion item |

**Installation:**
```bash
npm install web-push@3.6.7
npm install --save-dev @types/web-push
```

**VAPID key generation (one-time script):**
```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(JSON.stringify(keys, null, 2));"
```
Output gives `publicKey` and `privateKey` — store as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Vercel env vars. Public key is also needed client-side as `VAPID_APP_SERVER_KEY` (exposed via a server-rendered variable or an API route).

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
web/
├── lib/
│   ├── push-sender.ts          # sendPushToUser(), deleteSubscription()
│   └── queries/
│       └── push-subscriptions.ts  # DB queries: upsert, delete, getByUserId, countByUserId
├── routes/
│   └── push.ts                 # POST /api/push/subscribe, DELETE /api/push/subscribe, POST /api/push/test
scripts/
└── generate-vapid-keys.ts      # One-time utility: prints new VAPID keys
public/
└── sw.js                       # Add push event listener (existing file)
web/views/
└── settings.eta                # Add Push Notifications section (existing file)
web/views/layouts/
└── base.eta                    # Add toast banner JS + task completion detection (existing file)
```

### Pattern 1: VAPID Server Configuration

Set once at app startup. `web-push` stores it as module state; all `sendNotification` calls inherit it.

```typescript
// Source: https://github.com/web-push-libs/web-push/blob/master/README.md
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@vendoagency.com.au',  // subject — identifies the server
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);
```

Place this in `web/start.ts` (or a `push-sender.ts` module-level init) so it runs once on startup.

### Pattern 2: Send Push to a User (all their devices)

```typescript
// Source: web-push README + web.dev push codelab
import webpush from 'web-push';
import { getSubscriptionsByUserId, deleteSubscriptionByEndpoint } from './queries/push-subscriptions.js';

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  const subs = await getSubscriptionsByUserId(userId);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 }  // 1 hour — notification expires if not delivered
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription is stale — prune it (PUSH-06)
          await deleteSubscriptionByEndpoint(sub.endpoint);
        }
        // Other errors: log but don't throw — fire-and-forget pattern
        console.error('[push] sendNotification failed', { userId, endpoint: sub.endpoint, status: err.statusCode });
      }
    })
  );
}
```

Use `Promise.allSettled` (not `Promise.all`) so a single failed device does not abort others.

### Pattern 3: Browser Subscription (client-side)

```javascript
// Source: MDN PushManager.subscribe docs
async function subscribeToPush(vapidPublicKey) {
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,               // required — Apple and Chrome enforce this
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  // sub.toJSON() gives { endpoint, expirationTime, keys: { p256dh, auth } }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
}

// VAPID public key must be converted from URL-safe Base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
```

### Pattern 4: Service Worker Push Event Handler

```javascript
// Source: web.dev push notifications guide
// Add to public/sw.js

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/tasks';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

### Pattern 5: iOS Standalone Detection

```javascript
// Source: MDN, Apple developer documentation
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;  // navigator.standalone is iOS Safari specific
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Before requesting push permission
if (isIOS() && !isStandaloneMode()) {
  // Show install instructions, not permission request
}
```

`window.navigator.standalone` is defined on iOS Safari. The `display-mode: standalone` media query covers Android and desktop Chrome. Check both for robustness.

### Pattern 6: Database Schema — push_subscriptions

Add to `ensureTables()` in `web/lib/queries/auth.ts`:

```typescript
await db.execute({ sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
)`, args: [] });

await db.execute({
  sql: `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`,
  args: [],
});
```

UNIQUE on `endpoint` (not `user_id`) — one row per device, multiple rows per user. This was decided in v1.1 research (STATE.md).

### Anti-Patterns to Avoid

- **Requesting permission on page load:** Browsers suppress or auto-deny this. Trigger after first task completes as decided.
- **Using `Promise.all` for multi-device sends:** One failure aborts all. Use `Promise.allSettled`.
- **Storing VAPID private key in code:** Must be environment variable only — never commit.
- **Exposing the VAPID private key to the client:** Only the public key goes to the browser.
- **Checking `window.Notification.permission` before checking iOS standalone:** On iOS without standalone, `Notification` may not exist; always check iOS + standalone first.
- **Using `navigator.serviceWorker.ready` without checking SW support:** Guard with `'serviceWorker' in navigator` before any push subscription code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAPID key generation & message encryption | Custom crypto | `web-push` | VAPID involves ECDH key agreement, AES-GCM encryption, and JWT signing — substantial crypto surface area |
| Push service HTTP protocol | Custom fetch to FCM/APNs | `web-push` | Content-Encoding: aes128gcm, correct headers (Authorization, TTL, Urgency), endpoint routing — all handled |
| Uint8Array conversion for applicationServerKey | Manual | `urlBase64ToUint8Array` helper | Required conversion from URL-safe Base64; simple but must be exact |

---

## Common Pitfalls

### Pitfall 1: iOS Push Only Works in Standalone Mode

**What goes wrong:** Calling `Notification.requestPermission()` in mobile Safari (non-standalone) either throws or silently does nothing. The user sees a broken experience.
**Why it happens:** Apple restricted Web Push to installed PWAs only (iOS 16.4+). The permission API is not available in the browser context.
**How to avoid:** Gate the entire push subscription flow behind `isIOS() && !isStandaloneMode()` → show install instructions instead. PUSH-07.
**Warning signs:** `Notification` is undefined, or `registration.pushManager` is undefined in iOS Safari.

### Pitfall 2: EU iOS Devices Cannot Use PWA Push

**What goes wrong:** On iOS 17.4+ in EU countries (DMA), installed PWAs open in Safari tabs — push does not work.
**Why it happens:** Apple removed standalone PWA mode in EU under the Digital Markets Act.
**How to avoid:** Accept as a known limitation (already in STATE.md). No technical fix. The `isStandaloneMode()` check will correctly fall through to install instructions on these devices.

### Pitfall 3: VAPID Public Key Must Be URL-Safe Base64

**What goes wrong:** Passing the raw VAPID public key string directly to `applicationServerKey` causes a DOMException.
**Why it happens:** `applicationServerKey` expects a `Uint8Array`, not a string.
**How to avoid:** Always run the `urlBase64ToUint8Array` conversion function before passing to `pushManager.subscribe()`.

### Pitfall 4: Sending Push After Reply Is Sent

**What goes wrong:** Push send is called inside the request handler and blocks or throws unhandled.
**Why it happens:** Task status updates happen inside API routes.
**How to avoid:** Follow the existing fire-and-forget pattern — place push send after `reply.send()` or in `assembleContext`'s post-completion callback. Use `.catch()` to prevent unhandled rejection.

### Pitfall 5: Stale Subscriptions Accumulate

**What goes wrong:** Repeated send failures to dead endpoints; database grows unbounded.
**Why it happens:** No pruning when push service returns 410.
**How to avoid:** In the catch block of `sendNotification`, check `err.statusCode === 410 || err.statusCode === 404` and delete the row. 404 also indicates gone (some push services use it interchangeably with 410). PUSH-06.

### Pitfall 6: `@fastify/csrf-protection` May Block Push Subscribe Endpoint

**What goes wrong:** The `POST /api/push/subscribe` route returns 403 if CSRF protection is global.
**Why it happens:** The subscription payload comes from a `fetch()` call with a JSON body, not a form POST.
**How to avoid:** Inspect current CSRF setup. If CSRF is form-only (checks for `_csrf` field), JSON API routes are already exempt. If it's header-based, ensure the fetch call sends the CSRF token in headers. Check existing task-runs API (`POST /api/tasks/runs`) to confirm the pattern already used.

### Pitfall 7: Notification Icon Path Must Be Absolute

**What goes wrong:** Notification appears without icon, or icon fails silently.
**Why it happens:** Relative paths in `showNotification` options are not resolved from the SW origin correctly on all platforms.
**How to avoid:** Use `/assets/icon-192.png` (absolute from origin) in `showNotification`. Already confirmed the icon exists at this path.

---

## Code Examples

### Trigger Push in updateTaskRunOutput (draft_ready)

```typescript
// In web/lib/queries/task-runs.ts — after the DB update
export async function updateTaskRunOutput(id: number, output: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET status = 'draft_ready', output = ?, updated_at = ? WHERE id = ?`,
    args: [output, now, id],
  });
  // Push notification — fire-and-forget, non-blocking
  getTaskRun(id).then(run => {
    if (!run) return;
    // Resolve client_name from brand_hub — or pass it through from caller
    sendDraftReadyPush(run.id, run.created_by, run.task_type, run.client_id).catch(console.error);
  }).catch(console.error);
}
```

Note: `created_by` is a user email string (confirmed from schema). The push query needs to look up subscriptions by user email or user_id. The `users` table links email to id. Consider passing `userId` through the call chain or doing a lookup in the push sender.

### Subscribe Route (Fastify)

```typescript
// web/routes/push.ts
app.post('/subscribe', async (request, reply) => {
  const user = (request as any).user as SessionUser;
  if (!user) return reply.code(401).send();

  const body = request.body as { endpoint: string; keys: { p256dh: string; auth: string } };
  await upsertPushSubscription({
    userId: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  });
  return reply.code(201).send({ ok: true });
});
```

### Unsubscribe Route

```typescript
app.delete('/subscribe', async (request, reply) => {
  const user = (request as any).user as SessionUser;
  if (!user) return reply.code(401).send();

  const body = request.body as { endpoint: string };
  await deleteSubscriptionByEndpoint(body.endpoint);
  return reply.code(200).send({ ok: true });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCM API key (Chrome-only) | VAPID (all browsers + iOS) | 2016-2017 | No Google dependency; works with APNs and all RFC 8030-compliant push services |
| `aesgcm` content encoding | `aes128gcm` (default in web-push 3.x) | 2018 | More efficient; web-push handles automatically |
| iOS push via native apps only | iOS 16.4+ supports Web Push in standalone PWA | March 2023 | VendoOS can deliver push to iPhone users who install the PWA |

**Deprecated/outdated:**
- `Notification.requestPermission()` callback form: deprecated in favour of Promise form. Use `await Notification.requestPermission()`.
- Manifest `gcm_sender_id`: legacy GCM — not needed for VAPID.

---

## Open Questions

1. **`created_by` is email, not user_id**
   - What we know: `task_runs.created_by` stores the user's email string (confirmed in `createTaskRun` which receives `createdBy` from `request.user?.email`).
   - What's unclear: The push_subscriptions table links by `user_id` (UUID). The send path needs to resolve email → id.
   - Recommendation: Add a `getUserByEmail` call in `push-sender.ts` (function already exists in `queries/auth.ts`) or denormalise by storing `user_id` in task_runs. The former is simpler and avoids a schema migration.

2. **CSRF protection on push routes**
   - What we know: Existing JSON API routes (`POST /api/tasks/runs`) work without form CSRF fields, suggesting JSON body routes are already exempt.
   - What's unclear: Whether a CSRF header check is applied globally.
   - Recommendation: Verify during Wave 0 by inspecting the server's CSRF plugin registration and checking the existing `/api/tasks/runs` route as reference.

3. **VAPID public key delivery to client**
   - What we know: The client needs `VAPID_PUBLIC_KEY` to call `pushManager.subscribe()`.
   - What's unclear: Whether to inject it as a script variable in `base.eta` or serve it via a dedicated API route.
   - Recommendation: Inject it server-side in `base.eta` as `window._vapidPublicKey = '<%= it.vapidPublicKey %>'` — simpler, no extra round-trip. Pass it through the existing template data pipeline in `web/start.ts` view decorators.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None — run directly with `node --test` |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/**/*.test.ts web/routes/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| PUSH-01 | VAPID keys present as env vars, `setVapidDetails` does not throw | unit | `node --test --import tsx/esm scripts/generate-vapid-keys.test.ts` | ❌ Wave 0 |
| PUSH-02 | upsertPushSubscription inserts row; second call with same endpoint updates; getSubscriptionsByUserId returns all rows for user | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts` | ❌ Wave 0 |
| PUSH-03 | sendPushToUser called when draft_ready status set; mock webpush.sendNotification receives correct payload | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ Wave 0 |
| PUSH-04 | sendPushToUser called when status set to failed; payload includes failure reason | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ Wave 0 |
| PUSH-05 | No push called for queued/generating/qa_check transitions | unit | covered in push-sender.test.ts | ❌ Wave 0 |
| PUSH-06 | 410 response causes subscription row deletion; 200 leaves row intact | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/push-sender.test.ts` | ❌ Wave 0 |
| PUSH-07 | manual-only | manual | Real iPhone, iOS 16.4+, non-standalone → install prompt shown; standalone → permission request shown | — |

### Sampling Rate

- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/push-subscriptions.test.ts`
- **Per wave merge:** Full test suite across all `*.test.ts` files
- **Phase gate:** Full suite green before `/gsd:verify-work`; PUSH-07 manually verified on real device

### Wave 0 Gaps

- [ ] `web/lib/queries/push-subscriptions.test.ts` — covers PUSH-02
- [ ] `web/lib/push-sender.test.ts` — covers PUSH-03, PUSH-04, PUSH-05, PUSH-06
- [ ] `scripts/generate-vapid-keys.ts` — utility script, tested by running it; or skip formal test for a one-time script

---

## Sources

### Primary (HIGH confidence)
- [web-push GitHub README](https://github.com/web-push-libs/web-push/blob/master/README.md) — sendNotification signature, VAPID setup, key generation
- [MDN PushSubscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription) — toJSON(), getKey(), subscription shape
- [web.dev Push Notifications articles](https://web.dev/articles/push-notifications-web-push-protocol) — protocol, TTL, urgency options
- VendoOS codebase (auth.ts, task-runs.ts, sw.js, settings.eta, base.eta) — confirmed integration points, schema patterns, existing test patterns

### Secondary (MEDIUM confidence)
- [Pushpad — Web Push Error 410](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed) — 410 handling pattern, confirmed against web-push library issue tracker
- [iOS 16.4 PWA push — Apple Developer Forums](https://developer.apple.com/forums/thread/732594) — standalone requirement confirmed
- [PWA iOS Limitations 2025 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — EU DMA change confirmed

### Tertiary (LOW confidence)
- None — all critical claims verified against primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — web-push is the canonical library; verified via README and web.dev docs
- Architecture: HIGH — patterns derived directly from codebase analysis and web-push README
- iOS behaviour: HIGH — confirmed via Apple Developer Forums and multiple 2024-2025 sources
- Pitfalls: HIGH — 410 handling confirmed against web-push issue tracker; iOS gating against Apple docs

**Research date:** 2026-04-07
**Valid until:** 2026-10-07 (stable spec; revisit only if iOS changes push policy again)
