---
phase: 01-infrastructure
plan: 01
subsystem: auth
tags: [crypto, aes-256-gcm, oauth, key-rotation, token-versioning]

# Dependency graph
requires: []
provides:
  - Versioned AES-256-GCM token encryption with v1: prefix format
  - Dual-key rotation support via TOKEN_ENCRYPTION_KEY_PREVIOUS
  - isV0Token helper for detecting legacy token format
  - Lazy v0-to-v1 re-encryption on token access in google-tokens.ts
  - Admin users page Google OAuth connection status per user
affects: [google-oauth, drive-sync, admin-ui, any phase using OAuth tokens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token version prefix: v1:<base64> for new tokens, bare base64 treated as v0 (legacy)"
    - "Dual-key Map cache: deriveKey(envValue) with scrypt, eager cache per key string"
    - "Lazy migration: fire-and-forget upsertUserOAuthToken after v0 decrypt, never await on hot path"
    - "decryptWithKey returns null on auth tag failure, throws only after all keys exhausted"

key-files:
  created:
    - web/lib/crypto.test.ts
  modified:
    - web/lib/crypto.ts
    - web/lib/google-tokens.ts
    - web/lib/queries.ts
    - web/views/admin/users.eta

key-decisions:
  - "isV0Token detects legacy tokens by absence of v1: prefix — simple, zero ambiguity"
  - "Key cache keyed by env var string value — allows mid-process key rotation in tests"
  - "Lazy migration is fire-and-forget to avoid blocking token access on the hot path"
  - "getAllUsers returns google_connected as COUNT (0 or 1+) not boolean — SQLite-native"

patterns-established:
  - "Token version prefix pattern: all new encrypted values carry version prefix for future-proofing"
  - "Dual-key fallback: try current key, fall back to previous, throw with clear message if both fail"

requirements-completed: [INFR-03]

# Metrics
duration: 4min
completed: 2026-04-01
---

# Phase 1 Plan 01: Crypto Key Versioning Summary

**AES-256-GCM token encryption hardened with v1: version prefix, dual-key rotation window, lazy v0-to-v1 migration, and admin OAuth status visibility**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T19:27:14Z
- **Completed:** 2026-04-01T19:31:14Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Rewrote crypto.ts with Map-based key cache, v1: prefix on all new tokens, dual-key fallback, and clear error on total failure
- Added 8 unit tests (node:test, zero new dependencies) covering all seven specified behaviours
- Updated google-tokens.ts with lazy v0→v1 re-encryption — fire-and-forget, never blocks token access
- Extended getAllUsers query to LEFT JOIN user_oauth_tokens and return google_connected count per user
- Added "Google" column to admin users table with Connected/Not connected badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Crypto key versioning with dual-key support and tests** - `7b1df6e` (auto) / `66308fb` (feat — test file)
2. **Task 2: Lazy v0-v1 migration and admin OAuth status** - `4d3674a`, `33bbb87`, `fd58594` (auto)

_Note: Task 1 used TDD flow. crypto.ts changes were picked up by auto-commit alongside the test file commit._

## Files Created/Modified
- `web/lib/crypto.ts` — Versioned encrypt/decrypt with dual-key, Map cache, isV0Token export
- `web/lib/crypto.test.ts` — 8 unit tests for all crypto behaviours
- `web/lib/google-tokens.ts` — Lazy v0→v1 migration on token access
- `web/lib/queries.ts` — getAllUsers extended with google_connected JOIN
- `web/views/admin/users.eta` — Google OAuth status column added to users table

## Decisions Made
- Used `Map<string, Buffer>` keyed by raw env value for key cache — allows two keys with independent scrypt derivation
- `decryptWithKey` catches all errors and returns null — the caller (decryptToken) decides whether to throw
- Lazy migration checks `row.access_token_enc` (the stored value) not the decrypted result — correct detection point
- `google_connected` returned as `COUNT()` integer from SQL rather than casting to boolean in the query — simpler and SQLite-native

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Concurrent auto-commit system picked up file changes mid-execution, resulting in auto commits alongside the explicit feat commit. All changes are correctly in git; the auto commits are the effective task commits for files already tracked.

## User Setup Required
None — no new environment variables introduced. `TOKEN_ENCRYPTION_KEY_PREVIOUS` is optional and only needed during active key rotation.

## Next Phase Readiness
- Crypto module ready for use by Drive sync OAuth flow
- Admin users page surfaces Google connection status — ops team can identify users needing reconnection
- No blockers for plan 01-02 (schema extension)

---
*Phase: 01-infrastructure*
*Completed: 2026-04-01*
