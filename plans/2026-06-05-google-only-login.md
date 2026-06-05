# Plan — Google-only login, gated on admin-provisioned accounts

**Date:** 2026-06-05
**Goal:** Replace email/password login with "Sign in with Google". A user can only get a
session if an admin has already created their account (matched by email). Unknown Google
sign-ins are blocked and flagged to admins (in-app + Slack/email) for provisioning. Admins
retain full control over access and permissions. No existing accounts are deleted — Toby and
Max already have rows and will match on their Google email.

## Decisions (confirmed with Toby)
1. **Password login removed entirely** — Google is the only way in. (Trade-off: if Google
   OAuth misconfigures, recovery is via DB/script, not a password page.)
2. **Flagged sign-ins** surface in an admin "Pending access requests" list **and** ping admins
   via the existing Slack DM / email channels.

## Design
- Login is identity-only OAuth (`openid email profile`), reusing the **existing**
  `/auth/google/callback` redirect URI so no Google Cloud console change is needed. Tokens
  from the login flow are **not** stored (the separate `/auth/google/connect` flow still owns
  Drive/Gmail/Calendar token storage).
- The callback branches on which short-lived state cookie is present:
  `google_login_state` → login; `google_oauth_state` → connect (existing behaviour).
- Look the user up by lowercased email. Found → issue session. Not found → record an
  `access_requests` row, notify admins, redirect to `/login?flagged=1`.

## Changes
1. **Schema** — new `access_requests` table (id, email UNIQUE, name, google_sub, status
   pending|dismissed|resolved, attempts, first/last_requested_at, resolved_at, resolved_by).
   Added to `web/lib/queries/auth.ts` initSchema + dated migration
   `scripts/migrations/2026-06-05-google-login.ts`.
2. **Queries** (`web/lib/queries/auth.ts`) — `recordAccessRequest`, `listPendingAccessRequests`,
   `countPendingAccessRequests`, `dismissAccessRequest`, `resolveAccessRequestByEmail`,
   `getAdminUsers`. `createUser` made password-optional (`must_change_password = 0`, unusable
   sentinel hash when omitted). Extend `AuditEventType`.
3. **OAuth** (`web/routes/google-oauth.ts`) — add `GET /auth/google/login`; refactor
   `/auth/google/callback` to handle login (no session) vs connect (resolve session itself).
4. **Server** (`web/server.ts`) — add `/auth/google/login` + `/auth/google/callback` to the
   public route allowlist.
5. **Login route/template** — `GET /login` reads `flagged`/`error` query flags; remove
   `POST /login`, the password form, and the IP rate limiter. Login page = Google button.
6. **Notifications** (`web/lib/notifications.ts`) — `notifyAdminsOfAccessRequest`.
7. **Admin users** — pending-requests section on `/admin/users`; create-user drops the
   password field and resolves the matching request; add dismiss route; remove the now-dead
   password-reset routes/button/modal.
8. **Portal users** — `createPortalUser` password-optional; drop password field.

## Verification
- `npm run typecheck` clean.
- Migration runs against local SQLite (and Turso when env present).
- Manual: existing user Google sign-in → session; unknown email → flagged + admin alert +
  visible in admin panel; admin creates the account → next sign-in works.
</content>
</invoke>
