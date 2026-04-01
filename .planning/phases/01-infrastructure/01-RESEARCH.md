# Phase 1: Infrastructure - Research

**Researched:** 2026-04-01
**Domain:** TypeScript/Node.js — crypto key versioning, module refactoring, SQLite schema extension
**Confidence:** HIGH

## Summary

Phase 1 is a pure refactoring and hardening phase with no new user-facing features. All three deliverables are well-scoped and fully within the existing stack. The codebase has been read in full — there are no surprises.

**Crypto:** `web/lib/crypto.ts` is a clean 40-line AES-256-GCM implementation. The version prefix strategy (`v1:...`) is straightforward to add. The only risk is the lazy migration path: `google-tokens.ts` calls `decryptToken` in multiple places and the re-encryption must happen in both the access-token retrieval path and the OAuth callback/disconnect paths.

**Queries split:** `web/lib/queries.ts` is 750 lines across six logical domains. The split is mechanical — all existing exports must remain reachable via a barrel `queries/index.ts`. The only non-obvious concern is the `db` client export: the server imports `{ db }` directly from queries (line 31 of `server.ts`) so the barrel must re-export it.

**Schema extension:** The project has two schema paths — `scripts/utils/db.ts` (sql.js, local only) and `queries.ts::initAuthSchema` (libsql, Turso production). New tables must be added to both. The local db.ts uses `CREATE TABLE IF NOT EXISTS` so it is safe to append. The Turso path currently only creates auth tables; the skills/brand tables must be added alongside.

**Primary recommendation:** Work in the order — crypto first (smallest blast radius), schema second (additive only), queries split last (highest surface area, do it when the other two are verified working).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation decisions delegated to Claude. Specific choices locked in CONTEXT.md:

**Queries split strategy:**
- Split by domain: `queries/meetings.ts`, `queries/auth.ts`, `queries/pipeline.ts`, `queries/ads.ts`, `queries/dashboard.ts`, `queries/base.ts` (shared helpers + db client export)
- Keep the same `rows<T>()` and `scalar<T>()` helpers in base — all modules import from there
- Re-export everything from a barrel `queries/index.ts` so existing imports don't break
- New skills/brand modules added in later phases slot into this structure

**OAuth token migration:**
- Add version byte prefix to encrypted token format: `v1:base64(iv+authTag+ciphertext)`
- Existing tokens (no prefix) treated as v0 — decrypted with current key
- On successful decrypt of v0 token, re-encrypt as v1 (lazy migration)
- Support dual-key period: try current key first, fall back to previous key
- Store `TOKEN_ENCRYPTION_KEY_PREVIOUS` env var for rotation window

**New table design:**
- `skills` — id, drive_file_id (unique), title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version
- `skills_fts` — FTS5 virtual table on skills(title, content) with tokenize='unicode61'
- `brand_hub` — id, client_id (FK), client_name, client_slug, content, content_hash, drive_file_id, drive_modified_at, indexed_at
- `drive_watch_channels` — id, channel_id, resource_id, expiration, page_token, created_at, renewed_at
- `task_runs` — id, client_id, channel, task_type, status, sops_used (JSON), brand_context_id, output, qa_score, qa_critique, attempts, created_by, created_at, updated_at
- All tables use `INTEGER PRIMARY KEY` (SQLite rowid alias)

### Claude's Discretion

All infrastructure choices delegated to Claude. CONTEXT.md: "User trusts Claude to make sensible technical decisions for all infrastructure choices."

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Split queries.ts monolith into domain-specific query modules before adding skills queries | Full codebase audit complete — all exports mapped, barrel pattern confirmed safe |
| INFR-02 | Database schema extended with skills, brand_hub, task_runs, drive_watch_channels tables | Both schema paths identified (sql.js local + libsql Turso); FTS5 availability confirmed for Turso; FTS4 note for local |
| INFR-03 | OAuth token handling hardened (crypto key versioning resolved, silent-failure path surfaces status) | crypto.ts fully read; all call sites in google-tokens.ts and google-oauth.ts identified; admin display pattern established |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in | AES-256-GCM encrypt/decrypt | Already in use — no additional dependency |
| `@libsql/client` | 0.17.2 | Turso/SQLite database client | Already in use throughout |
| TypeScript | 5.6.x | Language | Established project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sql.js` | 1.11.0 | Local SQLite (scripts only) | `scripts/utils/db.ts` — migration of schema init only |
| `tsx` | 4.19.x | TypeScript execution for scripts | Already used for all script runs |

No new dependencies are required for this phase.

---

## Architecture Patterns

### Recommended Project Structure After Split

```
web/lib/
├── queries/
│   ├── base.ts          # db client, rows<T>(), scalar<T>(), shared types
│   ├── meetings.ts      # searchMeetings, getMeetingById, getMeetingActionItems, etc.
│   ├── auth.ts          # users, channels, permissions, OAuth tokens
│   ├── dashboard.ts     # getDashboardStats, getRecentMeetings, getActionsByAssignee
│   ├── pipeline.ts      # GHL pipelines, stages, opportunities
│   ├── ads.ts           # Meta insights, ad accounts
│   └── index.ts         # barrel — re-exports everything + db
├── queries.ts           # DELETED after split verified
├── crypto.ts            # Updated: version prefix, dual-key support
└── google-tokens.ts     # Updated: lazy v0→v1 re-encryption
```

### Pattern 1: Barrel Export (INFR-01)

**What:** All split modules re-exported from `queries/index.ts` so zero call sites change.
**When to use:** Any monolith split where consumers use a single import path.

```typescript
// web/lib/queries/index.ts
export * from './base.js';
export * from './meetings.js';
export * from './auth.js';
export * from './dashboard.js';
export * from './pipeline.js';
export * from './ads.js';
```

All existing imports `from '../lib/queries.js'` resolve unchanged via TypeScript module resolution. After the split, `queries.ts` is removed and the directory `queries/` takes its place — TypeScript will resolve `queries.js` to `queries/index.js` automatically.

**Critical:** `web/server.ts` line 31 imports `{ db }` from queries. The `db` client export must live in `base.ts` and be re-exported from `index.ts`.

### Pattern 2: Token Version Prefix (INFR-03)

**What:** Prepend `v1:` to new encrypted tokens; treat bare base64 as v0 (legacy).
**Dual-key:** On decrypt, try `TOKEN_ENCRYPTION_KEY` first, fall back to `TOKEN_ENCRYPTION_KEY_PREVIOUS`.

```typescript
// Detect version
function getVersion(ciphertext: string): 'v0' | 'v1' {
  return ciphertext.startsWith('v1:') ? 'v1' : 'v0';
}

export function encryptToken(plaintext: string): string {
  // Always produces v1 format
  const key = getCurrentKey();
  // ... AES-256-GCM ...
  return 'v1:' + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(ciphertext: string): string {
  const version = getVersion(ciphertext);
  const payload = version === 'v1' ? ciphertext.slice(3) : ciphertext;
  // Try current key; on AuthTag failure with previous key available, try that
  return decryptWithKey(payload, getCurrentKey()) 
    ?? decryptWithKey(payload, getPreviousKey());
}
```

### Pattern 3: Lazy v0→v1 Migration (INFR-03)

**What:** On successful v0 decrypt, re-encrypt as v1 and persist immediately.
**Where:** In `google-tokens.ts::getGoogleAccessToken` — after decrypting a v0 token, call `upsertUserOAuthToken` with the re-encrypted value. Also needed on disconnect (revoke path calls `decryptToken`).

```typescript
// In getGoogleAccessToken, after decryptToken:
if (version === 'v0') {
  // Re-encrypt as v1 in background — non-blocking
  upsertUserOAuthToken({ ...row, accessTokenEnc: encryptToken(accessToken), refreshTokenEnc: encryptToken(refreshToken) })
    .catch(e => console.error('[crypto] lazy migration failed:', e));
}
```

### Pattern 4: FTS5 Virtual Table (INFR-02)

**What:** FTS5 with `tokenize='unicode61'` for skills full-text search. Matches existing `meetings_fts` pattern.
**Important difference:** Local `scripts/utils/db.ts` uses `sql.js` which includes FTS4 only. FTS5 is available in Turso (libsql). The local schema must use FTS4 for local dev or skip the FTS table entirely in local scripts (it is only queried via the web app which uses Turso).

```sql
-- Turso / libsql path (web/lib/queries/auth.ts initSchema):
CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  title,
  content,
  content='skills',
  tokenize='unicode61'
);
```

### Pattern 5: OAuth Status in Admin (INFR-03)

**What:** Admin dashboard surfaces per-user OAuth token status to make silent failures visible.
**Where:** Extend `getAllUsers()` query to JOIN `user_oauth_tokens` and return a `googleConnected` boolean per row. Extend the admin/users.eta template with a "Google" column.

```typescript
// Extended getAllUsers in queries/auth.ts:
export async function getAllUsers(): Promise<(UserRow & { channels: string; google_connected: number })[]> {
  return rows(`
    SELECT u.*,
           COALESCE(GROUP_CONCAT(c.name, ', '), '') as channels,
           COUNT(t.user_id) as google_connected
    FROM users u
    LEFT JOIN user_channels uc ON u.id = uc.user_id
    LEFT JOIN channels c ON uc.channel_id = c.id
    LEFT JOIN user_oauth_tokens t ON u.id = t.user_id AND t.provider = 'google'
    GROUP BY u.id
    ORDER BY u.name
  `);
}
```

### Anti-Patterns to Avoid

- **Changing import paths in consumers:** The barrel pattern means zero consumer changes. Do not update `from '../lib/queries.js'` anywhere — TypeScript resolves it to `queries/index.js` automatically.
- **Splitting the db client:** All modules must import `db` from `./base.js` — never create a second client instance.
- **Throwing on decrypt failure during key rotation:** `decryptToken` must return `null` (not throw) when both keys fail, so callers can surface a "token invalid, please reconnect" state rather than a 500.
- **FTS5 in sql.js context:** `sql.js` 1.11.0 does not include FTS5 (only FTS4). Do not add `skills_fts` to `scripts/utils/db.ts::initSchema`. Add it only to the libsql/Turso schema init in the web layer.
- **Blocking lazy migration:** The v0→v1 re-encryption must be fire-and-forget (`.catch()` logged) — never `await` it on the hot path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key derivation | Custom KDF | `crypto.scryptSync` (already in use) | scrypt is the correct choice for password/key derivation; already wired |
| AES authentication | Custom MAC | AES-256-GCM `authTag` (already in use) | Built-in authentication tag detects tampered ciphertext |
| SQLite FTS | Manual LIKE search | FTS5 virtual table | Tokenisation, ranking, prefix matching — FTS handles all edge cases |
| Module barrel | Manual import updates | `index.ts` re-exports | Zero-risk approach to monolith split; no consumer changes |

---

## Common Pitfalls

### Pitfall 1: scrypt Key Caching Breaks Dual-Key
**What goes wrong:** The current `getKey()` caches `_key` as a module-level singleton. Adding a second key (previous) requires two separate cached values, not one.
**Why it happens:** The original design assumed a single static key.
**How to avoid:** Replace `_key` singleton with a `Map<string, Buffer>` keyed by the env var value, or simply compute both keys on module load (scrypt is slow — cache both eagerly at startup).
**Warning signs:** Previous key always produces wrong result despite correct env var.

### Pitfall 2: `v1:` Prefix Breaks Base64 Detection
**What goes wrong:** Code that checks `if (ciphertext.startsWith('v1:'))` works, but code that tries to `Buffer.from(ciphertext, 'base64')` on a v1 token will silently produce garbage (the `v1:` prefix is not valid base64).
**Why it happens:** Forgetting to strip the prefix before passing to `Buffer.from`.
**How to avoid:** Always strip the prefix in `decryptToken` before base64-decode: `const payload = ciphertext.startsWith('v1:') ? ciphertext.slice(3) : ciphertext`.

### Pitfall 3: queries/index.ts Import Resolution
**What goes wrong:** TypeScript compiles `queries/index.ts` to `queries/index.js`, but `import ... from '../lib/queries.js'` resolves to `../lib/queries.js` (a file), not `../lib/queries/index.js` (the directory barrel).
**Why it happens:** Node ESM does not do directory index resolution — `queries.js` and `queries/index.js` are different paths.
**How to avoid:** Rename the split output correctly: the barrel file is at `web/lib/queries/index.ts` and the old `web/lib/queries.ts` file is deleted. TypeScript with `moduleResolution: "node16"` or `"bundler"` resolves `./queries.js` to `./queries/index.js` when the file `./queries.js` does not exist and `./queries/index.js` does. Verify `tsconfig.json` module resolution setting before proceeding.
**Warning signs:** Module-not-found errors after the split.

### Pitfall 4: Two Schema Paths Diverge
**What goes wrong:** New tables added to `scripts/utils/db.ts` but not to the libsql `initAuthSchema` in queries (or vice versa). Drive sync works locally but fails on Turso.
**Why it happens:** The project has two separate schema init paths that aren't linked.
**How to avoid:** The plan must include tasks for both schema paths in parallel. The libsql path should be the authoritative one (it runs on Turso in production). The `sql.js` path only matters for local script runs — and since new tables are only queried by the web app (not scripts), it is acceptable to note this explicitly and add them to `db.ts` as a secondary step.

### Pitfall 5: getSyncStatus Double-Query Bug
**What goes wrong:** `getSyncStatus` in the current `queries.ts` (lines 337-360) executes `scalar("SELECT MAX(synced_at) FROM ghl_opportunities")` and `scalar('SELECT COUNT(*) FROM ghl_opportunities')` twice — once in the `Promise.all` destructuring and once directly when building `sources`. This is an existing bug.
**Why it happens:** Copy-paste error in original code.
**How to avoid:** Fix this when migrating the function to `queries/dashboard.ts` — use the already-resolved values from `Promise.all` rather than querying again.

---

## Code Examples

### crypto.ts — Dual-Key Decrypt

```typescript
// web/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = 'vendoos-token-encryption';

// Eager key cache — scrypt is intentionally slow
const _keys = new Map<string, Buffer>();

function deriveKey(envValue: string): Buffer {
  if (_keys.has(envValue)) return _keys.get(envValue)!;
  const key = crypto.scryptSync(envValue, SALT, 32);
  _keys.set(envValue, key);
  return key;
}

function getCurrentKey(): Buffer {
  const val = process.env.TOKEN_ENCRYPTION_KEY;
  if (!val) throw new Error('TOKEN_ENCRYPTION_KEY is required');
  return deriveKey(val);
}

function getPreviousKey(): Buffer | null {
  const val = process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
  return val ? deriveKey(val) : null;
}

export function encryptToken(plaintext: string): string {
  const key = getCurrentKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return 'v1:' + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptWithKey(payload: string, key: Buffer): string | null {
  try {
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}

export function decryptToken(ciphertext: string): string {
  const isV1 = ciphertext.startsWith('v1:');
  const payload = isV1 ? ciphertext.slice(3) : ciphertext;

  // Try current key first
  const result = decryptWithKey(payload, getCurrentKey());
  if (result !== null) return result;

  // Fall back to previous key (key rotation window)
  const prevKey = getPreviousKey();
  if (prevKey) {
    const fallback = decryptWithKey(payload, prevKey);
    if (fallback !== null) return fallback;
  }

  throw new Error('Token decryption failed — key may have rotated without migration');
}

// Exported for google-tokens.ts lazy migration check
export function isV0Token(ciphertext: string): boolean {
  return !ciphertext.startsWith('v1:');
}
```

### New Table DDL (libsql path)

```sql
-- skills
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY,
  drive_file_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  channel TEXT NOT NULL,        -- 'paid_social' | 'seo' | 'paid_ads'
  skill_type TEXT NOT NULL,
  drive_modified_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- skills FTS5 (Turso/libsql only — NOT sql.js)
CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  title,
  content,
  content='skills',
  tokenize='unicode61'
);

-- brand_hub
CREATE TABLE IF NOT EXISTS brand_hub (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  client_slug TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  drive_file_id TEXT,
  drive_modified_at TEXT,
  indexed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brand_hub_client ON brand_hub(client_id);

-- drive_watch_channels
CREATE TABLE IF NOT EXISTS drive_watch_channels (
  id INTEGER PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  expiration INTEGER NOT NULL,
  page_token TEXT,
  created_at TEXT NOT NULL,
  renewed_at TEXT
);

-- task_runs
CREATE TABLE IF NOT EXISTS task_runs (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sops_used TEXT,               -- JSON array of skill IDs
  brand_context_id INTEGER,
  output TEXT,
  qa_score REAL,
  qa_critique TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_runs_client ON task_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status);
CREATE INDEX IF NOT EXISTS idx_task_runs_created ON task_runs(created_at);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `queries.ts` monolith | Domain-split barrel pattern | Enables skills/brand modules to have clean homes without merge conflicts |
| Bare base64 encrypted tokens (v0) | `v1:` prefixed with key versioning | Key rotation no longer invalidates all existing tokens |
| Silent decrypt failure → 500 | Throw with message + admin visibility | Ops team can see who needs to reconnect Google without log-diving |

---

## Open Questions

1. **tsconfig.json module resolution**
   - What we know: The project uses ESM (`"type": "module"`) and imports use `.js` extensions
   - What's unclear: Whether `moduleResolution` is `node16`/`nodenext` or `bundler` — affects whether `queries.js` resolves to `queries/index.js`
   - Recommendation: Read `tsconfig.json` at the start of the plan execution task and verify before splitting; if `node` (legacy), update to `node16` or keep `queries.ts` as a thin re-export wrapper instead

2. **FTS5 in local sql.js path**
   - What we know: `sql.js` 1.11.0 ships FTS4, not FTS5
   - What's unclear: Whether `skills_fts` will ever be queried by scripts (vs only the web app)
   - Recommendation: Add `skills_fts` only to the libsql schema init. Document explicitly that local `db.ts` omits it. This is safe because all skills queries go through the web app, not scripts.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test framework installed |
| Config file | None — Wave 0 must create |
| Quick run command | `npx tsx --test web/lib/crypto.test.ts` (Node built-in test runner, no install needed) |
| Full suite command | `npx tsx --test web/lib/**/*.test.ts scripts/**/*.test.ts` |

No test framework (Jest, Vitest, etc.) is in `package.json`. The simplest zero-install option is Node's built-in `node:test` module, runnable via `tsx --test`. This avoids adding a devDependency for a phase that is largely mechanical refactoring.

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| INFR-01 | All existing query exports still resolve after split | smoke | `npx tsx --test web/lib/queries/index.test.ts` | Wave 0 |
| INFR-02 | All 5 new tables exist in schema after init | integration | `npx tsx --test scripts/utils/schema.test.ts` | Wave 0 |
| INFR-03a | v0 token decrypts correctly with current key | unit | `npx tsx --test web/lib/crypto.test.ts` | Wave 0 |
| INFR-03b | v1 token decrypts correctly | unit | (same file) | Wave 0 |
| INFR-03c | v0 token decrypts with previous key (rotation window) | unit | (same file) | Wave 0 |
| INFR-03d | Failed decrypt throws with clear message | unit | (same file) | Wave 0 |
| INFR-03e | encryptToken always produces `v1:` prefixed output | unit | (same file) | Wave 0 |
| INFR-03f | Admin users view includes google_connected column | manual | visual check in browser | N/A |

### Sampling Rate
- **Per task commit:** `npx tsx --test web/lib/crypto.test.ts` (for crypto tasks) or `npx tsx --test web/lib/queries/index.test.ts` (for split tasks)
- **Per wave merge:** Full suite: `npx tsx --test web/lib/**/*.test.ts`
- **Phase gate:** Full suite green + manual browser check of admin/users page before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/crypto.test.ts` — covers INFR-03a through INFR-03e
- [ ] `web/lib/queries/index.test.ts` — covers INFR-01 (import smoke test — does every previously-exported symbol still resolve?)
- [ ] `scripts/utils/schema.test.ts` — covers INFR-02 (init schema against in-memory libsql, assert table existence)

No framework install required — Node built-in `node:test` + `tsx --test`.

---

## Sources

### Primary (HIGH confidence)
- Direct source code read: `web/lib/crypto.ts` — full implementation, 40 lines
- Direct source code read: `web/lib/queries.ts` — full 750-line monolith, all exports catalogued
- Direct source code read: `web/lib/google-tokens.ts` — all decryptToken call sites identified
- Direct source code read: `web/routes/google-oauth.ts` — encryptToken / decryptToken call sites identified
- Direct source code read: `web/server.ts` — `{ db }` import confirmed on line 31
- Direct source code read: `scripts/utils/db.ts` — sql.js path, FTS4 confirmed, initSchema pattern
- Direct source code read: `web/routes/admin/users.ts` and `web/views/admin/users.eta` — admin display pattern confirmed
- Direct source code read: `package.json` — no test framework installed, tsx available

### Secondary (MEDIUM confidence)
- Node.js built-in `node:test` module — available since Node 18, works with `tsx --test`
- sql.js 1.11.0 FTS4-only: confirmed via package.json version + known sql.js limitation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, read directly from source
- Architecture: HIGH — all patterns derived from reading actual code, no assumptions
- Pitfalls: HIGH — pitfalls identified from actual code inspection (double-query bug in getSyncStatus is a concrete existing issue, not speculative)
- Schema DDL: HIGH — exact column specs taken verbatim from CONTEXT.md decisions

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack, no fast-moving dependencies)
