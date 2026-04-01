# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Monolithic queries module (732 lines):**
- Issue: `web/lib/queries.ts` contains all database operations for meetings, actions, clients, ads, briefs, sync status, pipeline, auth, and OAuth tokens in a single file
- Files: `web/lib/queries.ts`
- Impact: Difficult to navigate, test, and maintain. Changes to one domain affect the entire module. High risk of unintended side effects during refactoring.
- Fix approach: Split into domain-specific modules (`queries/meetings.ts`, `queries/auth.ts`, `queries/pipeline.ts`, etc.) with shared helper functions in `queries/base.ts`

**Type casting to `any` in request handlers:**
- Issue: Type assertions like `(request as any).user` and `(r: any) => r.channel_id` bypass TypeScript safety
- Files: `web/server.ts:45`, `web/routes/admin/users.ts:54,77,92,107`, `web/routes/google-oauth.ts:42,72,158`, `web/routes/settings.ts:7`, `web/routes/drive.ts:50`, `web/routes/auth.ts:53`
- Impact: Removes compile-time type checking for critical authentication and user data. Silent runtime failures possible.
- Fix approach: Create typed request/reply decorators for Fastify using proper module augmentation. Use generics for handler callbacks (`map((r: any) =>` should be `map((r: ChannelRow) =>`).

**Stateful crypto key caching:**
- Issue: `web/lib/crypto.ts` caches encryption key in module-level `_key` variable without re-initialisation on env changes
- Files: `web/lib/crypto.ts:8`
- Impact: If `TOKEN_ENCRYPTION_KEY` changes in production, existing tokens become unrecoverable until server restart. No way to rotate keys.
- Fix approach: Add key versioning scheme; store key version with encrypted tokens; support multiple active keys during rotation period.

**Insecure session token generation:**
- Issue: `web/lib/auth.ts` uses custom HMAC-based session tokens instead of cryptographically secure session library
- Files: `web/lib/auth.ts:39-75`
- Impact: Token validation is synchronous and relies on timing-safe comparison of strings, but token payload format is custom JSON serialized in base64url. Potential for timing attacks if secret is weak; no session invalidation mechanism (tokens valid until expiry).
- Fix approach: Use a proper session library (e.g., `@fastify/secure-session`) or JWT with standard claims (jti for revocation).

**Unencrypted password in invite notifications:**
- Issue: `web/lib/notifications.ts` includes plain-text temporary password in Slack DMs and emails
- Files: `web/lib/notifications.ts:152,168`
- Impact: Security risk if Slack or email is compromised. Passwords should never be sent via unencrypted channels.
- Fix approach: Send temporary login link instead of password (e.g., magic link or one-time code valid for 30 minutes).

**No input validation or sanitisation:**
- Issue: Form inputs parsed directly from request body without validation (e.g., email format, password strength, name length)
- Files: `web/routes/admin/users.ts:26-30`, `web/routes/auth.ts` 
- Impact: SQL injection risk (if parameterised queries fail); XSS if user input rendered in templates without escaping; nonsensical data in database.
- Fix approach: Add schema validation layer (e.g., `zod` or `joi`) at route entry. Validate all form inputs before database operations.

**No error logging in critical auth paths:**
- Issue: Login failures, session validation failures, and token refresh errors only log to stdout in dev mode
- Files: `web/server.ts:74-91`, `web/lib/google-tokens.ts:41`, `web/lib/notifications.ts:41,48,51,89`
- Impact: In production on Vercel, logs are not persisted. Failed auth attempts disappear. Debugging security issues impossible.
- Fix approach: Implement structured logging (e.g., `pino`) that sends to external service (Vercel logs, Datadog, or similar).

## Known Bugs

**Session duration calculation off by timezone:**
- Issue: `web/lib/auth.ts:69` compares `Date.now()` (UTC milliseconds) with `payload.iat` (milliseconds since epoch), but on systems with non-UTC timezone the calculation may be incorrect if `iat` was stored as local time
- Files: `web/lib/auth.ts:69`
- Trigger: Create session on a server in UTC+X, then verify on a server in UTC-Y
- Workaround: Always use UTC for timestamps; audit existing `iat` values to confirm they're in UTC

**SQL injection in date concatenation:**
- Issue: `web/lib/queries.ts:166,190,231` construct SQL like `"date <= ? || 'T23:59:59Z'"` which assumes SQLite's string concatenation; if `?` is not a date string, this fails silently
- Files: `web/lib/queries.ts:166,190,231`
- Trigger: Pass a non-ISO date string as `to` parameter
- Workaround: Use `DATE(?)` function in SQL to validate input is a valid date

**FTS query fails on special characters:**
- Issue: `web/lib/queries.ts:158` removes quotes and replaces spaces with `*` but doesn't escape other FTS operators like `-`, `()`, `[]`
- Files: `web/lib/queries.ts:158`
- Trigger: Search for text like `"C++" or "deal (urgent)" or "item-123"`
- Workaround: Escape FTS operators before building query, or use LIKE instead of FTS for untrusted input

**OAuth state validation is not timing-safe at comparison site:**
- Issue: `web/routes/google-oauth.ts:33-36` uses `crypto.timingSafeEqual` but compares raw state strings which may be different lengths if comparison fails early
- Files: `web/routes/google-oauth.ts:33-36`
- Trigger: Attacker with modified state parameter may trigger timing differences
- Workaround: Ensure both buffers are same length before comparison; use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` with pre-validated lengths

## Security Considerations

**Temporary passwords sent via insecure channels:**
- Risk: Slack DMs and email are not encrypted end-to-end; temporary passwords can be intercepted
- Files: `web/lib/notifications.ts:152,168`, `web/routes/admin/users.ts:55-61`
- Current mitigation: Passwords are temporary (must be changed on login), Slack requires auth
- Recommendations: Replace password delivery with time-limited magic links; enforce password change; log all user creations with timestamps

**Session secret fallback to weak value:**
- Risk: If `SESSION_SECRET` env var is missing, code falls back to `DASHBOARD_PASSWORD` or hardcoded `'vendo-dev'`
- Files: `web/lib/auth.ts:40`, `web/routes/google-oauth.ts:25`
- Current mitigation: `.env.local` is gitignored; dev-only, will fail in production if env var not set
- Recommendations: Require `SESSION_SECRET` to be set in all environments; fail fast if missing (throw error on startup, not on first request)

**Google OAuth credentials not validated on startup:**
- Risk: If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are missing, error only surfaces when user tries to connect their Google account
- Files: `web/routes/google-oauth.ts:45-48`, `web/lib/google-tokens.ts:22-26`
- Current mitigation: Error message displayed to user
- Recommendations: Validate all external service credentials at server startup; return 500 with logged error rather than 500 in request handler

**Encrypted tokens stored without versioning:**
- Risk: If encryption algorithm or key changes, old tokens become unrecoverable without access to old key
- Files: `web/lib/crypto.ts`, `web/lib/google-tokens.ts`
- Current mitigation: None — if key is rotated, all encrypted tokens are lost
- Recommendations: Add `version` field to encrypted format; support multiple active keys during transition; document key rotation procedure

**User deletion doesn't revoke sessions:**
- Risk: If a user is deleted from admin panel, they can continue using the system if they have an active session
- Files: `web/routes/admin/users.ts:115`
- Current mitigation: Session is verified on every request, checking `getUserById()`; if user is deleted, `getUserById()` returns null and session is invalidated
- Recommendations: Add explicit session revocation table; log all user deletions with who deleted them and when

## Performance Bottlenecks

**Multiple scalar queries in `getSyncStatus()`:**
- Problem: `web/lib/queries.ts:318-344` runs 10+ separate scalar queries sequentially to build sync status
- Files: `web/lib/queries.ts:318-344`
- Cause: Each `SELECT MAX(synced_at)` and `SELECT COUNT(*)` is a separate roundtrip to database
- Improvement path: Combine into single query with multiple aggregates; use `UNION ALL` or multiple `SELECT ... AS` columns

**Pipeline overview loops through stages and runs query per stage:**
- Problem: `web/lib/queries.ts:391-401` runs multiple queries inside a loop for each pipeline
- Files: `web/lib/queries.ts:391-401`
- Cause: For N pipelines, this runs ~5N queries (stages, counts, month calculations, etc.)
- Improvement path: Use window functions or CTEs to calculate all aggregates in single query

**FTS query rebuilds entire index:**
- Problem: `scripts/sync/sync-meetings.ts` calls `rebuildFts()` after every sync, even for single-meeting updates
- Files: `scripts/sync/sync-meetings.ts` (not shown, but referenced in `db.ts`)
- Cause: No incremental FTS index update
- Improvement path: Only rebuild FTS if `meetings` table changed; use `REBUILD` only when needed (e.g., once per day)

**Sync scripts load entire database into memory (sql.js):**
- Problem: `scripts/utils/db.ts:20` loads entire SQLite database file into memory
- Files: `scripts/utils/db.ts:20`
- Cause: Uses `sql.js` (in-memory JS SQLite) instead of native bindings for script execution
- Improvement path: For sync scripts, use native SQLite or `@libsql/client` directly (already used in `web/lib/queries.ts`)

## Fragile Areas

**Custom form body parser:**
- Files: `web/server.ts:139-155`
- Why fragile: Hand-written URL-decoded form parsing; doesn't handle edge cases like missing `=`, repeated keys, or encoding errors
- Safe modification: Add tests for edge cases; consider using `@fastify/formbody` instead
- Test coverage: No unit tests; only tested by integration tests via form submissions

**OAuth redirect URI generation:**
- Files: `web/routes/google-oauth.ts:16-21`
- Why fragile: Relies on request headers (`x-forwarded-proto`, `x-forwarded-host`) which can be spoofed; no validation that redirect URI matches registered URI in Google Cloud Console
- Safe modification: Require `GOOGLE_REDIRECT_URI` env var instead of computing from headers; validate against whitelist
- Test coverage: Not tested; only works if reverse proxy headers are correct

**Notification sending (Slack + Gmail):**
- Files: `web/lib/notifications.ts`
- Why fragile: Two separate services (Slack, Gmail) with different auth methods, both with fallible network requests; if one fails, user creation succeeds but user doesn't get notified
- Safe modification: Add request timeout, retry logic, and dead-letter queue for failed notifications
- Test coverage: No tests; only sends on user creation (hard to test in dev)

**Session cookie parsing:**
- Files: `web/lib/auth.ts:116-123`
- Why fragile: Hand-written cookie parser; doesn't handle quoted values or special characters in cookie values
- Safe modification: Use `cookie` npm package; add tests for malformed cookies
- Test coverage: No unit tests

## Scaling Limits

**Single SQLite database for all users:**
- Current capacity: ~1M meetings on a single Vercel function; unclear exact limit
- Limit: SQLite has single-writer constraint; concurrent writes block each other
- Scaling path: Migrate to Turso (SQLite cloud) once data grows; currently using Turso in production (check `TURSO_DATABASE_URL` env var) but dev uses local file

**FTS index not optimised for large corpora:**
- Current capacity: FTS works well up to 100k+ meetings; unclear exact limit for search performance
- Limit: FTS5 is slower with larger tables; no pagination in FTS queries (loads all results into memory)
- Scaling path: Add LIMIT/OFFSET to FTS queries; monitor search latency; consider Elasticsearch if search becomes bottleneck

**OAuth token encryption/decryption on every request:**
- Current capacity: 100+ requests/sec on single server; each request may decrypt 1-2 tokens
- Limit: `crypto.scryptSync()` is CPU-intensive; called on every Google token refresh
- Scaling path: Cache decrypted tokens in memory with short TTL (60s); add token caching middleware

**Sync scripts load all meetings into memory:**
- Current capacity: ~10k meetings fit in memory; past that, scripts may crash
- Limit: `sql.js` keeps all data in Node memory
- Scaling path: Use streaming approach; process meetings in batches of 1000

## Dependencies at Risk

**sql.js (in-memory SQLite):**
- Risk: `scripts/utils/db.ts` uses `sql.js` for script execution, but web uses `@libsql/client`. This creates two different database implementations; data consistency issues possible if schemas diverge.
- Impact: Scripts may work with different schema than web; migrations difficult to coordinate
- Migration plan: Unify on `@libsql/client` for both web and scripts (already available in `package.json`)

**Custom crypto implementation:**
- Risk: `web/lib/crypto.ts` implements AES-256-GCM manually. If Node.js crypto library changes API or has vulnerabilities, custom implementation may not be updated.
- Impact: No key rotation mechanism; if algorithm is found to be weak, all encrypted tokens are at risk
- Migration plan: Use established library like `tweetnacl` or `libsodium.js` with built-in key derivation and versioning

**Eta template engine:**
- Risk: `web/server.ts:6` uses Eta (less popular than EJS or Handlebars). Smaller community, less security audits.
- Impact: XSS vulnerabilities in templates may not be caught; limited ecosystem of security tools
- Migration plan: Migrate to EJS or move to JSX-based templates (React SSR) if refactoring frontend

## Missing Critical Features

**No audit logging:**
- Problem: No record of who accessed what, when. Admin users can delete other users or change permissions with no trace.
- Blocks: Compliance (SOC2, GDPR); debugging user support issues; security investigations
- Files affected: `web/routes/admin/users.ts`, `web/routes/admin/permissions.ts`

**No rate limiting:**
- Problem: No protection against brute-force login attacks, API DoS, or credential stuffing
- Blocks: Production deployment without security measures
- Files affected: `web/routes/auth.ts`, `web/server.ts`

**No CSRF protection:**
- Problem: Form submissions not protected by CSRF tokens (only HTMX requests have `hx-request` header check)
- Blocks: Vulnerable to cross-site request forgery for state-changing operations (user creation, deletion, permission changes)
- Files affected: `web/routes/admin/users.ts`, `web/routes/admin/permissions.ts`

**No session revocation:**
- Problem: Session tokens cannot be invalidated before expiry (7 days). If user is hacked or fired, they can still access the system.
- Blocks: Immediate access revocation; emergency lockdown
- Files affected: `web/lib/auth.ts:37`

**No password complexity requirements:**
- Problem: Admin can set any password for users, including empty or single-character passwords
- Blocks: Compliance with security policies; preventing weak passwords
- Files affected: `web/routes/admin/users.ts:32-36`

**No multi-factor authentication:**
- Problem: Only password required; no TOTP, U2F, or backup codes
- Blocks: Higher-security environments; compliance with enterprise security standards
- Files affected: `web/lib/auth.ts`, `web/routes/auth.ts`

**No data export/backup:**
- Problem: No way for users to export their data (meetings, action items, pipeline)
- Blocks: Data portability; disaster recovery
- Files affected: All query modules

**No API rate limiting per user:**
- Problem: No quota system; large syncs or searches could consume all resources
- Blocks: Multi-tenant fairness; preventing accidental resource exhaustion
- Files affected: `web/lib/queries.ts`

## Test Coverage Gaps

**Auth system:**
- What's not tested: Session token creation/validation, session expiry, CSRF protection, OAuth flow, password reset, permission checks
- Files: `web/lib/auth.ts`, `web/routes/auth.ts`, `web/routes/google-oauth.ts`
- Risk: Auth bugs go undetected; session hijacking, privilege escalation, or lockout possible
- Priority: HIGH

**Form input validation:**
- What's not tested: Email validation, password strength, name length, special characters
- Files: `web/routes/admin/users.ts`, `web/routes/auth.ts`
- Risk: SQL injection, XSS, nonsensical data in database
- Priority: HIGH

**Query result parsing:**
- What's not tested: Null handling, type casting, default values when rows are empty
- Files: `web/lib/queries.ts:23-28,110-126`
- Risk: NaN or undefined values in responses; TypeError at runtime
- Priority: MEDIUM

**OAuth token refresh:**
- What's not tested: Expired token handling, Google API errors, token storage, decryption
- Files: `web/lib/google-tokens.ts`
- Risk: Silent token refresh failures; stale tokens; decryption errors on corrupted data
- Priority: MEDIUM

**Database migrations:**
- What's not tested: Schema creation, table creation on Turso vs local SQLite, constraint enforcement
- Files: `scripts/utils/db.ts:46-180`, `web/lib/queries.ts:632-668`
- Risk: Dev/prod schema mismatch; constraint violations on production data
- Priority: MEDIUM

**Notification sending:**
- What's not tested: Slack API errors, Gmail authentication, email formatting, network failures
- Files: `web/lib/notifications.ts`
- Risk: Users not notified of invites; support burden
- Priority: LOW (non-blocking, already has fallback logging)

---

*Concerns audit: 2026-04-01*
