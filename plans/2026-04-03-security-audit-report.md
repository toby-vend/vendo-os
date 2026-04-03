# Vendo-OS Security Audit Report

**Date:** 2026-04-03
**Branch:** `feat/security-hardening`
**Audited by:** 5 parallel security agents (secrets, auth, injection, routes, dependencies)

---

## Executive Summary

The codebase has a **strong security foundation** — bcrypt password hashing, HMAC-signed sessions, CSRF protection, timing-safe comparisons, AES-256-GCM token encryption, parameterised SQL queries, and comprehensive security headers are all in place.

However, the audit identified **3 critical, 8 high, 10 medium, and 8 low** findings that should be addressed before this branch ships.

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 8 |
| MEDIUM | 10 |
| LOW | 8 |

---

## CRITICAL Findings

### C1. Session secret falls back to `DASHBOARD_PASSWORD`
**File:** `web/lib/auth.ts:42`
The session HMAC key falls back to `DASHBOARD_PASSWORD` — a potentially weak, shared credential. If both `SESSION_SECRET` and `DASHBOARD_PASSWORD` are unset outside production, it further falls back to the hardcoded string `'vendo-dev'`.
**Fix:** Remove the `DASHBOARD_PASSWORD` fallback. Require `SESSION_SECRET` as a dedicated high-entropy value. Keep `'vendo-dev'` only for local dev with a loud console warning.

### C2. Google OAuth state secret has independent hardcoded fallback
**File:** `web/routes/google-oauth.ts:25`
`const secret = process.env.SESSION_SECRET || 'vendo-dev'` — this bypasses the production guard in `auth.ts`. If `SESSION_SECRET` is unset on a non-Vercel deployment, OAuth state HMAC is trivially forgeable (CSRF on OAuth callback).
**Fix:** Import and reuse `getSessionSecret()` from `auth.ts` instead of duplicating the fallback.

### C3. Cron endpoints unprotected when `CRON_SECRET` is unset
**File:** `web/server.ts:104-115`
When `CRON_SECRET` is undefined, the auth check is skipped entirely — all `/api/cron/*` routes are accessible without authentication.
**Fix:** Reject cron requests when `CRON_SECRET` is not configured rather than silently allowing them.

---

## HIGH Findings

### H1. XSS via unsanitised Markdown output
**Files:** `web/lib/markdown.ts:13-26`, templates using `<%~ it.md(...) %>`
`marked.parse()` does not sanitise HTML. Content like `<img src=x onerror="alert(1)">` passes through to the browser. Affects briefs, meetings, skills, LinkedIn detail views.
**Fix:** Add `DOMPurify` or `sanitize-html` as a post-processing step in the `md()` function.

### H2. XSS via unescaped FTS search excerpts
**Files:** `web/views/meetings/results.eta:15`, `web/lib/queries/meetings.ts:75`
SQLite's `snippet()` wraps matches in `<mark>` tags but doesn't escape surrounding text. Rendered with `<%~ m.excerpt %>`.
**Fix:** HTML-escape the excerpt, then restore the `<mark>` tags.

### H3. XSS via innerHTML in chat view
**File:** `web/views/chat.eta:280,293,468`
`div.innerHTML = renderMarkdown(text)` — if `marked` output isn't sanitised client-side, crafted AI responses could inject scripts.
**Fix:** Pipe `marked` output through DOMPurify before setting innerHTML.

### H4. Routes not in ROUTE_MAP bypass permission checks
**Files:** `web/lib/auth.ts:99-125`, `web/server.ts:188-197`
`getRouteSlug()` returns `null` for unmapped routes, causing the permission check to short-circuit. All standard users can access `/growth/*`, `/dashboards/*`, `/skills/*`, `/asana-tasks/*`, `/client-database/*` regardless of their allowed routes.
**Fix:** Invert to deny-by-default: if a route has no slug mapping, block access for standard users.

### H5. Arbitrary role assignment via form manipulation
**File:** `web/routes/admin/users.ts:28,86`
`as 'admin' | 'standard'` is a compile-time-only assertion. At runtime, any string is accepted (e.g. `role=superadmin`).
**Fix:** Validate against an allowlist: `['admin', 'standard', 'client']`.

### H6. No password complexity on admin password reset
**File:** `web/routes/admin/users.ts:119-131`
Admin can set a user's password to a single character. `validatePasswordComplexity` exists but isn't called here.
**Fix:** Apply the shared complexity validator on all password-setting paths.

### H7. No global error handler — potential info leakage
**File:** `web/server.ts`
No `setErrorHandler` registered. Unhandled errors may expose table names, column names, or connection details in responses.
**Fix:** Add `app.setErrorHandler()` that logs the error and returns a generic 500 response.

### H8. Error messages in growth routes expose internal details
**File:** `web/routes/growth.ts:102-103,118-119,194,225,245,309`
Raw `err.message` from AI/DB failures is rendered in HTML templates.
**Fix:** Log full error server-side; return generic user-facing message.

---

## MEDIUM Findings

### M1. No session invalidation on password change
**File:** `web/lib/auth.ts:52-84`
Stateless HMAC tokens have no revocation mechanism. Old sessions survive password changes for up to 24 hours.
**Fix:** Add `session_invalidated_at` column; reject tokens with `iat` before that timestamp.

### M2. No per-account lockout after failed logins
**File:** `web/routes/auth.ts:13-26`
Rate limiting is IP-only. A botnet can attempt unlimited passwords against a single account.
**Fix:** Add per-email attempt counter with exponential backoff.

### M3. In-memory rate limiter ineffective on Vercel
**File:** `web/routes/auth.ts:13-34`
The `loginAttempts` Map resets on each cold start in serverless. Effectively bypassed.
**Fix:** Use Upstash Redis or Vercel KV for distributed rate limiting.

### M4. CSRF token is deterministic (derived from session)
**File:** `web/lib/auth.ts:140-150`
Token never changes per session. If leaked via cache or referrer, it's valid for 24 hours.
**Fix:** Consider per-request nonce, or accept as known trade-off.

### M5. Google OAuth state cookie missing `Secure` flag
**File:** `web/routes/google-oauth.ts:55`
Unlike the session cookie, this cookie never sets `Secure` in production.
**Fix:** Apply same production `Secure` flag logic as `sessionCookie()`.

### M6. Path traversal in brief content loading
**File:** `web/lib/queries/dashboard.ts:167-170`
`getBriefContent(date)` uses the URL parameter directly in `resolve(BRIEFS_DIR, date + '.md')`. A request to `/briefs/../../.env.local` reads arbitrary files.
**Fix:** Validate `date` matches `/^\d{4}-\d{2}-\d{2}$/` and confirm resolved path starts with `BRIEFS_DIR`.

### M7. Open redirect in growth route
**File:** `web/routes/growth.ts:128`
`reply.redirect(body._redirect)` with no validation. Attacker can redirect to external site.
**Fix:** Validate `_redirect` starts with `/` and doesn't start with `//`.

### M8. Static encryption salt
**File:** `web/lib/crypto.ts:6`
Hardcoded `'vendoos-token-encryption'` salt weakens scrypt key derivation.
**Fix:** Derive salt from a deployment-specific env var, or document as accepted risk.

### M9. Duplicate cron auth with non-timing-safe comparison
**File:** `web/routes/drive-cron.ts:14-22`
Route-level check uses simple string comparison instead of `timingSafeEqual`.
**Fix:** Remove route-level check (rely on server hook after fixing C3), or use `timingSafeEqual`.

### M10. Console logging with potential PII
**Files:** Multiple files in `web/lib/`, `web/routes/`
`console.log`/`console.error` calls may include email addresses and error context.
**Fix:** Use Fastify's structured logger; audit logged content for PII.

---

## LOW Findings

### L1. Logout is a GET request (CSRF-based forced logout)
`web/routes/auth.ts:84-87` — Mitigated by `SameSite=Lax` cookies in modern browsers.

### L2. `script-src 'unsafe-inline'` in CSP
`web/server.ts:211` — Required for HTMX. Consider nonce-based CSP.

### L3. Password passed as CLI argument
`scripts/reset-password.ts:9` — Visible in `ps aux` and shell history.

### L4. OAuth tokens stored as plain JSON in `.secrets/`
`scripts/sync/sync-gsc.ts:29` et al. — Gitignored but not encrypted at rest.

### L5. Stale worktrees with weaker security logic
`.claude/worktrees/` — Two worktrees lack production guard on session secret.

### L6. Incomplete FTS query sanitisation
`web/lib/queries/meetings.ts:56` — Only strips quotes, not FTS5 operators (`AND`, `OR`, `NOT`, `*`).

### L7. 18 `as any` type assertions
Multiple files — Weakens TypeScript strict mode. Define proper Fastify type augmentation.

### L8. Missing `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` headers
`web/server.ts:200-218` — Consider adding, or adopt `@fastify/helmet`.

---

## Dependency Vulnerabilities (npm audit)

9 vulnerabilities, all in `@vercel/node` transitive dependencies:

| Package | Severity | Issue |
|---------|----------|-------|
| undici <=6.23.0 | **HIGH** (x7) | HTTP smuggling, CRLF injection, unbounded decompression, bad cert DoS, WebSocket memory, random values |
| minimatch 10.0.0-10.2.2 | **HIGH** (x3) | ReDoS via wildcards, GLOBSTAR, extglobs |
| path-to-regexp 4.0.0-6.2.2 | **HIGH** | Backtracking regex |
| ajv 7.0.0-alpha.0-8.17.1 | Moderate | ReDoS with `$data` option |
| smol-toml <1.6.1 | Moderate | DoS via commented lines |

**Fix:** `npm audit fix --force` (installs `@vercel/node@4.0.0` — breaking change, test before merging).

---

## Positive Security Posture

These areas are well-implemented:

- Bcrypt with 12 rounds for password hashing
- HMAC-SHA256 session tokens with 24-hour expiry
- CSRF protection on all POST routes (HMAC-based, timing-safe)
- Parameterised SQL queries throughout (no SQL injection)
- AES-256-GCM token encryption with key rotation support
- Security headers (X-Frame-Options DENY, HSTS, CSP, Referrer-Policy, Permissions-Policy)
- Timing-safe comparisons for all secret validation
- OAuth tokens encrypted at rest in database
- Forced password change on first login
- Admin self-demotion prevention
- Audit logging for auth events
- No eval(), no command injection vectors
- .gitignore covers .env, .secrets, .db files
- TypeScript strict mode enabled
- No hardcoded secrets in source or git history

---

## Recommended Remediation Priority

### Immediate (before merge)
1. **C1+C2** — Centralise session secret; remove `DASHBOARD_PASSWORD` fallback
2. **C3** — Reject cron requests when secret is unset
3. **H1+H2+H3** — Add DOMPurify to all Markdown rendering paths
4. **H4** — Deny-by-default route permission checks
5. **M6** — Fix path traversal in briefs

### Soon (next sprint)
6. **H5** — Role validation allowlist
7. **H6** — Password complexity on all paths
8. **H7** — Global error handler
9. **H8** — Sanitise error messages
10. **M7** — Open redirect validation

### Planned
11. **M1** — Session invalidation mechanism
12. **M2+M3** — Distributed rate limiting
13. **M5** — OAuth cookie Secure flag
14. **L2** — Nonce-based CSP
15. Dependency updates (`npm audit fix`)
